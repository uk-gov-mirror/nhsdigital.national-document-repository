import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import ReviewDetailsDontKnowNHSNumberConfirmStage from './ReviewDetailsDontKnowNHSNumberConfirmStage';
import useReviewId from '../../../../helpers/hooks/useReviewId';

vi.mock('../../../../helpers/utils/documentType');
vi.mock('../../../../helpers/hooks/useReviewId');

const mockReviewId = 'test-review-123';
const mockNavigate = vi.fn();
const mockUseReviewId = useReviewId as Mock;

vi.mock('react-router-dom', async (): Promise<unknown> => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        useParams: (): { reviewId: string } => ({ reviewId: mockReviewId }),
        Link: ({ children, to, ...props }: any) => (
            <a href={to} {...props}>
                {children}
            </a>
        ),
    };
});

describe('ReviewDetailsDontKnowNHSNumberConfirmStage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockUseReviewId.mockReturnValue(mockReviewId);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders the page content', () => {
            render(<ReviewDetailsDontKnowNHSNumberConfirmStage />);

            expect(
                screen.getByRole('heading', {
                    name: 'Check this document has downloaded to your computer',
                }),
            ).toBeInTheDocument();

            const callout = screen.getByTestId('review-notification');
            expect(callout).toBeInTheDocument();
            expect(
                within(callout).getByText(
                    /check this document has downloaded to your computer\. When you finish reviewing/i,
                ),
            ).toBeInTheDocument();

            expect(screen.getByTestId('back-button')).toBeInTheDocument();

            expect(
                screen.getByRole('button', { name: 'Finish reviewing this document' }),
            ).toBeInTheDocument();

            expect(
                screen.getByRole('link', { name: 'Go back to download the document' }),
            ).toBeInTheDocument();
        });
    });

    describe('Navigation', () => {
        it('navigates to the complete patient unknown route when finish reviewing is clicked', async () => {
            const user = userEvent.setup();
            render(<ReviewDetailsDontKnowNHSNumberConfirmStage />);

            await user.click(
                screen.getByRole('button', { name: 'Finish reviewing this document' }),
            );

            expect(mockNavigate).toHaveBeenCalledWith(
                `/reviews/${mockReviewId}/complete-patient-unknown`,
                undefined,
            );
        });

        it('calls navigate(-1) when the go back link is clicked', async () => {
            const user = userEvent.setup();
            render(<ReviewDetailsDontKnowNHSNumberConfirmStage />);

            await user.click(
                screen.getByRole('link', { name: 'Go back to download the document' }),
            );

            expect(mockNavigate).toHaveBeenCalledWith(-1);
        });
    });
});
