import { describe, it, expect, vi, beforeEach, Mocked } from 'vitest';
import axios from 'axios';
import getDocument, { GetDocumentResponse } from './getDocument';
import { AuthHeaders } from '../../types/blocks/authHeaders';
import { endpoints } from '../../types/generic/endpoints';

vi.mock('axios');
vi.mock('../utils/isLocal', () => ({
    isLocal: false,
    isMock: (): boolean => false,
    isRunningInCypress: (): boolean => false,
}));
const mockedAxios = axios as Mocked<typeof axios>;

describe('getDocument', () => {
    const mockArgs = {
        nhsNumber: '1234567890',
        baseUrl: 'https://api.example.com',
        baseHeaders: { 'Content-Type': 'application/json', test: 'test' } as AuthHeaders,
        documentId: 'doc-123',
    };

    const mockResponse: GetDocumentResponse = {
        url: 'https://example.com/document.pdf',
        contentType: 'application/pdf',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully fetch document and return response', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

        const result = await getDocument(mockArgs);

        expect(mockedAxios.get).toHaveBeenCalledWith(
            `${mockArgs.baseUrl}${endpoints.DOCUMENT_REFERENCE}/${mockArgs.documentId}`,
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

        await expect(getDocument(mockArgs)).rejects.toThrow(mockError);
    });

    it('should construct correct URL with documentId', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

        await getDocument(mockArgs);

        expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.stringContaining(`/${mockArgs.documentId}`),
            expect.any(Object),
        );
    });

    it('should pass correct parameters including patientId', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

        await getDocument(mockArgs);

        expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                params: {
                    patientId: mockArgs.nhsNumber,
                },
            }),
        );
    });

    describe('when isLocal is true', () => {
        beforeEach(async () => {
            vi.resetModules();
            vi.doMock('../utils/isLocal', () => ({
                isLocal: true,
                isMock: (): boolean => false,
                isRunningInCypress: (): boolean => false,
            }));
        });

        it('should return local test file without making API call', async () => {
            const getDocumentModule = await import('./getDocument');
            const result = await getDocumentModule.default(mockArgs);

            expect(result).toEqual({
                url: '/dev/testFile.pdf',
                contentType: 'application/pdf',
            });
            expect(mockedAxios.get).not.toHaveBeenCalled();
        });
    });
});
