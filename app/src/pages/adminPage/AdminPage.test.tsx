import { render, screen } from '@testing-library/react';
import { AdminPage } from './AdminPage';
import { runAxeTest } from '../../helpers/test/axeTestHelper';
import { describe, expect, it } from 'vitest';
import { routeChildren } from '../../types/generic/routes';

vi.mock('../../../helpers/hooks/useTitle');
vi.mock('../../styles/right-chevron-circle.svg', () => ({
    ReactComponent: () => 'svg',
}));
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});
const mockNavigate = vi.fn();

describe('AdminPage', (): void => {
    describe('Rendering', (): void => {
        it('renders the admin hub heading', (): void => {
            render(<AdminPage />);
            expect(screen.getByRole('heading', { name: 'Admin hub' })).toBeInTheDocument();
        });

        it('renders the Review documents card', (): void => {
            render(<AdminPage />);
            const reviewsLink = screen.getByTestId('admin-reviews-btn');
            expect(reviewsLink).toBeInTheDocument();
            expect(reviewsLink).toHaveTextContent('Review documents');
        });

        it('renders the Review documents card with correct href', (): void => {
            render(<AdminPage />);
            expect(screen.getByTestId('admin-reviews-btn')).toBeInTheDocument();
        });

        it('renders the Review documents card description', (): void => {
            render(<AdminPage />);
            expect(
                screen.getByText(
                    'Review patient documents from practice to practice transfers, or rejections from bulk transfer into this service.',
                ),
            ).toBeInTheDocument();
        });

        it('renders the Download a report card', (): void => {
            render(<AdminPage />);
            const reportLink = screen.getByTestId('download-report-btn');
            expect(reportLink).toBeInTheDocument();
            expect(reportLink).toHaveTextContent('Download a report');
        });

        it('renders the Download a report card with correct href', (): void => {
            render(<AdminPage />);
            const reportLink = screen.getByTestId('download-report-btn');
            expect(reportLink).toHaveAttribute('href', '/create-report?reportType=0');
        });

        it('renders the Download a report card description', (): void => {
            render(<AdminPage />);
            expect(
                screen.getByText(
                    'This report shows the list of Lloyd George records stored for your organisation.',
                ),
            ).toBeInTheDocument();
        });
    });

    describe('Accessibility', (): void => {
        it('passes accessibility checks', async (): Promise<void> => {
            render(<AdminPage />);
            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });
    });

    describe('Navigation', (): void => {
        it('navigates to admin review page on Review documents card click', (): void => {
            render(<AdminPage />);
            const reviewsLink = screen.getByTestId('admin-reviews-btn');
            reviewsLink.click();
            expect(mockNavigate).toHaveBeenCalledWith(routeChildren.ADMIN_REVIEW);
        });
    });
});
