import { render, screen } from '@testing-library/react';
import ReviewDetailsPatientVerifyStage from './ReviewDetailsPatientVerifyStage';
import userEvent from '@testing-library/user-event';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';
import { Mock } from 'vitest';
import { formatNhsNumber } from '../../../../helpers/utils/formatNhsNumber';
import { getFormattedDateFromString } from '../../../../helpers/utils/formatDate';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => vi.fn(),
        Link: ({
            children,
            onClick,
        }: {
            children: React.ReactNode;
            onClick?: () => void;
        }): React.JSX.Element => <button onClick={onClick}>{children}</button>,
    };
});
vi.mock('../../../../helpers/hooks/useRole');
vi.mock('../../../../helpers/hooks/usePatient');

describe('ReviewDetailsPatientVerifyStage', () => {
    const mockPatientDetails = buildPatientDetails();

    it('renders the patient verify form with correct patient details', () => {
        const mockOnSubmit = vi.fn();

        render(
            <ReviewDetailsPatientVerifyStage
                onSubmit={mockOnSubmit}
                patientDetails={mockPatientDetails}
            />,
        );

        expect(screen.getByText('Patient details')).toBeInTheDocument();
        expect(screen.getByText(mockPatientDetails.familyName)).toBeInTheDocument();
        expect(screen.getByText(mockPatientDetails.givenName[0])).toBeInTheDocument();
        expect(screen.getByText(mockPatientDetails.postalCode!)).toBeInTheDocument();
        expect(screen.getByText(formatNhsNumber(mockPatientDetails.nhsNumber))).toBeInTheDocument();
        expect(
            screen.getByText(getFormattedDateFromString(mockPatientDetails.birthDate)),
        ).toBeInTheDocument();
    });

    it('calls onSubmit when the form is submitted', async () => {
        const mockOnSubmit = vi.fn();

        render(
            <ReviewDetailsPatientVerifyStage
                onSubmit={mockOnSubmit}
                patientDetails={mockPatientDetails}
            />,
        );

        const submitButton = screen.getByTestId('confirm-patient-details-btn');
        await userEvent.click(submitButton);

        expect(mockOnSubmit).toHaveBeenCalled();
    });
});
