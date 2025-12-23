import axios from 'axios';
import { beforeEach, describe, expect, Mocked, test, vi } from 'vitest';
import { endpoints } from '../../types/generic/endpoints';
import { ReviewsResponse } from '../../types/generic/reviews';
import getReviews from './getReviews';
import { DOCUMENT_TYPE } from '../utils/documentType';

vi.mock('axios');
vi.mock('../utils/isLocal', () => ({
    isLocal: false,
}));

const mockedAxios = axios as Mocked<typeof axios>;

describe('getReviews', () => {
    const baseUrl = 'https://test-api.com';
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
                        document_snomed_code_type: '16521000000101' as DOCUMENT_TYPE,
                        odsCode: 'Y12345',
                        dateUploaded: '2024-01-15',
                        reviewReason: 'Missing metadata',
                    },
                    {
                        id: '2',
                        nhsNumber: '9000000002',
                        document_snomed_code_type: '16521000000101' as DOCUMENT_TYPE,
                        odsCode: 'Y12345',
                        dateUploaded: '2024-01-16',
                        reviewReason: 'Duplicate record',
                    },
                ],
                nextPageToken: '3',
                count: 2,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviews(baseUrl, nhsNumber, '', 10);

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

            const result = await getReviews(baseUrl, nhsNumber, '', 10);

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
                        document_snomed_code_type: '16521000000101' as DOCUMENT_TYPE,
                        odsCode: 'Y12345',
                        dateUploaded: '2024-01-25',
                        reviewReason: 'Review needed',
                    },
                ],
                nextPageToken: '12',
                count: 1,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviews(baseUrl, nhsNumber, '10', 1);

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

            await getReviews(baseUrl, nhsNumber, 'startKey123', 20);

            const expectedUrl = `${baseUrl}${endpoints.REVIEW_LIST}?limit=20&startKey=startKey123&nhsNumber=${nhsNumber}`;

            expect(mockedAxios.get).toHaveBeenCalledWith(expectedUrl);
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
            await getReviews(baseUrl, nhsNumberWithSpaces, '', 10);

            const expectedUrl = `${baseUrl}${endpoints.REVIEW_LIST}?limit=10&startKey=&nhsNumber=9000000001`;

            expect(mockedAxios.get).toHaveBeenCalledWith(expectedUrl);
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

            await getReviews(baseUrl, nhsNumber, '');

            const expectedUrl = `${baseUrl}${endpoints.REVIEW_LIST}?limit=10&startKey=&nhsNumber=${nhsNumber}`;

            expect(mockedAxios.get).toHaveBeenCalledWith(expectedUrl);
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

            await getReviews(baseUrl, nhsNumber, '', 5);

            const expectedUrl = `${baseUrl}${endpoints.REVIEW_LIST}?limit=5&startKey=&nhsNumber=${nhsNumber}`;

            expect(mockedAxios.get).toHaveBeenCalledWith(expectedUrl);
        });
    });

    describe('error handling', () => {
        test('handles 4XX client errors', async () => {
            const errorResponse = {
                status: 403,
                message: 'Forbidden',
            };

            mockedAxios.get.mockRejectedValue(errorResponse);

            await expect(getReviews(baseUrl, nhsNumber, '', 10)).rejects.toEqual(errorResponse);
        });

        test('handles 5XX server errors', async () => {
            const errorResponse = {
                status: 500,
                message: 'Internal Server Error',
            };

            mockedAxios.get.mockRejectedValue(errorResponse);

            await expect(getReviews(baseUrl, nhsNumber, '', 10)).rejects.toEqual(errorResponse);
        });

        test('handles network errors', async () => {
            const networkError = new Error('Network Error');

            mockedAxios.get.mockRejectedValue(networkError);

            await expect(getReviews(baseUrl, nhsNumber, '', 10)).rejects.toThrow('Network Error');
        });

        test('handles 404 not found errors', async () => {
            const errorResponse = {
                status: 404,
                message: 'Not Found',
            };

            mockedAxios.get.mockRejectedValue(errorResponse);

            await expect(getReviews(baseUrl, nhsNumber, '', 10)).rejects.toEqual(errorResponse);
        });
    });

    describe('response data structure', () => {
        test('returns correct structure with all required fields', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [
                    {
                        id: '1',
                        nhsNumber: '9000000001',
                        document_snomed_code_type: '16521000000101' as DOCUMENT_TYPE,
                        odsCode: 'Y12345',
                        dateUploaded: '2024-01-15',
                        reviewReason: 'Missing metadata',
                    },
                ],
                nextPageToken: '2',
                count: 1,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviews(baseUrl, nhsNumber, '', 10);

            expect(result).toHaveProperty('documentReviewReferences');
            expect(result).toHaveProperty('nextPageToken');
            expect(result).toHaveProperty('count');
            expect(result.documentReviewReferences[0]).toHaveProperty('id');
            expect(result.documentReviewReferences[0]).toHaveProperty('nhsNumber');
            expect(result.documentReviewReferences[0]).toHaveProperty('document_snomed_code_type');
            expect(result.documentReviewReferences[0]).toHaveProperty('odsCode');
            expect(result.documentReviewReferences[0]).toHaveProperty('dateUploaded');
            expect(result.documentReviewReferences[0]).toHaveProperty('reviewReason');
        });

        test('handles multiple review items with different data', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [
                    {
                        id: '1',
                        nhsNumber: '9000000001',
                        document_snomed_code_type: '16521000000101' as DOCUMENT_TYPE,
                        odsCode: 'Y12345',
                        dateUploaded: '2024-01-15',
                        reviewReason: 'Missing metadata',
                    },
                    {
                        id: '2',
                        nhsNumber: '9000000002',
                        document_snomed_code_type: '717391000000106' as DOCUMENT_TYPE,
                        odsCode: 'Y67890',
                        dateUploaded: '2024-02-20',
                        reviewReason: 'Invalid format',
                    },
                ],
                nextPageToken: '3',
                count: 2,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviews(baseUrl, nhsNumber, '', 10);

            expect(result.documentReviewReferences).toHaveLength(2);
            expect(result.documentReviewReferences[0].odsCode).toBe('Y12345');
            expect(result.documentReviewReferences[1].odsCode).toBe('Y67890');
            expect(result.documentReviewReferences[0].document_snomed_code_type).toBe(
                '16521000000101',
            );
            expect(result.documentReviewReferences[1].document_snomed_code_type).toBe(
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
                        document_snomed_code_type: '16521000000101' as DOCUMENT_TYPE,
                        odsCode: 'Y12345',
                        dateUploaded: '2024-01-15',
                        reviewReason: 'Missing metadata',
                    },
                ],
                nextPageToken: '2',
                count: 1,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviews(baseUrl, nhsNumber, '', 1);

            expect(result.count).toBe(1);
            expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('limit=1'));
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

            await getReviews(baseUrl, nhsNumber, '', 100);

            expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('limit=100'));
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
            await getReviews(baseUrl, nhsNumberWithVariousSpaces, '', 10);

            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining('nhsNumber=9000000001'),
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
            await getReviews(baseUrl, nhsNumber, specialStartKey, 10);

            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining(`startKey=${specialStartKey}`),
            );
        });

        test('handles response with nextPageToken indicating more pages', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [
                    {
                        id: '1',
                        nhsNumber: '9000000001',
                        document_snomed_code_type: '16521000000101' as DOCUMENT_TYPE,
                        odsCode: 'Y12345',
                        dateUploaded: '2024-01-15',
                        reviewReason: 'Missing metadata',
                    },
                ],
                nextPageToken: 'hasMorePages123',
                count: 1,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviews(baseUrl, nhsNumber, '', 1);

            expect(result.nextPageToken).toBe('hasMorePages123');
            expect(result.nextPageToken).not.toBe('');
        });

        test('handles different SNOMED code types', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [
                    {
                        id: '1',
                        nhsNumber: '9000000001',
                        document_snomed_code_type: '717391000000106' as DOCUMENT_TYPE,
                        odsCode: 'Y12345',
                        dateUploaded: '2024-01-15',
                        reviewReason: 'Review needed',
                    },
                ],
                nextPageToken: '',
                count: 1,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviews(baseUrl, nhsNumber, '', 10);

            expect(result.documentReviewReferences[0].document_snomed_code_type).toBe(
                '717391000000106',
            );
        });

        test('handles various review reasons', async () => {
            const mockResponse: ReviewsResponse = {
                documentReviewReferences: [
                    {
                        id: '1',
                        nhsNumber: '9000000001',
                        document_snomed_code_type: '16521000000101' as DOCUMENT_TYPE,
                        odsCode: 'Y12345',
                        dateUploaded: '2024-01-15',
                        reviewReason: 'Suspicious content',
                    },
                ],
                nextPageToken: '',
                count: 1,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockResponse,
            });

            const result = await getReviews(baseUrl, nhsNumber, '', 10);

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

            await getReviews(baseUrl, nhsNumber, '', 10);

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

            await getReviews(baseUrl, nhsNumber, 'startKey', 20);

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

            await getReviews(baseUrl, nhsNumber, '', 10);

            const callUrl = mockedAxios.get.mock.calls[0][0];
            expect(callUrl).toContain(endpoints.REVIEW_LIST);
            expect(callUrl).toContain(baseUrl);
        });
    });
});
