import { render, screen } from '@testing-library/react';
import { Mock } from 'vitest';
import UserPatientRestrictionsCompleteStage from './UserPatientRestrictionsCompleteStage';
import { UserPatientRestrictionsSubRoute } from '../../../../types/generic/userPatientRestriction';
import usePatient from '../../../../helpers/hooks/usePatient';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';
import userEvent from '@testing-library/user-event';
import { routes } from '../../../../types/generic/routes';

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
        render(
            <UserPatientRestrictionsCompleteStage route={UserPatientRestrictionsSubRoute.ADD} />,
        );

        expect(screen.getByTestId('page-title')).toHaveTextContent(
            'A restriction has been added to this patient record:',
        );
        expect(screen.getByTestId('restriction-added-message')).toBeInTheDocument();
    });

    it('renders the correct title and patient details when a restriction is removed', () => {
        render(
            <UserPatientRestrictionsCompleteStage route={UserPatientRestrictionsSubRoute.REMOVE} />,
        );

        expect(screen.getByTestId('page-title')).toHaveTextContent(
            'A restriction on accessing this patient record has been removed:',
        );
        expect(screen.getByTestId('restriction-removed-message')).toBeInTheDocument();
    });

    it('should navigate to user restrictions hub when the view restrictions button is clicked', async () => {
        render(
            <UserPatientRestrictionsCompleteStage route={UserPatientRestrictionsSubRoute.REMOVE} />,
        );

        const viewRestrictionsButton = screen.getByTestId('view-restrictions-button');
        await userEvent.click(viewRestrictionsButton);

        expect(mockNavigate).toHaveBeenCalledWith(routes.USER_PATIENT_RESTRICTIONS);
    });
});
