import { describe, expect, it, vi, Mock, Mocked, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { getPdfObjectUrl } from './getPdfObjectUrl';
import { DOWNLOAD_STAGE } from '../../types/generic/downloadStage';

vi.mock('axios');

const mockedAxios = axios as Mocked<typeof axios>;

describe('getPdfObjectUrl', () => {
    const mockSetPdfObjectUrl = vi.fn();
    const mockSetDownloadStage = vi.fn();
    const testCloudFrontUrl = 'https://cloudfront.example.com/test-file.pdf';

    // Mock URL.createObjectURL
    const mockObjectUrl = 'blob:http://localhost:3000/test-blob-id';
    const originalCreateObjectURL = URL.createObjectURL;

    beforeEach(() => {
        vi.clearAllMocks();
        URL.createObjectURL = vi.fn((): string => mockObjectUrl);
    });

    afterEach(() => {
        URL.createObjectURL = originalCreateObjectURL;
    });

    describe('Successful PDF download', () => {
        it('fetches PDF from cloudFrontUrl with correct config', async () => {
            const mockBlob = new Blob(['test pdf data'], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            await getPdfObjectUrl(testCloudFrontUrl, mockSetPdfObjectUrl, mockSetDownloadStage);

            expect(mockedAxios.get).toHaveBeenCalledTimes(1);
            expect(mockedAxios.get).toHaveBeenCalledWith(testCloudFrontUrl, {
                responseType: 'blob',
            });
        });

        it('creates blob URL from response data', async () => {
            const mockBlob = new Blob(['test pdf data'], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            await getPdfObjectUrl(testCloudFrontUrl, mockSetPdfObjectUrl, mockSetDownloadStage);

            expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
            expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
        });

        it('calls setPdfObjectUrl with created object URL', async () => {
            const mockBlob = new Blob(['test pdf data'], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            await getPdfObjectUrl(testCloudFrontUrl, mockSetPdfObjectUrl, mockSetDownloadStage);

            expect(mockSetPdfObjectUrl).toHaveBeenCalledTimes(1);
            expect(mockSetPdfObjectUrl).toHaveBeenCalledWith(mockObjectUrl);
        });

        it('sets download stage to SUCCEEDED', async () => {
            const mockBlob = new Blob(['test pdf data'], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            await getPdfObjectUrl(testCloudFrontUrl, mockSetPdfObjectUrl, mockSetDownloadStage);

            expect(mockSetDownloadStage).toHaveBeenCalledTimes(1);
            expect(mockSetDownloadStage).toHaveBeenCalledWith(DOWNLOAD_STAGE.SUCCEEDED);
        });

        it('completes successfully with all callbacks', async () => {
            const mockBlob = new Blob(['test pdf data'], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            await expect(
                getPdfObjectUrl(testCloudFrontUrl, mockSetPdfObjectUrl, mockSetDownloadStage),
            ).resolves.not.toThrow();

            expect(mockSetPdfObjectUrl).toHaveBeenCalled();
            expect(mockSetDownloadStage).toHaveBeenCalledWith(DOWNLOAD_STAGE.SUCCEEDED);
        });
    });

    describe('Error handling', () => {
        it('throws error when axios request fails', async () => {
            const mockError = new Error('Network error');
            mockedAxios.get.mockRejectedValue(mockError);

            await expect(
                getPdfObjectUrl(testCloudFrontUrl, mockSetPdfObjectUrl, mockSetDownloadStage),
            ).rejects.toThrow('Network error');
        });

        it('does not call setPdfObjectUrl or setDownloadStage on error', async () => {
            const mockError = new Error('Network error');
            mockedAxios.get.mockRejectedValue(mockError);

            try {
                await getPdfObjectUrl(testCloudFrontUrl, mockSetPdfObjectUrl, mockSetDownloadStage);
            } catch (error) {
                // Expected error
            }

            expect(mockSetPdfObjectUrl).not.toHaveBeenCalled();
            expect(mockSetDownloadStage).not.toHaveBeenCalled();
        });

        it('handles 403 forbidden error', async () => {
            const mockError = {
                response: {
                    status: 403,
                    statusText: 'Forbidden',
                },
                message: 'Request failed with status code 403',
            };
            mockedAxios.get.mockRejectedValue(mockError);

            await expect(
                getPdfObjectUrl(testCloudFrontUrl, mockSetPdfObjectUrl, mockSetDownloadStage),
            ).rejects.toMatchObject({
                message: 'Request failed with status code 403',
            });
        });

        it('handles 404 not found error', async () => {
            const mockError = {
                response: {
                    status: 404,
                    statusText: 'Not Found',
                },
                message: 'Request failed with status code 404',
            };
            mockedAxios.get.mockRejectedValue(mockError);

            await expect(
                getPdfObjectUrl(testCloudFrontUrl, mockSetPdfObjectUrl, mockSetDownloadStage),
            ).rejects.toMatchObject({
                message: 'Request failed with status code 404',
            });
        });

        it('handles 500 server error', async () => {
            const mockError = {
                response: {
                    status: 500,
                    statusText: 'Internal Server Error',
                },
                message: 'Request failed with status code 500',
            };
            mockedAxios.get.mockRejectedValue(mockError);

            await expect(
                getPdfObjectUrl(testCloudFrontUrl, mockSetPdfObjectUrl, mockSetDownloadStage),
            ).rejects.toMatchObject({
                message: 'Request failed with status code 500',
            });
        });

        it('handles timeout error', async () => {
            const mockError = {
                code: 'ECONNABORTED',
                message: 'timeout of 30000ms exceeded',
            };
            mockedAxios.get.mockRejectedValue(mockError);

            await expect(
                getPdfObjectUrl(testCloudFrontUrl, mockSetPdfObjectUrl, mockSetDownloadStage),
            ).rejects.toMatchObject({
                message: 'timeout of 30000ms exceeded',
            });
        });
    });

    describe('Different blob types', () => {
        it('handles large PDF blobs', async () => {
            // Create a larger blob to simulate real PDFs
            const largeData = new Uint8Array(1024 * 1024); // 1MB
            const mockBlob = new Blob([largeData], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            await getPdfObjectUrl(testCloudFrontUrl, mockSetPdfObjectUrl, mockSetDownloadStage);

            expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
            expect(mockSetPdfObjectUrl).toHaveBeenCalledWith(mockObjectUrl);
        });

        it('handles empty blob', async () => {
            const mockBlob = new Blob([], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            await getPdfObjectUrl(testCloudFrontUrl, mockSetPdfObjectUrl, mockSetDownloadStage);

            expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
            expect(mockSetDownloadStage).toHaveBeenCalledWith(DOWNLOAD_STAGE.SUCCEEDED);
        });

        it('handles blob without explicit type', async () => {
            const mockBlob = new Blob(['test data']);
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            await getPdfObjectUrl(testCloudFrontUrl, mockSetPdfObjectUrl, mockSetDownloadStage);

            expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
            expect(mockSetDownloadStage).toHaveBeenCalledWith(DOWNLOAD_STAGE.SUCCEEDED);
        });
    });

    describe('Different URLs', () => {
        it('handles different CloudFront URLs', async () => {
            const differentUrl = 'https://cdn.example.com/documents/patient123.pdf';
            const mockBlob = new Blob(['test pdf data'], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            await getPdfObjectUrl(differentUrl, mockSetPdfObjectUrl, mockSetDownloadStage);

            expect(mockedAxios.get).toHaveBeenCalledWith(differentUrl, {
                responseType: 'blob',
            });
        });

        it('handles URLs with query parameters', async () => {
            //TODO Review tests
            const urlWithParams = 'https://cloudfront.example.com/file.pdf?token=abc&expires=123';
            const mockBlob = new Blob(['test pdf data'], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            await getPdfObjectUrl(urlWithParams, mockSetPdfObjectUrl, mockSetDownloadStage);

            expect(mockedAxios.get).toHaveBeenCalledWith(urlWithParams, {
                responseType: 'blob',
            });
        });

        it('handles URLs with special characters', async () => {
            const specialUrl = 'https://cloudfront.example.com/files/patient%20record%20(1).pdf';
            const mockBlob = new Blob(['test pdf data'], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            await getPdfObjectUrl(specialUrl, mockSetPdfObjectUrl, mockSetDownloadStage);

            expect(mockedAxios.get).toHaveBeenCalledWith(specialUrl, {
                responseType: 'blob',
            });
        });
    });

    describe('Callback execution order', () => {
        it('calls setPdfObjectUrl before setDownloadStage', async () => {
            const mockBlob = new Blob(['test pdf data'], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            const callOrder: string[] = [];
            const trackingSetPdfObjectUrl = vi.fn((): void => {
                callOrder.push('setPdfObjectUrl');
            });
            const trackingSetDownloadStage = vi.fn((): void => {
                callOrder.push('setDownloadStage');
            });

            await getPdfObjectUrl(
                testCloudFrontUrl,
                trackingSetPdfObjectUrl,
                trackingSetDownloadStage,
            );

            expect(callOrder).toEqual(['setPdfObjectUrl', 'setDownloadStage']);
        });

        it('ensures blob URL is created before calling setPdfObjectUrl', async () => {
            const mockBlob = new Blob(['test pdf data'], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            const callOrder: string[] = [];
            (URL.createObjectURL as Mock).mockImplementation((): string => {
                callOrder.push('createObjectURL');
                return mockObjectUrl;
            });
            const trackingSetPdfObjectUrl = vi.fn((): void => {
                callOrder.push('setPdfObjectUrl');
            });

            await getPdfObjectUrl(testCloudFrontUrl, trackingSetPdfObjectUrl, mockSetDownloadStage);

            expect(callOrder[0]).toBe('createObjectURL');
            expect(callOrder[1]).toBe('setPdfObjectUrl');
        });
    });
});
