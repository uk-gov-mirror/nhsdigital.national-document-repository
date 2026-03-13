import { extractPdfBlobUsingSelectedPages, parsePageNumbersToRanges } from './pageNumbers';

const mockAdd = vi.fn();
const mockSaveAsBlob = vi.fn();

vi.mock('pdf-merger-js/browser', () => {
    class PDFMergerMock {
        async add(data: unknown, pages?: number[]): Promise<void> {
            mockAdd(data, pages);
        }

        async saveAsBlob(): Promise<Blob> {
            return mockSaveAsBlob();
        }
    }

    return { default: PDFMergerMock };
});

const mockGetPageCount = vi.fn();

vi.mock('pdf-lib', () => ({
    PDFDocument: {
        load: vi.fn().mockImplementation(async () => ({
            getPageCount: mockGetPageCount,
        })),
    },
}));

describe('pageNumbers utils', () => {
    describe('pageNumbers', () => {
        describe('parsePageNumbersToRanges', () => {
            it('should parse single page numbers correctly', () => {
                expect(parsePageNumbersToRanges(['1', '3', '5'])).toEqual([[1], [3], [5]]);
            });

            it('should parse page ranges correctly', () => {
                expect(parsePageNumbersToRanges(['1-3'])).toEqual([[1, 2, 3]]);
                expect(parsePageNumbersToRanges(['2-4'])).toEqual([[2, 3, 4]]);
            });

            it('should handle mixed single pages and ranges', () => {
                expect(parsePageNumbersToRanges(['1', '3-4', '5'])).toEqual([[1], [3, 4, 5]]);
            });

            it('should handle duplicate page numbers and ranges', () => {
                expect(parsePageNumbersToRanges(['1', '1-3', '2'])).toEqual([[1, 2, 3]]);
            });

            it('should handle unsorted input', () => {
                expect(parsePageNumbersToRanges(['3', '1-2'])).toEqual([[1, 2, 3]]);
            });
        });
    });

    describe('extractPdfBlobUsingSelectedPages', () => {
        const mockBlob = new Blob(['mock pdf content'], { type: 'application/pdf' });
        const selectedPages = [[1], [3, 4]];

        beforeEach(() => {
            vi.clearAllMocks();
            mockSaveAsBlob.mockResolvedValue(
                new Blob([new ArrayBuffer(8)], { type: 'application/pdf' }),
            );
        });

        it('should extract a new PDF blob including selected pages when include is set to true', async () => {
            const resultBlob = await extractPdfBlobUsingSelectedPages(
                mockBlob,
                selectedPages,
                true,
            );

            expect(resultBlob).toBeInstanceOf(Blob);
            expect(mockAdd).toHaveBeenCalledWith(expect.any(Blob), [1, 3, 4]);
            expect(mockSaveAsBlob).toHaveBeenCalled();
        });

        it('should extract a new PDF blob excluding selected pages when include is set to false', async () => {
            mockGetPageCount.mockReturnValue(5);

            const resultBlob = await extractPdfBlobUsingSelectedPages(
                mockBlob,
                selectedPages,
                false,
            );

            expect(resultBlob).toBeInstanceOf(Blob);
            expect(mockAdd).toHaveBeenCalledWith(expect.any(Blob), [2, 5]);
            expect(mockSaveAsBlob).toHaveBeenCalled();
        });
    });
});
