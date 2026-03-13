import { PDFDocumentLoadingTask } from 'pdfjs-dist';
import { extractPdfBlobUsingSelectedPages, parsePageNumbersToIndexRanges } from './pageNumbers';

vi.mock('pdfjs-dist', () => ({
    getDocument: (): PDFDocumentLoadingTask =>
        ({
            promise: Promise.resolve({
                extractPages: mockExtractPages,
            }),
        }) as any,
}));

const mockExtractPages = vi.fn();

describe('pageNumbers utils', () => {
    describe('pageNumbers', () => {
        describe('parsePageNumbersToIndexRanges', () => {
            it('should parse single page numbers correctly', () => {
                expect(parsePageNumbersToIndexRanges(['1', '3', '5'])).toEqual([[0], [2], [4]]);
            });

            it('should parse page ranges correctly', () => {
                expect(parsePageNumbersToIndexRanges(['1-3'])).toEqual([[0, 1, 2]]);
                expect(parsePageNumbersToIndexRanges(['2-4'])).toEqual([[1, 2, 3]]);
            });

            it('should handle mixed single pages and ranges', () => {
                expect(parsePageNumbersToIndexRanges(['1', '3-4', '5'])).toEqual([[0], [2, 3, 4]]);
            });

            it('should handle duplicate page numbers and ranges', () => {
                expect(parsePageNumbersToIndexRanges(['1', '1-3', '2'])).toEqual([[0, 1, 2]]);
            });

            it('should handle unsorted input', () => {
                expect(parsePageNumbersToIndexRanges(['3', '1-2'])).toEqual([[0, 1, 2]]);
            });
        });
    });

    describe('extractPdfBlobUsingSelectedPages', () => {
        const mockBlob = new Blob(['mock pdf content'], { type: 'application/pdf' });
        const selectedPages = [[0], [2, 3]];

        it('should extract a new PDF blob including selected pages when include is set to true', async () => {
            mockExtractPages.mockResolvedValue({
                buffer: new ArrayBuffer(8),
            });

            const resultBlob = await extractPdfBlobUsingSelectedPages(
                mockBlob,
                selectedPages,
                true,
            );

            expect(resultBlob).toBeInstanceOf(Blob);
            expect(mockExtractPages).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        document: expect.any(Uint8Array),
                        includePages: [0, 2, 3],
                    }),
                ]),
            );
        });

        it('should extract a new PDF blob excluding selected pages when include is set to false', async () => {
            mockExtractPages.mockResolvedValue({
                buffer: new ArrayBuffer(8),
            });

            const resultBlob = await extractPdfBlobUsingSelectedPages(
                mockBlob,
                selectedPages,
                false,
            );

            expect(resultBlob).toBeInstanceOf(Blob);
            expect(mockExtractPages).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        document: expect.any(Uint8Array),
                        excludePages: [0, 2, 3],
                    }),
                ]),
            );
        });
    });
});
