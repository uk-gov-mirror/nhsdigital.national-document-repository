import { render, screen } from '@testing-library/react';
import UserPatientRestrictionsIndex from './UserPatientRestrictionsIndex';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { routes } from '../../../../types/generic/routes';

vi.mock('../../../helpers/hooks/useTitle');
vi.mock('../../../../styles/right-chevron-circle.svg', () => ({
    ReactComponent: (): string => 'svg',
}));
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});
const mockNavigate = vi.fn();

const renderComponent = (): void => {
    render(<UserPatientRestrictionsIndex />);
};

describe('UserRestrictionsPage', (): void => {
    beforeEach(() => {
        renderComponent();
    });

    describe('Rendering', (): void => {
        it('renders the page correctly', (): void => {
            expect(
                screen.getByRole('heading', {
                    name: 'Restrict staff from accessing patient records',
                }),
            ).toBeInTheDocument();

            expect(screen.getByTestId('add-user-restriction-btn')).toBeInTheDocument();
            expect(screen.getByTestId('add-user-restriction-btn')).toHaveTextContent(
                'Add a restriction',
            );
            expect(
                screen.getByText('Restrict a staff member from accessing a patient record.'),
            ).toBeInTheDocument();

            expect(screen.getByTestId('view-user-restrictions-btn')).toBeInTheDocument();
            expect(screen.getByTestId('view-user-restrictions-btn')).toHaveTextContent(
                'View and remove a restriction',
            );
            expect(
                screen.getByText('View and remove restrictions for staff at your practice.'),
            ).toBeInTheDocument();

            expect(screen.getByTestId('user-restrictions-back-btn')).toBeInTheDocument();
        });
    });

    describe('Navigation', (): void => {
        it('navigates back to admin route when back button is clicked', (): void => {
            screen.getByTestId('user-restrictions-back-btn').click();
            expect(mockNavigate).toHaveBeenCalledWith(routes.ADMIN_ROUTE);
        });
    });

    describe('Accessibility', (): void => {
        it('passes accessibility checks', async (): Promise<void> => {
            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });
    });
});
