import axios from 'axios';
import { AuthHeaders } from '../../types/blocks/authHeaders';
import { DOCUMENT_TYPE } from '../utils/documentType';

type Args = {
    documentId?: string;
    docType?: DOCUMENT_TYPE;
    nhsNumber: string;
    baseUrl: string;
    baseHeaders: AuthHeaders;
};

export type DeleteResponse = {
    data: string;
    status: number;
};
const deleteAllDocuments = async ({
    documentId,
    docType,
    nhsNumber,
    baseUrl,
    baseHeaders,
}: Args): Promise<DeleteResponse> => {
    const gatewayUrl = baseUrl + '/DocumentDelete';

    try {
        const response: DeleteResponse = await axios.delete(gatewayUrl, {
            headers: {
                ...baseHeaders,
            },
            params: {
                patientId: nhsNumber,
                docType,
                documentId,
            },
        });
        return response;
    } catch (e) {
        throw e;
    }
};

export default deleteAllDocuments;
