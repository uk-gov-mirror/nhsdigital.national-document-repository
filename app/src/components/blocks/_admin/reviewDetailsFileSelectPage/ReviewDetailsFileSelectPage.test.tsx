import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import ReviewDetailsFileSelectPage from './ReviewDetailsFileSelectPage';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../../../helpers/utils/documentType';
import { getPdfObjectUrl } from '../../../../helpers/utils/getPdfObjectUrl';
import { routeChildren } from '../../../../types/generic/routes';
import '../../../../helpers/utils/string-extensions';

vi.mock('../../../../helpers/utils/documentType');
vi.mock('../../../../helpers/utils/getPdfObjectUrl');
vi.mock('../../../../helpers/utils/isLocal', () => ({
    isLocal: true,
}));

const mockNavigate = vi.fn();
const mockReviewId = 'test-review-123';

vi.mock('react-router-dom', async (): Promise<unknown> => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        useParams: (): { reviewId: string } => ({ reviewId: mockReviewId }),
    };
});

const mockgetConfigForDocType = getConfigForDocType as Mock;
const mockGetPdfObjectUrl = getPdfObjectUrl as Mock;

describe('ReviewDetailsFileSelectPage', () => {
    const testReviewSnoMed: DOCUMENT_TYPE = '16521000000101' as any;
    const mockConfig = {
        displayName: 'test document type',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockgetConfigForDocType.mockReturnValue(mockConfig);
        mockGetPdfObjectUrl.mockImplementation((url, setPdfUrl) => {
            setPdfUrl('blob:mock-pdf-url');
        });
        Element.prototype.scrollIntoView = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders loading spinner initially', () => {
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByText('Loading files...')).toBeInTheDocument();
        });

        it('renders the page heading correctly after loading', async () => {
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('heading', {
                        name: 'Choose files to add to the existing Test document type',
                    }),
                ).toBeInTheDocument();
            });
        });

        it('renders back button with correct text', () => {
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByRole('link', { name: 'Go back' })).toBeInTheDocument();
        });

        it('redirects if reviewSnoMed is empty', () => {
            render(<ReviewDetailsFileSelectPage reviewSnoMed={'' as any} />);

            expect(mockNavigate).toHaveBeenCalledWith(routeChildren.ADMIN_REVIEW);
        });

        it('renders file table with correct headers', async () => {
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('Filename')).toBeInTheDocument();
                expect(screen.getByText('Date received')).toBeInTheDocument();
                expect(screen.getByText('View file')).toBeInTheDocument();
                expect(screen.getByText('Select')).toBeInTheDocument();
            });
        });

        it('renders all mock files in the table', async () => {
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('filename_1.pdf')).toBeInTheDocument();
                expect(screen.getByText('filename_2.pdf')).toBeInTheDocument();
                expect(screen.getByText('filename_3.pdf')).toBeInTheDocument();
            });
        });

        it('renders View buttons for each file', async () => {
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                const viewButtons = screen.getAllByRole('button', { name: /View filename_/i });
                expect(viewButtons).toHaveLength(3);
            });
        });

        it('renders checkboxes for each file', async () => {
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                const checkboxes = screen.getAllByRole('checkbox');
                expect(checkboxes).toHaveLength(3);
            });
        });

        it('renders Continue button', async () => {
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });
        });

        it('renders PDF viewer section when file is selected', async () => {
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByText('You are currently viewing: filename_1.pdf'),
                ).toBeInTheDocument();
            });
        });

        it('does not show error summary initially', async () => {
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.queryByText('There is a problem')).not.toBeInTheDocument();
            });
        });
    });

    describe('File Selection', () => {
        it('allows checking individual files', async () => {
            const user = userEvent.setup({ delay: null });
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('filename_1.pdf')).toBeInTheDocument();
            });

            const checkboxes = screen.getAllByRole('checkbox');
            await user.click(checkboxes[0]);

            expect(checkboxes[0]).toBeChecked();
            expect(checkboxes[1]).not.toBeChecked();
            expect(checkboxes[2]).not.toBeChecked();
        });

        it('allows unchecking individual files', async () => {
            const user = userEvent.setup({ delay: null });
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('filename_1.pdf')).toBeInTheDocument();
            });

            const checkboxes = screen.getAllByRole('checkbox');
            await user.click(checkboxes[0]);
            expect(checkboxes[0]).toBeChecked();

            await user.click(checkboxes[0]);
            expect(checkboxes[0]).not.toBeChecked();
        });

        it('allows selecting multiple files', async () => {
            const user = userEvent.setup({ delay: null });
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('filename_1.pdf')).toBeInTheDocument();
            });

            const checkboxes = screen.getAllByRole('checkbox');
            await user.click(checkboxes[0]);
            await user.click(checkboxes[1]);
            await user.click(checkboxes[2]);

            expect(checkboxes[0]).toBeChecked();
            expect(checkboxes[1]).toBeChecked();
            expect(checkboxes[2]).toBeChecked();
        });

        it('maintains checkbox state when viewing different files', async () => {
            const user = userEvent.setup({ delay: null });
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('filename_1.pdf')).toBeInTheDocument();
            });

            const checkboxes = screen.getAllByRole('checkbox');
            await user.click(checkboxes[0]);
            expect(checkboxes[0]).toBeChecked();

            const viewButtons = screen.getAllByRole('button', { name: /View filename_/i });
            await user.click(viewButtons[1]);

            expect(checkboxes[0]).toBeChecked();
        });
    });

    describe('File Viewing', () => {
        it('displays first file by default', async () => {
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByText('You are currently viewing: filename_1.pdf'),
                ).toBeInTheDocument();
            });
        });

        it('calls getPdfObjectUrl for default file', async () => {
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(mockGetPdfObjectUrl).toHaveBeenCalledWith(
                    '/dev/testFile.pdf',
                    expect.any(Function),
                    expect.any(Function),
                );
            });
        });

        it('updates viewer when View button clicked', async () => {
            const user = userEvent.setup({ delay: null });
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('filename_2.pdf')).toBeInTheDocument();
            });

            const viewButtons = screen.getAllByRole('button', { name: /View filename_/i });
            await user.click(viewButtons[1]);

            await waitFor(() => {
                expect(
                    screen.getByText('You are currently viewing: filename_2.pdf'),
                ).toBeInTheDocument();
            });
        });

        it('calls getPdfObjectUrl with correct URL when viewing file', async () => {
            const user = userEvent.setup({ delay: null });
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('filename_2.pdf')).toBeInTheDocument();
            });

            mockGetPdfObjectUrl.mockClear();

            const viewButtons = screen.getAllByRole('button', { name: /View filename_/i });
            await user.click(viewButtons[1]);

            await waitFor(() => {
                expect(mockGetPdfObjectUrl).toHaveBeenCalledWith(
                    '/dev/testFile2.pdf',
                    expect.any(Function),
                    expect.any(Function),
                );
            });
        });
    });

    describe('Error Handling', () => {
        it('shows error when Continue clicked without selecting any files', async () => {
            const user = userEvent.setup({ delay: null });
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('There is a problem')).toBeInTheDocument();
                expect(screen.getByText('You need to select an option')).toBeInTheDocument();
                expect(screen.getByText('Select at least one file')).toBeInTheDocument();
            });
        });

        it('error summary has correct ARIA attributes', async () => {
            const user = userEvent.setup({ delay: null });
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            await waitFor(() => {
                const errorSummary = screen.getByRole('alert');
                expect(errorSummary).toHaveAttribute('aria-labelledby', 'error-summary-title');
                expect(errorSummary).toHaveAttribute('tabIndex', '-1');
            });
        });

        it('clears error when file is selected after error shown', async () => {
            const user = userEvent.setup({ delay: null });
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('There is a problem')).toBeInTheDocument();
            });

            const checkboxes = screen.getAllByRole('checkbox');
            await user.click(checkboxes[0]);

            await waitFor(() => {
                expect(screen.queryByText('There is a problem')).not.toBeInTheDocument();
            });
        });

        it('does not navigate when Continue clicked without selection', async () => {
            const user = userEvent.setup({ delay: null });
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            expect(mockNavigate).not.toHaveBeenCalled();
        });
    });

    describe('Navigation', () => {
        it('navigates to download choice page with unselected files when some files selected', async () => {
            const user = userEvent.setup({ delay: null });
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('filename_1.pdf')).toBeInTheDocument();
            });

            const checkboxes = screen.getAllByRole('checkbox');
            await user.click(checkboxes[0]); // Select first file

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    routeChildren.ADMIN_REVIEW_DOWNLOAD_CHOICE.replace(':reviewId', mockReviewId),
                    {
                        state: {
                            unselectedFiles: ['filename_2.pdf', 'filename_3.pdf'],
                        },
                    },
                );
            });
        });

        it('navigates with empty unselected files when all files selected', async () => {
            const user = userEvent.setup({ delay: null });
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('filename_1.pdf')).toBeInTheDocument();
            });

            const checkboxes = screen.getAllByRole('checkbox');
            await user.click(checkboxes[0]);
            await user.click(checkboxes[1]);
            await user.click(checkboxes[2]);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    routeChildren.ADMIN_REVIEW_ADD_MORE_CHOICE.replace(':reviewId', mockReviewId),
                    undefined,
                );
            });
        });

        it('navigates with correct unselected files when middle file selected', async () => {
            const user = userEvent.setup({ delay: null });
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('filename_1.pdf')).toBeInTheDocument();
            });

            const checkboxes = screen.getAllByRole('checkbox');
            await user.click(checkboxes[1]); // Select middle file

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    routeChildren.ADMIN_REVIEW_DOWNLOAD_CHOICE.replace(':reviewId', mockReviewId),
                    {
                        state: {
                            unselectedFiles: ['filename_1.pdf', 'filename_3.pdf'],
                        },
                    },
                );
            });
        });
    });

    describe('Configuration', () => {
        it('uses getConfig to get display name', async () => {
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(mockgetConfigForDocType).toHaveBeenCalledWith(testReviewSnoMed);
            });
        });

        it('displays correct document type in heading using toSentenceCase', async () => {
            mockgetConfigForDocType.mockReturnValue({ displayName: 'lloyd george record' });

            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('heading', {
                        name: 'Choose files to add to the existing Lloyd george record',
                    }),
                ).toBeInTheDocument();
            });
        });
    });

    describe('Accessibility', () => {
        it('passes axe tests in initial loading state', async () => {
            const { container } = render(
                <ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />,
            );

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('passes axe tests after loading with files', async () => {
            const { container } = render(
                <ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />,
            );

            await waitFor(() => {
                expect(screen.getByText('filename_1.pdf')).toBeInTheDocument();
            });

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('passes axe tests in error state', async () => {
            const user = userEvent.setup({ delay: null });
            const { container } = render(
                <ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />,
            );

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('There is a problem')).toBeInTheDocument();
            });

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('View buttons have accessible labels', async () => {
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

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

        it('checkboxes have accessible labels', async () => {
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('Select filename_1.pdf')).toBeInTheDocument();
                expect(screen.getByText('Select filename_2.pdf')).toBeInTheDocument();
                expect(screen.getByText('Select filename_3.pdf')).toBeInTheDocument();
            });
        });
    });

    describe('Edge Cases', () => {
        it('handles rapid checkbox toggling', async () => {
            const user = userEvent.setup({ delay: null });
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('filename_1.pdf')).toBeInTheDocument();
            });

            const checkbox = screen.getAllByRole('checkbox')[0];
            await user.click(checkbox);
            await user.click(checkbox);
            await user.click(checkbox);
            await user.click(checkbox);

            expect(checkbox).not.toBeChecked();
        });

        it('handles clicking Continue multiple times', async () => {
            const user = userEvent.setup({ delay: null });
            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByText('filename_1.pdf')).toBeInTheDocument();
            });

            const checkboxes = screen.getAllByRole('checkbox');
            await user.click(checkboxes[0]);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);
            await user.click(continueButton);
            await user.click(continueButton);

            // Component doesn't prevent multiple navigations, it navigates each time
            expect(mockNavigate).toHaveBeenCalledTimes(3);
        });

        it('scrolls to error summary when error appears', async () => {
            const user = userEvent.setup({ delay: null });
            const mockScrollIntoView = vi.fn();
            Element.prototype.scrollIntoView = mockScrollIntoView;

            render(<ReviewDetailsFileSelectPage reviewSnoMed={testReviewSnoMed} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            await waitFor(() => {
                expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
            });
        });
    });
});
