import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import ReviewDetailsDontKnowNHSNumberStage from './ReviewDetailsDontKnowNHSNumberStage';
import { ReviewDetails } from '../../../../types/generic/reviews';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';
import useReviewId from '../../../../helpers/hooks/useReviewId';

vi.mock('../../../../helpers/utils/zip', () => ({
    zipFiles: vi.fn().mockResolvedValue(new Blob()),
}));

vi.mock('../../../../helpers/utils/downloadFile', () => ({
    downloadFile: vi.fn(),
}));

const mockNavigate = vi.fn();
const mockReviewId = 'test-review-123';
const mockUseReviewId = useReviewId as Mock;

vi.mock('react-router-dom', async (): Promise<unknown> => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        Link: ({ children, to, ...props }: any) => (
            <a href={to} {...props}>
                {children}
            </a>
        ),
    };
});
vi.mock('../../../../helpers/hooks/useReviewId');

describe('ReviewDetailsDontKnowNHSNumberPage', () => {
    const testReviewData = new ReviewDetails(
        'test-review-123',
        DOCUMENT_TYPE.LLOYD_GEORGE,
        '2023-01-01',
        'test-uploader',
        '2023-01-01',
        'test-reason',
        '1',
        '1234567890',
    );

    beforeEach(() => {
        vi.clearAllMocks();
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockUseReviewId.mockReturnValue(mockReviewId);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders the Primary Care Support England link', () => {
            render(
                <ReviewDetailsDontKnowNHSNumberStage reviewData={testReviewData} documents={[]} />,
            );

            const link = screen.getByRole('link', { name: 'process for record transfers' });
            expect(link).toBeInTheDocument();
            expect(link).toHaveAttribute(
                'href',
                'https://pcse.england.nhs.uk/services/medical-records/moving-medical-records',
            );
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        });

        it('renders the download button', () => {
            render(
                <ReviewDetailsDontKnowNHSNumberStage reviewData={testReviewData} documents={[]} />,
            );

            const button = screen.getByRole('button', { name: 'Download this document' });
            expect(button).toBeInTheDocument();
            expect(button).toHaveAttribute('id', 'finish-review-button');
            expect(button).toHaveAttribute('type', 'submit');
        });

        it('renders the instructions about record transfers', () => {
            render(
                <ReviewDetailsDontKnowNHSNumberStage reviewData={testReviewData} documents={[]} />,
            );

            expect(
                screen.getByRole('link', { name: 'process for record transfers' }),
            ).toBeInTheDocument();
        });

        it('renders the go back button with correct text and data-testid', () => {
            render(
                <ReviewDetailsDontKnowNHSNumberStage reviewData={testReviewData} documents={[]} />,
            );

            const backButton = screen.getByTestId('back-button');
            expect(backButton).toBeInTheDocument();
            expect(backButton).toHaveTextContent('Go back');
        });
    });

    describe('User Interactions', () => {
        it('download button can be clicked', async () => {
            const user = userEvent.setup({ delay: null });
            render(
                <ReviewDetailsDontKnowNHSNumberStage reviewData={testReviewData} documents={[]} />,
            );

            await user.click(screen.getByRole('button', { name: 'Download this document' }));

            expect(
                screen.getByRole('button', { name: 'Download this document' }),
            ).toBeInTheDocument();
        });
    });

    describe('Patient Integration', () => {
        it('handles null patient details gracefully', () => {
            expect(() => {
                render(<ReviewDetailsDontKnowNHSNumberStage reviewData={null} documents={[]} />);
            }).not.toThrow();

            expect(screen.getByText('Loading')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('passes axe accessibility tests', async () => {
            const { container } = render(
                <ReviewDetailsDontKnowNHSNumberStage reviewData={testReviewData} documents={[]} />,
            );

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('external link has proper accessibility attributes', () => {
            render(
                <ReviewDetailsDontKnowNHSNumberStage reviewData={testReviewData} documents={[]} />,
            );

            const link = screen.getByRole('link', { name: 'process for record transfers' });
            expect(link).toHaveClass('nhsuk-link');
        });

        it('download button has proper type attribute for form submission', () => {
            render(
                <ReviewDetailsDontKnowNHSNumberStage reviewData={testReviewData} documents={[]} />,
            );

            const button = screen.getByRole('button', { name: 'Download this document' });
            expect(button).toHaveAttribute('type', 'submit');
        });
    });

    describe('Component Props', () => {
        it('accepts reviewData prop without errors', () => {
            expect(() => {
                render(
                    <ReviewDetailsDontKnowNHSNumberStage
                        reviewData={testReviewData}
                        documents={[]}
                    />,
                );
            }).not.toThrow();
        });

        it('renders with different reviewData values', () => {
            const alternateReviewData = new ReviewDetails(
                'test-review-456',
                DOCUMENT_TYPE.LLOYD_GEORGE,
                '2023-02-01',
                'different-uploader',
                '2023-02-01',
                'different-reason',
                '2',
                '9876543210',
            );
            const { rerender } = render(
                <ReviewDetailsDontKnowNHSNumberStage reviewData={testReviewData} documents={[]} />,
            );

            expect(
                screen.getByRole('heading', { name: 'Download this document' }),
            ).toBeInTheDocument();

            rerender(
                <ReviewDetailsDontKnowNHSNumberStage
                    reviewData={alternateReviewData}
                    documents={[]}
                />,
            );

            expect(
                screen.getByRole('heading', { name: 'Download this document' }),
            ).toBeInTheDocument();
        });
    });

    describe('Layout and Structure', () => {
        it('renders within NHS UK grid system', () => {
            const { container } = render(
                <ReviewDetailsDontKnowNHSNumberStage reviewData={testReviewData} documents={[]} />,
            );

            expect(container.querySelector('.nhsuk-width-container')).toBeInTheDocument();
            expect(container.querySelector('.nhsuk-grid-row')).toBeInTheDocument();
            expect(container.querySelector('.nhsuk-grid-column-two-thirds')).toBeInTheDocument();
        });

        it('applies correct styling classes', () => {
            render(
                <ReviewDetailsDontKnowNHSNumberStage reviewData={testReviewData} documents={[]} />,
            );

            const heading = screen.getByRole('heading', { name: 'Download this document' });
            expect(heading).toHaveClass('nhsuk-heading-l');

            const button = screen.getByRole('button', { name: 'Download this document' });
            expect(button).toHaveClass('mt-9');
        });
    });

    describe('Navigation Routes', () => {
        it('includes reviewId in navigation path', async () => {
            const user = userEvent.setup({ delay: null });
            render(
                <ReviewDetailsDontKnowNHSNumberStage reviewData={testReviewData} documents={[]} />,
            );

            const downloadButton = screen.getByRole('button', {
                name: 'Download this document',
            });
            await user.click(downloadButton);

            expect(mockNavigate).toHaveBeenCalledWith(
                expect.stringContaining(`/reviews/${mockReviewId}/`),
                undefined,
            );
        });
    });
});
