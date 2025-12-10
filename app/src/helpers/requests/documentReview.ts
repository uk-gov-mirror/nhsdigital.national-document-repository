import { AuthHeaders } from '../../types/blocks/authHeaders';
import { endpoints } from '../../types/generic/endpoints';
import { UploadDocument } from '../../types/pages/UploadDocumentsPage/types';

import axios, { AxiosError } from 'axios';
import { DocumentReviewDto, DocumentReviewStatusDto } from '../../types/blocks/documentReview';

type DocumentReviewArgs = {
    document: UploadDocument;
    nhsNumber: string;
    baseUrl: string;
    baseHeaders: AuthHeaders;
};

export const uploadDocumentForReview = async ({
    nhsNumber,
    document,
    baseUrl,
    baseHeaders,
}: DocumentReviewArgs): Promise<DocumentReviewDto> => {
    const requestBody = {
        nhsNumber,
        snomedCode: document.docType,
        documents: [document.file.name],
    };

    const gatewayUrl = baseUrl + endpoints.DOCUMENT_REVIEW;

    try {
        const { data } = await axios.post<DocumentReviewDto>(gatewayUrl, JSON.stringify(requestBody), {
            headers: {
                ...baseHeaders,
            },
            params: {
                patientId: nhsNumber,
            },
        });

        return data;
    } catch (e) {
        const error = e as AxiosError;
        throw error;
    }
};

export const getDocumentReviewStatus = async ({
    document,
    baseUrl,
    baseHeaders,
    nhsNumber,
}: DocumentReviewArgs): Promise<DocumentReviewStatusDto> => {
    const documentStatusUrl = `${baseUrl}${endpoints.DOCUMENT_REVIEW}/${document.id}/${document.versionId}/Status`;

    try {
        const { data } = await axios.get<DocumentReviewStatusDto>(documentStatusUrl, {
            headers: {
                ...baseHeaders,
            },
            params: {
                patientId: nhsNumber,
            },
        });

        return data;
    } catch (e) {
        const error = e as AxiosError;
        throw error;
    }
};
