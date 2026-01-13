import axios from 'axios';
import { beforeEach, describe, expect, Mocked, test, vi } from 'vitest';
import { endpoints } from '../../types/generic/endpoints';
import { GetDocumentReviewDto, ReviewDetails, ReviewsResponse } from '../../types/generic/reviews';
import getReviews, { getReviewById, getReviewData } from './getReviews';
import { DOCUMENT_TYPE } from '../utils/documentType';
import { AuthHeaders } from '../../types/blocks/authHeaders';
import getMockResponses, { setupMockRequest } from '../test/getMockReviews';
import getDocumentSearchResults from './getDocumentSearchResults';
import getDocument from './getDocument';

vi.mock('axios');
vi.mock('../utils/isLocal', () => ({
    isLocal: false,
}));
vi.mock('../test/getMockReviews', () => ({
    default: vi.fn(),
    setupMockRequest: vi.fn(),
}));
vi.mock('./getDocumentSearchResults', () => ({
    default: vi.fn(),
}));
vi.mock('./getDocument', () => ({
    default: vi.fn(),
}));

const mockedAxios = axios as Mocked<typeof axios>;
const mockedGetMockResponses = getMockResponses as unknown as ReturnType<typeof vi.fn>;
const mockedSetupMockRequest = setupMockRequest as unknown as ReturnType<typeof vi.fn>;
const mockedGetDocumentSearchResults = getDocumentSearchResults as unknown as ReturnType<
    typeof vi.fn
>;
const mockedGetDocument = getDocument as unknown as ReturnType<typeof vi.fn>;

