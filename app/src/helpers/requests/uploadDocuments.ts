import { AuthHeaders } from '../../types/blocks/authHeaders';
import { endpoints } from '../../types/generic/endpoints';
import { DOCUMENT_UPLOAD_STATE, UploadDocument } from '../../types/pages/UploadDocumentsPage/types';

import axios, { AxiosError } from 'axios';
import { DocumentStatusResult, S3Upload, UploadSession } from '../../types/generic/uploadResult';
import { Dispatch, SetStateAction } from 'react';
import { extractUploadSession, setSingleDocument } from '../utils/uploadDocumentHelpers';
import { PatientDetails } from '../../types/generic/patientDetails';
import { formatDateWithDashes } from '../utils/formatDate';
import { DOCUMENT_TYPE_CONFIG } from '../utils/documentType';

type UploadDocumentsArgs = {
    documents: UploadDocument[];
    nhsNumber: string;
    baseUrl: string;
    baseHeaders: AuthHeaders;
    documentReferenceId?: string | undefined;
    snomedCode?: string | undefined;
};

type UploadDocumentsToS3Args = {
    setDocuments: Dispatch<SetStateAction<UploadDocument[]>>;
    document: UploadDocument;
    uploadSession: UploadSession;
};

export const uploadDocumentToS3 = async ({
    setDocuments,
    uploadSession,
    document,
}: UploadDocumentsToS3Args): Promise<void> => {
    const documentMetadata: S3Upload = uploadSession[document.id];
    const s3url = documentMetadata.url;
    const axiosMethod = Object.keys(documentMetadata).includes('fields') ? axios.post : axios.put;
    try {
        return await axiosMethod(s3url, document.file, {
            headers: {
                'Content-Type': document.file.type,
            },
            onUploadProgress: (progress): void => {
                const { loaded, total } = progress;
                if (total) {
                    setSingleDocument(setDocuments, {
                        id: document.id,
                        state:
                            total >= 100
                                ? DOCUMENT_UPLOAD_STATE.SCANNING
                                : DOCUMENT_UPLOAD_STATE.UPLOADING,
                        progress: (loaded / total) * 100,
                    });
                }
            },
        });
    } catch (e) {
        const error = e as AxiosError;
        throw error;
    }
};

export const generateStitchedFileName = (
    patientDetails: PatientDetails | null,
    documentConfig: DOCUMENT_TYPE_CONFIG,
): string => {
    if (!patientDetails) {
        throw new Error('Patient details are required to generate filename');
    }

    // replace commas and other characters unfriendly characters to file paths
    const givenName = patientDetails.givenName.join(' ').replace(/[,/\\?%*:|"<>]/g, '-');
    const filename = `${documentConfig.stitchedFilenamePrefix}_[${givenName} ${patientDetails.familyName.toUpperCase()}]_[${patientDetails.nhsNumber}]_[${formatDateWithDashes(new Date(patientDetails.birthDate))}].pdf`;
    return filename;
};

const uploadDocuments = async ({
    nhsNumber,
    documents,
    baseUrl,
    baseHeaders,
    documentReferenceId,
    snomedCode,
}: UploadDocumentsArgs): Promise<UploadSession> => {
    const attachments = documents.map((doc) => ({
        fileName: doc.file.name,
        contentType: doc.file.type,
        docType: doc.docType,
        clientId: doc.id,
        versionId: doc.versionId,
    }));
    const requestBody = {
        resourceType: 'DocumentReference',
        subject: {
            identifier: {
                system: 'https://fhir.nhs.uk/Id/nhs-number',
                value: nhsNumber,
            },
        },
        type: {
            coding: [
                {
                    system: 'http://snomed.info/sct',
                    code: snomedCode ?? '22151000087106',
                },
            ],
        },
        content: [
            {
                attachment: documentReferenceId ? attachments[0] : attachments,
            },
        ],
        created: new Date(Date.now()).toISOString(),
    };

    const gatewayUrl =
        baseUrl +
        endpoints.DOCUMENT_REFERENCE +
        (documentReferenceId ? `/${documentReferenceId}` : '');

    try {
        const axiosMethod = documentReferenceId ? axios.put : axios.post;
        const { data } = await axiosMethod(gatewayUrl, JSON.stringify(requestBody), {
            headers: {
                ...baseHeaders,
            },
            params: {
                patientId: nhsNumber,
            },
        });

        return extractUploadSession(data);
    } catch (e) {
        const error = e as AxiosError;
        throw error;
    }
};

export const getDocumentStatus = async ({
    documents,
    baseUrl,
    baseHeaders,
    nhsNumber,
}: UploadDocumentsArgs): Promise<DocumentStatusResult> => {
    const documentStatusUrl = baseUrl + endpoints.DOCUMENT_STATUS;

    try {
        const { data } = await axios.get<DocumentStatusResult>(documentStatusUrl, {
            headers: {
                ...baseHeaders,
            },
            params: {
                patientId: nhsNumber,
                docIds: documents.map((d) => d.ref).join(','),
            },
        });

        return data;
    } catch (e) {
        const error = e as AxiosError;
        throw error;
    }
};

export default uploadDocuments;
