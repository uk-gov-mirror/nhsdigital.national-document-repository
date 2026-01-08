import { PatientDetails } from '../../types/generic/patientDetails';
import {
    DOCUMENT_STATUS,
    DOCUMENT_UPLOAD_STATE,
    UploadDocument,
} from '../../types/pages/UploadDocumentsPage/types';
import uploadDocuments, { generateStitchedFileName } from '../requests/uploadDocuments';
import { DOCUMENT_TYPE, DOCUMENT_TYPE_CONFIG } from './documentType';
import { v4 as uuidv4 } from 'uuid';
import { zipFiles } from './zip';
import { isLocal } from './isLocal';
import { buildMockUploadSession } from '../test/testBuilders';
import { DocumentStatusResult, UploadSession } from '../../types/generic/uploadResult';
import { AuthHeaders } from '../../types/blocks/authHeaders';
import {
    DocumentReviewDto,
    DocumentReviewStatus,
    DocumentReviewStatusDto,
} from '../../types/blocks/documentReview';
import { uploadDocumentForReview } from '../requests/documentReview';
import { Dispatch, SetStateAction } from 'react';

export const reduceDocumentsForUpload = async (
    documents: UploadDocument[],
    documentConfig: DOCUMENT_TYPE_CONFIG,
    mergedPdfBlob: Blob,
    patientDetails: PatientDetails,
    versionId: string,
): Promise<UploadDocument[]> => {
    if (documentConfig.stitched) {
        const filename = generateStitchedFileName(patientDetails, documentConfig);
        documents = [
            {
                id: uuidv4(),
                file: new File([mergedPdfBlob], filename, { type: 'application/pdf' }),
                state: DOCUMENT_UPLOAD_STATE.SELECTED,
                progress: 0,
                docType: documentConfig.snomedCode as DOCUMENT_TYPE,
                attempts: 0,
                versionId: versionId,
            },
        ];
    }

    if (documentConfig.multifileZipped) {
        const filename = `${documentConfig.zippedFilename}_(${documents.length}).zip`;

        const zip = await zipFiles(documents);

        documents = [
            {
                id: uuidv4(),
                file: new File([zip], filename, {
                    type: 'application/zip',
                }),
                state: DOCUMENT_UPLOAD_STATE.SELECTED,
                progress: 0,
                docType: documentConfig.snomedCode as DOCUMENT_TYPE,
                attempts: 0,
                versionId,
            },
        ];
    }

    return documents;
};

export const getUploadSession = async (
    patientDetails: PatientDetails,
    baseUrl: string,
    baseHeaders: AuthHeaders,
    existingDocuments: UploadDocument[],
    documents: UploadDocument[],
    setDocuments: Dispatch<SetStateAction<UploadDocument[]>>,
): Promise<UploadSession> => {
    if (isLocal) {
        return buildMockUploadSession(documents);
    }

    if (patientDetails?.canManageRecord) {
        return await uploadDocuments({
            nhsNumber: patientDetails.nhsNumber,
            documents: documents,
            baseUrl,
            baseHeaders,
            documentReferenceId: existingDocuments[0]?.id,
        });
    }

    return await getUploadSessionForReview(
        patientDetails,
        baseUrl,
        baseHeaders,
        documents,
        setDocuments,
    );
};

const getUploadSessionForReview = async (
    patientDetails: PatientDetails,
    baseUrl: string,
    baseHeaders: AuthHeaders,
    documents: UploadDocument[],
    setDocuments: Dispatch<SetStateAction<UploadDocument[]>>,
): Promise<UploadSession> => {
    const uploadSession: UploadSession = {};
    const requests: Promise<DocumentReviewDto>[] = [];

    const reviewDocs = documents.map((document) => {
        const documentReview = uploadDocumentForReview({
            nhsNumber: patientDetails.nhsNumber,
            document,
            baseUrl,
            baseHeaders,
        });

        documentReview.then((review: DocumentReviewDto) => {
            document.id = review.id;
            document.versionId = review.version;
            uploadSession[review.id] = {
                url: review.files[0].presignedUrl,
            };
        });

        requests.push(documentReview);

        return document;
    });

    await Promise.all(requests);

    setDocuments(reviewDocs);

    return uploadSession;
};

export const handleDocStatusResult = (
    documentStatusResult: DocumentStatusResult,
    setDocuments: Dispatch<SetStateAction<UploadDocument[]>>,
): void => {
    setDocuments((previousState) =>
        previousState.map((doc) => {
            const docStatus = documentStatusResult[doc.ref!];

            const updatedDoc = {
                ...doc,
            };

            switch (docStatus?.status) {
                case DOCUMENT_STATUS.FINAL:
                    updatedDoc.state = DOCUMENT_UPLOAD_STATE.SUCCEEDED;
                    break;

                case DOCUMENT_STATUS.INFECTED:
                    updatedDoc.state = DOCUMENT_UPLOAD_STATE.INFECTED;
                    break;

                case DOCUMENT_STATUS.NOT_FOUND:
                case DOCUMENT_STATUS.CANCELLED:
                    updatedDoc.state = DOCUMENT_UPLOAD_STATE.ERROR;
                    updatedDoc.errorCode = docStatus.error_code;
                    break;
            }

            return updatedDoc;
        }),
    );
};

export const handleDocReviewStatusResult = (
    result: DocumentReviewStatusDto,
    setDocuments: Dispatch<SetStateAction<UploadDocument[]>>,
): void => {
    setDocuments((previousState) =>
        previousState.map((doc) => {
            if (doc.id !== result.id) {
                return doc;
            }

            const updatedDoc = {
                ...doc,
            };

            switch (result.reviewStatus) {
                case DocumentReviewStatus.PENDING_REVIEW:
                    updatedDoc.state = DOCUMENT_UPLOAD_STATE.SUCCEEDED;
                    break;

                case DocumentReviewStatus.VIRUS_SCAN_FAILED:
                    updatedDoc.state = DOCUMENT_UPLOAD_STATE.INFECTED;
                    break;

                case DocumentReviewStatus.REVIEW_PENDING_UPLOAD:
                    updatedDoc.state = DOCUMENT_UPLOAD_STATE.SCANNING;
                    break;

                default:
                    updatedDoc.state = DOCUMENT_UPLOAD_STATE.ERROR;
                    updatedDoc.errorCode = result.reviewReason;
                    break;
            }

            return updatedDoc;
        }),
    );
};
