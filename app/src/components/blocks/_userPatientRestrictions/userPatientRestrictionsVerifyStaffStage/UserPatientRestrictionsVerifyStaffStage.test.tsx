import { render, screen } from '@testing-library/react';
import { Mock } from 'vitest';
import UserPatientRestrictionsVerifyStaffStage from './UserPatientRestrictionsVerifyStaffStage';
import userEvent from '@testing-library/user-event';
import { routeChildren } from '../../../../types/generic/routes';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});

const mockNavigate = vi.fn();

describe('UserPatientRestrictionsVerifyStaffStage', () => {
    it('renders correctly', () => {
        const mockUserInformation = {
            smartcardId: '123456789012',
            firstName: 'John',
            lastName: 'Doe',
        };

        render(<UserPatientRestrictionsVerifyStaffStage userInformation={mockUserInformation} />);

        expect(screen.getByTestId('smartcard-id')).toHaveTextContent(
            mockUserInformation.smartcardId,
        );
    });

    it('should navigate to confirm page on button click', async () => {
        const mockUserInformation = {
            smartcardId: '123456789012',
            firstName: 'John',
            lastName: 'Doe',
        };

        render(<UserPatientRestrictionsVerifyStaffStage userInformation={mockUserInformation} />);

        const button = screen.getByTestId('confirm-staff-details-button');
        await userEvent.click(button);

        expect(mockNavigate).toHaveBeenCalledWith(
            routeChildren.USER_PATIENT_RESTRICTIONS_ADD_CONFIRM,
        );
    });
});
