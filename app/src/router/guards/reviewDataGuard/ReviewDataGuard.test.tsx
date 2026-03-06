import { render, RenderResult, waitFor } from '@testing-library/react';
import { routes } from '../../../types/generic/routes';
import ReviewDataGuard from './ReviewDataGuard';
import { ReviewDetails } from '../../../types/generic/reviews';
import { DOCUMENT_TYPE } from '../../../helpers/utils/documentType';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';

const mockedUseNavigate = vi.fn();
const mockedUseParams = vi.fn();

vi.mock('react-router-dom', () => ({
    useNavigate: (): Mock => mockedUseNavigate,
    useParams: (): Mock => mockedUseParams(),
}));

const buildReviewDetails = (): ReviewDetails =>
    new ReviewDetails(
        'review-abc-123',
        DOCUMENT_TYPE.LLOYD_GEORGE,
        '2025-01-01T00:00:00Z',
        'test-uploader',
        '2025-01-01',
        'Test reason',
        '1',
        '9000000009',
    );

describe('ReviewDataGuard', () => {
    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('navigates to reviews page when reviewData is null', async () => {
        mockedUseParams.mockReturnValue({ reviewId: 'review-abc-123' });

        renderGuard({ reviewData: null });

        await waitFor(() => {
            expect(mockedUseNavigate).toHaveBeenCalledWith(routes.REVIEWS);
        });
    });

    it('navigates to reviews page when reviewData is undefined', async () => {
        mockedUseParams.mockReturnValue({ reviewId: 'review-abc-123' });

        renderGuard({ reviewData: undefined });

        await waitFor(() => {
            expect(mockedUseNavigate).toHaveBeenCalledWith(routes.REVIEWS);
        });
    });

    it('navigates to reviews page when reviewId param is missing', async () => {
        mockedUseParams.mockReturnValue({ reviewId: undefined });

        renderGuard({ reviewData: buildReviewDetails() });

        await waitFor(() => {
            expect(mockedUseNavigate).toHaveBeenCalledWith(routes.REVIEWS);
        });
    });

    it('navigates to reviews page when reviewId has invalid dot-separated UUID format', async () => {
        mockedUseParams.mockReturnValue({ reviewId: '12345678-1234-1234-1234-123456789012.1' });

        renderGuard({ reviewData: buildReviewDetails() });

        await waitFor(() => {
            expect(mockedUseNavigate).toHaveBeenCalledWith(routes.REVIEWS);
        });
    });

    it('navigates to reviews page when reviewId has invalid dot-separated numeric format', async () => {
        mockedUseParams.mockReturnValue({ reviewId: '12345.1' });

        renderGuard({ reviewData: buildReviewDetails() });

        await waitFor(() => {
            expect(mockedUseNavigate).toHaveBeenCalledWith(routes.REVIEWS);
        });
    });

    it('does not navigate when reviewData is present and reviewId is valid', async () => {
        mockedUseParams.mockReturnValue({ reviewId: '12345_1' });

        renderGuard({ reviewData: buildReviewDetails() });

        await waitFor(() => {
            expect(mockedUseNavigate).not.toHaveBeenCalled();
        });
    });

    it('renders children when reviewData is present and reviewId is valid', async () => {
        mockedUseParams.mockReturnValue({ reviewId: '12345_1' });

        const { getByText } = renderGuard({ reviewData: buildReviewDetails() });

        await waitFor(() => {
            expect(getByText('child content')).toBeInTheDocument();
        });
    });
});

type RenderProps = {
    reviewData?: ReviewDetails | null;
};

const renderGuard = ({ reviewData }: RenderProps): RenderResult => {
    return render(
        <ReviewDataGuard reviewData={reviewData}>
            <div>child content</div>
        </ReviewDataGuard>,
    );
};
