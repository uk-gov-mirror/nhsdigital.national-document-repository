import { render, screen, waitFor } from '@testing-library/react';
import GenericErrorPage from './GenericErrorPage';
import { Mock } from 'vitest';
import { UIErrorCode, UIErrors } from '../../types/generic/errors';
import { routes } from '../../types/generic/routes';
import userEvent from '@testing-library/user-event';

vi.mock('react-router-dom', () => ({
    useNavigate: (): Mock => mockNavigate,
    useLocation: mockUseLocation,
}));

const mockNavigate = vi.fn();
const mockUseLocation = vi.hoisted(() => vi.fn());

describe('GenericErrorPage', () => {
    it('renders error title and message when valid error code is provided', () => {
        mockUseLocation.mockReturnValueOnce({
            search: `?errorCode=${UIErrorCode.PATIENT_ACCESS_RESTRICTED}`,
        });
        const expectedError = UIErrors[UIErrorCode.PATIENT_ACCESS_RESTRICTED];
        render(<GenericErrorPage />);

        expect(screen.getByRole('heading', { name: expectedError.title })).toBeInTheDocument();
        expect(
            screen.getByText(
                "A member of staff at your practice has restricted your access to this patient's record.",
            ),
        ).toBeInTheDocument();
    });

    it('navigates to home when invalid error code is provided', async () => {
        mockUseLocation.mockReturnValueOnce({});
        render(<GenericErrorPage />);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(routes.HOME);
        });
    });

    it('navigates to home when "Go to home" button is clicked', async () => {
        mockUseLocation.mockReturnValueOnce({
            search: `?errorCode=${UIErrorCode.PATIENT_ACCESS_RESTRICTED}`,
        });
        render(<GenericErrorPage />);

        const button = screen.getByTestId('go-to-home-button');
        await userEvent.click(button);

        expect(mockNavigate).toHaveBeenCalledWith(routes.HOME);
    });
});
