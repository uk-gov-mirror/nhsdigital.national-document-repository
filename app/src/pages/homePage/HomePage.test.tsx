import { render, screen } from '@testing-library/react';
import HomePage from './HomePage';
import { afterEach, describe, expect, it, vi, Mock } from 'vitest';
import { userEvent } from '@testing-library/user-event';
import { routes } from '../../types/generic/routes';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});

vi.mock('../../styles/right-chevron-circle.svg', () => ({
    ReactComponent: (): string => 'svg',
}));
const mockNavigate = vi.fn();

describe('HomePage', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Navigation', () => {
        it('navigates to patient search when search patient button is clicked', async () => {
            render(<HomePage />);

            const searchPatientButton = screen.getByTestId('search-patient-btn');
            await userEvent.click(searchPatientButton);

            expect(mockNavigate).toHaveBeenCalledWith(routes.SEARCH_PATIENT);
        });

        it('navigates to admin hub when admin hub button is clicked', async () => {
            render(<HomePage />);

            const adminHubButton = screen.getByTestId('admin-hub-btn');
            await userEvent.click(adminHubButton);

            expect(mockNavigate).toHaveBeenCalledWith(routes.ADMIN_ROUTE);
        });
    });
});
