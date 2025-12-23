import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import ReviewDetailsDontKnowNHSNumberPage from './ReviewDetailsDontKnowNHSNumberPage';

const mockNavigate = vi.fn();
const mockReviewId = 'test-review-123';

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

describe('ReviewDetailsDontKnowNHSNumberPage', () => {
    const testReviewSnoMed = '16521000000101';

    beforeEach(() => {
        vi.clearAllMocks();
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders the Primary Care Support England link', () => {
            render(<ReviewDetailsDontKnowNHSNumberPage reviewSnoMed={testReviewSnoMed} />);

            const link = screen.getByRole('link', { name: 'Primary Care Support England' });
            expect(link).toBeInTheDocument();
            expect(link).toHaveAttribute(
                'href',
                'https://pcse.england.nhs.uk/services/medical-records/moving-medical-records',
            );
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        });

        it('renders the download link', () => {
            render(<ReviewDetailsDontKnowNHSNumberPage reviewSnoMed={testReviewSnoMed} />);

            const downloadLink = screen.getByRole('link', { name: 'Download all records' });
            expect(downloadLink).toBeInTheDocument();
            expect(downloadLink).toHaveAttribute('href', '#');
        });

        it('renders the finish reviewing button', () => {
            render(<ReviewDetailsDontKnowNHSNumberPage reviewSnoMed={testReviewSnoMed} />);

            const button = screen.getByRole('button', { name: 'Finish reviewing this document' });
            expect(button).toBeInTheDocument();
            expect(button).toHaveAttribute('id', 'finish-review-button');
            expect(button).toHaveAttribute('type', 'submit');
        });

        it('renders the instructions about record transfers', () => {
            render(<ReviewDetailsDontKnowNHSNumberPage reviewSnoMed={testReviewSnoMed} />);

            expect(
                screen.getByText(/following their process for record transfers/i),
            ).toBeInTheDocument();
        });
    });

    describe('User Interactions', () => {
        it('download link can be clicked without error', async () => {
            // TODO Review test in PRMP-827
            const user = userEvent.setup({ delay: null });
            render(<ReviewDetailsDontKnowNHSNumberPage reviewSnoMed={testReviewSnoMed} />);

            const downloadLink = screen.getByRole('link', { name: 'Download all records' });

            await user.click(downloadLink);

            // Component should still be rendered after click
            expect(
                screen.getByRole('heading', { name: 'Download this document' }),
            ).toBeInTheDocument();
        });
    });

    describe('Patient Integration', () => {
        it('handles null patient details gracefully', () => {
            expect(() => {
                render(<ReviewDetailsDontKnowNHSNumberPage reviewSnoMed={testReviewSnoMed} />);
            }).not.toThrow();

            expect(
                screen.getByRole('heading', { name: 'Download this document' }),
            ).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('passes axe accessibility tests', async () => {
            const { container } = render(
                <ReviewDetailsDontKnowNHSNumberPage reviewSnoMed={testReviewSnoMed} />,
            );

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('external link has proper accessibility attributes', () => {
            render(<ReviewDetailsDontKnowNHSNumberPage reviewSnoMed={testReviewSnoMed} />);

            const link = screen.getByRole('link', { name: 'Primary Care Support England' });
            expect(link).toHaveClass('nhsuk-link');
        });

        it('download link has proper accessibility class', () => {
            render(<ReviewDetailsDontKnowNHSNumberPage reviewSnoMed={testReviewSnoMed} />);

            const downloadLink = screen.getByRole('link', { name: 'Download all records' });
            expect(downloadLink).toHaveClass('nhsuk-link');
        });

        it('finish button has proper type attribute for form submission', () => {
            render(<ReviewDetailsDontKnowNHSNumberPage reviewSnoMed={testReviewSnoMed} />);

            const button = screen.getByRole('button', { name: 'Finish reviewing this document' });
            expect(button).toHaveAttribute('type', 'submit');
        });
    });

    describe('Component Props', () => {
        it('accepts reviewSnoMed prop without errors', () => {
            expect(() => {
                render(<ReviewDetailsDontKnowNHSNumberPage reviewSnoMed={testReviewSnoMed} />);
            }).not.toThrow();
        });

        it('renders with different reviewSnoMed values', () => {
            const { rerender } = render(<ReviewDetailsDontKnowNHSNumberPage reviewSnoMed="123" />);

            expect(
                screen.getByRole('heading', { name: 'Download this document' }),
            ).toBeInTheDocument();

            rerender(<ReviewDetailsDontKnowNHSNumberPage reviewSnoMed="456" />);

            expect(
                screen.getByRole('heading', { name: 'Download this document' }),
            ).toBeInTheDocument();
        });
    });

    describe('Layout and Structure', () => {
        it('renders within NHS UK grid system', () => {
            const { container } = render(
                <ReviewDetailsDontKnowNHSNumberPage reviewSnoMed={testReviewSnoMed} />,
            );

            expect(container.querySelector('.nhsuk-width-container')).toBeInTheDocument();
            expect(container.querySelector('.nhsuk-grid-row')).toBeInTheDocument();
            expect(container.querySelector('.nhsuk-grid-column-two-thirds')).toBeInTheDocument();
        });

        it('applies correct styling classes', () => {
            render(<ReviewDetailsDontKnowNHSNumberPage reviewSnoMed={testReviewSnoMed} />);

            const heading = screen.getByRole('heading', { name: 'Download this document' });
            expect(heading).toHaveClass('nhsuk-heading-l');

            const button = screen.getByRole('button', { name: 'Finish reviewing this document' });
            expect(button).toHaveClass('mt-9');
        });
    });

    describe('Navigation Routes', () => {
        it('includes reviewId in navigation path', async () => {
            const user = userEvent.setup({ delay: null });
            render(<ReviewDetailsDontKnowNHSNumberPage reviewSnoMed={testReviewSnoMed} />);

            const finishButton = screen.getByRole('button', {
                name: 'Finish reviewing this document',
            });
            await user.click(finishButton);

            expect(mockNavigate).toHaveBeenCalledWith(
                expect.stringContaining(`/reviews/${mockReviewId}/`),
                undefined,
            );
        });
    });
});
