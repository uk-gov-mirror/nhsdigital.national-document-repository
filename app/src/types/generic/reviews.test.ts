import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ReviewDetails, GetDocumentReviewDto, ReviewFileDto } from './reviews';
import { DOCUMENT_TYPE } from '../../helpers/utils/documentType';

vi.mock('axios');
vi.mock('uuid', () => ({
    v4: vi.fn(() => 'mock-uuid'),
}));

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
});
