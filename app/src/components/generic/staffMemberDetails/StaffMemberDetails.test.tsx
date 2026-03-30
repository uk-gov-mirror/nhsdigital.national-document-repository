import { render, screen } from '@testing-library/react';
import StaffMemberDetails from './StaffMemberDetails';

describe('StaffMemberDetails', () => {
    it('renders user information correctly', () => {
        const mockUserInformation = {
            smartcardId: '123456789012',
            firstName: 'John',
            lastName: 'Doe',
        };

        render(<StaffMemberDetails userInformation={mockUserInformation} />);

        expect(screen.getByTestId('smartcard-id')).toHaveTextContent(
            mockUserInformation.smartcardId,
        );
        expect(screen.getByTestId('staff-member')).toHaveTextContent(
            `${mockUserInformation.firstName} ${mockUserInformation.lastName}`,
        );
    });
});
