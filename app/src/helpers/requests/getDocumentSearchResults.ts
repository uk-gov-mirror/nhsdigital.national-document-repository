import { AuthHeaders } from '../../types/blocks/authHeaders';
import { endpoints } from '../../types/generic/endpoints';
import { SearchResult } from '../../types/generic/searchResult';

import axios, { AxiosError } from 'axios';
import { DOCUMENT_TYPE } from '../utils/documentType';
import { isLocal } from '../utils/isLocal';

export type DocumentSearchResultsArgs = {
    nhsNumber: string;
    baseUrl: string;
    baseHeaders: AuthHeaders;
    docType?: DOCUMENT_TYPE;
};

export type GetDocumentSearchResultsResponse = {
    references: Array<SearchResult>;
};

const getDocumentSearchResults = async ({
    nhsNumber,
    baseUrl,
    baseHeaders,
    docType,
}: DocumentSearchResultsArgs): Promise<Array<SearchResult>> => {
    const gatewayUrl = baseUrl + endpoints.DOCUMENT_SEARCH;

    try {
        const { data } = await axios.get<GetDocumentSearchResultsResponse>(gatewayUrl, {
            headers: {
                ...baseHeaders,
            },
            params: {
                patientId: nhsNumber?.replaceAll(/\s/g, ''), // replace whitespace
                docType: docType === DOCUMENT_TYPE.ALL ? undefined : docType,
                limit: 9999,
            },
        });
        return data.references;
    } catch (e) {
        if (isLocal) {
            return [
                {
                    fileName: 'document_1.pdf',
                    created: '2023-01-01T12:00:00Z',
                    virusScannerResult: 'CLEAN',
                    author: 'Y12345',
                    id: 'mock-document-id-1',
                    fileSize: 1024,
                    version: '1.0',
                    documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                    contentType: 'application/pdf',
                },
            ];
        }
        const error = e as AxiosError;
        throw error;
    }
};

export default getDocumentSearchResults;
