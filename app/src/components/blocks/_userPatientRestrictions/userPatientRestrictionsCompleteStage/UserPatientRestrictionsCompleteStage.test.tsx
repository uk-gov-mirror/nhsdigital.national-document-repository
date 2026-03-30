import { render, screen } from '@testing-library/react';
import { Mock } from 'vitest';
import UserPatientRestrictionsCompleteStage from './UserPatientRestrictionsCompleteStage';
import { UserPatientRestrictionsSubRoute } from '../../../../types/generic/userPatientRestriction';
import usePatient from '../../../../helpers/hooks/usePatient';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';
import userEvent from '@testing-library/user-event';
import { routeChildren } from '../../../../types/generic/routes';
import { UserPatientRestrictionsJourneyState } from '../../../../pages/userPatientRestrictionsPage/useUserPatientRestrictionsPageHook';

vi.mock('react-router-dom', async () => ({
    ...(await vi.importActual('react-router-dom')),
    useNavigate: (): Mock => mockNavigate,
}));
vi.mock('../../../../helpers/hooks/usePatient');

const mockNavigate = vi.fn();
const mockUsePatient = usePatient as Mock;

describe('UserPatientRestrictionsCompleteStage', () => {
    beforeEach(() => {
        mockUsePatient.mockReturnValue(buildPatientDetails());
    });

    it('renders the correct title and patient details when a restriction is added', () => {
        renderComponent(UserPatientRestrictionsSubRoute.ADD);

        expect(screen.getByTestId('page-title')).toHaveTextContent(
            'A restriction has been added to this patient record:',
        );
        expect(screen.getByTestId('restriction-added-message')).toBeInTheDocument();
    });

    it('renders the correct title and patient details when a restriction is removed', () => {
        renderComponent(UserPatientRestrictionsSubRoute.REMOVE);

        expect(screen.getByTestId('page-title')).toHaveTextContent(
            'A restriction on accessing this patient record has been removed:',
        );
        expect(screen.getByTestId('restriction-removed-message')).toBeInTheDocument();
    });

    it('should navigate to user restrictions list page when the view restrictions button is clicked', async () => {
        renderComponent(UserPatientRestrictionsSubRoute.REMOVE);

        const viewRestrictionsButton = screen.getByTestId('view-restrictions-button');
        await userEvent.click(viewRestrictionsButton);

        expect(mockNavigate).toHaveBeenCalledWith(routeChildren.USER_PATIENT_RESTRICTIONS_LIST);
    });

    it('should navigate back when the journey state is not complete', () => {
        renderComponent(
            UserPatientRestrictionsSubRoute.ADD,
            UserPatientRestrictionsJourneyState.INITIAL,
        );

        expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
});

const renderComponent = (
    route: UserPatientRestrictionsSubRoute,
    journeyState: UserPatientRestrictionsJourneyState = UserPatientRestrictionsJourneyState.COMPLETE,
): void => {
    render(<UserPatientRestrictionsCompleteStage route={route} journeyState={journeyState} />);
};
