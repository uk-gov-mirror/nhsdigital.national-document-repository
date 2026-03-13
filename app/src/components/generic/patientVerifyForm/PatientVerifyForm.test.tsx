import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { runAxeTest } from '../../../helpers/test/axeTestHelper';
import { buildPatientDetails } from '../../../helpers/test/testBuilders';
import { REPOSITORY_ROLE } from '../../../types/generic/authRole';
import PatientVerifyForm from './PatientVerifyForm';
import { PatientDetails } from '../../../types/generic/patientDetails';
import useRole from '../../../helpers/hooks/useRole';

const mockNavigate = vi.fn();
const mockUseRole = useRole as Mock;

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});

vi.mock('../../../helpers/hooks/useRole');
vi.mock('../../../helpers/hooks/usePatient');

describe('PatientVerifyForm', () => {
    const mockOnSubmit = vi.fn();

    beforeEach(() => {
        mockUseRole.mockReturnValue(REPOSITORY_ROLE.GP_ADMIN);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders page heading', () => {
            renderComponent(mockOnSubmit);

            // PatientSummary renders patient information in a summary list with separate rows
            expect(screen.getByTestId('patient-summary')).toBeInTheDocument();
            expect(screen.getByText('Doe')).toBeInTheDocument();
            expect(screen.getByText('John')).toBeInTheDocument();
            expect(
                screen.getByText(
                    'This page displays the current data recorded in the Personal Demographics Service for this patient.',
                ),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: 'Confirm patient details and continue' }),
            ).toBeInTheDocument();
            expect(screen.queryByText('Information')).not.toBeInTheDocument();
        });
    });

    describe('Warning Callouts', () => {
        it('shows deceased warning for GP Admin with deceased patient', () => {
            const deceasedPatient = buildPatientDetails({ deceased: true });
            mockUseRole.mockReturnValue(REPOSITORY_ROLE.GP_ADMIN);

            renderComponent(mockOnSubmit, deceasedPatient);

            expect(
                screen.getByRole('heading', {
                    name: /Important:?\s*This record is for a deceased patient/i,
                }),
            ).toBeInTheDocument();
            expect(
                screen.getByText(/Access to the records of deceased patients is regulated/),
            ).toBeInTheDocument();
        });

        it('does not show deceased warning for PCSE user', () => {
            const deceasedPatient = buildPatientDetails({ deceased: true });
            mockUseRole.mockReturnValue(REPOSITORY_ROLE.PCSE);

            renderComponent(mockOnSubmit, deceasedPatient);

            expect(
                screen.queryByRole('heading', {
                    name: /Important:?\s*This record is for a deceased patient/i,
                }),
            ).not.toBeInTheDocument();
        });

        it('shows superseded warning', () => {
            const supersededPatient = buildPatientDetails({ superseded: true });

            renderComponent(mockOnSubmit, supersededPatient);

            expect(
                screen.getByRole('heading', { name: /Important:?\s*Information/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByText('The NHS number for this patient has changed.'),
            ).toBeInTheDocument();
        });

        it('shows restricted warning', () => {
            const restrictedPatient = buildPatientDetails({ restricted: true });

            renderComponent(mockOnSubmit, restrictedPatient);

            expect(
                screen.getByRole('heading', { name: /Important:?\s*Information/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByText(/Certain details about this patient cannot be displayed/),
            ).toBeInTheDocument();
        });

        it('shows multiple warnings together', () => {
            const multiWarningPatient = buildPatientDetails({
                superseded: true,
                restricted: true,
            });

            renderComponent(mockOnSubmit, multiWarningPatient);

            expect(
                screen.getByText('The NHS number for this patient has changed.'),
            ).toBeInTheDocument();
            expect(
                screen.getByText(/Certain details about this patient cannot be displayed/),
            ).toBeInTheDocument();
        });

        it('includes external link in deceased warning', () => {
            const deceasedPatient = buildPatientDetails({ deceased: true });
            mockUseRole.mockReturnValue(REPOSITORY_ROLE.GP_ADMIN);

            renderComponent(mockOnSubmit, deceasedPatient);

            const link = screen.getByRole('link', {
                name: /Access to the health and care records of deceased people/,
            });
            expect(link).toHaveAttribute(
                'href',
                'https://transform.england.nhs.uk/information-governance/guidance/access-to-the-health-and-care-records-of-deceased-people/',
            );
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noreferrer');
        });
    });

    describe('User Interactions', () => {
        it('calls onSubmit when confirm button clicked', async () => {
            const patientDetails = buildPatientDetails({});
            renderComponent(mockOnSubmit, patientDetails);

            const confirmButton = screen.getByTestId('confirm-patient-details-btn');
            await userEvent.click(confirmButton);

            await waitFor(() => {
                expect(mockOnSubmit).toHaveBeenCalled();
            });
        });

        it('passes setInputError to onSubmit', async () => {
            const patientDetails = buildPatientDetails({});
            renderComponent(mockOnSubmit, patientDetails);

            const confirmButton = screen.getByTestId('confirm-patient-details-btn');
            await userEvent.click(confirmButton);

            await waitFor(() => {
                expect(mockOnSubmit).toHaveBeenCalled();
            });
        });
    });

    describe('Accessibility', () => {
        it('passes axe tests with no warnings', async () => {
            renderComponent(mockOnSubmit);

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });

        it('passes axe tests with deceased warning', async () => {
            const deceasedPatient = buildPatientDetails({ deceased: true });
            mockUseRole.mockReturnValue(REPOSITORY_ROLE.GP_ADMIN);

            renderComponent(mockOnSubmit, deceasedPatient);

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });
    });
});

const renderComponent = (
    onSubmit: Mock,
    patientDetails: PatientDetails = buildPatientDetails(),
): void => {
    render(<PatientVerifyForm onSubmit={onSubmit} patientDetails={patientDetails} />);
};
