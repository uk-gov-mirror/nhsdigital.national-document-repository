import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReviewDetailsAssessmentPage from './ReviewDetailsAssessmentPage';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import * as getPdfObjectUrlModule from '../../../../helpers/utils/getPdfObjectUrl';
import * as isLocalModule from '../../../../helpers/utils/isLocal';
import '../../../../helpers/utils/string-extensions';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = (await vi.importActual('react-router-dom')) as Record<string, unknown>;
    return {
        ...actual,
        useNavigate: (): ReturnType<typeof vi.fn> => mockNavigate,
        useParams: (): { reviewId: string } => ({ reviewId: 'test-review-789' }),
    };
});

vi.mock('../../../../helpers/utils/getPdfObjectUrl');

describe('ReviewDetailsAssessmentPage', () => {
    const testReviewSnoMed: DOCUMENT_TYPE = '16521000000101' as DOCUMENT_TYPE; // Lloyd George config

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock isLocal to return true by default for data loading
        vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

        // Mock getPdfObjectUrl
        vi.spyOn(getPdfObjectUrlModule, 'getPdfObjectUrl').mockImplementation((url, setPdfUrl) => {
            setPdfUrl('blob:mock-pdf-url');
            return Promise.resolve();
        });
    });

    describe('Loading State', () => {
        it('renders loading spinner initially', () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(false);

            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByText('Loading files...')).toBeInTheDocument();
            expect(screen.getByLabelText('Loading files...')).toBeInTheDocument();
        });

        it('renders back button during loading', () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(false);

            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByTestId('back-button')).toBeInTheDocument();
        });
    });

    describe('Rendering - Page Structure', () => {
        it('renders main heading for Lloyd George with existing files', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            expect(
                screen.getByRole('heading', {
                    name: 'Review the new and existing Scanned paper notes',
                    level: 1,
                }),
            ).toBeInTheDocument();
        });

        it('renders main heading for accept/reject config', async () => {
            // EHR SNOMED code with canBeDiscarded=true, canBeUpdated=false
            const acceptRejectSnoMed: DOCUMENT_TYPE = DOCUMENT_TYPE.EHR;

            render(<ReviewDetailsAssessmentPage reviewSnoMed={acceptRejectSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            expect(
                screen.getByRole('heading', {
                    name: 'Do you want to accept these records?',
                    level: 1,
                }),
            ).toBeInTheDocument();
        });

        it('renders back button after loading', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByTestId('back-button')).toBeInTheDocument();
            });
        });
    });

    describe('Existing Files Table', () => {
        it('renders existing files heading when files exist', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            expect(
                screen.getByRole('heading', { name: 'Existing files', level: 2 }),
            ).toBeInTheDocument();
        });

        it('renders existing file in table', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('LloydGeorgerecord1.pdf')).toBeInTheDocument();
            });
        });

        it('renders view button for existing file', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                const viewButtons = screen.getAllByRole('button', { name: /View/i });
                expect(viewButtons.length).toBeGreaterThan(0);
            });
        });
    });

    describe('New Files Table', () => {
        it('renders new files heading', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('heading', { name: 'New files', level: 2 }),
                ).toBeInTheDocument();
            });
        });

        it('renders table headers for new files', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const newFilesSection = screen
                .getByRole('heading', { name: 'New files', level: 2 })
                .closest('section');
            expect(newFilesSection).toBeInTheDocument();
            expect(screen.getAllByText('Filename').length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText('Date received')).toBeInTheDocument();
            expect(screen.getAllByText('View file').length).toBeGreaterThanOrEqual(1);
        });

        it('renders all new files in table', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('filename_1.pdf')).toBeInTheDocument();
                expect(screen.getByText('filename_2.pdf')).toBeInTheDocument();
                expect(screen.getByText('filename_3.pdf')).toBeInTheDocument();
            });
        });

        it('renders date received for each file', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                const dates = screen.getAllByText('29 May 2025');
                expect(dates.length).toBe(3);
            });
        });

        it('renders view button for each new file', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: 'View filename_1.pdf' }),
                ).toBeInTheDocument();
                expect(
                    screen.getByRole('button', { name: 'View filename_2.pdf' }),
                ).toBeInTheDocument();
                expect(
                    screen.getByRole('button', { name: 'View filename_3.pdf' }),
                ).toBeInTheDocument();
            });
        });
    });

    describe('PDF Viewer', () => {
        it('displays first file as selected by default', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByText(/You are currently viewing: filename_1\.pdf/i),
                ).toBeInTheDocument();
            });
        });

        it('renders PDF viewer component', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument();
            });
        });

        it('calls getPdfObjectUrl for first file on load', async () => {
            const getPdfSpy = vi.spyOn(getPdfObjectUrlModule, 'getPdfObjectUrl');

            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(getPdfSpy).toHaveBeenCalledWith(
                    '/dev/testFile.pdf',
                    expect.any(Function),
                    expect.any(Function),
                );
            });
        });
    });

    describe('File Selection and Viewing', () => {
        it('updates viewer when new file is clicked', async () => {
            const user = userEvent.setup();
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const viewButton = screen.getByRole('button', { name: 'View filename_2.pdf' });
            await user.click(viewButton);

            expect(
                screen.getByText(/You are currently viewing: filename_2\.pdf/i),
            ).toBeInTheDocument();
        });

        it('calls getPdfObjectUrl when different file is viewed', async () => {
            const user = userEvent.setup();
            const getPdfSpy = vi.spyOn(getPdfObjectUrlModule, 'getPdfObjectUrl');
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            getPdfSpy.mockClear();

            const viewButton = screen.getByRole('button', { name: 'View filename_3.pdf' });
            await user.click(viewButton);

            expect(getPdfSpy).toHaveBeenCalledWith(
                '/dev/testFile.pdf',
                expect.any(Function),
                expect.any(Function),
            );
        });

        it('updates viewer when existing file is clicked', async () => {
            const user = userEvent.setup();
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const viewButton = screen.getByRole('button', { name: 'View LloydGeorgerecord1.pdf' });
            await user.click(viewButton);

            expect(
                screen.getByText(/You are currently viewing: LloydGeorgerecord1\.pdf/i),
            ).toBeInTheDocument();
        });
    });

    describe('Radio Options - Lloyd George with Existing Files', () => {
        it('renders fieldset legend', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByText('What do you want to do with these files?'),
                ).toBeInTheDocument();
            });
        });

        it('renders "Add all files" radio option', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('radio', {
                        name: /Add all files to the existing scanned paper notes/i,
                    }),
                ).toBeInTheDocument();
            });
        });

        it('renders "Choose which files" radio option', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('radio', {
                        name: /Choose which files to add to the existing scanned paper notes/i,
                    }),
                ).toBeInTheDocument();
            });
        });

        it('renders "Duplicates" radio option', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('radio', {
                        name: /I don't need these files, they are duplicates of the existing scanned paper notes/i,
                    }),
                ).toBeInTheDocument();
            });
        });

        it('radio options are not selected initially', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                const addAllRadio = screen.getByRole('radio', {
                    name: /Add all files to the existing/i,
                });
                const chooseRadio = screen.getByRole('radio', {
                    name: /Choose which files to add/i,
                });
                const duplicateRadio = screen.getByRole('radio', {
                    name: /I don't need these files, they are duplicates/i,
                });

                expect(addAllRadio).not.toBeChecked();
                expect(chooseRadio).not.toBeChecked();
                expect(duplicateRadio).not.toBeChecked();
            });
        });
    });

    describe('Radio Options - Accept/Reject Configuration', () => {
        it('renders "Accept record" radio option', async () => {
            const acceptRejectSnoMed: DOCUMENT_TYPE = DOCUMENT_TYPE.EHR;

            render(<ReviewDetailsAssessmentPage reviewSnoMed={acceptRejectSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('radio', { name: 'Accept record' })).toBeInTheDocument();
            });
        });

        it('renders "Reject record" radio option', async () => {
            const acceptRejectSnoMed: DOCUMENT_TYPE = DOCUMENT_TYPE.EHR;

            render(<ReviewDetailsAssessmentPage reviewSnoMed={acceptRejectSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('radio', { name: 'Reject record' })).toBeInTheDocument();
            });
        });

        it('does not render Lloyd George options for accept/reject config', async () => {
            const acceptRejectSnoMed: DOCUMENT_TYPE = DOCUMENT_TYPE.EHR;

            render(<ReviewDetailsAssessmentPage reviewSnoMed={acceptRejectSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.queryByRole('radio', { name: /Add all files/i }),
                ).not.toBeInTheDocument();
            });
        });
    });

    describe('User Interactions - Radio Selection', () => {
        it('allows selecting "Add all files" radio option', async () => {
            const user = userEvent.setup();
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('radio', { name: /Add all files to the existing/i }),
                ).toBeInTheDocument();
            });

            const addAllRadio = screen.getByRole('radio', {
                name: /Add all files to the existing/i,
            });
            await user.click(addAllRadio);

            expect(addAllRadio).toBeChecked();
        });

        it('allows selecting "Choose which files" radio option', async () => {
            const user = userEvent.setup();
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('radio', { name: /Choose which files to add/i }),
                ).toBeInTheDocument();
            });

            const chooseRadio = screen.getByRole('radio', { name: /Choose which files to add/i });
            await user.click(chooseRadio);

            expect(chooseRadio).toBeChecked();
        });

        it('allows changing selection between options', async () => {
            const user = userEvent.setup();
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('radio', { name: /Add all files to the existing/i }),
                ).toBeInTheDocument();
            });

            const addAllRadio = screen.getByRole('radio', {
                name: /Add all files to the existing/i,
            });
            const duplicateRadio = screen.getByRole('radio', {
                name: /I don't need these files, they are duplicates/i,
            });

            await user.click(addAllRadio);
            expect(addAllRadio).toBeChecked();

            await user.click(duplicateRadio);
            expect(duplicateRadio).toBeChecked();
            expect(addAllRadio).not.toBeChecked();
        });
    });

    describe('Continue Button and Validation', () => {
        it('renders continue button', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });
        });

        it('shows error when Continue clicked without selection', async () => {
            const user = userEvent.setup();
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: 'Continue' }));

            expect(screen.getByText('There is a problem')).toBeInTheDocument();
            expect(
                screen.getByText('Select what you want to do with these files'),
            ).toBeInTheDocument();
        });

        it('error summary has correct ARIA attributes', async () => {
            const user = userEvent.setup();
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: 'Continue' }));

            const errorSummary = screen.getByRole('alert');
            expect(errorSummary).toHaveAttribute('aria-labelledby', 'error-summary-title');
            expect(errorSummary).toHaveAttribute('tabIndex', '-1');
        });

        it('error message links to radio group', async () => {
            const user = userEvent.setup();
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: 'Continue' }));

            const errorLink = screen.getByRole('link', {
                name: 'Select what you want to do with these files',
            });
            expect(errorLink).toHaveAttribute('href', '#file-action');
        });

        it('shows error on radio group when validation fails', async () => {
            const user = userEvent.setup();
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: 'Continue' }));

            const radioGroup = screen.getByRole('group');
            expect(radioGroup).toHaveTextContent('Select an option');
        });

        it('clears error when radio option selected', async () => {
            const user = userEvent.setup();
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: 'Continue' }));
            expect(screen.getByText('There is a problem')).toBeInTheDocument();

            const addAllRadio = screen.getByRole('radio', {
                name: /Add all files to the existing/i,
            });
            await user.click(addAllRadio);

            await user.click(screen.getByRole('button', { name: 'Continue' }));
            expect(screen.queryByText('There is a problem')).not.toBeInTheDocument();
        });
    });

    describe('Navigation - Add All Files', () => {
        it('navigates to add more choice when "Add all" selected', async () => {
            const user = userEvent.setup();
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('radio', { name: /Add all files to the existing/i }),
                ).toBeInTheDocument();
            });

            const addAllRadio = screen.getByRole('radio', {
                name: /Add all files to the existing/i,
            });
            await user.click(addAllRadio);
            await user.click(screen.getByRole('button', { name: 'Continue' }));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    '/admin/reviews/test-review-789/add-more-choice',
                    undefined,
                );
            });
        });
    });

    describe('Navigation - Choose Files', () => {
        it('navigates to choose files page when "Choose which files" selected', async () => {
            const user = userEvent.setup();
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('radio', { name: /Choose which files to add/i }),
                ).toBeInTheDocument();
            });

            const chooseRadio = screen.getByRole('radio', { name: /Choose which files to add/i });
            await user.click(chooseRadio);
            await user.click(screen.getByRole('button', { name: 'Continue' }));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    '/admin/reviews/test-review-789/files',
                    undefined,
                );
            });
        });
    });

    describe('Navigation - Duplicate Files', () => {
        it('navigates to no files choice when "Duplicate" selected', async () => {
            const user = userEvent.setup();
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('radio', {
                        name: /I don't need these files, they are duplicates/i,
                    }),
                ).toBeInTheDocument();
            });

            const duplicateRadio = screen.getByRole('radio', {
                name: /I don't need these files, they are duplicates/i,
            });
            await user.click(duplicateRadio);
            await user.click(screen.getByRole('button', { name: 'Continue' }));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    '/admin/reviews/test-review-789/no-files-choice',
                    undefined,
                );
            });
        });
    });

    describe('Navigation - Accept Record', () => {
        it('navigates to complete page when "Accept" selected', async () => {
            const user = userEvent.setup();
            const acceptRejectSnoMed: DOCUMENT_TYPE = DOCUMENT_TYPE.EHR;

            render(<ReviewDetailsAssessmentPage reviewSnoMed={acceptRejectSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('radio', { name: 'Accept record' })).toBeInTheDocument();
            });

            const acceptRadio = screen.getByRole('radio', { name: 'Accept record' });
            await user.click(acceptRadio);
            await user.click(screen.getByRole('button', { name: 'Continue' }));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    '/admin/reviews/test-review-789/complete',
                    undefined,
                );
            });
        });
    });

    describe('Navigation - Reject Record', () => {
        it('navigates to no files choice when "Reject" selected', async () => {
            const user = userEvent.setup();
            const acceptRejectSnoMed: DOCUMENT_TYPE = DOCUMENT_TYPE.EHR;

            render(<ReviewDetailsAssessmentPage reviewSnoMed={acceptRejectSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('radio', { name: 'Reject record' })).toBeInTheDocument();
            });

            const rejectRadio = screen.getByRole('radio', { name: 'Reject record' });
            await user.click(rejectRadio);
            await user.click(screen.getByRole('button', { name: 'Continue' }));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    '/admin/reviews/test-review-789/no-files-choice',
                    undefined,
                );
            });
        });
    });

    describe('Accessibility', () => {
        it('passes axe accessibility tests in initial state', async () => {
            const { container } = render(
                <ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />,
            );

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('passes axe accessibility tests with error state', async () => {
            const user = userEvent.setup();
            const { container } = render(
                <ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />,
            );

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: 'Continue' }));

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('passes axe accessibility tests with selection made', async () => {
            const user = userEvent.setup();
            const { container } = render(
                <ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />,
            );

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const addAllRadio = screen.getByRole('radio', {
                name: /Add all files to the existing/i,
            });
            await user.click(addAllRadio);

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });
    });

    describe('Configuration Variants', () => {
        it('uses reviewSnoMed prop to determine display name', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            // Lloyd George config displayName: "Scanned Paper Notes"
            expect(
                screen.getByRole('heading', {
                    name: /Review the new and existing Scanned paper notes/i,
                    level: 1,
                }),
            ).toBeInTheDocument();
        });

        it('handles different SNOMED codes correctly', async () => {
            const differentSnoMed: DOCUMENT_TYPE = DOCUMENT_TYPE.EHR;

            render(<ReviewDetailsAssessmentPage reviewSnoMed={differentSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            expect(
                screen.getByRole('heading', {
                    name: 'Do you want to accept these records?',
                    level: 1,
                }),
            ).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        it('handles multiple files being viewed in sequence', async () => {
            const user = userEvent.setup();
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const file2Button = screen.getByRole('button', { name: 'View filename_2.pdf' });
            await user.click(file2Button);
            expect(
                screen.getByText(/You are currently viewing: filename_2\.pdf/i),
            ).toBeInTheDocument();

            const file3Button = screen.getByRole('button', { name: 'View filename_3.pdf' });
            await user.click(file3Button);
            expect(
                screen.getByText(/You are currently viewing: filename_3\.pdf/i),
            ).toBeInTheDocument();

            const file1Button = screen.getByRole('button', { name: 'View filename_1.pdf' });
            await user.click(file1Button);
            expect(
                screen.getByText(/You are currently viewing: filename_1\.pdf/i),
            ).toBeInTheDocument();
        });
    });

    describe('Component Integration', () => {
        it('renders ExistingRecordTable when files exist', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            expect(screen.getByText('LloydGeorgerecord1.pdf')).toBeInTheDocument();
            expect(
                screen.getByRole('heading', { name: 'Existing files', level: 2 }),
            ).toBeInTheDocument();
        });

        it('renders PDF viewer component', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument();
        });

        it('renders BackButton component', async () => {
            render(<ReviewDetailsAssessmentPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                const backButton = screen.getByTestId('back-button');
                expect(backButton).toBeInTheDocument();
            });
        });
    });
});