describe('getReviews', () => {
    const baseUrl = 'https://test-api.com';
    const baseHeaders: AuthHeaders = {
        'Content-Type': 'application/json',
    };
    const nhsNumber = '9000000001';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('successful responses', () => {
        test('handles a successful response with reviews', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [
                    {
                        id: '1',
                        nhsNumber: '9000000001',
                        documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
                        author: 'Y12345',
                        uploadDate: '2024-01-15',
                        reviewReason: 'Missing metadata',
                        version: '1',
                    },
                    {
                        id: '2',
                        nhsNumber: '9000000002',
                        documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
                        author: 'Y12345',
                        uploadDate: '2024-01-16',
                        reviewReason: 'Duplicate record',
                        version: '1',
                    },
                ],
                nextPageToken: '3',
                count: 2,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviews(baseUrl, baseHeaders, nhsNumber, '', 10);

            expect(result).toEqual(mockResponse);
            expect(result.documentReviewReferences).toHaveLength(2);
            expect(result.count).toBe(2);
            expect(result.nextPageToken).toBe('3');
        });

        test('handles an empty response with no reviews', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [],
                nextPageToken: '',
                count: 0,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviews(baseUrl, baseHeaders, nhsNumber, '', 10);

            expect(result).toEqual(mockResponse);
            expect(result.documentReviewReferences).toHaveLength(0);
            expect(result.count).toBe(0);
            expect(result.nextPageToken).toBe('');
        });

        test('handles pagination with nextPageToken', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [
                    {
                        id: '11',
                        nhsNumber: '9000000011',
                        documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
                        author: 'Y12345',
                        uploadDate: '2024-01-25',
                        reviewReason: 'Review needed',
                        version: '1',
                    },
                ],
                nextPageToken: '12',
                count: 1,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviews(baseUrl, baseHeaders, nhsNumber, '10', 1);

            expect(result).toEqual(mockResponse);
            expect(result.documentReviewReferences).toHaveLength(1);
            expect(result.nextPageToken).toBe('12');
        });
    });

    describe('URL construction', () => {
        test('constructs correct URL with all parameters', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [],
                nextPageToken: '',
                count: 0,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            await getReviews(baseUrl, baseHeaders, nhsNumber, 'startKey123', 20);

            const expectedUrl = `${baseUrl}${endpoints.DOCUMENT_REVIEW}?limit=20&startKey=startKey123&nhsNumber=${nhsNumber}`;

            expect(mockedAxios.get).toHaveBeenCalledWith(expectedUrl, {
                headers: baseHeaders,
            });
        });

        test('removes whitespace from NHS number', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [],
                nextPageToken: '',
                count: 0,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const nhsNumberWithSpaces = '900 000 0001';
            await getReviews(baseUrl, baseHeaders, nhsNumberWithSpaces, '', 10);

            const expectedUrl = `${baseUrl}${endpoints.DOCUMENT_REVIEW}?limit=10&startKey=&nhsNumber=9000000001`;

            expect(mockedAxios.get).toHaveBeenCalledWith(expectedUrl, {
                headers: baseHeaders,
            });
        });

        test('uses default limit of 10 when not provided', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [],
                nextPageToken: '',
                count: 0,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            await getReviews(baseUrl, baseHeaders, nhsNumber, '');

            const expectedUrl = `${baseUrl}${endpoints.DOCUMENT_REVIEW}?limit=10&startKey=&nhsNumber=${nhsNumber}`;

            expect(mockedAxios.get).toHaveBeenCalledWith(expectedUrl, {
                headers: baseHeaders,
            });
        });

        test('handles empty startKey parameter', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [],
                nextPageToken: '',
                count: 0,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            await getReviews(baseUrl, baseHeaders, nhsNumber, '', 5);

            const expectedUrl = `${baseUrl}${endpoints.DOCUMENT_REVIEW}?limit=5&startKey=&nhsNumber=${nhsNumber}`;

            expect(mockedAxios.get).toHaveBeenCalledWith(expectedUrl, {
                headers: baseHeaders,
            });
        });
    });

    describe('error handling', () => {
        test('handles 4XX client errors', async () => {
            const errorResponse = {
                status: 403,
                message: 'Forbidden',
            };

            mockedAxios.get.mockRejectedValue(errorResponse);

            await expect(getReviews(baseUrl, baseHeaders, nhsNumber, '', 10)).rejects.toEqual(
                errorResponse,
            );
        });

        test('handles 5XX server errors', async () => {
            const errorResponse = {
                status: 500,
                message: 'Internal Server Error',
            };

            mockedAxios.get.mockRejectedValue(errorResponse);

            await expect(getReviews(baseUrl, baseHeaders, nhsNumber, '', 10)).rejects.toEqual(
                errorResponse,
            );
        });

        test('handles network errors', async () => {
            const networkError = new Error('Network Error');

            mockedAxios.get.mockRejectedValue(networkError);

            await expect(getReviews(baseUrl, baseHeaders, nhsNumber, '', 10)).rejects.toThrow(
                'Network Error',
            );
        });

        test('handles 404 not found errors', async () => {
            const errorResponse = {
                status: 404,
                message: 'Not Found',
            };

            mockedAxios.get.mockRejectedValue(errorResponse);

            await expect(getReviews(baseUrl, baseHeaders, nhsNumber, '', 10)).rejects.toEqual(
                errorResponse,
            );
        });
    });

    describe('response data structure', () => {
        test('returns correct structure with all required fields', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [
                    {
                        id: '1',
                        nhsNumber: '9000000001',
                        documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
                        author: 'Y12345',
                        uploadDate: '2024-01-15',
                        reviewReason: 'Missing metadata',
                        version: '1',
                    },
                ],
                nextPageToken: '2',
                count: 1,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviews(baseUrl, baseHeaders, nhsNumber, '', 10);

            expect(result).toHaveProperty('documentReviewReferences');
            expect(result).toHaveProperty('nextPageToken');
            expect(result).toHaveProperty('count');
            expect(result.documentReviewReferences[0]).toHaveProperty('id');
            expect(result.documentReviewReferences[0]).toHaveProperty('nhsNumber');
            expect(result.documentReviewReferences[0]).toHaveProperty('documentSnomedCodeType');
            expect(result.documentReviewReferences[0]).toHaveProperty('author');
            expect(result.documentReviewReferences[0]).toHaveProperty('uploadDate');
            expect(result.documentReviewReferences[0]).toHaveProperty('reviewReason');
        });

        test('handles multiple review items with different data', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [
                    {
                        id: '1',
                        nhsNumber: '9000000001',
                        documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
                        author: 'Y12345',
                        uploadDate: '2024-01-15',
                        reviewReason: 'Missing metadata',
                        version: '1',
                    },
                    {
                        id: '2',
                        nhsNumber: '9000000002',
                        documentSnomedCodeType: '717391000000106' as DOCUMENT_TYPE,
                        author: 'Y67890',
                        uploadDate: '2024-02-20',
                        reviewReason: 'Invalid format',
                        version: '1',
                    },
                ],
                nextPageToken: '3',
                count: 2,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviews(baseUrl, baseHeaders, nhsNumber, '', 10);

            expect(result.documentReviewReferences).toHaveLength(2);
            expect(result.documentReviewReferences[0].author).toBe('Y12345');
            expect(result.documentReviewReferences[1].author).toBe('Y67890');
            expect(result.documentReviewReferences[0].documentSnomedCodeType).toBe(
                '16521000000101',
            );
            expect(result.documentReviewReferences[1].documentSnomedCodeType).toBe(
                '717391000000106',
            );
        });
    });

    describe('different limit values', () => {
        test('handles limit of 1', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [
                    {
                        id: '1',
                        nhsNumber: '9000000001',
                        documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
                        author: 'Y12345',
                        uploadDate: '2024-01-15',
                        reviewReason: 'Missing metadata',
                        version: '1',
                    },
                ],
                nextPageToken: '2',
                count: 1,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviews(baseUrl, baseHeaders, nhsNumber, '', 1);

            expect(result.count).toBe(1);
            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining('limit=1'),
                expect.objectContaining({ headers: baseHeaders }),
            );
        });

        test('handles large limit values', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [],
                nextPageToken: '',
                count: 0,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            await getReviews(baseUrl, baseHeaders, nhsNumber, '', 100);

            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining('limit=100'),
                expect.objectContaining({ headers: baseHeaders }),
            );
        });
    });

    describe('edge cases', () => {
        test('handles NHS number with multiple types of whitespace', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [],
                nextPageToken: '',
                count: 0,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const nhsNumberWithVariousSpaces = '900\t000\n0001';
            await getReviews(baseUrl, baseHeaders, nhsNumberWithVariousSpaces, '', 10);

            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining('nhsNumber=9000000001'),
                expect.objectContaining({ headers: baseHeaders }),
            );
        });

        test('handles special characters in startKey', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [],
                nextPageToken: '',
                count: 0,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const specialStartKey = 'key-with-dashes_and_underscores';
            await getReviews(baseUrl, baseHeaders, nhsNumber, specialStartKey, 10);

            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining(`startKey=${specialStartKey}`),
                expect.objectContaining({ headers: baseHeaders }),
            );
        });

        test('handles response with nextPageToken indicating more pages', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [
                    {
                        id: '1',
                        nhsNumber: '9000000001',
                        documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
                        author: 'Y12345',
                        uploadDate: '2024-01-15',
                        reviewReason: 'Missing metadata',
                        version: '1',
                    },
                ],
                nextPageToken: 'hasMorePages123',
                count: 1,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviews(baseUrl, baseHeaders, nhsNumber, '', 1);

            expect(result.nextPageToken).toBe('hasMorePages123');
            expect(result.nextPageToken).not.toBe('');
        });

        test('handles different SNOMED code types', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [
                    {
                        id: '1',
                        nhsNumber: '9000000001',
                        documentSnomedCodeType: '717391000000106' as DOCUMENT_TYPE,
                        author: 'Y12345',
                        uploadDate: '2024-01-15',
                        reviewReason: 'Review needed',
                        version: '1',
                    },
                ],
                nextPageToken: '',
                count: 1,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviews(baseUrl, baseHeaders, nhsNumber, '', 10);

            expect(result.documentReviewReferences[0].documentSnomedCodeType).toBe(
                '717391000000106',
            );
        });

        test('handles various review reasons', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [
                    {
                        id: '1',
                        nhsNumber: '9000000001',
                        documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
                        author: 'Y12345',
                        uploadDate: '2024-01-15',
                        reviewReason: 'Suspicious content',
                        version: '1',
                    },
                ],
                nextPageToken: '',
                count: 1,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviews(baseUrl, baseHeaders, nhsNumber, '', 10);

            expect(result.documentReviewReferences[0].reviewReason).toBe('Suspicious content');
        });
    });

    describe('API contract verification', () => {
        test('sends correct HTTP method (GET)', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [],
                nextPageToken: '',
                count: 0,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            await getReviews(baseUrl, baseHeaders, nhsNumber, '', 10);

            expect(mockedAxios.get).toHaveBeenCalledTimes(1);
            expect(mockedAxios.post).not.toHaveBeenCalled();
        });

        test('includes all required query parameters', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [],
                nextPageToken: '',
                count: 0,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            await getReviews(baseUrl, baseHeaders, nhsNumber, 'startKey', 20);

            const callUrl = mockedAxios.get.mock.calls[0][0];
            expect(callUrl).toContain('limit=');
            expect(callUrl).toContain('startKey=');
            expect(callUrl).toContain('nhsNumber=');
        });

        test('constructs correct endpoint path', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [],
                nextPageToken: '',
                count: 0,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            await getReviews(baseUrl, baseHeaders, nhsNumber, '', 10);

            const callUrl = mockedAxios.get.mock.calls[0][0];
            expect(callUrl).toContain(endpoints.DOCUMENT_REVIEW);
            expect(callUrl).toContain(baseUrl);
        });
    });

    describe('local development mode', () => {
        beforeEach(() => {
            vi.doMock('../utils/isLocal', () => ({
                isLocal: true,
            }));
        });

        test('uses mock responses when isLocal is true', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [
                    {
                        id: 'mock-1',
                        nhsNumber: '9000000001',
                        documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
                        author: 'Y12345',
                        uploadDate: '2024-01-15',
                        reviewReason: 'Mock review',
                        version: '1',
                    },
                ],
                nextPageToken: 'mock-next',
                count: 1,
            };

            mockedGetMockResponses.mockResolvedValue(mockResponse);

            vi.resetModules();
            vi.doMock('../utils/isLocal', () => ({
                isLocal: true,
            }));
            const { default: getReviewsLocal } = await import('./getReviews');

            const result = await getReviewsLocal(baseUrl, baseHeaders, nhsNumber, 'startKey', 10);

            expect(mockedSetupMockRequest).toHaveBeenCalled();
            expect(mockedGetMockResponses).toHaveBeenCalled();
            expect(result).toEqual(mockResponse);
            expect(mockedAxios.get).not.toHaveBeenCalled();

            vi.resetModules();
            vi.doMock('../utils/isLocal', () => ({
                isLocal: false,
            }));
        });

        test('calls setupMockRequest with correct params when isLocal is true', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [],
                nextPageToken: '',
                count: 0,
            };

            mockedGetMockResponses.mockResolvedValue(mockResponse);

            vi.resetModules();
            vi.doMock('../utils/isLocal', () => ({
                isLocal: true,
            }));
            const { default: getReviewsLocal } = await import('./getReviews');

            await getReviewsLocal(baseUrl, baseHeaders, nhsNumber, 'testKey', 20);

            expect(mockedSetupMockRequest).toHaveBeenCalled();
            const callParams = mockedSetupMockRequest.mock.calls[0][0] as URLSearchParams;
            expect(callParams.get('limit')).toBe('20');
            expect(callParams.get('startKey')).toBe('testKey');
            expect(callParams.get('nhsNumber')).toBe(nhsNumber);

            vi.resetModules();
            vi.doMock('../utils/isLocal', () => ({
                isLocal: false,
            }));
        });
    });
});

