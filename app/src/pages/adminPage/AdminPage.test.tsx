import { render, screen } from '@testing-library/react';
import { AdminPage } from './AdminPage';
import { runAxeTest } from '../../helpers/test/axeTestHelper';
import { describe, expect, it, Mock, vi } from 'vitest';
import { routes } from '../../types/generic/routes';
import useConfig from '../../helpers/hooks/useConfig';
import { defaultFeatureFlags } from '../../types/generic/featureFlags';

vi.mock('../../../helpers/hooks/useTitle');
vi.mock('../../styles/right-chevron-circle.svg', () => ({
    ReactComponent: (): string => 'svg',
}));
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});
vi.mock('../../helpers/hooks/useConfig');
const mockUseConfig = useConfig as Mock;
const mockNavigate = vi.fn();

const renderWithConfig = (userRestrictionEnabled = false): void => {
    mockUseConfig.mockReturnValue({
        featureFlags: { ...defaultFeatureFlags, userRestrictionEnabled },
    });
    render(<AdminPage />);
};

describe('AdminPage', (): void => {
    beforeEach(() => {
        mockUseConfig.mockReturnValue({ featureFlags: defaultFeatureFlags });
    });

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
            expect(reportLink).toHaveAttribute('href', '/create-report?reportType=PATIENT');
        });

        it('renders the Download a report card description', (): void => {
            render(<AdminPage />);
            expect(
                screen.getByText(
                    'This report shows the list of Lloyd George records stored for your organisation.',
                ),
            ).toBeInTheDocument();
        });

        it('renders the back button', (): void => {
            render(<AdminPage />);
            expect(screen.getByTestId('admin-back-btn')).toBeInTheDocument();
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
            expect(mockNavigate).toHaveBeenCalledWith(routes.REVIEWS);
        });

        it('navigates to home page when back button is clicked', async (): Promise<void> => {
            render(<AdminPage />);
            screen.getByTestId('admin-back-btn').click();
            expect(mockNavigate).toHaveBeenCalledWith(routes.HOME);
        });
    });

    describe('Feature flag - userRestrictionEnabled', (): void => {
        it('does not render the user restrictions tile when flag is disabled', (): void => {
            renderWithConfig(false);
            expect(screen.queryByTestId('user-restrictions-btn')).not.toBeInTheDocument();
        });

        it('renders the user restrictions tile when flag is enabled', (): void => {
            renderWithConfig(true);
            expect(screen.getByTestId('user-restrictions-btn')).toBeInTheDocument();
        });

        it('renders the user restrictions tile with correct href when flag is enabled', (): void => {
            renderWithConfig(true);
            expect(screen.getByTestId('user-restrictions-btn')).toHaveAttribute(
                'href',
                routes.USER_PATIENT_RESTRICTIONS,
            );
        });
    });
});
