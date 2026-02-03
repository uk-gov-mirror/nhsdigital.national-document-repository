import { PatientDetails } from '../../types/generic/patientDetails';
import {
    DOCUMENT_STATUS,
    DOCUMENT_UPLOAD_STATE,
    UploadDocument,
} from '../../types/pages/UploadDocumentsPage/types';
import uploadDocuments, {
    generateStitchedFileName,
    getDocumentStatus,
} from '../requests/uploadDocuments';
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
import { getDocumentReviewStatus, uploadDocumentForReview } from '../requests/documentReview';
import { Dispatch, RefObject, SetStateAction } from 'react';

export const reduceDocumentsForUpload = async (
    documents: UploadDocument[],
    documentConfig: DOCUMENT_TYPE_CONFIG,
    mergedPdfBlob: Blob,
    patientDetails: PatientDetails,
    versionId: string,
): Promise<UploadDocument[]> => {
    if (documents.length === 0) {
        return [];
    }

    if (documentConfig.stitched) {
        const filename = generateStitchedFileName(patientDetails, documentConfig);
        documents = [
            {
                id: uuidv4(),
                file: new File([mergedPdfBlob], filename, { type: 'application/pdf' }),
                state: DOCUMENT_UPLOAD_STATE.SELECTED,
                progress: 0,
                docType: documentConfig.snomedCode,
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
                docType: documentConfig.snomedCode,
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

export const startIntervalTimer = (
    uploadDocuments: Array<UploadDocument>,
    interval: RefObject<number>,
    documents: Array<UploadDocument>,
    setDocuments: Dispatch<SetStateAction<UploadDocument[]>>,
    patientDetails: PatientDetails | null,
    baseUrl: string,
    baseHeaders: AuthHeaders,
    nhsNumber: string,
    timeout: number,
): number => {
    return window.setInterval(async () => {
        interval.current = interval.current + 1;
        try {
            if (isLocal) {
                const updatedDocuments = uploadDocuments.map((doc) => {
                    const min = (doc.progress ?? 0) + 40;
                    const max = 70;
                    doc.progress = Math.random() * (min + max - (min + 1)) + min;
                    doc.progress = Math.min(doc.progress, 100);
                    if (doc.progress < 100) {
                        doc.state = DOCUMENT_UPLOAD_STATE.UPLOADING;
                    } else if (doc.state !== DOCUMENT_UPLOAD_STATE.SCANNING) {
                        const hasVirusFile = documents.filter(
                            (d) => d.file.name.toLocaleLowerCase() === 'virus.pdf',
                        );

                        if (hasVirusFile.length > 0) {
                            doc.state = DOCUMENT_UPLOAD_STATE.INFECTED;
                        } else if (doc.file.name.toLocaleLowerCase() === 'virus-failed.pdf') {
                            doc.state = DOCUMENT_UPLOAD_STATE.ERROR;
                        } else {
                            doc.state = DOCUMENT_UPLOAD_STATE.SUCCEEDED;
                        }
                    }

                    return doc;
                });
                setDocuments(updatedDocuments);
            } else if (patientDetails?.canManageRecord) {
                const documentStatusResult = await getDocumentStatus({
                    documents: uploadDocuments,
                    baseUrl,
                    baseHeaders,
                    nhsNumber,
                });

                handleDocStatusResult(documentStatusResult, setDocuments);
            } else {
                uploadDocuments.forEach(async (document) => {
                    void getDocumentReviewStatus({
                        document,
                        baseUrl,
                        baseHeaders,
                        nhsNumber,
                    }).then((result) => handleDocReviewStatusResult(result, setDocuments));
                });
            }
        } catch {}
    }, timeout);
};

export const goToNextDocType = (
    documentTypeList: DOCUMENT_TYPE[],
    documentType: DOCUMENT_TYPE,
    setShowSkipLink: React.Dispatch<React.SetStateAction<boolean | undefined>>,
    setDocumentType: React.Dispatch<React.SetStateAction<DOCUMENT_TYPE>>,
    documents: UploadDocument[],
): void => {
    const nextDocTypeIndex = documentTypeList.indexOf(documentType) + 1;
    if (nextDocTypeIndex > documentTypeList.length - 1) {
        return;
    }

    setShowSkipLink(
        nextDocTypeIndex < documentTypeList.length - 1 ||
            documents.some((doc) => doc.docType === documentType),
    );
    setDocumentType(documentTypeList[nextDocTypeIndex]);
};

export const goToPreviousDocType = (
    documentTypeList: DOCUMENT_TYPE[],
    documentType: DOCUMENT_TYPE,
    setShowSkipLink: React.Dispatch<React.SetStateAction<boolean | undefined>>,
    setDocumentType: React.Dispatch<React.SetStateAction<DOCUMENT_TYPE>>,
): void => {
    const previousDocTypeIndex = documentTypeList.indexOf(documentType) - 1;
    if (previousDocTypeIndex < 0) {
        return;
    }

    setShowSkipLink(true);
    setDocumentType(documentTypeList[previousDocTypeIndex]);
};
