import axios from 'axios';
import { beforeEach, describe, expect, it, Mocked, vi } from 'vitest';
import { AuthHeaders } from '../../types/blocks/authHeaders';
import { Bundle } from '../../types/fhirR4/bundle';
import {
    DocumentReferenceStatus,
    FhirDocumentReference,
} from '../../types/fhirR4/documentReference';
import { endpoints } from '../../types/generic/endpoints';
import {
    GetDocumentVersionHistoryArgs,
    getDocumentVersionHistoryResponse,
} from './getDocumentVersionHistory';

vi.mock('axios');
vi.mock('../utils/isLocal', () => ({
    isLocal: false,
    isMock: (): boolean => false,
    isRunningInCypress: (): boolean => false,
}));
const mockedAxios = axios as Mocked<typeof axios>;

describe('getDocumentVersionHistoryResponse', () => {
    const mockArgs: GetDocumentVersionHistoryArgs = {
        nhsNumber: '1234567890',
        baseUrl: 'https://api.example.com',
        baseHeaders: { 'Content-Type': 'application/json', test: 'test' } as AuthHeaders,
        documentReferenceId: 'doc-ref-123',
    };

    const mockResponse: Bundle<FhirDocumentReference> = {
        resourceType: 'Bundle',
        type: 'history',
        total: 2,
        entry: [
            {
                fullUrl: 'urn:uuid:doc-ref-123',
                resource: {
                    resourceType: 'DocumentReference',
                    id: 'doc-ref-123',
                    meta: {
                        versionId: '2',
                        lastUpdated: '2025-12-15T10:30:00Z',
                    },
                    status: DocumentReferenceStatus.Current,
                    type: {
                        coding: [
                            {
                                system: 'http://snomed.info/sct',
                                code: '16521000000101',
                                display: 'Lloyd George record folder',
                            },
                        ],
                    },
                    subject: {
                        identifier: {
                            system: 'https://fhir.nhs.uk/Id/nhs-number',
                            value: '1234567890',
                        },
                    },
                    date: '2025-12-15T10:30:00Z',
                    custodian: {
                        identifier: {
                            system: 'https://fhir.nhs.uk/Id/ods-organization-code',
                            value: 'Y12345',
                        },
                        display: 'Y12345',
                    },
                    content: [
                        {
                            attachment: {
                                contentType: 'application/pdf',
                                size: 2048,
                                title: 'document_v2.pdf',
                                creation: '2025-12-15T10:30:00Z',
                            },
                        },
                    ],
                },
            },
            {
                fullUrl: 'urn:uuid:doc-ref-123',
                resource: {
                    resourceType: 'DocumentReference',
                    id: 'doc-ref-123',
                    meta: {
                        versionId: '1',
                        lastUpdated: '2025-10-01T09:00:00Z',
                    },
                    status: DocumentReferenceStatus.Superseded,
                    type: {
                        coding: [
                            {
                                system: 'http://snomed.info/sct',
                                code: '16521000000101',
                                display: 'Lloyd George record folder',
                            },
                        ],
                    },
                    subject: {
                        identifier: {
                            system: 'https://fhir.nhs.uk/Id/nhs-number',
                            value: '1234567890',
                        },
                    },
                    date: '2025-10-01T09:00:00Z',
                    custodian: {
                        identifier: {
                            system: 'https://fhir.nhs.uk/Id/ods-organization-code',
                            value: 'A12345',
                        },
                        display: 'A12345',
                    },
                    content: [
                        {
                            attachment: {
                                contentType: 'application/pdf',
                                size: 1024,
                                title: 'document_v1.pdf',
                                creation: '2025-10-01T09:00:00Z',
                            },
                        },
                    ],
                },
            },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully fetch document version history and return response', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

        const result = await getDocumentVersionHistoryResponse(mockArgs);

        expect(mockedAxios.get).toHaveBeenCalledWith(
            `${mockArgs.baseUrl}${endpoints.DOCUMENT_REFERENCE}/${mockArgs.documentReferenceId}/_history`,
            {
                headers: mockArgs.baseHeaders,
                params: {
                    patientId: mockArgs.nhsNumber,
                },
            },
        );
        expect(result).toEqual(mockResponse);
    });

    it('should throw AxiosError when request fails', async () => {
        const mockError = new Error('Network Error');
        mockedAxios.get.mockRejectedValueOnce(mockError);

        await expect(getDocumentVersionHistoryResponse(mockArgs)).rejects.toThrow(mockError);
    });

    it('should construct correct URL with documentReferenceId and _history suffix', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

        await getDocumentVersionHistoryResponse(mockArgs);

        expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.stringContaining(`/${mockArgs.documentReferenceId}/_history`),
            expect.any(Object),
        );
    });

    it('should pass correct parameters including patientId', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

        await getDocumentVersionHistoryResponse(mockArgs);

        expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                params: {
                    patientId: mockArgs.nhsNumber,
                },
            }),
        );
    });

    it('should return response with correct bundle structure', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

        const result = await getDocumentVersionHistoryResponse(mockArgs);

        expect(result.resourceType).toBe('Bundle');
        expect(result.type).toBe('history');
        expect(result.total).toBe(2);
        expect(result.entry).toHaveLength(2);
    });

    describe('when isLocal is true', () => {
        beforeEach(async () => {
            vi.resetModules();
            vi.doMock('../utils/isLocal', () => ({
                isLocal: true,
                isMock: (): boolean => false,
                isRunningInCypress: (): boolean => false,
            }));
            vi.doMock('axios', () => ({
                default: {
                    get: vi.fn().mockRejectedValue(new Error('Network Error')),
                },
            }));
        });

        it('should return mock entries ordered by version descending', async () => {
            const { getDocumentVersionHistoryResponse: fn } =
                await import('./getDocumentVersionHistory');

            const localArgs = {
                ...mockArgs,
                documentReferenceId: 'mock-document-id-1',
            };

            const result = await fn(localArgs);

            const versions = result.entry!.map((e) => e.resource.meta?.versionId);
            expect(versions).toEqual(['2', '4', '1', '5', '3']);
        });
    });
});
