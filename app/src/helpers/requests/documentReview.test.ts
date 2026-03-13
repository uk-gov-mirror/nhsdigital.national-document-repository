import { describe, it, expect, vi, beforeEach, afterEach, Mocked } from 'vitest';
import axios from 'axios';
import { uploadDocumentForReview, getDocumentReviewStatus } from './documentReview';
import { AuthHeaders } from '../../types/blocks/authHeaders';
import { DOCUMENT_UPLOAD_STATE, UploadDocument } from '../../types/pages/UploadDocumentsPage/types';
import { endpoints } from '../../types/generic/endpoints';
import { DOCUMENT_TYPE } from '../utils/documentType';

vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;
(mockedAxios.get as any) = vi.fn();

describe('documentReview', () => {
    const mockAuthHeaders: AuthHeaders = {
        authorization: 'Bearer token',
        'Content-Type': 'string',
    };

    const mockDocument: UploadDocument = {
        id: 'doc-123',
        versionId: 'v1',
        docType: DOCUMENT_TYPE.LLOYD_GEORGE,
        file: { name: 'test-document.pdf' } as File,
        state: DOCUMENT_UPLOAD_STATE.UPLOADING,
    };

    const mockArgs = {
        document: mockDocument,
        nhsNumber: '1234567890',
        baseUrl: 'https://api.example.com',
        baseHeaders: mockAuthHeaders,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('uploadDocumentForReview', () => {
        it('should successfully upload document for review', async () => {
            const mockResponse = { data: { reviewId: 'review-123', status: 'pending' } };
            mockedAxios.post.mockResolvedValue(mockResponse);

            const result = await uploadDocumentForReview(mockArgs);

            expect(mockedAxios.post).toHaveBeenCalledWith(
                `${mockArgs.baseUrl}${endpoints.DOCUMENT_REVIEW}`,
                JSON.stringify({
                    nhsNumber: mockArgs.nhsNumber,
                    snomedCode: mockArgs.document.docType,
                    documents: [mockArgs.document.file.name],
                }),
                {
                    headers: mockAuthHeaders,
                    params: {
                        patientId: mockArgs.nhsNumber,
                    },
                },
            );
            expect(result).toEqual(mockResponse.data);
        });

        it('should throw error when request fails', async () => {
            const mockError = new Error('Network error');
            mockedAxios.post.mockRejectedValue(mockError);

            await expect(uploadDocumentForReview(mockArgs)).rejects.toThrow('Network error');
        });
    });

    describe('getDocumentReviewStatus', () => {
        it('should successfully get document review status', async () => {
            const mockResponse = { data: { status: 'completed', result: 'approved' } };
            mockedAxios.get.mockResolvedValue(mockResponse);

            const result = await getDocumentReviewStatus(mockArgs);

            expect(mockedAxios.get).toHaveBeenCalledWith(
                `${mockArgs.baseUrl}${endpoints.DOCUMENT_REVIEW}/${mockArgs.document.id}/${mockArgs.document.versionId}/Status`,
                {
                    headers: mockAuthHeaders,
                    params: {
                        patientId: mockArgs.nhsNumber,
                    },
                },
            );
            expect(result).toEqual(mockResponse.data);
        });

        it('should throw error when status request fails', async () => {
            const mockError = new Error('Status fetch failed');
            mockedAxios.get.mockRejectedValue(mockError);

            await expect(getDocumentReviewStatus(mockArgs)).rejects.toThrow('Status fetch failed');
        });
    });
});
