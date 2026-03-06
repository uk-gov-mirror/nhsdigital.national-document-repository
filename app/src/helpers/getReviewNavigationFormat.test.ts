import getReviewNavigationFormat from './getReviewNavigationFormat';

describe('getReviewNavigationFormat', () => {
    it('combines reviewId and reviewVersion with an underscore', () => {
        const result = getReviewNavigationFormat('abc123', '1');
        expect(result).toBe('abc123_1');
    });

    it('returns the correct format for different inputs', () => {
        const result = getReviewNavigationFormat('review-456', '2.0');
        expect(result).toBe('review-456_2.0');
    });

    it('handles empty strings', () => {
        const result = getReviewNavigationFormat('', '');
        expect(result).toBe('_');
    });
});
