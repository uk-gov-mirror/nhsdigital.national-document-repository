import { render, screen } from '@testing-library/react';
import UserPatientRestrictionsAddConfirmStage from './UserPatientRestrictionsAddConfirmStage';

vi.mock('react-router-dom');
vi.mock('../../../../helpers/hooks/usePatient');

describe('UserPatientRestrictionsAddConfirmStage', () => {
    it('renders correctly', () => {
        const userInformation = {
            name: 'John Doe',
            smartcardId: '123456789012',
            firstName: 'John',
            lastName: 'Doe',
        };

        render(<UserPatientRestrictionsAddConfirmStage userInformation={userInformation} />);

        expect(screen.getByTestId('smartcard-id')).toHaveTextContent(userInformation.smartcardId);
        expect(screen.getByTestId('staff-member')).toHaveTextContent(
            `${userInformation.firstName} ${userInformation.lastName}`,
        );
    });
});
