import { render, screen, waitFor } from '@testing-library/react';
import LogoutPage from './LogoutPage';
import SessionProvider, { Session } from '../../providers/sessionProvider/SessionProvider';
import { buildUserAuth } from '../../helpers/test/testBuilders';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import logout from '../../helpers/requests/logout';

vi.mock('../../helpers/requests/logout');
const mockSetSession = vi.fn();
const mockedLogout = logout as Mock;
const mockedUseNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
    useNavigate: (): Mock => mockedUseNavigate,
}));

describe('logoutPage', () => {
    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns a loading state until logout redirect', () => {
        renderLogoutPage();
        const status = 'Signing out...';
        expect(screen.getByText(status)).toBeInTheDocument();
    });

    it('navigates to the home page when logout is successful', async () => {
        renderLogoutPage();

        const clearLocalStorageSpy = vi.spyOn(Storage.prototype, 'clear');
        const clearSessionStorageSpy = vi.spyOn(sessionStorage.__proto__, 'clear');

        await waitFor(() => {
            expect(mockedLogout).toHaveBeenCalled();
            expect(clearLocalStorageSpy).toHaveBeenCalled();
            expect(clearSessionStorageSpy).toHaveBeenCalled();
        });
    });

    it('navigates to the previous page when logout fails', async () => {
        vi.mocked(logout).mockRejectedValue(new Error());

        renderLogoutPage();

        const clearLocalStorageSpy = vi.spyOn(Storage.prototype, 'clear');
        const clearSessionStorageSpy = vi.spyOn(sessionStorage.__proto__, 'clear');

        await waitFor(() => {
            expect(mockedLogout).toHaveBeenCalled();
            expect(clearLocalStorageSpy).toHaveBeenCalled();
            expect(clearSessionStorageSpy).toHaveBeenCalled();
        });
    });
});

const renderLogoutPage = (): void => {
    const auth: Session = {
        auth: buildUserAuth(),
        isLoggedIn: true,
    };
    render(
        <SessionProvider sessionOverride={auth} setSessionOverride={mockSetSession}>
            <LogoutPage />
        </SessionProvider>,
    );
};
