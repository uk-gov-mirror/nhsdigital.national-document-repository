import { AuthHeaders } from '../../types/blocks/authHeaders';
import { endpoints } from '../../types/generic/endpoints';
import axios, { AxiosError } from 'axios';
import { isLocal } from '../utils/isLocal';

export type GetDocumentArgs = {
    nhsNumber: string;
    baseUrl: string;
    baseHeaders: AuthHeaders;
    documentId: string;
};

export type GetDocumentResponse = {
    url: string;
    contentType: string;
};

const getDocument = async ({
    nhsNumber,
    baseUrl,
    baseHeaders,
    documentId,
}: GetDocumentArgs): Promise<GetDocumentResponse> => {
    if (isLocal) {
        return {
            url: '/dev/testFile.pdf',
            contentType: 'application/pdf',
        };
    }

    const gatewayUrl = baseUrl + endpoints.DOCUMENT_REFERENCE + `/${documentId}`;

    try {
        const { data } = await axios.get<GetDocumentResponse>(gatewayUrl, {
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

export default getDocument;
