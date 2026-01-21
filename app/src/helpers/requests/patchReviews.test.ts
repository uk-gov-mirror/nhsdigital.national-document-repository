import { describe, it, expect, vi, beforeEach, afterEach, Mocked } from 'vitest';
import axios from 'axios';
import { patchReview } from './patchReviews';
import { endpoints } from '../../types/generic/endpoints';
import { DocumentReviewStatus } from '../../types/blocks/documentReview';
import { AuthHeaders } from '../../types/blocks/authHeaders';

vi.mock('axios');
vi.mock('../utils/isLocal', () => ({
    isLocal: false,
}));

const mockedAxios = axios as Mocked<typeof axios>;

describe('patchReviews', () => {
    const baseUrl = 'https://api.example.com';
    const baseHeaders: AuthHeaders = {
        authorization: 'Bearer token',
        'Content-Type': 'application/json',
    };

    const reviewId = 'review-123';
    const versionNumber = '1';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('calls PATCH with correct URL + body', async () => {
        mockedAxios.patch.mockResolvedValue({ status: 200, data: '' });

        await patchReview(baseUrl, baseHeaders, reviewId, versionNumber, '9000000001', {
            reviewStatus: DocumentReviewStatus.APPROVED,
            documentReferenceId: 'doc-ref-1',
        });

        expect(mockedAxios.patch).toHaveBeenCalledWith(
            `${baseUrl}${endpoints.DOCUMENT_REVIEW}/${reviewId}/${versionNumber}?patientId=9000000001`,
            JSON.stringify({
                reviewStatus: DocumentReviewStatus.APPROVED,
                documentReferenceId: 'doc-ref-1',
            }),
            {
                headers: { ...baseHeaders },
            },
        );
    });

    it('removes whitespace from patientId in URL', async () => {
        mockedAxios.patch.mockResolvedValue({ status: 200, data: '' });

        await patchReview(baseUrl, baseHeaders, reviewId, versionNumber, '900 000\n0001', {
            reviewStatus: DocumentReviewStatus.REJECTED,
        });

        expect(mockedAxios.patch).toHaveBeenCalledWith(
            `${baseUrl}${endpoints.DOCUMENT_REVIEW}/${reviewId}/${versionNumber}?patientId=9000000001`,
            JSON.stringify({
                reviewStatus: DocumentReviewStatus.REJECTED,
            }),
            expect.objectContaining({ headers: baseHeaders }),
        );
    });

    it('re-throws axios errors', async () => {
        const error = new Error('Network error');
        mockedAxios.patch.mockRejectedValue(error);

        await expect(
            patchReview(baseUrl, baseHeaders, reviewId, versionNumber, '9000000001', {
                reviewStatus: DocumentReviewStatus.REJECTED_DUPLICATE,
            }),
        ).rejects.toThrow('Network error');
    });
});