describe('getReviewById', () => {
    const baseUrl = 'https://test-api.com';
    const baseHeaders: AuthHeaders = {
        'Content-Type': 'application/json',
    };
    const reviewId = 'review-123';
    const versionNumber = '1';
    const nhsNumber = '9000000001';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('successful responses', () => {
        test('returns review details with files', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [
                    {
                        fileName: 'document_1.pdf',
                        presignedUrl: 'https://example.com/document_1.pdf',
                    },
                    {
                        fileName: 'document_2.pdf',
                        presignedUrl: 'https://example.com/document_2.pdf',
                    },
                ],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviewById(
                baseUrl,
                baseHeaders,
                reviewId,
                versionNumber,
                nhsNumber,
            );

            expect(result).toEqual(mockResponse);
            expect(result.id).toBe(reviewId);
            expect(result.files).toHaveLength(2);
            expect(result.files[0].fileName).toBe('document_1.pdf');
        });

        test('returns review details with single file', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.EHR,
                files: [
                    {
                        fileName: 'single_document.pdf',
                        presignedUrl: 'https://example.com/single_document.pdf',
                    },
                ],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviewById(
                baseUrl,
                baseHeaders,
                reviewId,
                versionNumber,
                nhsNumber,
            );

            expect(result.files).toHaveLength(1);
            expect(result.files[0].fileName).toBe('single_document.pdf');
        });

        test('returns review details with no files', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviewById(
                baseUrl,
                baseHeaders,
                reviewId,
                versionNumber,
                nhsNumber,
            );

            expect(result.files).toHaveLength(0);
        });

        test('handles different document types', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.EHR_ATTACHMENTS,
                files: [
                    {
                        fileName: 'attachment.pdf',
                        presignedUrl: 'https://example.com/attachment.pdf',
                    },
                ],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviewById(
                baseUrl,
                baseHeaders,
                reviewId,
                versionNumber,
                nhsNumber,
            );

            expect(result.documentSnomedCodeType).toBe(DOCUMENT_TYPE.EHR_ATTACHMENTS);
        });

        test('handles multiple files with different names', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [
                    {
                        fileName: 'page_001.pdf',
                        presignedUrl: 'https://example.com/page_001.pdf',
                    },
                    {
                        fileName: 'page_002.pdf',
                        presignedUrl: 'https://example.com/page_002.pdf',
                    },
                    {
                        fileName: 'page_003.pdf',
                        presignedUrl: 'https://example.com/page_003.pdf',
                    },
                ],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviewById(
                baseUrl,
                baseHeaders,
                reviewId,
                versionNumber,
                nhsNumber,
            );

            expect(result.files).toHaveLength(3);
            expect(result.files[0].fileName).toBe('page_001.pdf');
            expect(result.files[1].fileName).toBe('page_002.pdf');
            expect(result.files[2].fileName).toBe('page_003.pdf');
        });
    });

    describe('URL construction', () => {
        test('constructs correct URL with reviewId and version', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            await getReviewById(baseUrl, baseHeaders, reviewId, versionNumber, nhsNumber);

            const expectedUrl = `${baseUrl}${endpoints.DOCUMENT_REVIEW}/${reviewId}/${versionNumber}?patientId=${nhsNumber}`;

            expect(mockedAxios.get).toHaveBeenCalledWith(expectedUrl, {
                headers: baseHeaders,
            });
        });

        test('removes whitespace from NHS number in URL', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const nhsNumberWithSpaces = '900 000 0001';
            await getReviewById(baseUrl, baseHeaders, reviewId, versionNumber, nhsNumberWithSpaces);

            const expectedUrl = `${baseUrl}${endpoints.DOCUMENT_REVIEW}/${reviewId}/${versionNumber}?patientId=9000000001`;

            expect(mockedAxios.get).toHaveBeenCalledWith(expectedUrl, {
                headers: baseHeaders,
            });
        });

        test('handles NHS number with tabs and newlines', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const nhsNumberWithWhitespace = '900\t000\n0001';
            await getReviewById(
                baseUrl,
                baseHeaders,
                reviewId,
                versionNumber,
                nhsNumberWithWhitespace,
            );

            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining('patientId=9000000001'),
                expect.objectContaining({ headers: baseHeaders }),
            );
        });

        test('constructs URL with different version numbers', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            await getReviewById(baseUrl, baseHeaders, reviewId, '5', nhsNumber);

            const expectedUrl = `${baseUrl}${endpoints.DOCUMENT_REVIEW}/${reviewId}/5?patientId=${nhsNumber}`;

            expect(mockedAxios.get).toHaveBeenCalledWith(expectedUrl, {
                headers: baseHeaders,
            });
        });

        test('constructs URL with special characters in reviewId', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: 'review-with-dashes_123',
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const specialReviewId = 'review-with-dashes_123';
            await getReviewById(baseUrl, baseHeaders, specialReviewId, versionNumber, nhsNumber);

            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining(`/${specialReviewId}/`),
                expect.objectContaining({ headers: baseHeaders }),
            );
        });
    });

    describe('error handling', () => {
        test('handles 404 not found errors', async () => {
            const errorResponse = {
                status: 404,
                message: 'Review not found',
            };

            mockedAxios.get.mockRejectedValue(errorResponse);

            await expect(
                getReviewById(baseUrl, baseHeaders, reviewId, versionNumber, nhsNumber),
            ).rejects.toEqual(errorResponse);
        });

        test('handles 403 forbidden errors', async () => {
            const errorResponse = {
                status: 403,
                message: 'Forbidden',
            };

            mockedAxios.get.mockRejectedValue(errorResponse);

            await expect(
                getReviewById(baseUrl, baseHeaders, reviewId, versionNumber, nhsNumber),
            ).rejects.toEqual(errorResponse);
        });

        test('handles 500 server errors', async () => {
            const errorResponse = {
                status: 500,
                message: 'Internal Server Error',
            };

            mockedAxios.get.mockRejectedValue(errorResponse);

            await expect(
                getReviewById(baseUrl, baseHeaders, reviewId, versionNumber, nhsNumber),
            ).rejects.toEqual(errorResponse);
        });

        test('handles network errors', async () => {
            const networkError = new Error('Network Error');

            mockedAxios.get.mockRejectedValue(networkError);

            await expect(
                getReviewById(baseUrl, baseHeaders, reviewId, versionNumber, nhsNumber),
            ).rejects.toThrow('Network Error');
        });

        test('handles 401 unauthorized errors', async () => {
            const errorResponse = {
                status: 401,
                message: 'Unauthorized',
            };

            mockedAxios.get.mockRejectedValue(errorResponse);

            await expect(
                getReviewById(baseUrl, baseHeaders, reviewId, versionNumber, nhsNumber),
            ).rejects.toEqual(errorResponse);
        });
    });

    describe('response data structure', () => {
        test('returns response with all required fields', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [
                    {
                        fileName: 'document_1.pdf',
                        presignedUrl: 'https://example.com/document_1.pdf',
                    },
                ],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviewById(
                baseUrl,
                baseHeaders,
                reviewId,
                versionNumber,
                nhsNumber,
            );

            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('uploadDate');
            expect(result).toHaveProperty('documentSnomedCodeType');
            expect(result).toHaveProperty('files');
            expect(result.files[0]).toHaveProperty('fileName');
            expect(result.files[0]).toHaveProperty('presignedUrl');
        });

        test('verifies file object structure', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [
                    {
                        fileName: 'test_file.pdf',
                        presignedUrl: 'https://example.com/test_file.pdf',
                    },
                ],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviewById(
                baseUrl,
                baseHeaders,
                reviewId,
                versionNumber,
                nhsNumber,
            );

            expect(result.files[0].fileName).toBe('test_file.pdf');
            expect(result.files[0].presignedUrl).toBe('https://example.com/test_file.pdf');
        });

        test('handles various date formats in uploadDate', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '1705315800000',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviewById(
                baseUrl,
                baseHeaders,
                reviewId,
                versionNumber,
                nhsNumber,
            );

            expect(result.uploadDate).toBe('1705315800000');
        });
    });

    describe('API contract verification', () => {
        test('sends correct HTTP method (GET)', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            await getReviewById(baseUrl, baseHeaders, reviewId, versionNumber, nhsNumber);

            expect(mockedAxios.get).toHaveBeenCalledTimes(1);
            expect(mockedAxios.post).not.toHaveBeenCalled();
        });

        test('includes patientId query parameter', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            await getReviewById(baseUrl, baseHeaders, reviewId, versionNumber, nhsNumber);

            const callUrl = mockedAxios.get.mock.calls[0][0];
            expect(callUrl).toContain('patientId=');
        });

        test('includes correct endpoint path', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            await getReviewById(baseUrl, baseHeaders, reviewId, versionNumber, nhsNumber);

            const callUrl = mockedAxios.get.mock.calls[0][0];
            expect(callUrl).toContain(endpoints.DOCUMENT_REVIEW);
            expect(callUrl).toContain(baseUrl);
        });

        test('passes headers correctly', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [],
            };

            const customHeaders = {
                'Content-Type': 'application/json',
                Authorization: 'Bearer test-token',
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            await getReviewById(baseUrl, customHeaders, reviewId, versionNumber, nhsNumber);

            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ headers: customHeaders }),
            );
        });
    });

    describe('edge cases', () => {
        test('handles empty reviewId', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: '',
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviewById(baseUrl, baseHeaders, '', versionNumber, nhsNumber);

            expect(result.id).toBe('');
        });

        test('handles version number 0', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            await getReviewById(baseUrl, baseHeaders, reviewId, '0', nhsNumber);

            const callUrl = mockedAxios.get.mock.calls[0][0];
            expect(callUrl).toContain('/0?');
        });

        test('handles presigned URLs with query parameters', async () => {
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [
                    {
                        fileName: 'document.pdf',
                        presignedUrl:
                            'https://s3.amazonaws.com/bucket/document.pdf?AWSAccessKeyId=xxx&Expires=123456',
                    },
                ],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviewById(
                baseUrl,
                baseHeaders,
                reviewId,
                versionNumber,
                nhsNumber,
            );

            expect(result.files[0].presignedUrl).toContain('?AWSAccessKeyId=');
            expect(result.files[0].presignedUrl).toContain('Expires=');
        });

        test('handles very long file names', async () => {
            const longFileName = 'very_long_file_name_'.repeat(10) + '.pdf';
            const mockResponse: GetDocumentReviewDto = {
                id: reviewId,
                uploadDate: '2024-01-15T10:30:00Z',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [
                    {
                        fileName: longFileName,
                        presignedUrl: 'https://example.com/file.pdf',
                    },
                ],
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviewById(
                baseUrl,
                baseHeaders,
                reviewId,
                versionNumber,
                nhsNumber,
            );

            expect(result.files[0].fileName).toBe(longFileName);
        });
    });

    describe('local development mode', () => {
        test('returns mock data when isLocal is true', async () => {
            mockedGetMockResponses.mockResolvedValue({
                documentReviewReferences: [
                    {
                        id: reviewId,
                        nhsNumber: '9000000001',
                        documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                        author: 'Y12345',
                        uploadDate: '2024-01-15',
                        reviewReason: 'Test',
                        version: versionNumber,
                    },
                ],
                nextPageToken: '',
                count: 1,
            });

            vi.resetModules();
            vi.doMock('../utils/isLocal', () => ({
                isLocal: true,
            }));
            const { getReviewById: getReviewByIdLocal } = await import('./getReviews');

            const result = await getReviewByIdLocal(
                baseUrl,
                baseHeaders,
                reviewId,
                versionNumber,
                nhsNumber,
            );

            expect(result.id).toBe(reviewId);
            expect(result.documentSnomedCodeType).toBe(DOCUMENT_TYPE.LLOYD_GEORGE);
            expect(result.files).toHaveLength(2);
            expect(result.files[0].fileName).toBe('document_1.pdf');
            expect(result.files[0].presignedUrl).toBe('/dev/testFile.pdf');
            expect(mockedAxios.get).not.toHaveBeenCalled();

            vi.resetModules();
            vi.doMock('../utils/isLocal', () => ({
                isLocal: false,
            }));
        });

        test('returns mock data with default document type when review not found in mock', async () => {
            mockedGetMockResponses.mockResolvedValue({
                documentReviewReferences: [
                    {
                        id: 'different-id',
                        nhsNumber: '9000000001',
                        documentSnomedCodeType: DOCUMENT_TYPE.EHR,
                        author: 'Y12345',
                        uploadDate: '2024-01-15',
                        reviewReason: 'Test',
                        version: '1',
                    },
                ],
                nextPageToken: '',
                count: 1,
            });

            vi.resetModules();
            vi.doMock('../utils/isLocal', () => ({
                isLocal: true,
            }));
            const { getReviewById: getReviewByIdLocal } = await import('./getReviews');

            const result = await getReviewByIdLocal(
                baseUrl,
                baseHeaders,
                'non-existent-id',
                '2',
                nhsNumber,
            );

            expect(result.id).toBe('non-existent-id');
            expect(result.documentSnomedCodeType).toBe(DOCUMENT_TYPE.LLOYD_GEORGE);
            expect(result.files).toHaveLength(2);
            expect(mockedAxios.get).not.toHaveBeenCalled();

            vi.resetModules();
            vi.doMock('../utils/isLocal', () => ({
                isLocal: false,
            }));
        });

        test('uses document type from mock review when found', async () => {
            mockedGetMockResponses.mockResolvedValue({
                documentReviewReferences: [
                    {
                        id: reviewId,
                        nhsNumber: '9000000001',
                        documentSnomedCodeType: DOCUMENT_TYPE.EHR_ATTACHMENTS,
                        author: 'Y12345',
                        uploadDate: '2024-01-15',
                        reviewReason: 'Test',
                        version: versionNumber,
                    },
                ],
                nextPageToken: '',
                count: 1,
            });

            vi.resetModules();
            vi.doMock('../utils/isLocal', () => ({
                isLocal: true,
            }));
            const { getReviewById: getReviewByIdLocal } = await import('./getReviews');

            const result = await getReviewByIdLocal(
                baseUrl,
                baseHeaders,
                reviewId,
                versionNumber,
                nhsNumber,
            );

            expect(result.documentSnomedCodeType).toBe(DOCUMENT_TYPE.EHR_ATTACHMENTS);
            expect(mockedAxios.get).not.toHaveBeenCalled();

            vi.resetModules();
            vi.doMock('../utils/isLocal', () => ({
                isLocal: false,
            }));
        });

        test('matches review by both id and version', async () => {
            mockedGetMockResponses.mockResolvedValue({
                documentReviewReferences: [
                    {
                        id: reviewId,
                        nhsNumber: '9000000001',
                        documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                        author: 'Y12345',
                        uploadDate: '2024-01-15',
                        reviewReason: 'Test',
                        version: '1',
                    },
                    {
                        id: reviewId,
                        nhsNumber: '9000000001',
                        documentSnomedCodeType: DOCUMENT_TYPE.EHR,
                        author: 'Y12345',
                        uploadDate: '2024-01-15',
                        reviewReason: 'Test',
                        version: '2',
                    },
                ],
                nextPageToken: '',
                count: 2,
            });

            vi.resetModules();
            vi.doMock('../utils/isLocal', () => ({
                isLocal: true,
            }));
            const { getReviewById: getReviewByIdLocal } = await import('./getReviews');

            const result = await getReviewByIdLocal(baseUrl, baseHeaders, reviewId, '2', nhsNumber);

            expect(result.documentSnomedCodeType).toBe(DOCUMENT_TYPE.EHR);
            expect(mockedAxios.get).not.toHaveBeenCalled();

            vi.resetModules();
            vi.doMock('../utils/isLocal', () => ({
                isLocal: false,
            }));
        });
    });
});

