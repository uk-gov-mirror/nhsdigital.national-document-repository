import { Mock } from 'vitest';
import { routes } from '../../types/generic/routes';
import useReviewId from './useReviewId';
import { v4 as uuid } from 'uuid';

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
        const validReviewId = '12345_12';
        mockUseParams.mockReturnValue({ reviewId: validReviewId });

        const result = useReviewId();

        expect(result).toBe(validReviewId);
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('returns the reviewId when it is valid real value', () => {
        const validReviewId = `${uuid()}_1`;
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
        const invalidReviewId = 'invalid-review-id.pdf';
        mockUseParams.mockReturnValue({ reviewId: invalidReviewId });

        const result = useReviewId();

        expect(result).toBeUndefined();
        expect(mockNavigate).toHaveBeenCalledWith(routes.NOT_FOUND);
    });
});
