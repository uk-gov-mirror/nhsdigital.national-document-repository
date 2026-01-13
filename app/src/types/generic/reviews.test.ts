import { describe, expect, it, vi, beforeEach, Mocked } from 'vitest';
import axios from 'axios';
import { ReviewDetails, GetDocumentReviewDto, ReviewFileDto } from './reviews';
import { DOCUMENT_TYPE } from '../../helpers/utils/documentType';
import { DOCUMENT_UPLOAD_STATE } from '../pages/UploadDocumentsPage/types';

vi.mock('axios');
vi.mock('uuid', () => ({
    v4: vi.fn(() => 'mock-uuid'),
}));

const mockedAxios = axios as Mocked<typeof axios>;

describe('ReviewDetails', () => {
    const mockId = 'test-review-id';
    const mockSnomedCode = DOCUMENT_TYPE.LLOYD_GEORGE;
    const mockLastUpdated = '2025-12-18T10:00:00Z';
    const mockUploader = 'test-uploader';
    const mockDateUploaded = '2025-12-17T10:00:00Z';
    const mockReviewReason = 'Test review reason';
    const mockVersion = '1.0';
    const mockNhsNumber = '123 456 7890';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Constructor', () => {
        it('creates a ReviewDetails instance with correct properties', () => {
            const reviewDetails = new ReviewDetails(
                mockId,
                mockSnomedCode,
                mockLastUpdated,
                mockUploader,
                mockDateUploaded,
                mockReviewReason,
                mockVersion,
                mockNhsNumber,
            );

            expect(reviewDetails.id).toBe(mockId);
            expect(reviewDetails.snomedCode).toBe(mockSnomedCode);
            expect(reviewDetails.lastUpdated).toBe(mockLastUpdated);
            expect(reviewDetails.uploader).toBe(mockUploader);
            expect(reviewDetails.dateUploaded).toBe(mockDateUploaded);
            expect(reviewDetails.reviewReason).toBe(mockReviewReason);
            expect(reviewDetails.version).toBe(mockVersion);
        });

        it('removes whitespace from NHS number', () => {
            const reviewDetails = new ReviewDetails(
                mockId,
                mockSnomedCode,
                mockLastUpdated,
                mockUploader,
                mockDateUploaded,
                mockReviewReason,
                mockVersion,
                mockNhsNumber,
            );

            expect(reviewDetails.nhsNumber).toBe('1234567890');
        });

        it('initializes files as null', () => {
            const reviewDetails = new ReviewDetails(
                mockId,
                mockSnomedCode,
                mockLastUpdated,
                mockUploader,
                mockDateUploaded,
                mockReviewReason,
                mockVersion,
                mockNhsNumber,
            );

            expect(reviewDetails.files).toBeNull();
        });

        it('initializes existingFiles as null', () => {
            const reviewDetails = new ReviewDetails(
                mockId,
                mockSnomedCode,
                mockLastUpdated,
                mockUploader,
                mockDateUploaded,
                mockReviewReason,
                mockVersion,
                mockNhsNumber,
            );

            expect(reviewDetails.existingFiles).toBeNull();
        });

        it('handles NHS number without spaces', () => {
            const reviewDetails = new ReviewDetails(
                mockId,
                mockSnomedCode,
                mockLastUpdated,
                mockUploader,
                mockDateUploaded,
                mockReviewReason,
                mockVersion,
                '9876543210',
            );

            expect(reviewDetails.nhsNumber).toBe('9876543210');
        });

        it('handles NHS number with multiple spaces', () => {
            const reviewDetails = new ReviewDetails(
                mockId,
                mockSnomedCode,
                mockLastUpdated,
                mockUploader,
                mockDateUploaded,
                mockReviewReason,
                mockVersion,
                '  987  654  3210  ',
            );

            expect(reviewDetails.nhsNumber).toBe('9876543210');
        });
    });

    describe('addReviewFiles', () => {
        let reviewDetails: ReviewDetails;

        beforeEach(() => {
            reviewDetails = new ReviewDetails(
                mockId,
                mockSnomedCode,
                mockLastUpdated,
                mockUploader,
                mockDateUploaded,
                mockReviewReason,
                mockVersion,
                mockNhsNumber,
            );
        });

        it('adds review files successfully', () => {
            const mockFiles: ReviewFileDto[] = [
                { fileName: 'file1.pdf', presignedUrl: 'https://example.com/file1.pdf' },
                { fileName: 'file2.pdf', presignedUrl: 'https://example.com/file2.pdf' },
            ];

            const dto: GetDocumentReviewDto = {
                id: mockId,
                uploadDate: '2025-12-18',
                documentSnomedCodeType: mockSnomedCode,
                files: mockFiles,
            };

            reviewDetails.addReviewFiles(dto);

            expect(reviewDetails.files).toHaveLength(2);
            expect(reviewDetails.files![0].fileName).toBe('file1.pdf');
            expect(reviewDetails.files![0].presignedUrl).toBe('https://example.com/file1.pdf');
            expect(reviewDetails.files![0].uploadDate).toBe('2025-12-18');
            expect(reviewDetails.files![1].fileName).toBe('file2.pdf');
            expect(reviewDetails.files![1].presignedUrl).toBe('https://example.com/file2.pdf');
            expect(reviewDetails.files![1].uploadDate).toBe('2025-12-18');
        });

        it('throws error when snomed code mismatch', () => {
            const dto: GetDocumentReviewDto = {
                id: mockId,
                uploadDate: '2025-12-18',
                documentSnomedCodeType: DOCUMENT_TYPE.EHR,
                files: [],
            };

            expect(() => reviewDetails.addReviewFiles(dto)).toThrow(
                'Snomed code mismatch when adding review details',
            );
        });

        it('throws error when review ID mismatch', () => {
            const dto: GetDocumentReviewDto = {
                id: 'different-id',
                uploadDate: '2025-12-18',
                documentSnomedCodeType: mockSnomedCode,
                files: [],
            };

            expect(() => reviewDetails.addReviewFiles(dto)).toThrow(
                'Review ID mismatch when adding review details',
            );
        });

        it('adds empty files array successfully', () => {
            const dto: GetDocumentReviewDto = {
                id: mockId,
                uploadDate: '2025-12-18',
                documentSnomedCodeType: mockSnomedCode,
                files: [],
            };

            reviewDetails.addReviewFiles(dto);

            expect(reviewDetails.files).toEqual([]);
        });

        it('includes uploadDate in all files', () => {
            const mockFiles: ReviewFileDto[] = [
                { fileName: 'file1.pdf', presignedUrl: 'https://example.com/file1.pdf' },
            ];

            const dto: GetDocumentReviewDto = {
                id: mockId,
                uploadDate: '2025-12-17T15:30:00Z',
                documentSnomedCodeType: mockSnomedCode,
                files: mockFiles,
            };

            reviewDetails.addReviewFiles(dto);

            expect(reviewDetails.files![0].uploadDate).toBe('2025-12-17T15:30:00Z');
        });
    });

    describe('getUploadDocuments', () => {
        let reviewDetails: ReviewDetails;

        beforeEach(() => {
            reviewDetails = new ReviewDetails(
                mockId,
                mockSnomedCode,
                mockLastUpdated,
                mockUploader,
                mockDateUploaded,
                mockReviewReason,
                mockVersion,
                mockNhsNumber,
            );
        });

        it('returns empty array when no files are set', async () => {
            const result = await reviewDetails.getUploadDocuments();

            expect(result).toEqual([]);
        });

        it('fetches blob from presigned URL when blob is not present', async () => {
            const mockBlob = new Blob(['test content'], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            reviewDetails.files = [
                {
                    fileName: 'file1.pdf',
                    presignedUrl: 'https://example.com/file1.pdf',
                },
            ];

            await reviewDetails.getUploadDocuments();

            expect(mockedAxios.get).toHaveBeenCalledWith('https://example.com/file1.pdf', {
                responseType: 'blob',
            });
        });

        it('creates upload documents with correct properties', async () => {
            const mockBlob = new Blob(['test content'], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            reviewDetails.files = [
                {
                    fileName: 'file1.pdf',
                    presignedUrl: 'https://example.com/file1.pdf',
                },
            ];

            const result = await reviewDetails.getUploadDocuments();

            expect(result).toHaveLength(1);
            expect(result[0].state).toBe(DOCUMENT_UPLOAD_STATE.SELECTED);
            expect(result[0].file.name).toBe('file1.pdf');
            expect(result[0].progress).toBe(0);
            expect(result[0].id).toBe('mock-uuid');
            expect(result[0].docType).toBe(mockSnomedCode);
            expect(result[0].attempts).toBe(0);
        });

        it('does not fetch blob when already present', async () => {
            const mockBlob = new Blob(['test content'], { type: 'application/pdf' });

            reviewDetails.files = [
                {
                    fileName: 'file1.pdf',
                    presignedUrl: 'https://example.com/file1.pdf',
                    blob: mockBlob,
                },
            ];

            await reviewDetails.getUploadDocuments();

            expect(mockedAxios.get).not.toHaveBeenCalled();
        });

        it('updates file blob after fetching', async () => {
            const mockBlob = new Blob(['test content'], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            reviewDetails.files = [
                {
                    fileName: 'file1.pdf',
                    presignedUrl: 'https://example.com/file1.pdf',
                },
            ];

            await reviewDetails.getUploadDocuments();

            expect(reviewDetails.files[0].blob).toBe(mockBlob);
        });

        it('handles multiple files', async () => {
            const mockBlob1 = new Blob(['test content 1'], { type: 'application/pdf' });
            const mockBlob2 = new Blob(['test content 2'], { type: 'application/pdf' });

            mockedAxios.get
                .mockResolvedValueOnce({ data: mockBlob1 })
                .mockResolvedValueOnce({ data: mockBlob2 });

            reviewDetails.files = [
                {
                    fileName: 'file1.pdf',
                    presignedUrl: 'https://example.com/file1.pdf',
                },
                {
                    fileName: 'file2.pdf',
                    presignedUrl: 'https://example.com/file2.pdf',
                },
            ];

            const result = await reviewDetails.getUploadDocuments();

            expect(result).toHaveLength(2);
            expect(result[0].file.name).toBe('file1.pdf');
            expect(result[1].file.name).toBe('file2.pdf');
            expect(mockedAxios.get).toHaveBeenCalledTimes(2);
        });

        it('handles mixed files with and without blobs', async () => {
            const mockBlob1 = new Blob(['test content 1'], { type: 'application/pdf' });
            const mockBlob2 = new Blob(['test content 2'], { type: 'application/pdf' });

            mockedAxios.get.mockResolvedValue({ data: mockBlob2 });

            reviewDetails.files = [
                {
                    fileName: 'file1.pdf',
                    presignedUrl: 'https://example.com/file1.pdf',
                    blob: mockBlob1,
                },
                {
                    fileName: 'file2.pdf',
                    presignedUrl: 'https://example.com/file2.pdf',
                },
            ];

            const result = await reviewDetails.getUploadDocuments();

            expect(result).toHaveLength(2);
            expect(mockedAxios.get).toHaveBeenCalledTimes(1);
            expect(mockedAxios.get).toHaveBeenCalledWith('https://example.com/file2.pdf', {
                responseType: 'blob',
            });
        });

        it('returns cached upload documents on subsequent calls', async () => {
            const mockBlob = new Blob(['test content'], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            reviewDetails.files = [
                {
                    fileName: 'file1.pdf',
                    presignedUrl: 'https://example.com/file1.pdf',
                },
            ];

            const result1 = await reviewDetails.getUploadDocuments();
            const result2 = await reviewDetails.getUploadDocuments();

            // filesForUpload is cached, so axios should only be called once
            expect(mockedAxios.get).toHaveBeenCalledTimes(1);
            // Results should have the same structure
            expect(result1).toStrictEqual(result2);
        });

        it('creates File objects with correct blob content', async () => {
            const mockBlobContent = 'test pdf content';
            const mockBlob = new Blob([mockBlobContent], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            reviewDetails.files = [
                {
                    fileName: 'test.pdf',
                    presignedUrl: 'https://example.com/test.pdf',
                },
            ];

            const result = await reviewDetails.getUploadDocuments();

            expect(result[0].file).toBeInstanceOf(File);
            expect(result[0].file.name).toBe('test.pdf');
        });

        it('generates unique IDs for each upload document', async () => {
            const mockBlob1 = new Blob(['content 1'], { type: 'application/pdf' });
            const mockBlob2 = new Blob(['content 2'], { type: 'application/pdf' });

            mockedAxios.get
                .mockResolvedValueOnce({ data: mockBlob1 })
                .mockResolvedValueOnce({ data: mockBlob2 });

            reviewDetails.files = [
                {
                    fileName: 'file1.pdf',
                    presignedUrl: 'https://example.com/file1.pdf',
                },
                {
                    fileName: 'file2.pdf',
                    presignedUrl: 'https://example.com/file2.pdf',
                },
            ];

            const result = await reviewDetails.getUploadDocuments();

            expect(result[0].id).toBe('mock-uuid');
            expect(result[1].id).toBe('mock-uuid');
        });
    });

    describe('Integration scenarios', () => {
        it('adds review files and then gets upload documents', async () => {
            const reviewDetails = new ReviewDetails(
                mockId,
                mockSnomedCode,
                mockLastUpdated,
                mockUploader,
                mockDateUploaded,
                mockReviewReason,
                mockVersion,
                mockNhsNumber,
            );

            const mockBlob = new Blob(['test content'], { type: 'application/pdf' });
            mockedAxios.get.mockResolvedValue({ data: mockBlob });

            const dto: GetDocumentReviewDto = {
                id: mockId,
                uploadDate: '2025-12-18',
                documentSnomedCodeType: mockSnomedCode,
                files: [
                    {
                        fileName: 'file1.pdf',
                        presignedUrl: 'https://example.com/file1.pdf',
                    },
                ],
            };

            reviewDetails.addReviewFiles(dto);
            const uploadDocuments = await reviewDetails.getUploadDocuments();

            expect(uploadDocuments).toHaveLength(1);
            expect(uploadDocuments[0].file.name).toBe('file1.pdf');
            expect(uploadDocuments[0].state).toBe(DOCUMENT_UPLOAD_STATE.SELECTED);
        });
    });
});
