import { useNavigate, useParams } from 'react-router-dom';
import { routes } from '../../types/generic/routes';
import { Mock } from 'vitest';
import { v4 as uuid } from 'uuid';

const useReviewId = (): string | undefined => {
    const { reviewId } = useParams<{ reviewId: string }>();
    const navigate = useNavigate();

    const reviewIdRegex = new RegExp(
        /^(([\dA-Za-z]{8}-[\dA-Za-z]{4}-[\dA-Za-z]{4}-[\dA-Za-z]{4}-[\dA-Za-z]{12})|(\d+))\.\d+$/,
    );

    if (!reviewId || !reviewIdRegex.test(reviewId)) {
        navigate(routes.NOT_FOUND);
        return;
    }

    return reviewId;
};

export default useReviewId;

const mockNavigate = vi.fn();
const mockUseParams = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        useParams: (): any => mockUseParams(),
    };
});

describe('useReviewId', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        mockUseParams.mockClear();
    });

    it('returns the reviewId when it is valid mock value', () => {
        const validReviewId = '12345.12';
        mockUseParams.mockReturnValue({ reviewId: validReviewId });

        const result = useReviewId();

        expect(result).toBe(validReviewId);
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('returns the reviewId when it is valid real value', () => {
        const validReviewId = `${uuid()}.1`;
        mockUseParams.mockReturnValue({ reviewId: validReviewId });

        const result = useReviewId();

        expect(result).toBe(validReviewId);
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('navigates to NOT_FOUND when reviewId is missing', () => {
        mockUseParams.mockReturnValue({});

        const result = useReviewId();

        expect(result).toBeUndefined();
        expect(mockNavigate).toHaveBeenCalledWith(routes.NOT_FOUND);
    });

    it('navigates to NOT_FOUND when reviewId is invalid', () => {
        const invalidReviewId = 'invalid-review-id';
        mockUseParams.mockReturnValue({ reviewId: invalidReviewId });

        const result = useReviewId();

        expect(result).toBeUndefined();
        expect(mockNavigate).toHaveBeenCalledWith(routes.NOT_FOUND);
    });
});
