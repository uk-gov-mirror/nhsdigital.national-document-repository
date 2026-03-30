import { render, screen } from '@testing-library/react';
import UserPatientRestrictionsAddConfirmStage from './UserPatientRestrictionsAddConfirmStage';
import { Mock } from 'vitest';
import usePatient from '../../../../helpers/hooks/usePatient';
import postUserPatientRestriction from '../../../../helpers/requests/userPatientRestrictions/createUserPatientRestriction';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';
import { userEvent } from '@testing-library/user-event';
import { routeChildren, routes } from '../../../../types/generic/routes';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        Link: ({ children, to }: { children: React.ReactNode; to: string }): React.JSX.Element => (
            <a href={to}>{children}</a>
        ),
    };
});
vi.mock('../../../../helpers/hooks/usePatient');
vi.mock('../../../../helpers/hooks/useBaseAPIUrl');
vi.mock('../../../../helpers/hooks/useBaseAPIHeaders');
vi.mock('../../../../helpers/requests/userPatientRestrictions/createUserPatientRestriction');

const mockNavigate = vi.fn();
const mockUsePatient = usePatient as Mock;
const mockPostUserPatientRestriction = postUserPatientRestriction as Mock;
const mockPatient = buildPatientDetails();
const userInformation = {
    name: 'John Doe',
    smartcardId: '123456789012',
    firstName: 'John',
    lastName: 'Doe',
};

describe('UserPatientRestrictionsAddConfirmStage', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockUsePatient.mockReturnValue(mockPatient);
        mockPostUserPatientRestriction.mockResolvedValue({});
    });

    it('renders correctly', () => {
        render(<UserPatientRestrictionsAddConfirmStage userInformation={userInformation} />);

        expect(screen.getByTestId('smartcard-id')).toHaveTextContent(userInformation.smartcardId);
        expect(screen.getByTestId('staff-member')).toHaveTextContent(
            `${userInformation.firstName} ${userInformation.lastName}`,
        );
    });

    it('submits new patient restriction and navigates to success page on button click', async () => {
        render(<UserPatientRestrictionsAddConfirmStage userInformation={userInformation} />);

        const button = screen.getByTestId('continue-button');
        await userEvent.click(button);

        expect(mockPostUserPatientRestriction).toHaveBeenCalledWith(
            expect.objectContaining({
                nhsNumber: mockPatient.nhsNumber,
                smartcardId: userInformation.smartcardId,
            }),
        );

        expect(mockNavigate).toHaveBeenCalledWith(
            routeChildren.USER_PATIENT_RESTRICTIONS_ACTION_COMPLETE,
        );
    });

    it('shows loading state when submitting restriction', async () => {
        render(<UserPatientRestrictionsAddConfirmStage userInformation={userInformation} />);

        mockPostUserPatientRestriction.mockReturnValue(new Promise(() => {}));

        const button = screen.getByTestId('continue-button');
        await userEvent.click(button);

        expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('navigates to error page on 500', async () => {
        render(<UserPatientRestrictionsAddConfirmStage userInformation={userInformation} />);

        mockPostUserPatientRestriction.mockRejectedValue({
            response: { status: 500 },
        });

        const button = screen.getByTestId('continue-button');
        await userEvent.click(button);

        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(routes.SERVER_ERROR));
    });

    it('navigates to session expired page on 403', async () => {
        render(<UserPatientRestrictionsAddConfirmStage userInformation={userInformation} />);

        mockPostUserPatientRestriction.mockRejectedValue({
            response: { status: 403 },
        });

        const button = screen.getByTestId('continue-button');
        await userEvent.click(button);

        expect(mockNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
    });
});
