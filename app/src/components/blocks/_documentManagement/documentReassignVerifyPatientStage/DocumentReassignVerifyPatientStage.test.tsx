import { render, screen } from '@testing-library/react';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';
import { Mock } from 'vitest';
import userEvent from '@testing-library/user-event';
import { routes } from '../../../../types/generic/routes';
import DocumentReassignVerifyPatientDetailsStage from './DocumentReassignVerifyPatientStage';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});
vi.mock('../../../../helpers/hooks/useRole');
vi.mock('../../../../helpers/hooks/usePatient');

const mockNavigate = vi.fn();

describe('ReviewDetailsPatientVerifyStage', () => {
    const mockOnConfirmPatientDetails = vi.fn();

    it('renders the patient verify form with correct patient details', () => {
        const mockPatientDetails = buildPatientDetails();

        render(
            <DocumentReassignVerifyPatientDetailsStage
                onConfirmPatientDetails={mockOnConfirmPatientDetails}
                patientDetails={mockPatientDetails}
            />,
        );

        expect(screen.getByText(mockPatientDetails.familyName)).toBeInTheDocument();
        expect(screen.getByText(mockPatientDetails.givenName[0])).toBeInTheDocument();
    });

    it('calls onConfirmPatientDetails when the form is submitted', async () => {
        const mockPatientDetails = buildPatientDetails();

        render(
            <DocumentReassignVerifyPatientDetailsStage
                onConfirmPatientDetails={mockOnConfirmPatientDetails}
                patientDetails={mockPatientDetails}
            />,
        );

        const submitButton = screen.getByTestId('confirm-patient-details-btn');
        await userEvent.click(submitButton);

        expect(mockOnConfirmPatientDetails).toHaveBeenCalled();
    });

    it('should navigate to home when patientDetails are null', () => {
        render(
            <DocumentReassignVerifyPatientDetailsStage
                onConfirmPatientDetails={vi.fn()}
                patientDetails={null}
            />,
        );

        expect(mockNavigate).toHaveBeenCalledWith(routes.HOME);
    });
});
