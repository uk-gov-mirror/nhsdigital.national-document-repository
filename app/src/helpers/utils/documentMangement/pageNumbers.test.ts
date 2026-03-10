import { parsePageNumbersToIndices } from './pageNumbers';

describe('pageNumbers', () => {
    describe('parsePageNumbersToIndices', () => {
        it('should parse single page numbers correctly', () => {
            expect(parsePageNumbersToIndices(['1', '3', '5'])).toEqual([0, 2, 4]);
        });

        it('should parse page ranges correctly', () => {
            expect(parsePageNumbersToIndices(['1-3'])).toEqual([0, 1, 2]);
            expect(parsePageNumbersToIndices(['2-4'])).toEqual([1, 2, 3]);
        });

        it('should handle mixed single pages and ranges', () => {
            expect(parsePageNumbersToIndices(['1', '3-4', '5'])).toEqual([0, 2, 3, 4]);
        });

        it('should handle duplicate page numbers and ranges', () => {
            expect(parsePageNumbersToIndices(['1', '1-3', '2'])).toEqual([0, 1, 2]);
        });

        it('should handle unsorted input', () => {
            expect(parsePageNumbersToIndices(['3', '1-2'])).toEqual([0, 1, 2]);
        });
    });
});
