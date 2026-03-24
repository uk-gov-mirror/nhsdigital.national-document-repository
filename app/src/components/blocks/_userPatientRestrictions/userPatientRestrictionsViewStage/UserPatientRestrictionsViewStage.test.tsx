import { render, screen, waitFor } from '@testing-library/react';
import UserPatientRestrictionsViewStage from './UserPatientRestrictionsViewStage';
import { UserPatientRestrictionsSubRoute } from '../../../../types/generic/userPatientRestriction';
import usePatient from '../../../../helpers/hooks/usePatient';
import { Mock } from 'vitest';
import { buildPatientDetails, buildUserRestrictions } from '../../../../helpers/test/testBuilders';
import getUserPatientRestrictions from '../../../../helpers/requests/userPatientRestrictions/getUserPatientRestrictions';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { UIErrorCode } from '../../../../types/generic/errors';
import userEvent from '@testing-library/user-event';
import useSmartcardNumber from '../../../../helpers/hooks/useSmartcardNumber';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        Link: ({ children }: { children: React.ReactNode }): React.JSX.Element => (
            <div>{children}</div>
        ),
    };
});
vi.mock('../../../../helpers/hooks/usePatient');
vi.mock('../../../../helpers/hooks/useSmartcardNumber');
vi.mock('../../../../helpers/hooks/useBaseAPIUrl');
vi.mock('../../../../helpers/hooks/useBaseAPIHeaders');
vi.mock('../../../../helpers/requests/userPatientRestrictions/getUserPatientRestrictions');

const mockNavigate = vi.fn();
const mockGetUserPatientRestrictions = getUserPatientRestrictions as Mock;
const mockUsePatient = usePatient as Mock;
const mockUserSmartcardNumber = useSmartcardNumber as Mock;

describe('UserPatientRestrictionsViewStage', () => {
    const mockPatient = buildPatientDetails();
    const mockRestrictions = buildUserRestrictions();

    beforeEach(() => {
        vi.resetAllMocks();
        mockUsePatient.mockReturnValue(mockPatient);
        mockGetUserPatientRestrictions.mockResolvedValue({
            restrictions: mockRestrictions,
        });
    });

    it('renders correctly', async () => {
        renderComponent();

        await waitFor(() => {
            expect(
                screen.getByText(
                    `${mockRestrictions[0].restrictedUserFirstName} ${mockRestrictions[0].restrictedUserLastName}`,
                ),
            ).toBeInTheDocument();
        });
    });

    it('displays loading spinner while fetching restrictions', async () => {
        mockGetUserPatientRestrictions.mockReturnValueOnce(new Promise(() => {}));

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('Loading restrictions...')).toBeInTheDocument();
        });
    });

    it('should not display remove button for restrictions on current user', async () => {
        mockUserSmartcardNumber.mockReturnValue(mockRestrictions[0].restrictedUser);

        renderComponent();

        await waitFor(() => {
            const removeButtons = screen.queryByTestId(
                `remove-restriction-button-${mockRestrictions[0].id}`,
            );
            expect(removeButtons).toBeNull();
        });
    });

    it('navigates to generic error page on patient access restricted error', async () => {
        const mockError = {
            response: {
                data: {
                    err_code: 'SP_4006',
                },
            },
        };
        mockGetUserPatientRestrictions.mockRejectedValueOnce(mockError);

        renderComponent();

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                routes.GENERIC_ERROR + '?errorCode=' + UIErrorCode.PATIENT_ACCESS_RESTRICTED,
                { replace: true },
            );
        });
    });

    it('navigates to session expired page on 403', async () => {
        const mockError = {
            response: {
                status: 403,
            },
        };
        mockGetUserPatientRestrictions.mockRejectedValueOnce(mockError);

        renderComponent();

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
        });
    });

    it('navigates to session expired page on 403', async () => {
        const mockError = {
            response: {
                status: 500,
            },
        };
        mockGetUserPatientRestrictions.mockRejectedValueOnce(mockError);

        renderComponent();

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(routes.SERVER_ERROR));
        });
    });

    it('navigates to add restriction page on add restriction click', async () => {
        renderComponent();

        const addButton = screen.getByTestId('add-restriction-button');
        await userEvent.click(addButton);

        await waitFor(() => {
            expect(mockSetSubRoute).toHaveBeenCalledWith(UserPatientRestrictionsSubRoute.ADD);
            expect(mockNavigate).toHaveBeenCalledWith(routeChildren.USER_PATIENT_RESTRICTIONS_ADD);
        });
    });
});

const onRemoveRestriction = vi.fn();
const mockSetSubRoute = vi.fn();

const renderComponent = (): void => {
    render(
        <UserPatientRestrictionsViewStage
            setSubRoute={mockSetSubRoute}
            onRemoveRestriction={onRemoveRestriction}
        />,
    );
};
