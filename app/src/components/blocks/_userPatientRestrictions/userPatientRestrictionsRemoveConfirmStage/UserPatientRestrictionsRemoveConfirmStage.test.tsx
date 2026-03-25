import { render, screen, waitFor } from '@testing-library/react';
import UserPatientRestrictionsRemoveConfirmStage from './UserPatientRestrictionsRemoveConfirmStage';
import { buildUserRestrictions } from '../../../../helpers/test/testBuilders';
import { Mock } from 'vitest';
import userEvent from '@testing-library/user-event';
import { routeChildren, routes } from '../../../../types/generic/routes';
import deleteUserPatientRestriction from '../../../../helpers/requests/userPatientRestrictions/deleteUserPatientRestriction';

vi.mock('react-router-dom', async () => ({
    ...(await vi.importActual('react-router-dom')),
    Link: ({
        children,
        onClick,
        'data-testid': dataTestId,
    }: {
        children: React.ReactNode;
        onClick?: () => void;
        'data-testid'?: string;
    }): React.JSX.Element => (
        <div data-testid={dataTestId} onClick={onClick}>
            {children}
        </div>
    ),
    useNavigate: (): Mock => mockNavigate,
}));
vi.mock('../../../../helpers/hooks/useBaseAPIHeaders');
vi.mock('../../../../helpers/hooks/useBaseAPIUrl');
vi.mock('../../../../helpers/requests/userPatientRestrictions/deleteUserPatientRestriction');

const mockNavigate = vi.fn();
const mockDeleteUserPatientRestriction = deleteUserPatientRestriction as Mock;

const mockRestriction = buildUserRestrictions()[0];
describe('UserPatientRestrictionsRemoveConfirmStage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDeleteUserPatientRestriction.mockResolvedValue({});
    });

    it('renders correctly', () => {
        render(<UserPatientRestrictionsRemoveConfirmStage restriction={mockRestriction} />);

        expect(
            screen.getByText(
                `${mockRestriction.restrictedUserFirstName} ${mockRestriction.restrictedUserLastName}`,
            ),
        ).toBeInTheDocument();
    });

    it('should call deleteUserPatientRestriction and navigate to complete on confirm', async () => {
        render(<UserPatientRestrictionsRemoveConfirmStage restriction={mockRestriction} />);

        const confirmButton = screen.getByTestId('confirm-remove-restriction-button');
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(mockDeleteUserPatientRestriction).toHaveBeenCalledWith({
                restrictionId: mockRestriction.id,
                nhsNumber: mockRestriction.nhsNumber,
            });
            expect(mockNavigate).toHaveBeenCalledWith(
                routeChildren.USER_PATIENT_RESTRICTIONS_REMOVE_COMPLETE,
            );
        });
    });

    it('should navigate to server error on delete failure', async () => {
        mockDeleteUserPatientRestriction.mockRejectedValue({ response: { status: 500 } });

        render(<UserPatientRestrictionsRemoveConfirmStage restriction={mockRestriction} />);

        const confirmButton = screen.getByTestId('confirm-remove-restriction-button');
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(routes.SERVER_ERROR));
        });
    });

    it('should navigate to session expired on 403 error', async () => {
        mockDeleteUserPatientRestriction.mockRejectedValue({ response: { status: 403 } });

        render(<UserPatientRestrictionsRemoveConfirmStage restriction={mockRestriction} />);

        const confirmButton = screen.getByTestId('confirm-remove-restriction-button');
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
        });
    });

    it('should navigate to user patient restrictions list page on cancel', async () => {
        render(<UserPatientRestrictionsRemoveConfirmStage restriction={mockRestriction} />);

        const cancelButton = screen.getByTestId('cancel-remove-button');
        await userEvent.click(cancelButton);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(routeChildren.USER_PATIENT_RESTRICTIONS_LIST);
        });
    });
});
