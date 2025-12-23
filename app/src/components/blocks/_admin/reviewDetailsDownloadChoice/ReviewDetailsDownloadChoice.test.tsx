import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import ReviewDetailsDownloadChoice from './ReviewDetailsDownloadChoice';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../../../helpers/utils/documentType';
import { routeChildren } from '../../../../types/generic/routes';
import '../../../../helpers/utils/string-extensions';

vi.mock('../../../../helpers/utils/documentType');

const mockNavigate = vi.fn();
const mockReviewId = 'test-review-123';
const mockLocation = {
    state: {
        unselectedFiles: ['file1.pdf', 'file2.pdf', 'file3.pdf'],
    },
    pathname: '/admin/review/test-review-123/download-choice',
    search: '',
    hash: '',
    key: 'default',
};

vi.mock('react-router-dom', async (): Promise<unknown> => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        useParams: (): { reviewId: string } => ({ reviewId: mockReviewId }),
        useLocation: (): typeof mockLocation => mockLocation,
        Link: ({ children, to, onClick }: any) => (
            <a href={to} onClick={onClick}>
                {children}
            </a>
        ),
    };
});

const mockgetConfigForDocType = getConfigForDocType as Mock;

describe('ReviewDetailsDownloadChoice', () => {
    const testReviewSnoMed: DOCUMENT_TYPE = '16521000000101' as any;
    const mockConfig = {
        displayName: 'lloyd george record',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockgetConfigForDocType.mockReturnValue(mockConfig);
        mockLocation.state = {
            unselectedFiles: ['file1.pdf', 'file2.pdf', 'file3.pdf'],
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders the page heading correctly', () => {
            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            expect(
                screen.getByRole('heading', {
                    name: "Do you want to download the files you didn't choose?",
                }),
            ).toBeInTheDocument();
        });

        it('renders the back button with correct text', () => {
            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByRole('link', { name: 'Go back' })).toBeInTheDocument();
        });

        it('renders the continue button', () => {
            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
        });

        it('displays the document type name in sentence case', () => {
            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            expect(
                screen.getByText(/You didn't select these files to add to the existing/i),
            ).toBeInTheDocument();
            expect(screen.getByText(/Lloyd george record/)).toBeInTheDocument();
        });

        it('renders the list of unselected files', () => {
            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByText('file1.pdf')).toBeInTheDocument();
            expect(screen.getByText('file2.pdf')).toBeInTheDocument();
            expect(screen.getByText('file3.pdf')).toBeInTheDocument();
        });

        it('renders download link', () => {
            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            const downloadLink = screen.getByRole('link', { name: 'download these files' });
            expect(downloadLink).toBeInTheDocument();
            expect(downloadLink).toHaveAttribute('href', '#');
        });

        it('calls getConfig with the provided reviewSnoMed', () => {
            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            expect(mockgetConfigForDocType).toHaveBeenCalledWith(testReviewSnoMed);
        });
    });

    describe('Navigation', () => {
        it('redirects to file select page if no unselected files in state', () => {
            mockLocation.state = null as any;

            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            expect(mockNavigate).toHaveBeenCalledWith(
                routeChildren.ADMIN_REVIEW_CHOOSE_WHICH_FILES.replace(':reviewId', mockReviewId),
                { replace: true },
            );
        });

        it('redirects to file select page if unselected files array is empty', () => {
            mockLocation.state = { unselectedFiles: [] };

            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            expect(mockNavigate).toHaveBeenCalledWith(
                routeChildren.ADMIN_REVIEW_CHOOSE_WHICH_FILES.replace(':reviewId', mockReviewId),
                { replace: true },
            );
        });

        it('does not redirect if unselected files exist', () => {
            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('navigates to add more choice page when Continue button is clicked', async () => {
            const user = userEvent.setup();
            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    routeChildren.ADMIN_REVIEW_ADD_MORE_CHOICE.replace(':reviewId', mockReviewId),
                    undefined,
                );
            });
        });

        it('does not navigate if reviewId is missing', async () => {
            const user = userEvent.setup();

            // Mock useParams to return undefined reviewId
            vi.doMock('react-router-dom', async () => {
                const actual = await vi.importActual('react-router-dom');
                return {
                    ...actual,
                    useNavigate: (): Mock => mockNavigate,
                    useParams: (): { reviewId: string | undefined } => ({ reviewId: undefined }),
                    useLocation: (): typeof mockLocation => mockLocation,
                };
            });

            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            // Should not navigate if reviewId is undefined
            expect(mockNavigate).not.toHaveBeenCalledWith(
                expect.stringContaining('add-more-choice'),
                expect.any(Object),
            );
        });
    });

    describe('Download Functionality', () => {
        it('handles download link click without errors', async () => {
            // TODO Review test in PRMP-827
            const user = userEvent.setup();
            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            const downloadLink = screen.getByRole('link', { name: 'download these files' });

            await expect(user.click(downloadLink)).resolves.not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        it('handles single unselected file', () => {
            mockLocation.state = { unselectedFiles: ['single-file.pdf'] };

            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByText('single-file.pdf')).toBeInTheDocument();
            expect(screen.queryByText('file1.pdf')).not.toBeInTheDocument();
        });

        it('handles many unselected files', () => {
            const manyFiles = Array.from({ length: 10 }, (_, i) => `file${i + 1}.pdf`);
            mockLocation.state = { unselectedFiles: manyFiles };

            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            manyFiles.forEach((filename) => {
                expect(screen.getByText(filename)).toBeInTheDocument();
            });
        });

        it('handles files with special characters in names', () => {
            mockLocation.state = {
                unselectedFiles: ['file (1).pdf', 'file-2023.pdf', "patient's_record.pdf"],
            };

            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByText('file (1).pdf')).toBeInTheDocument();
            expect(screen.getByText('file-2023.pdf')).toBeInTheDocument();
            expect(screen.getByText("patient's_record.pdf")).toBeInTheDocument();
        });

        it('handles different document type configurations', () => {
            const differentConfig = {
                displayName: 'ELECTRONIC HEALTH RECORD',
            };
            mockgetConfigForDocType.mockReturnValue(differentConfig);

            render(
                <ReviewDetailsDownloadChoice
                    reviewSnoMed={'different-snomed-code' as DOCUMENT_TYPE}
                />,
            );

            expect(screen.getByText(/Electronic health record/)).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('passes axe accessibility tests in default state', async () => {
            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });

        it('has properly structured heading hierarchy', () => {
            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            const heading = screen.getByRole('heading', { level: 1 });
            expect(heading).toBeInTheDocument();
        });

        it('has accessible button', () => {
            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            const button = screen.getByRole('button', { name: 'Continue' });
            expect(button).toBeInTheDocument();
        });

        it('has accessible download link with descriptive text', () => {
            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            const link = screen.getByRole('link', { name: 'download these files' });
            expect(link).toBeInTheDocument();
        });

        it('renders a list with proper structure', () => {
            render(<ReviewDetailsDownloadChoice reviewSnoMed={testReviewSnoMed} />);

            const listItems = screen.getAllByRole('listitem');
            expect(listItems).toHaveLength(3);
        });
    });
});
