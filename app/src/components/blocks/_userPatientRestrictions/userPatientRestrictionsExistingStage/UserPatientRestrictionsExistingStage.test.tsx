import { render, screen, waitFor } from '@testing-library/react';
import UserPatientRestrictionsExistingStage from './UserPatientRestrictionsExistingStage';
import { Mock } from 'vitest';
import getUserPatientRestrictions from '../../../../helpers/requests/userPatientRestrictions/getUserPatientRestrictions';
import usePatient from '../../../../helpers/hooks/usePatient';
import { buildPatientDetails, buildUserRestrictions } from '../../../../helpers/test/testBuilders';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { UserPatientRestriction } from '../../../../types/generic/userPatientRestriction';
import userEvent from '@testing-library/user-event';

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
vi.mock('../../../../helpers/requests/userPatientRestrictions/getUserPatientRestrictions');
vi.mock('../../../../helpers/hooks/usePatient');
vi.mock('../../../../helpers/hooks/useBaseAPIHeaders');
vi.mock('../../../../helpers/hooks/useBaseAPIUrl');

const mockNavigate = vi.fn();
const mockGetUserPatientRestrictions = getUserPatientRestrictions as Mock;
const mockUsePatient = usePatient as Mock;
const setExistingRestrictions = vi.fn();

describe('UserPatientRestrictionsExistingStage', () => {
    const mockRestrictions = buildUserRestrictions();
    const mockPatient = buildPatientDetails();

    beforeEach(() => {
        vi.resetAllMocks();
        mockGetUserPatientRestrictions.mockResolvedValue({ restrictions: mockRestrictions });
        mockUsePatient.mockReturnValue(mockPatient);
    });

    it('renders the page correctly', async () => {
        renderComponent(mockRestrictions);

        await waitFor(() => {
            expect(mockGetUserPatientRestrictions).toHaveBeenCalledWith(
                expect.objectContaining({
                    nhsNumber: mockPatient.nhsNumber,
                    limit: 100,
                }),
            );
            expect(setExistingRestrictions).toHaveBeenCalledWith(mockRestrictions);
            expect(
                screen.getByText(
                    `${mockRestrictions[0].restrictedUserFirstName} ${mockRestrictions[0].restrictedUserLastName}`,
                ),
            ).toBeInTheDocument();
        });
    });

    it('navigates to search staff if no restrictions found', async () => {
        mockGetUserPatientRestrictions.mockResolvedValue({ restrictions: [] });

        renderComponent();

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                routeChildren.USER_PATIENT_RESTRICTIONS_SEARCH_STAFF,
                { replace: true },
            );
        });
    });

    it('navigates to session expired if 403 error thrown', async () => {
        mockGetUserPatientRestrictions.mockRejectedValue({ response: { status: 403 } });

        renderComponent();

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
        });
    });

    it('navigates to server error if non-403 error thrown', async () => {
        mockGetUserPatientRestrictions.mockRejectedValue({ response: { status: 500 } });

        renderComponent();

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(routes.SERVER_ERROR));
        });
    });

    it('shows loading state while fetching restrictions', async () => {
        mockGetUserPatientRestrictions.mockReturnValue(new Promise(() => {}));

        renderComponent();

        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('navigates to verify patient on continue clicked', async () => {
        renderComponent(mockRestrictions);

        let continueButton;
        await waitFor(() => {
            continueButton = screen.getByTestId('add-restriction-button');
            expect(continueButton).toBeInTheDocument();
        });
        await userEvent.click(continueButton!);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                routeChildren.USER_PATIENT_RESTRICTIONS_SEARCH_STAFF,
            );
        });
    });
});

const renderComponent = (existingRestrictions: UserPatientRestriction[] = []): void => {
    render(
        <UserPatientRestrictionsExistingStage
            existingRestrictions={existingRestrictions}
            setExistingRestrictions={setExistingRestrictions}
        />,
    );
};
