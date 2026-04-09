import { Mock } from 'vitest';
import getUserInformation from '../../../../helpers/requests/userPatientRestrictions/getUserInformation';
import useSmartcardNumber from '../../../../helpers/hooks/useSmartcardNumber';
import { buildUserInformation, buildUserRestrictions } from '../../../../helpers/test/testBuilders';
import { render, screen, waitFor } from '@testing-library/react';
import UserPatientRestrictionsSearchStaffStage from './UserPatientRestrictionsSearchStaffStage';
import userEvent from '@testing-library/user-event';
import { routeChildren, routes } from '../../../../types/generic/routes';
import {
    userRestrictionsStaffSearchNotFoundError,
    userRestrictionStaffSearchEmptyValueError,
    userRestrictionStaffSearchInvalidFormatError,
    userRestrictionStaffSearchRestrictionExistsError,
} from '../../../../helpers/constants/errors';
import { UIErrorCode } from '../../../../types/generic/errors';

vi.mock('react-router-dom', () => ({
    ...vi.importActual('react-router-dom'),
    useNavigate: (): Mock => mockNavigate,
}));
vi.mock('../../../../helpers/requests/userPatientRestrictions/getUserInformation');
vi.mock('../../../../helpers/hooks/useBaseAPIUrl');
vi.mock('../../../../helpers/hooks/useBaseAPIHeaders');
vi.mock('../../../../helpers/hooks/useSmartcardNumber');

const mockNavigate = vi.fn();
const mockGetUserInformation = getUserInformation as Mock;
const mockUseSmartcardNumber = useSmartcardNumber as Mock;
const mockSetUserInformation = vi.fn();
const mockRestrictions = buildUserRestrictions();
const mockUserInformation = buildUserInformation();

describe('UserPatientRestrictionsSearchStaffStage', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockUseSmartcardNumber.mockReturnValue('777777777777');
        mockGetUserInformation.mockResolvedValue(mockUserInformation);
    });

    it('should fetch user information and navigate on valid form submission', async () => {
        renderComponent();

        const smartcardNumber = '1111 1111 1111';
        const input = screen.getByTestId('smartcard-number-input');
        await userEvent.type(input, smartcardNumber);
        const submitButton = screen.getByTestId('continue-button');
        await userEvent.click(submitButton);

        expect(mockGetUserInformation).toHaveBeenCalledWith(
            expect.objectContaining({
                smartcardId: smartcardNumber.replaceAll(/\s/g, ''),
            }),
        );
        expect(mockSetUserInformation).toHaveBeenCalledWith(mockUserInformation);
        expect(mockNavigate).toHaveBeenCalledWith(
            routeChildren.USER_PATIENT_RESTRICTIONS_VERIFY_STAFF,
        );
    });

    it('should show validation error for empty input', async () => {
        renderComponent();

        const submitButton = screen.getByTestId('continue-button');
        await userEvent.click(submitButton);

        expect(screen.getByText(userRestrictionStaffSearchEmptyValueError)).toBeInTheDocument();
    });

    it('should show validation error for invalid input', async () => {
        renderComponent();

        const input = screen.getByTestId('smartcard-number-input');
        await userEvent.type(input, 'invalid');
        const submitButton = screen.getByTestId('continue-button');
        await userEvent.click(submitButton);

        expect(screen.getByText(userRestrictionStaffSearchInvalidFormatError)).toBeInTheDocument();
    });

    it('should navigate to error page when search for yourself', async () => {
        renderComponent();

        const input = screen.getByTestId('smartcard-number-input');
        await userEvent.type(input, '777777777777');
        const submitButton = screen.getByTestId('continue-button');
        await userEvent.click(submitButton);

        expect(mockNavigate).toHaveBeenCalledWith(
            routes.GENERIC_ERROR + `?errorCode=${UIErrorCode.USER_PATIENT_RESTRICTIONS_SELF_ADD}`,
        );
    });

    it('should show validation error when trying to add a restriction that already exists', async () => {
        renderComponent();

        const existingSmartcardNumber = mockRestrictions[0].restrictedUser;
        const input = screen.getByTestId('smartcard-number-input');
        await userEvent.type(input, existingSmartcardNumber);
        const submitButton = screen.getByTestId('continue-button');
        await userEvent.click(submitButton);

        expect(
            screen.getByText(userRestrictionStaffSearchRestrictionExistsError),
        ).toBeInTheDocument();
    });

    it('should navigate to session expired page on 403 error', async () => {
        mockGetUserInformation.mockRejectedValue({
            response: { status: 403 },
        });

        renderComponent();

        const input = screen.getByTestId('smartcard-number-input');
        await userEvent.type(input, '111111111111');
        const submitButton = screen.getByTestId('continue-button');
        await userEvent.click(submitButton);

        expect(mockNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
    });

    it('should navigate to server error page on 500 error', async () => {
        mockGetUserInformation.mockRejectedValue({
            response: { status: 500 },
        });

        renderComponent();

        const input = screen.getByTestId('smartcard-number-input');
        await userEvent.type(input, '111111111111');
        const submitButton = screen.getByTestId('continue-button');
        await userEvent.click(submitButton);

        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(routes.SERVER_ERROR));
    });

    it('should show error message when staff member not found', async () => {
        mockGetUserInformation.mockRejectedValue({
            response: { status: 404 },
        });

        renderComponent();

        const input = screen.getByTestId('smartcard-number-input');
        await userEvent.type(input, '111111111111');
        const submitButton = screen.getByTestId('continue-button');
        await userEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(userRestrictionsStaffSearchNotFoundError)).toBeInTheDocument();
        });
    });
});

const renderComponent = (): void => {
    render(
        <UserPatientRestrictionsSearchStaffStage
            existingRestrictions={mockRestrictions}
            setUserInformation={mockSetUserInformation}
        />,
    );
};
