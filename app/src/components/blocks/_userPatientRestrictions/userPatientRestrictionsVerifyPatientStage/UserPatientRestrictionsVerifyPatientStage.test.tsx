import userEvent from '@testing-library/user-event';
import UserPatientRestrictionsVerifyPatientStage from './UserPatientRestrictionsVerifyPatientStage';
import { UserPatientRestrictionsSubRoute } from '../../../../types/generic/userPatientRestriction';
import { render, screen } from '@testing-library/react';
import usePatient from '../../../../helpers/hooks/usePatient';
import { Mock } from 'vitest';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';
import { formatNhsNumber } from '../../../../helpers/utils/formatNhsNumber';
import { getFormattedDateFromString } from '../../../../helpers/utils/formatDate';

vi.mock('react-router-dom', () => ({
    ...vi.importActual('react-router-dom'),
    useNavigate: (): Mock => mockNavigate,
}));

vi.mock('../../../../helpers/hooks/usePatient');

const mockUsePatient = usePatient as Mock;
const mockNavigate = vi.fn();

const mockPatient = buildPatientDetails();

describe('UserPatientRestrictionsVerifyPatientStage', () => {
    const confirmClicked = vi.fn();

    beforeEach(() => {
        vi.resetAllMocks();
        mockUsePatient.mockReturnValue(mockPatient);
    });

    it('renders the correct title and patient summary fields for the add route', async () => {
        render(
            <UserPatientRestrictionsVerifyPatientStage
                route={UserPatientRestrictionsSubRoute.ADD}
                confirmClicked={confirmClicked}
            />,
        );

        expect(screen.getByText('Patient details')).toBeInTheDocument();
        expect(screen.getByText(formatNhsNumber(mockPatient.nhsNumber))).toBeInTheDocument();
        expect(screen.getByText(mockPatient.familyName)).toBeInTheDocument();
        expect(screen.getByText(mockPatient.givenName.join(' '))).toBeInTheDocument();
        expect(
            screen.getByText(getFormattedDateFromString(mockPatient.birthDate)),
        ).toBeInTheDocument();
        expect(screen.getByText(mockPatient.postalCode!)).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('confirm-patient-details'));
        expect(confirmClicked).toHaveBeenCalled();
    });

    it('renders the correct title and patient summary fields for the view route', async () => {
        render(
            <UserPatientRestrictionsVerifyPatientStage
                route={UserPatientRestrictionsSubRoute.VIEW}
                confirmClicked={confirmClicked}
            />,
        );

        expect(screen.getByText('Verify patient details to view restrictions')).toBeInTheDocument();
        expect(screen.getByText(formatNhsNumber(mockPatient.nhsNumber))).toBeInTheDocument();
        expect(screen.getByText(mockPatient.familyName)).toBeInTheDocument();
        expect(screen.getByText(mockPatient.givenName.join(' '))).toBeInTheDocument();
        expect(
            screen.queryByText(getFormattedDateFromString(mockPatient.birthDate)),
        ).not.toBeInTheDocument();
        expect(screen.queryByText(mockPatient.postalCode!)).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId('confirm-patient-details'));
        expect(confirmClicked).toHaveBeenCalled();
    });
});
