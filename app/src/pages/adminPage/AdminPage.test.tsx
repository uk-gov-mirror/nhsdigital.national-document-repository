import { render, screen } from '@testing-library/react';
import { AdminPage } from './AdminPage';
import { runAxeTest } from '../../helpers/test/axeTestHelper';
import { describe, expect, it } from 'vitest';
import { routeChildren } from '../../types/generic/routes';

vi.mock('../../../helpers/hooks/useTitle');
vi.mock('../../styles/right-chevron-circle.svg', () => ({
    ReactComponent: () => 'svg',
}));

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
            const reviewsLink = screen.getByTestId('admin-reviews-btn');
            expect(reviewsLink).toHaveAttribute('href', routeChildren.ADMIN_REVIEW);
        });

        it('renders the Review documents card description', (): void => {
            render(<AdminPage />);
            expect(
                screen.getByText(
                    'Review patient documents from practice to practice transfers, or rejections from bulk transfer into this service.',
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
});
