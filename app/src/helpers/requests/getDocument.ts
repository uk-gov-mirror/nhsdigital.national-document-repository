import { AuthHeaders } from '../../types/blocks/authHeaders';
import { endpoints } from '../../types/generic/endpoints';
import axios, { AxiosError } from 'axios';

type Args = {
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
}: Args): Promise<GetDocumentResponse> => {
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
