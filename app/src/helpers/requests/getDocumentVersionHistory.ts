import axios, { AxiosError } from 'axios';
import { AuthHeaders } from '../../types/blocks/authHeaders';
import { Bundle } from '../../types/fhirR4/bundle';
import { FhirDocumentReference } from '../../types/fhirR4/documentReference';
import { endpoints } from '../../types/generic/endpoints';
import { mockDocumentVersionHistoryResponse } from '../test/getMockVersionHistory';
import { isLocal } from '../utils/isLocal';

export type { FhirDocumentReference as DocumentReference } from '../../types/fhirR4/documentReference';

export type GetDocumentVersionHistoryArgs = {
    nhsNumber: string;
    baseUrl: string;
    baseHeaders: AuthHeaders;
    documentReferenceId: string;
};

export const getDocumentVersionHistoryResponse = async ({
    nhsNumber,
    baseUrl,
    baseHeaders,
    documentReferenceId,
}: GetDocumentVersionHistoryArgs): Promise<Bundle<FhirDocumentReference>> => {
    const gatewayUrl = baseUrl + endpoints.DOCUMENT_REFERENCE + `/${documentReferenceId}/_history`;

    try {
        const { data } = await axios.get<Bundle<FhirDocumentReference>>(gatewayUrl, {
            headers: {
                ...baseHeaders,
            },
            params: {
                patientId: nhsNumber,
            },
        });

        return data;
    } catch (e) {
        if (isLocal) {
            return mockDocumentVersionHistoryResponse;
        }
        const error = e as AxiosError;
        throw error;
    }
};
