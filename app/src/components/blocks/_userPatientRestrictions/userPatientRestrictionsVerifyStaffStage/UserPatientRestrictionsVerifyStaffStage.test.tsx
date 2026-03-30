import { render, screen } from '@testing-library/react';
import { Mock } from 'vitest';
import UserPatientRestrictionsVerifyStaffStage from './UserPatientRestrictionsVerifyStaffStage';
import userEvent from '@testing-library/user-event';
import { routeChildren } from '../../../../types/generic/routes';
import { buildUserInformation } from '../../../../helpers/test/testBuilders';
import { UserPatientRestrictionsJourneyState } from '../../../../pages/userPatientRestrictionsPage/useUserPatientRestrictionsPageHook';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});

const mockNavigate = vi.fn();
const mockSetJourneyState = vi.fn();
const mockUserInformation = buildUserInformation();

describe('UserPatientRestrictionsVerifyStaffStage', () => {
    it('renders correctly', () => {
        renderComponent();

        expect(screen.getByTestId('smartcard-id')).toHaveTextContent(
            mockUserInformation.smartcardId,
        );
    });

    it('should navigate to confirm page on button click', async () => {
        renderComponent();

        const button = screen.getByTestId('confirm-staff-details-button');
        await userEvent.click(button);

        expect(mockSetJourneyState).toHaveBeenCalledWith(
            UserPatientRestrictionsJourneyState.CONFIRMING,
        );
        expect(mockNavigate).toHaveBeenCalledWith(
            routeChildren.USER_PATIENT_RESTRICTIONS_ADD_CONFIRM,
        );
    });
});

const renderComponent = (): void => {
    render(
        <UserPatientRestrictionsVerifyStaffStage
            userInformation={mockUserInformation}
            setJourneyState={mockSetJourneyState}
        />,
    );
};
