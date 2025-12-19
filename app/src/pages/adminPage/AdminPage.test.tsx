import { render, screen } from '@testing-library/react';
import { AdminPage } from './AdminPage';
import { runAxeTest } from '../../helpers/test/axeTestHelper';
import { describe, expect, it, vi } from 'vitest';
import { routeChildren } from '../../types/generic/routes';

vi.mock('../../../helpers/hooks/useTitle');
vi.mock('../../styles/right-chevron-circle.svg', () => ({
    ReactComponent: () => 'svg',
}));

describe('AdminPage', (): void => {
    describe('Rendering', (): void => {
        it('renders the admin console heading', (): void => {
            render(<AdminPage />);
            expect(screen.getByRole('heading', { name: 'Admin console' })).toBeInTheDocument();
        });

        it('renders the Reviews card', (): void => {
            render(<AdminPage />);
            const reviewsLink = screen.getByTestId('admin-reviews-btn');
            expect(reviewsLink).toBeInTheDocument();
            expect(reviewsLink).toHaveTextContent('Reviews');
        });

        it('renders the Reviews card with correct href', (): void => {
            render(<AdminPage />);
            const reviewsLink = screen.getByTestId('admin-reviews-btn');
            expect(reviewsLink).toHaveAttribute('href', routeChildren.ADMIN_REVIEW);
        });

        it('renders the Reviews card description', (): void => {
            render(<AdminPage />);
            expect(
                screen.getByText(
                    'Review documents from practice to practice transfers and rejections from bulk transfer into this service.',
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
