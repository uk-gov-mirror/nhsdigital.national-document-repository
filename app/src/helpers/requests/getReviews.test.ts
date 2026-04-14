import axios from 'axios';
import { afterEach, beforeEach, describe, expect, Mocked, test, vi } from 'vitest';
import { endpoints } from '../../types/generic/endpoints';
import { GetDocumentReviewDto, ReviewDetails, ReviewsResponse } from '../../types/generic/reviews';
import getReviews, { getReviewById, getReviewData } from './getReviews';
import { AuthHeaders } from '../../types/blocks/authHeaders';
import getMockResponses, { setupMockRequest } from '../test/getMockReviews';
import getDocumentSearchResults from './getDocumentSearchResults';
import getDocument from './getDocument';
import { DOCUMENT_UPLOAD_STATE } from '../../types/pages/UploadDocumentsPage/types';
import * as documentTypeModule from '../utils/documentType';

const mockIsLocal = vi.hoisted(() => ({ value: false }));

vi.mock('axios');
vi.mock('../utils/isLocal', () => ({
    get isLocal() {
        return mockIsLocal.value;
    },
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
describe('getReviews.ts', () => {
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
                            documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                            author: 'Y12345',
                            uploadDate: '2024-01-15',
                            reviewReason: 'Missing metadata',
                            version: '1',
                        },
                        {
                            id: '2',
                            nhsNumber: '9000000002',
                            documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
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
                            documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
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

                const expectedUrl = `${baseUrl}${endpoints.DOCUMENT_REVIEW}?limit=20&nextPageToken=startKey123&nhsNumber=${nhsNumber}`;

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

                const expectedUrl = `${baseUrl}${endpoints.DOCUMENT_REVIEW}?limit=10&nextPageToken=&nhsNumber=9000000001`;

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

                const expectedUrl = `${baseUrl}${endpoints.DOCUMENT_REVIEW}?limit=10&nextPageToken=&nhsNumber=${nhsNumber}`;

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

                const expectedUrl = `${baseUrl}${endpoints.DOCUMENT_REVIEW}?limit=5&nextPageToken=&nhsNumber=${nhsNumber}`;

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
                            documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
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
                            documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                            author: 'Y12345',
                            uploadDate: '2024-01-15',
                            reviewReason: 'Missing metadata',
                            version: '1',
                        },
                        {
                            id: '2',
                            nhsNumber: '9000000002',
                            documentSnomedCodeType:
                                '717391000000106' as documentTypeModule.DOCUMENT_TYPE,
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
                            documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
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
                    expect.stringContaining(`nextPageToken=${specialStartKey}`),
                    expect.objectContaining({ headers: baseHeaders }),
                );
            });

            test('handles response with nextPageToken indicating more pages', async () => {
                const mockResponse: ReviewsResponse = {
                    documentReviewReferences: [
                        {
                            id: '1',
                            nhsNumber: '9000000001',
                            documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
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
                            documentSnomedCodeType:
                                '717391000000106' as documentTypeModule.DOCUMENT_TYPE,
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
                            documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
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
                expect(callUrl).toContain('nextPageToken=');
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
                mockIsLocal.value = true;
            });

            afterEach(() => {
                mockIsLocal.value = false;
            });

            test('uses mock responses when isLocal is true', async () => {
                const mockResponse: ReviewsResponse = {
                    documentReviewReferences: [
                        {
                            id: 'mock-1',
                            nhsNumber: '9000000001',
                            documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
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

                const result = await getReviews(baseUrl, baseHeaders, nhsNumber, 'startKey', 10);

                expect(mockedSetupMockRequest).toHaveBeenCalled();
                expect(mockedGetMockResponses).toHaveBeenCalled();
                expect(result).toEqual(mockResponse);
                expect(mockedAxios.get).not.toHaveBeenCalled();
            });

            test('calls setupMockRequest with correct params when isLocal is true', async () => {
                const mockResponse: ReviewsResponse = {
                    documentReviewReferences: [],
                    nextPageToken: '',
                    count: 0,
                };

                mockedGetMockResponses.mockResolvedValue(mockResponse);

                await getReviews(baseUrl, baseHeaders, nhsNumber, 'testKey', 20);

                expect(mockedSetupMockRequest).toHaveBeenCalled();
                const callParams = mockedSetupMockRequest.mock.calls[0][0] as URLSearchParams;
                expect(callParams.get('limit')).toBe('20');
                expect(callParams.get('nextPageToken')).toBe('testKey');
                expect(callParams.get('nhsNumber')).toBe(nhsNumber);
            });

            test('does not call axios when isLocal is true', async () => {
                const mockResponse: ReviewsResponse = {
                    documentReviewReferences: [],
                    nextPageToken: '',
                    count: 0,
                };

                mockedGetMockResponses.mockResolvedValue(mockResponse);

                await getReviews(baseUrl, baseHeaders, nhsNumber, '', 10);

                expect(mockedAxios.get).not.toHaveBeenCalled();
                expect(mockedGetMockResponses).toHaveBeenCalledTimes(1);
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

        describe('URL construction', () => {
            test('constructs correct URL with reviewId and versionNumber in path', async () => {
                const mockResponse: GetDocumentReviewDto = {
                    id: reviewId,
                    uploadDate: '2024-01-15T10:00:00Z',
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                    files: [
                        {
                            fileName: 'document_1.pdf',
                            presignedUrl: 'https://example.com/presigned',
                        },
                    ],
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

            test('removes whitespace from NHS number in query params', async () => {
                const mockResponse: GetDocumentReviewDto = {
                    id: reviewId,
                    uploadDate: '2024-01-15T10:00:00Z',
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                    files: [],
                };

                mockedAxios.get.mockResolvedValue({
                    status: 200,
                    data: mockResponse,
                });

                const nhsNumberWithSpaces = '900 000 0001';
                await getReviewById(
                    baseUrl,
                    baseHeaders,
                    reviewId,
                    versionNumber,
                    nhsNumberWithSpaces,
                );

                const expectedUrl = `${baseUrl}${endpoints.DOCUMENT_REVIEW}/${reviewId}/${versionNumber}?patientId=9000000001`;

                expect(mockedAxios.get).toHaveBeenCalledWith(expectedUrl, {
                    headers: baseHeaders,
                });
            });

            test('removes tabs and newlines from NHS number', async () => {
                const mockResponse: GetDocumentReviewDto = {
                    id: reviewId,
                    uploadDate: '2024-01-15T10:00:00Z',
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                    files: [],
                };

                mockedAxios.get.mockResolvedValue({
                    status: 200,
                    data: mockResponse,
                });

                const nhsNumberWithVariousSpaces = '900\t000\n0001';
                await getReviewById(
                    baseUrl,
                    baseHeaders,
                    reviewId,
                    versionNumber,
                    nhsNumberWithVariousSpaces,
                );

                expect(mockedAxios.get).toHaveBeenCalledWith(
                    expect.stringContaining('patientId=9000000001'),
                    expect.anything(),
                );
            });

            test('handles different version numbers in URL path', async () => {
                const mockResponse: GetDocumentReviewDto = {
                    id: reviewId,
                    uploadDate: '2024-01-15T10:00:00Z',
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
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
        });

        describe('successful responses', () => {
            test('returns review data with a single file', async () => {
                const mockResponse: GetDocumentReviewDto = {
                    id: reviewId,
                    uploadDate: '2024-01-15T10:00:00Z',
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                    files: [
                        {
                            fileName: 'document_1.pdf',
                            presignedUrl: 'https://example.com/presigned-1',
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
                expect(result.files).toHaveLength(1);
                expect(result.files[0].fileName).toBe('document_1.pdf');
                expect(result.files[0].presignedUrl).toBe('https://example.com/presigned-1');
            });

            test('returns review data with multiple files', async () => {
                const mockResponse: GetDocumentReviewDto = {
                    id: reviewId,
                    uploadDate: '2024-01-15T10:00:00Z',
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                    files: [
                        {
                            fileName: 'document_1.pdf',
                            presignedUrl: 'https://example.com/presigned-1',
                        },
                        {
                            fileName: 'document_2.pdf',
                            presignedUrl: 'https://example.com/presigned-2',
                        },
                        {
                            fileName: 'document_3.pdf',
                            presignedUrl: 'https://example.com/presigned-3',
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
                expect(result.files[0].fileName).toBe('document_1.pdf');
                expect(result.files[1].fileName).toBe('document_2.pdf');
                expect(result.files[2].fileName).toBe('document_3.pdf');
            });

            test('returns review data with an empty files array', async () => {
                const mockResponse: GetDocumentReviewDto = {
                    id: reviewId,
                    uploadDate: '2024-01-15T10:00:00Z',
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
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

            test('returns correct documentSnomedCodeType', async () => {
                const mockResponse: GetDocumentReviewDto = {
                    id: reviewId,
                    uploadDate: '2024-01-15T10:00:00Z',
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.EHR,
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

                expect(result.documentSnomedCodeType).toBe(documentTypeModule.DOCUMENT_TYPE.EHR);
            });

            test('returns correct uploadDate', async () => {
                const mockResponse: GetDocumentReviewDto = {
                    id: reviewId,
                    uploadDate: '1765539858673',
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
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

                expect(result.uploadDate).toBe('1765539858673');
            });
        });

        describe('response data structure', () => {
            test('returns object with all required fields', async () => {
                const mockResponse: GetDocumentReviewDto = {
                    id: reviewId,
                    uploadDate: '2024-01-15T10:00:00Z',
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                    files: [
                        {
                            fileName: 'doc.pdf',
                            presignedUrl: 'https://example.com/presigned',
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
            });

            test('each file has fileName and presignedUrl', async () => {
                const mockResponse: GetDocumentReviewDto = {
                    id: reviewId,
                    uploadDate: '2024-01-15T10:00:00Z',
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                    files: [
                        {
                            fileName: 'file1.pdf',
                            presignedUrl: 'https://example.com/url1',
                        },
                        {
                            fileName: 'file2.zip',
                            presignedUrl: 'https://example.com/url2',
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

                result.files.forEach((file) => {
                    expect(file).toHaveProperty('fileName');
                    expect(file).toHaveProperty('presignedUrl');
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

                await expect(
                    getReviewById(baseUrl, baseHeaders, reviewId, versionNumber, nhsNumber),
                ).rejects.toEqual(errorResponse);
            });

            test('handles 5XX server errors', async () => {
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

            test('handles 404 not found errors', async () => {
                const errorResponse = {
                    status: 404,
                    message: 'Not Found',
                };

                mockedAxios.get.mockRejectedValue(errorResponse);

                await expect(
                    getReviewById(baseUrl, baseHeaders, reviewId, versionNumber, nhsNumber),
                ).rejects.toEqual(errorResponse);
            });
        });

        describe('headers', () => {
            test('passes all base headers to axios request', async () => {
                const customHeaders: AuthHeaders = {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer test-token',
                };

                const mockResponse: GetDocumentReviewDto = {
                    id: reviewId,
                    uploadDate: '2024-01-15T10:00:00Z',
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                    files: [],
                };

                mockedAxios.get.mockResolvedValue({
                    status: 200,
                    data: mockResponse,
                });

                await getReviewById(baseUrl, customHeaders, reviewId, versionNumber, nhsNumber);

                expect(mockedAxios.get).toHaveBeenCalledWith(expect.any(String), {
                    headers: customHeaders,
                });
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

        test('does not fetch existing document when doc type is not singleDocumentOnly and NHS number is unknown', async () => {
            const reviewData = new ReviewDetails(
                'review-2',
                documentTypeModule.DOCUMENT_TYPE.EHR,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '7',
                '0000000000', // NHS_NUMBER_UNKNOWN
            );

            const reviewDto: GetDocumentReviewDto = {
                id: 'review-2',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.EHR,
                files: [
                    {
                        fileName: 'ehr.pdf',
                        presignedUrl: 'https://example.com/ehr.pdf',
                    },
                ],
            };

            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-2/7`)) {
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

        test('does not fetch existing document when doc type is singleDocumentOnly and NHS number is unknown', async () => {
            const reviewData = new ReviewDetails(
                'review-2',
                documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '7',
                '0000000000', // NHS_NUMBER_UNKNOWN
            );

            const reviewDto: GetDocumentReviewDto = {
                id: 'review-2',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [
                    {
                        fileName: 'ehr.pdf',
                        presignedUrl: 'https://example.com/ehr.pdf',
                    },
                ],
            };

            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-2/7`)) {
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
                documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
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
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                },
            ]);

            mockedGetDocument.mockResolvedValue({
                url: 'https://example.com/existing.pdf',
                contentType: 'application/pdf',
            });

            const reviewDto: GetDocumentReviewDto = {
                id: 'review-3',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [
                    {
                        fileName: 'review1.pdf',
                        presignedUrl: 'https://example.com/review1.pdf',
                    },
                ],
            };

            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-3/2`)) {
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
                documentTypeModule.DOCUMENT_TYPE.EHR,
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
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.EHR,
                files: [
                    {
                        fileName: 'bad.pdf',
                        presignedUrl: '',
                    },
                ],
            } as GetDocumentReviewDto;

            mockedGetDocumentSearchResults.mockResolvedValue([]);
            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-4/1`)) {
                    return Promise.resolve({ status: 200, data: reviewDto });
                }
                return Promise.reject(new Error(`Unexpected url: ${String(url)}`));
            });

            const result = await getReviewData({ baseUrl, baseHeaders, reviewData });

            expect(result.aborted).toBe(true);
            expect(result.uploadDocuments).toHaveLength(0);
            expect(result.hasExistingRecordInStorage).toBe(false);
        });

        test('handles multiple review files correctly', async () => {
            const reviewData = new ReviewDetails(
                'review-5',
                documentTypeModule.DOCUMENT_TYPE.EHR,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9000000001',
            );

            const reviewDto: GetDocumentReviewDto = {
                id: 'review-5',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.EHR,
                files: [
                    {
                        fileName: 'file1.pdf',
                        presignedUrl: 'https://example.com/file1.pdf',
                    },
                    {
                        fileName: 'file2.pdf',
                        presignedUrl: 'https://example.com/file2.pdf',
                    },
                    {
                        fileName: 'file3.pdf',
                        presignedUrl: 'https://example.com/file3.pdf',
                    },
                ],
            };

            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-5/1`)) {
                    return Promise.resolve({ status: 200, data: reviewDto });
                }
                if (url.startsWith('https://example.com/')) {
                    return Promise.resolve({ status: 200, data: new Blob(['file']) });
                }
                return Promise.reject(new Error(`Unexpected url: ${String(url)}`));
            });

            mockedGetDocumentSearchResults.mockResolvedValue([]);
            const result = await getReviewData({ baseUrl, baseHeaders, reviewData });

            expect(result.aborted).toBe(false);
            expect(result.uploadDocuments).toHaveLength(3);
            expect(result.additionalFiles).toHaveLength(3);
            expect(result.uploadDocuments.every((doc) => doc.type === 'REVIEW')).toBe(true);
            expect(result.uploadDocuments[0].file.name).toBe('file1.pdf');
            expect(result.uploadDocuments[1].file.name).toBe('file2.pdf');
            expect(result.uploadDocuments[2].file.name).toBe('file3.pdf');
        });

        test('handles different file types based on extension', async () => {
            const reviewData = new ReviewDetails(
                'review-6',
                documentTypeModule.DOCUMENT_TYPE.EHR,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9000000001',
            );

            const reviewDto: GetDocumentReviewDto = {
                id: 'review-6',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.EHR,
                files: [
                    {
                        fileName: 'document.pdf',
                        presignedUrl: 'https://example.com/document.pdf',
                    },
                    {
                        fileName: 'image.jpg',
                        presignedUrl: 'https://example.com/image.jpg',
                    },
                    {
                        fileName: 'archive.zip',
                        presignedUrl: 'https://example.com/archive.zip',
                    },
                ],
            };

            mockedGetDocumentSearchResults.mockResolvedValue([]);
            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-6/1`)) {
                    return Promise.resolve({ status: 200, data: reviewDto });
                }
                if (url.startsWith('https://example.com/')) {
                    return Promise.resolve({ status: 200, data: new Blob(['file']) });
                }
                return Promise.reject(new Error(`Unexpected url: ${String(url)}`));
            });

            const result = await getReviewData({ baseUrl, baseHeaders, reviewData });

            expect(result.uploadDocuments).toHaveLength(3);
            expect(result.uploadDocuments[0].file.name).toBe('document.pdf');
            expect(result.uploadDocuments[1].file.name).toBe('image.jpg');
            expect(result.uploadDocuments[2].file.name).toBe('archive.zip');
        });

        test('handles files without extension', async () => {
            const reviewData = new ReviewDetails(
                'review-7',
                documentTypeModule.DOCUMENT_TYPE.EHR,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9000000001',
            );

            const reviewDto: GetDocumentReviewDto = {
                id: 'review-7',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.EHR,
                files: [
                    {
                        fileName: 'documentwithoutextension',
                        presignedUrl: 'https://example.com/file',
                    },
                ],
            };

            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-7/1`)) {
                    return Promise.resolve({ status: 200, data: reviewDto });
                }
                if (url.startsWith('https://example.com/')) {
                    return Promise.resolve({ status: 200, data: new Blob(['file']) });
                }
                return Promise.reject(new Error(`Unexpected url: ${String(url)}`));
            });

            mockedGetDocumentSearchResults.mockResolvedValue([]);
            const result = await getReviewData({ baseUrl, baseHeaders, reviewData });

            expect(result.uploadDocuments).toHaveLength(1);
            expect(result.uploadDocuments[0].file.name).toBe('documentwithoutextension');
        });

        test('calls addReviewFiles on reviewData with correct data', async () => {
            const reviewData = new ReviewDetails(
                'review-8',
                documentTypeModule.DOCUMENT_TYPE.EHR,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9000000001',
            );

            const addReviewFilesSpy = vi.spyOn(reviewData, 'addReviewFiles');

            const reviewDto: GetDocumentReviewDto = {
                id: 'review-8',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.EHR,
                files: [
                    {
                        fileName: 'test.pdf',
                        presignedUrl: 'https://example.com/test.pdf',
                    },
                ],
            };

            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-8/1`)) {
                    return Promise.resolve({ status: 200, data: reviewDto });
                }
                if (url.startsWith('https://example.com/')) {
                    return Promise.resolve({ status: 200, data: new Blob(['file']) });
                }
                return Promise.reject(new Error(`Unexpected url: ${String(url)}`));
            });

            mockedGetDocumentSearchResults.mockResolvedValue([]);
            await getReviewData({ baseUrl, baseHeaders, reviewData });

            expect(addReviewFilesSpy).toHaveBeenCalledWith(reviewDto);
            expect(addReviewFilesSpy).toHaveBeenCalledTimes(1);
        });

        test('handles error when getReviewById fails', async () => {
            const reviewData = new ReviewDetails(
                'review-9',
                documentTypeModule.DOCUMENT_TYPE.EHR,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9000000001',
            );

            mockedGetDocumentSearchResults.mockResolvedValue([]);
            mockedAxios.get.mockRejectedValue(new Error('Network error'));

            await expect(getReviewData({ baseUrl, baseHeaders, reviewData })).rejects.toThrow(
                'Network error',
            );
        });

        test('handles error when fetching blob fails', async () => {
            const reviewData = new ReviewDetails(
                'review-10',
                documentTypeModule.DOCUMENT_TYPE.EHR,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9000000001',
            );

            const reviewDto: GetDocumentReviewDto = {
                id: 'review-10',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.EHR,
                files: [
                    {
                        fileName: 'test.pdf',
                        presignedUrl: 'https://example.com/test.pdf',
                    },
                ],
            };

            mockedGetDocumentSearchResults.mockResolvedValue([]);
            mockedAxios.get.mockImplementation((url: string) => {
                if (url.includes('/document-review/')) {
                    return Promise.resolve({ status: 200, data: reviewDto });
                }
                return Promise.reject(new Error('Blob fetch failed'));
            });

            await expect(getReviewData({ baseUrl, baseHeaders, reviewData })).rejects.toThrow(
                'Blob fetch failed',
            );
        });

        test('handles error when getDocumentSearchResults fails', async () => {
            const reviewData = new ReviewDetails(
                'review-11',
                documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9000000001',
            );

            mockedGetDocumentSearchResults.mockRejectedValue(new Error('Search failed'));

            await expect(getReviewData({ baseUrl, baseHeaders, reviewData })).rejects.toThrow(
                'Search failed',
            );
        });

        test('handles error when getDocument fails for existing document', async () => {
            const reviewData = new ReviewDetails(
                'review-12',
                documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
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
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                },
            ]);

            mockedGetDocument.mockRejectedValue(new Error('Document fetch failed'));

            await expect(getReviewData({ baseUrl, baseHeaders, reviewData })).rejects.toThrow(
                'Document fetch failed',
            );
        });

        test('sets all required properties on upload documents', async () => {
            const reviewData = new ReviewDetails(
                'review-13',
                documentTypeModule.DOCUMENT_TYPE.EHR,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9000000001',
            );

            const reviewDto: GetDocumentReviewDto = {
                id: 'review-13',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.EHR,
                files: [
                    {
                        fileName: 'test.pdf',
                        presignedUrl: 'https://example.com/test.pdf',
                    },
                ],
            };

            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-13/1`)) {
                    return Promise.resolve({ status: 200, data: reviewDto });
                }
                if (url.startsWith('https://example.com/')) {
                    return Promise.resolve({ status: 200, data: new Blob(['file']) });
                }
                return Promise.reject(new Error(`Unexpected url: ${String(url)}`));
            });

            mockedGetDocumentSearchResults.mockResolvedValue([]);
            const result = await getReviewData({ baseUrl, baseHeaders, reviewData });

            const doc = result.uploadDocuments[0];
            expect(doc).toHaveProperty('type', 'REVIEW');
            expect(doc).toHaveProperty('id');
            expect(doc).toHaveProperty('file');
            expect(doc).toHaveProperty('blob');
            expect(doc).toHaveProperty('state', DOCUMENT_UPLOAD_STATE.SELECTED);
            expect(doc).toHaveProperty('progress', 0);
            expect(doc).toHaveProperty('docType', documentTypeModule.DOCUMENT_TYPE.EHR);
            expect(doc).toHaveProperty('numPages', undefined);
            expect(doc).toHaveProperty('validated', false);
            expect(doc).not.toHaveProperty('versionId');
        });

        test('sets versionId on existing documents', async () => {
            const reviewData = new ReviewDetails(
                'review-14',
                documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9000000001',
            );

            mockedGetDocumentSearchResults.mockResolvedValue([
                {
                    id: 'doc-existing',
                    fileName: 'existing.pdf',
                    contentType: 'application/pdf',
                    created: '2024-01-01T00:00:00Z',
                    virusScannerResult: 'CLEAN',
                    fileSize: 100,
                    version: 'v2',
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                },
            ]);

            mockedGetDocument.mockResolvedValue({
                url: 'https://example.com/existing.pdf',
                contentType: 'application/pdf',
            });

            const reviewDto: GetDocumentReviewDto = {
                id: 'review-14',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [
                    {
                        fileName: 'review.pdf',
                        presignedUrl: 'https://example.com/review.pdf',
                    },
                ],
            };

            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-14/1`)) {
                    return Promise.resolve({ status: 200, data: reviewDto });
                }
                if (url.startsWith('https://example.com/')) {
                    return Promise.resolve({ status: 200, data: new Blob(['file']) });
                }
                return Promise.reject(new Error(`Unexpected url: ${String(url)}`));
            });

            const result = await getReviewData({ baseUrl, baseHeaders, reviewData });

            const existingDoc = result.existingUploadDocuments[0];
            expect(existingDoc.versionId).toBe('v2');
            expect(existingDoc.type).toBe('EXISTING');

            const reviewDoc = result.additionalFiles[0];
            expect(reviewDoc).not.toHaveProperty('versionId');
        });

        test('filters existing and additional documents correctly', async () => {
            const reviewData = new ReviewDetails(
                'review-15',
                documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9000000001',
            );

            mockedGetDocumentSearchResults.mockResolvedValue([
                {
                    id: 'doc-existing',
                    fileName: 'existing.pdf',
                    contentType: 'application/pdf',
                    created: '2024-01-01T00:00:00Z',
                    virusScannerResult: 'CLEAN',
                    fileSize: 100,
                    version: 'v1',
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                },
            ]);

            mockedGetDocument.mockResolvedValue({
                url: 'https://example.com/existing.pdf',
                contentType: 'application/pdf',
            });

            const reviewDto: GetDocumentReviewDto = {
                id: 'review-15',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [
                    {
                        fileName: 'review1.pdf',
                        presignedUrl: 'https://example.com/review1.pdf',
                    },
                    {
                        fileName: 'review2.pdf',
                        presignedUrl: 'https://example.com/review2.pdf',
                    },
                ],
            };

            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-15/1`)) {
                    return Promise.resolve({ status: 200, data: reviewDto });
                }
                if (url.startsWith('https://example.com/')) {
                    return Promise.resolve({ status: 200, data: new Blob(['file']) });
                }
                return Promise.reject(new Error(`Unexpected url: ${String(url)}`));
            });

            const result = await getReviewData({ baseUrl, baseHeaders, reviewData });

            expect(result.uploadDocuments).toHaveLength(3);
            expect(result.existingUploadDocuments).toHaveLength(1);
            expect(result.additionalFiles).toHaveLength(2);

            expect(result.existingUploadDocuments[0].type).toBe('EXISTING');
            expect(result.additionalFiles.every((doc) => doc.type === 'REVIEW')).toBe(true);
        });

        test('calls getDocumentSearchResults with correct parameters', async () => {
            const reviewData = new ReviewDetails(
                'review-16',
                documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9876543210',
            );

            mockedGetDocumentSearchResults.mockResolvedValue([]);

            const reviewDto: GetDocumentReviewDto = {
                id: 'review-16',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [
                    {
                        fileName: 'test.pdf',
                        presignedUrl: 'https://example.com/test.pdf',
                    },
                ],
            };

            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-16/1`)) {
                    return Promise.resolve({ status: 200, data: reviewDto });
                }
                if (url.startsWith('https://example.com/')) {
                    return Promise.resolve({ status: 200, data: new Blob(['file']) });
                }
                return Promise.reject(new Error(`Unexpected url: ${String(url)}`));
            });

            await getReviewData({ baseUrl, baseHeaders, reviewData });

            expect(mockedGetDocumentSearchResults).toHaveBeenCalledWith({
                nhsNumber: '9876543210',
                baseUrl,
                baseHeaders,
                docType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
            });
        });

        test('calls getDocument with correct parameters for existing document', async () => {
            const reviewData = new ReviewDetails(
                'review-17',
                documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9111222333',
            );

            mockedGetDocumentSearchResults.mockResolvedValue([
                {
                    id: 'doc-id-123',
                    fileName: 'existing.pdf',
                    contentType: 'application/pdf',
                    created: '2024-01-01T00:00:00Z',
                    virusScannerResult: 'CLEAN',
                    fileSize: 100,
                    version: 'v1',
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                },
            ]);

            mockedGetDocument.mockResolvedValue({
                url: 'https://example.com/existing.pdf',
                contentType: 'application/pdf',
            });

            const reviewDto: GetDocumentReviewDto = {
                id: 'review-17',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [
                    {
                        fileName: 'review.pdf',
                        presignedUrl: 'https://example.com/review.pdf',
                    },
                ],
            };

            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-17/1`)) {
                    return Promise.resolve({ status: 200, data: reviewDto });
                }
                if (url.startsWith('https://example.com/')) {
                    return Promise.resolve({ status: 200, data: new Blob(['file']) });
                }
                return Promise.reject(new Error(`Unexpected url: ${String(url)}`));
            });

            await getReviewData({ baseUrl, baseHeaders, reviewData });

            expect(mockedGetDocument).toHaveBeenCalledWith({
                nhsNumber: '9111222333',
                baseUrl,
                baseHeaders,
                documentId: 'doc-id-123',
            });
        });

        test('sets existingFiles on reviewData when documents found', async () => {
            const reviewData = new ReviewDetails(
                'review-18',
                documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9000000001',
            );

            const searchResults = [
                {
                    id: 'doc-123',
                    fileName: 'existing.pdf',
                    contentType: 'application/pdf',
                    created: '2024-01-01T00:00:00Z',
                    virusScannerResult: 'CLEAN',
                    fileSize: 100,
                    version: 'v1',
                    documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                },
            ];

            mockedGetDocumentSearchResults.mockResolvedValue(searchResults);

            mockedGetDocument.mockResolvedValue({
                url: 'https://example.com/existing.pdf',
                contentType: 'application/pdf',
            });

            const reviewDto: GetDocumentReviewDto = {
                id: 'review-18',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [
                    {
                        fileName: 'review.pdf',
                        presignedUrl: 'https://example.com/review.pdf',
                    },
                ],
            };

            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-18/1`)) {
                    return Promise.resolve({ status: 200, data: reviewDto });
                }
                if (url.startsWith('https://example.com/')) {
                    return Promise.resolve({ status: 200, data: new Blob(['file']) });
                }
                return Promise.reject(new Error(`Unexpected url: ${String(url)}`));
            });

            await getReviewData({ baseUrl, baseHeaders, reviewData });

            expect(reviewData.existingFiles).toEqual(searchResults);
        });

        test('generates unique IDs for review documents', async () => {
            const reviewData = new ReviewDetails(
                'review-19',
                documentTypeModule.DOCUMENT_TYPE.EHR,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9000000001',
            );

            const reviewDto: GetDocumentReviewDto = {
                id: 'review-19',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.EHR,
                files: [
                    {
                        fileName: 'file1.pdf',
                        presignedUrl: 'https://example.com/file1.pdf',
                    },
                    {
                        fileName: 'file2.pdf',
                        presignedUrl: 'https://example.com/file2.pdf',
                    },
                    {
                        fileName: 'file3.pdf',
                        presignedUrl: 'https://example.com/file3.pdf',
                    },
                ],
            };

            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-19/1`)) {
                    return Promise.resolve({ status: 200, data: reviewDto });
                }
                if (url.startsWith('https://example.com/')) {
                    return Promise.resolve({ status: 200, data: new Blob(['file']) });
                }
                return Promise.reject(new Error(`Unexpected url: ${String(url)}`));
            });

            mockedGetDocumentSearchResults.mockResolvedValue([]);
            const result = await getReviewData({ baseUrl, baseHeaders, reviewData });

            const ids = result.uploadDocuments.map((doc) => doc.id);
            const uniqueIds = new Set(ids);

            expect(uniqueIds.size).toBe(3);
            expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
        });

        test('handles empty files array in review', async () => {
            const reviewData = new ReviewDetails(
                'review-20',
                documentTypeModule.DOCUMENT_TYPE.EHR,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9000000001',
            );

            const reviewDto: GetDocumentReviewDto = {
                id: 'review-20',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.EHR,
                files: [],
            };

            mockedGetDocumentSearchResults.mockResolvedValue([]);
            mockedAxios.get.mockResolvedValue({ status: 200, data: reviewDto });

            const result = await getReviewData({ baseUrl, baseHeaders, reviewData });

            expect(result.aborted).toBe(false);
            expect(result.uploadDocuments).toHaveLength(0);
            expect(result.additionalFiles).toHaveLength(0);
            expect(result.hasExistingRecordInStorage).toBe(false);
        });

        test('handles null presignedUrl as abort condition', async () => {
            const reviewData = new ReviewDetails(
                'review-21',
                documentTypeModule.DOCUMENT_TYPE.EHR,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9000000001',
            );

            const reviewDto = {
                id: 'review-21',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.EHR,
                files: [
                    {
                        fileName: 'file1.pdf',
                        presignedUrl: null,
                    },
                ],
            } as unknown as GetDocumentReviewDto;

            mockedGetDocumentSearchResults.mockResolvedValue([]);
            mockedAxios.get.mockResolvedValue({ status: 200, data: reviewDto });

            const result = await getReviewData({ baseUrl, baseHeaders, reviewData });

            expect(result.aborted).toBe(true);
            expect(result.uploadDocuments).toHaveLength(0);
            expect(result.additionalFiles).toHaveLength(0);
            expect(result.existingUploadDocuments).toHaveLength(0);
            expect(result.hasExistingRecordInStorage).toBe(false);
        });

        test('aborts early when any file has missing presignedUrl before fetching', async () => {
            const reviewData = new ReviewDetails(
                'review-22',
                documentTypeModule.DOCUMENT_TYPE.EHR,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9000000001',
            );

            const reviewDto = {
                id: 'review-22',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.EHR,
                files: [
                    {
                        fileName: 'file1.pdf',
                        presignedUrl: 'https://example.com/file1.pdf',
                    },
                    {
                        fileName: 'file2.pdf',
                        presignedUrl: '',
                    },
                    {
                        fileName: 'file3.pdf',
                        presignedUrl: 'https://example.com/file3.pdf',
                    },
                ],
            } as GetDocumentReviewDto;

            let blobFetchCount = 0;
            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-22/1`)) {
                    return Promise.resolve({ status: 200, data: reviewDto });
                }

                if (url.startsWith('https://example.com/')) {
                    blobFetchCount += 1;
                    return Promise.resolve({ status: 200, data: new Blob(['file']) });
                }
                return Promise.reject(new Error(`Unexpected url: ${String(url)}`));
            });

            mockedGetDocumentSearchResults.mockResolvedValue([]);
            const result = await getReviewData({ baseUrl, baseHeaders, reviewData });

            expect(result.aborted).toBe(true);
            expect(blobFetchCount).toBe(1);
        });

        test('handles empty nhsNumber in reviewData', async () => {
            const reviewData = new ReviewDetails(
                'review-23',
                documentTypeModule.DOCUMENT_TYPE.EHR,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '', // empty NHS number
            );

            const reviewDto = {
                id: 'review-23',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.EHR,
                files: [
                    {
                        fileName: 'document.pdf',
                        presignedUrl: 'https://example.com/document.pdf',
                    },
                ],
            } as GetDocumentReviewDto;

            const mockBlob = new Blob(['test content'], { type: 'application/pdf' });

            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-23/1`)) {
                    return Promise.resolve({ status: 200, data: reviewDto });
                }
                if (url.startsWith('https://example.com/')) {
                    return Promise.resolve({ status: 200, data: mockBlob });
                }
                return Promise.reject(new Error('Unexpected URL'));
            });

            mockedGetDocumentSearchResults.mockResolvedValue([]);
            const result = await getReviewData({ baseUrl, baseHeaders, reviewData });

            expect(result.aborted).toBe(false);
            expect(result.uploadDocuments).toHaveLength(1);
            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining('patientId='),
                expect.anything(),
            );
        });

        test('handles file with name that has no extension (split.pop returns undefined)', async () => {
            const reviewData = new ReviewDetails(
                'review-24',
                documentTypeModule.DOCUMENT_TYPE.EHR,
                '2024-01-01',
                'uploader',
                '2024-01-01',
                'reason',
                '1',
                '9000000001',
            );

            const reviewDto = {
                id: 'review-24',
                uploadDate: '2024-01-01T10:00:00Z',
                documentSnomedCodeType: documentTypeModule.DOCUMENT_TYPE.EHR,
                files: [
                    {
                        fileName: '',
                        presignedUrl: 'https://example.com/emptyname',
                    },
                ],
            } as GetDocumentReviewDto;

            const mockBlob = new Blob(['test content'], { type: 'application/octet-stream' });

            mockedAxios.get.mockImplementation((url: string) => {
                if (url.startsWith(`${baseUrl}${endpoints.DOCUMENT_REVIEW}/review-24/1`)) {
                    return Promise.resolve({ status: 200, data: reviewDto });
                }
                if (url.startsWith('https://example.com/')) {
                    return Promise.resolve({ status: 200, data: mockBlob });
                }
                return Promise.reject(new Error('Unexpected URL'));
            });

            mockedGetDocumentSearchResults.mockResolvedValue([]);
            const result = await getReviewData({ baseUrl, baseHeaders, reviewData });

            expect(result.aborted).toBe(false);
            expect(result.uploadDocuments).toHaveLength(1);
            expect(result.uploadDocuments[0].file.name).toBe('');
        });
    });
});
