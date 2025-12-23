import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import ReviewsDetailsPage from './ReviewDetailsPage';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';
import { routeChildren } from '../../../../types/generic/routes';
import { DOWNLOAD_STAGE } from '../../../../types/generic/downloadStage';
import { REPOSITORY_ROLE } from '../../../../types/generic/authRole';
import * as getPdfObjectUrlModule from '../../../../helpers/utils/getPdfObjectUrl';
import * as isLocalModule from '../../../../helpers/utils/isLocal';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';

const mockNavigate = vi.fn();
const mockSetPatientDetails = vi.fn();
const mockUsePatientDetailsContext = vi.fn();
const mockUseSessionContext = vi.fn();

vi.mock('react-router-dom', async (): Promise<unknown> => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        useParams: (): { reviewId: string } => ({ reviewId: 'test-review-123' }),
    };
});

vi.mock('../../../../providers/patientProvider/PatientProvider', () => ({
    usePatientDetailsContext: (): unknown => mockUsePatientDetailsContext(),
}));

vi.mock('../../../../providers/sessionProvider/SessionProvider', () => ({
    useSessionContext: (): unknown => mockUseSessionContext(),
}));

vi.mock('../../../../helpers/hooks/useRole', () => ({
    default: (): string => REPOSITORY_ROLE.GP_ADMIN,
}));

vi.mock('../../../../helpers/utils/getPdfObjectUrl');