describe('getReviewData', () => {
    const baseUrl = 'https://test-api.com';
    const baseHeaders: AuthHeaders = {
        'Content-Type': 'application/json',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('returns aborted when singleDocumentOnly and no existing documents found', async () => {
        const reviewData = new ReviewDetails(
            'review-1',
            DOCUMENT_TYPE.LLOYD_GEORGE,
            '2024-01-01',
            'uploader',
            '2024-01-01',
            'reason',
            '1',
            '9000000001',
        );

        mockedGetDocumentSearchResults.mockResolvedValue([]);

        const result = await getReviewData({ baseUrl, baseHeaders, reviewData });

        expect(result.aborted).toBe(true);
        expect(result.hasExistingRecordInStorage).toBe(false);
        expect(result.uploadDocuments).toHaveLength(0);
        expect(mockedGetDocument).not.toHaveBeenCalled();
        expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    test('does not fetch existing document when doc type is not singleDocumentOnly', async () => {
        const reviewData = new ReviewDetails(
            'review-2',
            DOCUMENT_TYPE.EHR,
            '2024-01-01',
            'uploader',
            '2024-01-01',
            'reason',
            '7',
            '9000000001',
        );

        const reviewDto: GetDocumentReviewDto = {
            id: 'review-2',
            uploadDate: '2024-01-01T10:00:00Z',
            documentSnomedCodeType: DOCUMENT_TYPE.EHR,
            files: [
                {
                    fileName: 'ehr.pdf',
                    presignedUrl: 'https://example.com/ehr.pdf',
                },
            ],
        };

        mockedAxios.get.mockImplementation((url) => {
            if (
                typeof url === 'string' &&
                url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-2/7`)
            ) {
                return Promise.resolve({ status: 200, data: reviewDto });
            }
            if (url === 'https://example.com/ehr.pdf') {
                return Promise.resolve({ status: 200, data: new Blob(['file']) });
            }
            return Promise.reject(new Error(`Unexpected url: ${String(url)}`));
        });

        const result = await getReviewData({ baseUrl, baseHeaders, reviewData });

        expect(result.aborted).toBe(false);
        expect(result.hasExistingRecordInStorage).toBe(false);
        expect(mockedGetDocumentSearchResults).not.toHaveBeenCalled();
        expect(mockedGetDocument).not.toHaveBeenCalled();

        expect(result.existingUploadDocuments).toHaveLength(0);
        expect(result.additionalFiles).toHaveLength(1);
        expect(result.uploadDocuments).toHaveLength(1);
        expect(result.uploadDocuments[0].type).toBe('REVIEW');
        expect(result.uploadDocuments[0].file.name).toBe('ehr.pdf');
        expect(result.uploadDocuments[0].file.type).toBe('application/pdf');
    });

    test('includes EXISTING doc and review docs when singleDocumentOnly and existing doc is found', async () => {
        const reviewData = new ReviewDetails(
            'review-3',
            DOCUMENT_TYPE.LLOYD_GEORGE,
            '2024-01-01',
            'uploader',
            '2024-01-01',
            'reason',
            '2',
            '9000000001',
        );

        mockedGetDocumentSearchResults.mockResolvedValue([
            {
                id: 'doc-123',
                fileName: 'existing.pdf',
                contentType: 'application/pdf',
                created: '2024-01-01T00:00:00Z',
                virusScannerResult: 'CLEAN',
                fileSize: 100,
                version: 'v1',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
            },
        ]);

        mockedGetDocument.mockResolvedValue({
            url: 'https://example.com/existing.pdf',
            contentType: 'application/pdf',
        });

        const reviewDto: GetDocumentReviewDto = {
            id: 'review-3',
            uploadDate: '2024-01-01T10:00:00Z',
            documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
            files: [
                {
                    fileName: 'review1.pdf',
                    presignedUrl: 'https://example.com/review1.pdf',
                },
            ],
        };

        mockedAxios.get.mockImplementation((url) => {
            if (
                typeof url === 'string' &&
                url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-3/2`)
            ) {
                return Promise.resolve({ status: 200, data: reviewDto });
            }
            if (url === 'https://example.com/existing.pdf') {
                return Promise.resolve({ status: 200, data: new Blob(['existing']) });
            }
            if (url === 'https://example.com/review1.pdf') {
                return Promise.resolve({ status: 200, data: new Blob(['review']) });
            }
            return Promise.reject(new Error(`Unexpected url: ${String(url)}`));
        });

        const result = await getReviewData({ baseUrl, baseHeaders, reviewData });

        expect(result.aborted).toBe(false);
        expect(result.hasExistingRecordInStorage).toBe(true);
        expect(result.uploadDocuments).toHaveLength(2);
        expect(result.existingUploadDocuments).toHaveLength(1);
        expect(result.additionalFiles).toHaveLength(1);

        expect(result.existingUploadDocuments[0].type).toBe('EXISTING');
        expect(result.existingUploadDocuments[0].file.name).toBe('existing.pdf');
        expect(result.existingUploadDocuments[0].versionId).toBe('v1');

        expect(result.additionalFiles[0].type).toBe('REVIEW');
        expect(result.additionalFiles[0].file.name).toBe('review1.pdf');
    });

    test('returns aborted when a review file is missing presignedUrl', async () => {
        const reviewData = new ReviewDetails(
            'review-4',
            DOCUMENT_TYPE.EHR,
            '2024-01-01',
            'uploader',
            '2024-01-01',
            'reason',
            '1',
            '9000000001',
        );

        const reviewDto = {
            id: 'review-4',
            uploadDate: '2024-01-01T10:00:00Z',
            documentSnomedCodeType: DOCUMENT_TYPE.EHR,
            files: [
                {
                    fileName: 'bad.pdf',
                    presignedUrl: '',
                },
            ],
        } as GetDocumentReviewDto;

        mockedAxios.get.mockResolvedValueOnce({ status: 200, data: reviewDto });

        const result = await getReviewData({ baseUrl, baseHeaders, reviewData });

        expect(result.aborted).toBe(true);
        expect(result.uploadDocuments).toHaveLength(0);
        expect(result.hasExistingRecordInStorage).toBe(false);
    });
});
