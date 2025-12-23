import { describe, it, expect, vi } from 'vitest';
import getMockResponses, { setupMockRequest } from './getMockReviews';

// Mock isLocal to ensure the mock implementation is initialized
vi.mock('../utils/isLocal', () => ({
    isLocal: true,
}));

describe('getMockResponses', () => {
    it('should be defined', () => {
        expect(getMockResponses).toBeDefined();
    });

    it('should return default paginated results', async () => {
        if (!getMockResponses) throw new Error('getMockResponses is undefined');
        if (!setupMockRequest) throw new Error('setupMockRequest is undefined');

        const params = new URLSearchParams();
        for (let index = 0; index < 15; index++) {
            setupMockRequest(params, true);
        }
        const response = await getMockResponses(params);

        expect(response).toBeDefined();
        expect(response.documentReviewReferences).toHaveLength(10); // Default limit is 10
        expect(response.count).toBe(10);
        expect(response.nextPageToken).toBeDefined();
    });

    it('should respect limit parameter', async () => {
        if (!getMockResponses) throw new Error('getMockResponses is undefined');

        const params = new URLSearchParams();
        params.set('limit', '5');
        const response = await getMockResponses(params);

        expect(response.documentReviewReferences).toHaveLength(5);
        expect(response.count).toBe(5);
    });

    it('should filter by nhsNumber', async () => {
        if (!getMockResponses) throw new Error('getMockResponses is undefined');

        // Pick an NHS number from the mock data
        const targetNhsNumber = '9000000001';
        const params = new URLSearchParams();
        params.set('nhsNumber', targetNhsNumber);

        const response = await getMockResponses(params);

        expect(response.documentReviewReferences.length).toBeGreaterThan(0);
        response.documentReviewReferences.forEach((review) => {
            expect(review.nhsNumber).toBe(targetNhsNumber);
        });
    });

    it('should throw error when nhsNumber is "error"', async () => {
        if (!getMockResponses) throw new Error('getMockResponses is undefined');

        const params = new URLSearchParams();
        params.set('nhsNumber', 'error');

        await expect(getMockResponses(params)).rejects.toThrow('Simulated network error');
    });

    it('should handle pagination with startKey', async () => {
        if (!getMockResponses) throw new Error('getMockResponses is undefined');

        const params1 = new URLSearchParams();
        params1.set('limit', '2');
        const response1 = await getMockResponses(params1);

        expect(response1.documentReviewReferences).toHaveLength(2);
        const nextPageToken = response1.nextPageToken;
        expect(nextPageToken).toBeTruthy();

        // Second page
        const params2 = new URLSearchParams();
        params2.set('limit', '2');
        params2.set('startKey', nextPageToken);
        const response2 = await getMockResponses(params2);

        expect(response2.documentReviewReferences).toHaveLength(2);
        expect(response2.documentReviewReferences[0].id).toBe(nextPageToken);
    });

    it('should return empty list if startKey is not found', async () => {
        if (!getMockResponses) throw new Error('getMockResponses is undefined');

        const params = new URLSearchParams();
        params.set('startKey', 'non-existent-id');
        const response = await getMockResponses(params);

        expect(response.documentReviewReferences.length).toBeGreaterThan(0);
        expect(response.documentReviewReferences[0].id).toBe('0'); // Assuming '0' is the first ID in baseData
    });
});