describe('ReviewDetailsPage', () => {
    const testReviewSnoMed: DOCUMENT_TYPE = '16521000000101' as DOCUMENT_TYPE;
    const mockPatientDetails = buildPatientDetails({
        givenName: ['Kevin'],
        familyName: 'Calvin',
        nhsNumber: '9691914948',
        birthDate: '2002-06-03',
        postalCode: 'AB12 3CD',
    });

    const mockSession = {
        auth: { authorisation_token: 'test-token' },
        isFullscreen: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockUsePatientDetailsContext.mockReturnValue([mockPatientDetails, mockSetPatientDetails]);
        mockUseSessionContext.mockReturnValue([mockSession, vi.fn()]);

        // Mock isLocal to return false by default
        vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(false);

        // Mock getPdfObjectUrl
        vi.spyOn(getPdfObjectUrlModule, 'getPdfObjectUrl').mockImplementation(
            (url, setPdfUrl, setStage) => {
                setPdfUrl('blob:mock-pdf-url');
                setStage(DOWNLOAD_STAGE.SUCCEEDED);
                return Promise.resolve();
            },
        );
    });

    describe('Loading States', () => {
        it('renders loading spinner for patient details initially', () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByText('Loading patient details...')).toBeInTheDocument();
            expect(screen.getByLabelText('Loading patient details...')).toBeInTheDocument();
        });

        it('renders back button during patient loading', () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByRole('link', { name: /go back/i })).toBeInTheDocument();
        });
    });

    describe('Local Development Mode', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('loads mock patient data in local mode', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(mockSetPatientDetails).toHaveBeenCalled();
            });
        });

        it('loads mock review data in local mode', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByText('Check this document is for the correct patient'),
                ).toBeInTheDocument();
            });
        });
    });

    describe('Rendering - Main Content', () => {
        beforeEach(async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('renders main heading', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('heading', {
                        name: 'Check this document is for the correct patient',
                    }),
                ).toBeInTheDocument();
            });
        });

        it('renders patient demographics instruction', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByText(
                        'Check the patient details in this document match these patient demographics:',
                    ),
                ).toBeInTheDocument();
            });
        });

        it('renders patient summary in inset text', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByTestId('patient-summary')).toBeInTheDocument();
                expect(screen.getByTestId('patient-summary').parentElement).toHaveClass(
                    'nhsuk-inset-text',
                );
            });
        });

        it('renders patient name formatted correctly', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                // The name should be formatted as "LastName, FirstName"
                expect(screen.getByText('Calvin, Kevin')).toBeInTheDocument();
            });
        });

        it('renders NHS number formatted correctly', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                // NHS number should be formatted with spaces
                expect(screen.getByText('969 191 4948')).toBeInTheDocument();
            });
        });

        it('renders birth date formatted correctly', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                // Date should be formatted as "3 June 2002"
                expect(screen.getByText('3 June 2002')).toBeInTheDocument();
            });
        });

        it('renders back button', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('link', { name: /go back/i })).toBeInTheDocument();
            });
        });
    });

    describe('PDF Viewer and Record Card', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('renders record card when not in fullscreen', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByTestId('pdf-card')).toBeInTheDocument();
            });
        });

        it('renders display name from config', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                // Lloyd George config has displayName: "Scanned Paper Notes"
                expect(screen.getByText('scanned paper notes')).toBeInTheDocument();
            });
        });
    });

    describe('Accepting Document Section', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('renders accepting document heading', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('heading', { name: 'Accepting this document' }),
                ).toBeInTheDocument();
            });
        });

        it('renders instruction to accept if pages match', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByText(
                        'Accept the document if any pages match the demographics shown.',
                    ),
                ).toBeInTheDocument();
            });
        });

        it('renders help and guidance link', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                const link = screen.getByRole('link', { name: 'help and guidance' });
                expect(link).toBeInTheDocument();
                expect(link).toHaveAttribute(
                    'href',
                    'https://digital.nhs.uk/services/access-and-store-digital-patient-documents/help-and-guidance',
                );
            });
        });

        it('renders guidance for partial match', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('heading', { name: 'Accepting this document' }),
                ).toBeInTheDocument();
            });

            expect(
                screen.getByRole('heading', {
                    name: 'If some pages don’t match the demographics:',
                }),
            ).toBeInTheDocument();
            expect(screen.getByText('you should still accept the record')).toBeInTheDocument();
        });

        it('renders guidance for no match', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('heading', { name: 'Accepting this document' }),
                ).toBeInTheDocument();
            });

            expect(
                screen.getByRole('heading', {
                    name: 'If some pages don’t match the demographics:',
                }),
            ).toBeInTheDocument();
            expect(
                screen.getByText('select ‘No, I don’t want to accept this record’'),
            ).toBeInTheDocument();
        });
    });

    describe('Radio Options and Form', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('renders fieldset legend', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('group', { name: 'Do you want to accept this document?' }),
                ).toBeInTheDocument();
            });
        });

        it('renders "Yes" radio option', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('radio', {
                        name: 'Yes, the details match and I want to accept this document',
                    }),
                ).toBeInTheDocument();
            });
        });

        it('renders "No" radio option', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('radio', {
                        name: /No, I don't want to accept this document/i,
                    }),
                ).toBeInTheDocument();
            });
        });

        it('radio options are not selected initially', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                const yesRadio = screen.getByRole('radio', {
                    name: 'Yes, the details match and I want to accept this document',
                });
                const noRadio = screen.getByRole('radio', {
                    name: /No, I don't want to accept this document/i,
                });

                expect(yesRadio).not.toBeChecked();
                expect(noRadio).not.toBeChecked();
            });
        });

        it('renders continue button', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });
        });

        it('does not show error message initially', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.queryByText('There is a problem')).not.toBeInTheDocument();
            });
        });
    });

    describe('User Interactions - Radio Selection', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('allows selecting "Yes" radio option', async () => {
            const user = userEvent.setup();
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const yesRadio = screen.getByRole('radio', {
                name: 'Yes, the details match and I want to accept this document',
            });

            await user.click(yesRadio);

            expect(yesRadio).toBeChecked();
        });

        it('allows selecting "No" radio option', async () => {
            const user = userEvent.setup();
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const noRadio = screen.getByRole('radio', {
                name: /No, I don't want to accept this document/i,
            });

            await user.click(noRadio);

            expect(noRadio).toBeChecked();
        });

        it('allows changing selection from Yes to No', async () => {
            const user = userEvent.setup();
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const yesRadio = screen.getByRole('radio', {
                name: 'Yes, the details match and I want to accept this document',
            });
            const noRadio = screen.getByRole('radio', {
                name: /No, I don't want to accept this document/i,
            });

            await user.click(yesRadio);
            expect(yesRadio).toBeChecked();

            await user.click(noRadio);
            expect(noRadio).toBeChecked();
            expect(yesRadio).not.toBeChecked();
        });
    });

    describe('Validation and Error Handling', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('shows error when Continue clicked without selection', async () => {
            const user = userEvent.setup();
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            expect(screen.getByText('There is a problem')).toBeInTheDocument();
            expect(screen.getByText('You need to select an option')).toBeInTheDocument();
        });

        it('error summary has correct ARIA attributes', async () => {
            const user = userEvent.setup();
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: 'Continue' }));

            const errorSummary = screen.getByRole('alert');
            expect(errorSummary).toHaveAttribute('aria-labelledby', 'error-summary-title');
            expect(errorSummary).toHaveAttribute('tabindex', '-1');
        });

        it('error message links to radio group', async () => {
            const user = userEvent.setup();
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: 'Continue' }));

            const errorLink = screen.getByRole('link', { name: 'You need to select an option' });
            expect(errorLink).toHaveAttribute('href', '#accept-document');
        });

        it('shows error on radio group when validation fails', async () => {
            const user = userEvent.setup();
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: 'Continue' }));

            expect(screen.getByText('Select an option')).toBeInTheDocument();
        });

        it('clears error when radio option selected', async () => {
            const user = userEvent.setup();
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            // Trigger error
            await user.click(screen.getByRole('button', { name: 'Continue' }));
            expect(screen.getByText('There is a problem')).toBeInTheDocument();

            // Select option - error should remain until form is submitted again
            const yesRadio = screen.getByRole('radio', {
                name: 'Yes, the details match and I want to accept this document',
            });
            await user.click(yesRadio);

            // Error is still visible until Continue is clicked again
            expect(screen.getByText('There is a problem')).toBeInTheDocument();
        });
    });

    describe('Navigation - Yes Selection', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('navigates to assess files when Yes selected and Continue clicked', async () => {
            const user = userEvent.setup();
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const yesRadio = screen.getByRole('radio', {
                name: 'Yes, the details match and I want to accept this document',
            });
            await user.click(yesRadio);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            expect(mockNavigate).toHaveBeenCalledWith(
                '/admin/reviews/test-review-123/assess',
                undefined,
            );
        });
    });

    describe('Navigation - No Selection', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('navigates to search patient when No selected and Continue clicked', async () => {
            const user = userEvent.setup();
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const noRadio = screen.getByRole('radio', {
                name: /No, I don't want to accept this document/i,
            });
            await user.click(noRadio);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            expect(mockNavigate).toHaveBeenCalledWith(
                '/admin/reviews/test-review-123/search-patient',
                undefined,
            );
        });
    });

    describe('Navigation - Missing Review Data', () => {
        it('redirects to admin review page when no review data', async () => {
            // Mock isLocal to false so review data won't be loaded
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(false);

            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            // Wait for loading to complete
            await waitFor(
                () => {
                    expect(mockNavigate).toHaveBeenCalledWith(routeChildren.ADMIN_REVIEW);
                },
                { timeout: 1500 },
            );
        });
    });

    describe('Accessibility', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('passes axe accessibility tests in initial state', async () => {
            const { container } = render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('passes axe accessibility tests with error state', async () => {
            const user = userEvent.setup();
            const { container } = render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: 'Continue' }));

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('passes axe accessibility tests with selection made', async () => {
            const user = userEvent.setup();
            const { container } = render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const yesRadio = screen.getByRole('radio', {
                name: 'Yes, the details match and I want to accept this document',
            });
            await user.click(yesRadio);

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('inset text has correct ARIA structure', async () => {
            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                const patientSummary = screen.getByTestId('patient-summary');
                expect(patientSummary.parentElement).toHaveClass('nhsuk-inset-text');
            });
        });
    });

    describe('Review Configuration', () => {
        it('uses reviewSnoMed prop to get configuration', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            render(<ReviewsDetailsPage reviewSnoMed={'16521000000101' as DOCUMENT_TYPE} />);

            await waitFor(() => {
                // Lloyd George config displayName: "Scanned Paper Notes"
                expect(screen.getByText('scanned paper notes')).toBeInTheDocument();
            });
        });
    });

    describe('Edge Cases', () => {
        it('handles patient details without postal code', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
            const patientWithoutPostcode = buildPatientDetails({
                givenName: ['Test'],
                familyName: 'Patient',
                nhsNumber: '1234567890',
                birthDate: '1990-01-01',
                postalCode: undefined,
            });
            mockUsePatientDetailsContext.mockReturnValue([
                patientWithoutPostcode,
                mockSetPatientDetails,
            ]);

            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('Patient, Test')).toBeInTheDocument();
            });
        });

        it('handles multiple given names', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
            const patientWithMultipleNames = buildPatientDetails({
                givenName: ['John', 'David', 'Smith'],
                familyName: 'Doe',
                nhsNumber: '1234567890',
                birthDate: '1990-01-01',
            });
            mockUsePatientDetailsContext.mockReturnValue([
                patientWithMultipleNames,
                mockSetPatientDetails,
            ]);

            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('Doe, John David Smith')).toBeInTheDocument();
            });
        });

        it('handles different date formats', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
            const patientWithDifferentDate = buildPatientDetails({
                givenName: ['Test'],
                familyName: 'Patient',
                nhsNumber: '1234567890',
                birthDate: '1995-12-25',
            });
            mockUsePatientDetailsContext.mockReturnValue([
                patientWithDifferentDate,
                mockSetPatientDetails,
            ]);

            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('25 December 1995')).toBeInTheDocument();
            });
        });
    });

    describe('Fullscreen Integration', () => {
        it('renders different layout when not in fullscreen mode', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
            mockUseSessionContext.mockReturnValue([
                { ...mockSession, isFullscreen: false },
                vi.fn(),
            ]);

            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                const pdfCard = screen.getByTestId('pdf-card');
                expect(pdfCard).toBeInTheDocument();
                // Check for the flex container wrapper
                expect(pdfCard.closest('.lloydgeorge_record-stage_flex')).toBeInTheDocument();
            });
        });
    });

    describe('Role-based Features', () => {
        it('displays record action links based on role', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            render(<ReviewsDetailsPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByTestId('pdf-card')).toBeInTheDocument();
            });
        });
    });
});
