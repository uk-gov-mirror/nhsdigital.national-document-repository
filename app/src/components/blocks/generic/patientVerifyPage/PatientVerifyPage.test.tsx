import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import getPatientDetails from '../../../../helpers/requests/getPatientDetails';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';
import { handleSearch, PATIENT_SEARCH_STATES } from '../../../../helpers/utils/handlePatientSearch';
import { REPOSITORY_ROLE } from '../../../../types/generic/authRole';
import PatientVerifyPage from './PatientVerifyPage';

const mockNavigate = vi.fn();
const mockUsePatient = vi.fn();
const mockUseRole = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});

vi.mock('../../../../helpers/hooks/usePatient', () => ({
    default: (): unknown => mockUsePatient(),
}));

vi.mock('../../../../helpers/hooks/useRole', () => ({
    default: (): unknown => mockUseRole(),
}));

vi.mock('../../../../helpers/requests/getPatientDetails');
const mockGetPatientDetails = getPatientDetails as Mock;

describe('PatientVerifyPage', () => {
    const mockOnSubmit = vi.fn();
    const mockPatientDetails = buildPatientDetails({
        givenName: ['Jane'],
        familyName: 'Smith',
        nhsNumber: '9000000009',
        active: true,
        deceased: false,
    });

    beforeEach(() => {
        mockUseRole.mockReturnValue(REPOSITORY_ROLE.GP_ADMIN);
        mockUsePatient.mockReturnValue(mockPatientDetails);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders page heading', () => {
            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            expect(screen.getByRole('heading', { name: 'Patient details' })).toBeInTheDocument();
        });

        it('renders back button', () => {
            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            expect(screen.getByRole('link', { name: /back/i })).toBeInTheDocument();
        });

        it('renders back button with default route when clicked', async () => {
            mockNavigate.mockClear();
            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            const backLink = screen.getByRole('link', { name: /back/i });
            await userEvent.click(backLink);

            expect(mockNavigate).toHaveBeenCalledWith('/patient/search');
        });

        it('renders back button with custom backLinkOverride when clicked', async () => {
            mockNavigate.mockClear();
            render(
                <PatientVerifyPage 
                    onSubmit={mockOnSubmit} 
                    backLinkOverride="/admin/reviews/test-123/search-patient"
                />
            );

            const backLink = screen.getByRole('link', { name: /back/i });
            await userEvent.click(backLink);

            expect(mockNavigate).toHaveBeenCalledWith('/admin/reviews/test-123/search-patient');
        });

        it('renders patient summary', () => {
            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            // PatientSummary renders patient information in a summary list with separate rows
            expect(screen.getByTestId('patient-summary')).toBeInTheDocument();
            expect(screen.getByText('Smith')).toBeInTheDocument();
            expect(screen.getByText('Jane')).toBeInTheDocument();
        });

        it('renders PDS message', () => {
            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            expect(
                screen.getByText(
                    'This page displays the current data recorded in the Personal Demographics Service for this patient.',
                ),
            ).toBeInTheDocument();
        });

        it('renders confirm button', () => {
            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            expect(
                screen.getByRole('button', { name: 'Confirm patient details and continue' }),
            ).toBeInTheDocument();
        });

        it('does not show warning for active patient', () => {
            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            expect(screen.queryByText('Information')).not.toBeInTheDocument();
        });
    });

    describe('Warning Callouts', () => {
        it('shows deceased warning for GP Admin with deceased patient', () => {
            const deceasedPatient = buildPatientDetails({ deceased: true });
            mockUsePatient.mockReturnValue(deceasedPatient);
            mockUseRole.mockReturnValue(REPOSITORY_ROLE.GP_ADMIN);

            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

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
            mockUsePatient.mockReturnValue(deceasedPatient);
            mockUseRole.mockReturnValue(REPOSITORY_ROLE.PCSE);

            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            expect(
                screen.queryByRole('heading', {
                    name: /Important:?\s*This record is for a deceased patient/i,
                }),
            ).not.toBeInTheDocument();
        });

        it('shows superseded warning', () => {
            const supersededPatient = buildPatientDetails({ superseded: true });
            mockUsePatient.mockReturnValue(supersededPatient);

            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            expect(
                screen.getByRole('heading', { name: /Important:?\s*Information/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByText('The NHS number for this patient has changed.'),
            ).toBeInTheDocument();
        });

        it('shows restricted warning', () => {
            const restrictedPatient = buildPatientDetails({ restricted: true });
            mockUsePatient.mockReturnValue(restrictedPatient);

            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

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
            mockUsePatient.mockReturnValue(multiWarningPatient);

            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            expect(
                screen.getByText('The NHS number for this patient has changed.'),
            ).toBeInTheDocument();
            expect(
                screen.getByText(/Certain details about this patient cannot be displayed/),
            ).toBeInTheDocument();
        });

        it('includes external link in deceased warning', () => {
            const deceasedPatient = buildPatientDetails({ deceased: true });
            mockUsePatient.mockReturnValue(deceasedPatient);
            mockUseRole.mockReturnValue(REPOSITORY_ROLE.GP_ADMIN);

            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

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
            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            const confirmButton = screen.getByRole('button', {
                name: 'Confirm patient details and continue',
            });
            await userEvent.click(confirmButton);

            await waitFor(() => {
                expect(mockOnSubmit).toHaveBeenCalled();
            });
        });

        it('passes setInputError to onSubmit', async () => {
            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            const confirmButton = screen.getByRole('button', {
                name: 'Confirm patient details and continue',
            });
            await userEvent.click(confirmButton);

            await waitFor(() => {
                expect(mockOnSubmit).toHaveBeenCalledWith(expect.any(Function));
            });
        });
    });

    describe('Error Display', () => {
        it('does not show error box initially', () => {
            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            expect(screen.queryByText('There is a problem')).not.toBeInTheDocument();
        });

        it('shows error box when inputError is set', async () => {
            const mockOnSubmitWithError = vi.fn((setInputError) => {
                setInputError('Test error message');
            });

            render(<PatientVerifyPage onSubmit={mockOnSubmitWithError} />);

            const confirmButton = screen.getByRole('button', {
                name: 'Confirm patient details and continue',
            });
            await userEvent.click(confirmButton);

            await waitFor(() => {
                expect(screen.getByText('There is a problem')).toBeInTheDocument();
                expect(screen.getByText('Test error message')).toBeInTheDocument();
            });
        });
    });

    describe('Role-Specific Behavior', () => {
        it('renders for PCSE users', () => {
            mockUseRole.mockReturnValue(REPOSITORY_ROLE.PCSE);

            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            // Component renders successfully for PCSE role
            expect(screen.getByRole('heading', { name: 'Patient details' })).toBeInTheDocument();
        });

        it('renders for GP Admin users', () => {
            mockUseRole.mockReturnValue(REPOSITORY_ROLE.GP_ADMIN);

            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            expect(screen.getByRole('heading', { name: 'Patient details' })).toBeInTheDocument();
        });

        it('renders for GP Clinical users', () => {
            mockUseRole.mockReturnValue(REPOSITORY_ROLE.GP_CLINICAL);

            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            expect(screen.getByRole('heading', { name: 'Patient details' })).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('passes axe tests with no warnings', async () => {
            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });

        it('passes axe tests with deceased warning', async () => {
            const deceasedPatient = buildPatientDetails({ deceased: true });
            mockUsePatient.mockReturnValue(deceasedPatient);
            mockUseRole.mockReturnValue(REPOSITORY_ROLE.GP_ADMIN);

            render(<PatientVerifyPage onSubmit={mockOnSubmit} />);

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });

        it('passes axe tests with error state', async () => {
            const mockOnSubmitWithError = vi.fn((setInputError) => {
                setInputError('Test error');
            });

            render(<PatientVerifyPage onSubmit={mockOnSubmitWithError} />);

            const confirmButton = screen.getByRole('button', {
                name: 'Confirm patient details and continue',
            });
            await userEvent.click(confirmButton);

            await waitFor(async () => {
                const results = await runAxeTest(document.body);
                expect(results).toHaveNoViolations();
            });
        });
    });
});

describe('handleSearch', () => {
    const mockSetSearchingState = vi.fn();
    const mockHandleSuccess = vi.fn();

    const defaultArgs = {
        nhsNumber: '900 000 0009',
        setSearchingState: mockSetSearchingState,
        handleSuccess: mockHandleSuccess,
        baseUrl: 'https://api.example.com',
        baseHeaders: { Authorization: 'Bearer token' },
        userIsGPAdmin: false,
        userIsGPClinical: false,
        mockLocal: { patientIsActive: true, patientIsDeceased: false },
        featureFlags: { uploadArfWorkflowEnabled: false, uploadLambdaEnabled: false },
    };

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Successful Search', () => {
        it('sets searching state when called', async () => {
            const mockPatient = buildPatientDetails({ active: true });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            await handleSearch(defaultArgs as any);

            expect(mockSetSearchingState).toHaveBeenCalledWith(PATIENT_SEARCH_STATES.SEARCHING);
        });

        it('returns undefined on successful search', async () => {
            const mockPatient = buildPatientDetails({ active: true });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            const result = await handleSearch(defaultArgs as any);

            expect(result).toBeUndefined();
        });

        it('calls getPatientDetails with cleaned NHS number', async () => {
            const mockPatient = buildPatientDetails({ active: true });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            await handleSearch({ ...defaultArgs, nhsNumber: '900-000-0009' } as any);

            expect(mockGetPatientDetails).toHaveBeenCalledWith({
                nhsNumber: '9000000009',
                baseUrl: defaultArgs.baseUrl,
                baseHeaders: defaultArgs.baseHeaders,
            });
        });

        it('removes spaces from NHS number', async () => {
            const mockPatient = buildPatientDetails({ active: true });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            await handleSearch({ ...defaultArgs, nhsNumber: '900 000 0009' } as any);

            expect(mockGetPatientDetails).toHaveBeenCalledWith({
                nhsNumber: '9000000009',
                baseUrl: defaultArgs.baseUrl,
                baseHeaders: defaultArgs.baseHeaders,
            });
        });

        it('calls handleSuccess with patient details', async () => {
            const mockPatient = buildPatientDetails({ active: true });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            await handleSearch(defaultArgs as any);

            expect(mockHandleSuccess).toHaveBeenCalledWith(mockPatient);
        });
    });

    describe('Inactive Patient Handling', () => {
        it('returns error for inactive patient when user is GP Clinical', async () => {
            const inactivePatient = buildPatientDetails({ active: false, deceased: false });
            mockGetPatientDetails.mockResolvedValue(inactivePatient);

            const result = await handleSearch({ ...defaultArgs, userIsGPClinical: true } as any);

            expect(result).toEqual([expect.any(String), 404, undefined]);
            expect(mockHandleSuccess).not.toHaveBeenCalled();
        });

        it('returns error for inactive patient when user is GP Admin with disabled features', async () => {
            const inactivePatient = buildPatientDetails({ active: false, deceased: false });
            mockGetPatientDetails.mockResolvedValue(inactivePatient);

            const result = await handleSearch({
                ...defaultArgs,
                userIsGPAdmin: true,
                featureFlags: { uploadArfWorkflowEnabled: false, uploadLambdaEnabled: false },
            } as any);

            expect(result).toEqual([expect.any(String), 404, undefined]);
            expect(mockHandleSuccess).not.toHaveBeenCalled();
        });

        it('allows inactive patient for GP Admin with enabled features', async () => {
            const inactivePatient = buildPatientDetails({ active: false, deceased: false });
            mockGetPatientDetails.mockResolvedValue(inactivePatient);

            const result = await handleSearch({
                ...defaultArgs,
                userIsGPAdmin: true,
                featureFlags: { uploadArfWorkflowEnabled: true, uploadLambdaEnabled: true },
            } as any);

            expect(mockHandleSuccess).toHaveBeenCalledWith(inactivePatient);
            expect(result).toBeUndefined();
        });

        it('allows deceased patient to proceed', async () => {
            const deceasedPatient = buildPatientDetails({ active: false, deceased: true });
            mockGetPatientDetails.mockResolvedValue(deceasedPatient);

            await handleSearch({ ...defaultArgs, userIsGPClinical: true } as any);

            expect(mockHandleSuccess).toHaveBeenCalledWith(deceasedPatient);
        });
    });

    describe('Error Handling', () => {
        it('returns 400 error with invalid NHS number message', async () => {
            const error = {
                response: { status: 400 },
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            const result = await handleSearch(defaultArgs as any);

            expect(result).toEqual(['Enter a valid patient NHS number.', 400, error]);
        });

        it('returns 403 error', async () => {
            const error = {
                response: { status: 403 },
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            const result = await handleSearch(defaultArgs as any);

            expect(result).toEqual([null, 403, error]);
        });

        it('returns 404 error with patient not found message', async () => {
            const error = {
                response: {
                    status: 404,
                    data: { err_code: 'PATIENT_NOT_FOUND' },
                },
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            const result = await handleSearch(defaultArgs as any);

            expect(result).toEqual([expect.any(String), 404, error]);
        });

        it('returns 500 error as unhandled', async () => {
            const error = {
                response: { status: 500 },
                message: 'Server error',
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            const result = await handleSearch(defaultArgs as any);

            expect(result).toEqual([null, null, error]);
        });

        it('returns error without response status', async () => {
            const error = {
                message: 'Network error',
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            const result = await handleSearch(defaultArgs as any);

            expect(result).toEqual([null, null, error]);
        });
    });
});
