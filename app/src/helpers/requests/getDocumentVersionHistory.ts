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

        for (const entry of data.entry ?? []) {
            if (entry.resource.id?.includes('~')) {
                entry.resource.id = entry.resource.id.split('~')[1];
            }
        }

        return data;
    } catch (e) {
        if (
            isLocal &&
            (documentReferenceId === 'mock-document-id-1' ||
                documentReferenceId === 'e7b1d94f-3c62-4a87-b5e0-8f2d1a6c9340')
        ) {
            return mockDocumentVersionHistoryResponse;
        }
        const error = e as AxiosError;
        throw error;
    }
};
