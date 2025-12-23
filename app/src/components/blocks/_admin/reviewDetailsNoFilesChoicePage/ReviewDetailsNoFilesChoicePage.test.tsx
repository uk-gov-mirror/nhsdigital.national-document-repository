import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import ReviewDetailsNoFilesChoicePage from './ReviewDetailsNoFilesChoicePage';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../../../helpers/utils/documentType';
import { routeChildren } from '../../../../types/generic/routes';
import * as navigateUtils from '../../../../types/generic/routes';
import { JSX } from 'react';
import '../../../../helpers/utils/string-extensions';

vi.mock('../../../../helpers/utils/documentType');
vi.mock('../../../../helpers/utils/string-extensions');

const mockNavigate = vi.fn();
const mockReviewId = 'test-review-456';

vi.mock('react-router-dom', async (): Promise<unknown> => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        useParams: (): { reviewId: string } => ({ reviewId: mockReviewId }),
        Link: ({
            children,
            onClick,
            to,
            style,
        }: {
            children: React.ReactNode;
            onClick: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
            to: string;
            style?: React.CSSProperties;
        }): JSX.Element => (
            <a href={to} onClick={onClick} style={style}>
                {children}
            </a>
        ),
    };
});

const mockGetConfigForDocType = getConfigForDocType as Mock;
const mockNavigateUrlParam = vi.spyOn(navigateUtils, 'navigateUrlParam');

describe('ReviewDetailsNoFilesChoicePage', () => {
    const testReviewSnoMed: DOCUMENT_TYPE = '16521000000101' as any;
    const mockConfig = {
        displayName: 'LLOYD GEORGE',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockGetConfigForDocType.mockReturnValue(mockConfig);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders the page heading', () => {
            render(<ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />);

            expect(
                screen.getByRole('heading', {
                    name: "You've chosen not to add any of the new files",
                }),
            ).toBeInTheDocument();
        });

        it('renders back button with correct text', () => {
            render(<ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByText('Go back')).toBeInTheDocument();
        });

        it('renders confirmation checkbox unchecked initially', () => {
            render(<ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />);

            const checkbox = screen.getByRole('checkbox', {
                name: /I don't need to add any of these files/i,
            });
            expect(checkbox).toBeInTheDocument();
            expect(checkbox).not.toBeChecked();
        });

        it('renders continue button', () => {
            render(<ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
        });

        it('renders go back link with document type', () => {
            render(<ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />);

            expect(
                screen.getByText(/Go back to choose files to add to the existing/i),
            ).toBeInTheDocument();
        });

        it('does not show error message initially', () => {
            render(<ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.queryByText('There is a problem')).not.toBeInTheDocument();
            expect(
                screen.queryByText("Please confirm that you don't need to add any of these files"),
            ).not.toBeInTheDocument();
        });

        it('calls getConfig with reviewSnoMed prop', () => {
            render(<ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />);

            expect(mockGetConfigForDocType).toHaveBeenCalledWith(testReviewSnoMed);
        });
    });

    describe('Error Handling', () => {
        it('displays error when continue clicked without checkbox', async () => {
            render(<ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('There is a problem')).toBeInTheDocument();
                expect(
                    screen.getByText(
                        "Please confirm that you don't need to add any of these files",
                    ),
                ).toBeInTheDocument();
            });
        });

        it('does not navigate when checkbox is not checked', async () => {
            render(<ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('There is a problem')).toBeInTheDocument();
            });

            expect(mockNavigateUrlParam).not.toHaveBeenCalled();
        });

        it('clears error when checkbox is checked', async () => {
            render(<ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />);

            // First trigger error
            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('There is a problem')).toBeInTheDocument();
            });

            // Then check the checkbox
            const checkbox = screen.getByRole('checkbox', {
                name: /I don't need to add any of these files/i,
            });
            await userEvent.click(checkbox);

            await waitFor(() => {
                expect(screen.queryByText('There is a problem')).not.toBeInTheDocument();
            });
        });
    });

    describe('User Interactions', () => {
        it('allows checking the confirmation checkbox', async () => {
            render(<ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />);

            const checkbox = screen.getByRole('checkbox', {
                name: /I don't need to add any of these files/i,
            });
            await userEvent.click(checkbox);

            await waitFor(() => {
                expect(checkbox).toBeChecked();
            });
        });

        it('allows unchecking the confirmation checkbox', async () => {
            render(<ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />);

            const checkbox = screen.getByRole('checkbox', {
                name: /I don't need to add any of these files/i,
            });

            // Check then uncheck
            await userEvent.click(checkbox);
            await waitFor(() => {
                expect(checkbox).toBeChecked();
            });

            await userEvent.click(checkbox);
            await waitFor(() => {
                expect(checkbox).not.toBeChecked();
            });
        });

        it('navigates correctly when checkbox is checked and continue clicked', async () => {
            render(<ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />);

            const checkbox = screen.getByRole('checkbox', {
                name: /I don't need to add any of these files/i,
            });
            await userEvent.click(checkbox);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);
            const params: any = { reviewId: mockReviewId };
            let updatedPath: string = routeChildren.ADMIN_REVIEW_COMPLETE_NO_FILES_CHOICE;
            Object.keys(params).forEach((key) => {
                updatedPath = updatedPath.replace(`:${key}`, params[key]);
            });
            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledTimes(1);
                expect(mockNavigate).toHaveBeenCalledWith(updatedPath, undefined);
            });
        });

        it('handles go back link click', async () => {
            render(<ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />);

            const goBackLink = screen.getByText(/Go back to choose files to add to the existing/i);
            await userEvent.click(goBackLink);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(-1);
            });
        });
    });

    describe('Document type display', () => {
        it('displays document type in go back link using toSentenceCase', () => {
            render(<ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />);

            // The displayName "LLOYD GEORGE" should be converted to "Lloyd george"
            expect(screen.getByText(/Lloyd george/i)).toBeInTheDocument();
        });

        it('handles different document types', () => {
            const differentConfig = {
                displayName: 'ELECTRONIC HEALTH RECORD',
            };
            mockGetConfigForDocType.mockReturnValue(differentConfig);

            render(
                <ReviewDetailsNoFilesChoicePage
                    reviewSnoMed={'different-snomed' as DOCUMENT_TYPE}
                />,
            );

            expect(screen.getByText(/Electronic health record/i)).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('passes axe accessibility tests in initial state', async () => {
            const { container } = render(
                <ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />,
            );

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('passes axe accessibility tests in error state', async () => {
            const { container } = render(
                <ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />,
            );

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('There is a problem')).toBeInTheDocument();
            });

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('passes axe accessibility tests with checkbox checked', async () => {
            const { container } = render(
                <ReviewDetailsNoFilesChoicePage reviewSnoMed={testReviewSnoMed} />,
            );

            const checkbox = screen.getByRole('checkbox', {
                name: /I don't need to add any of these files/i,
            });
            await userEvent.click(checkbox);

            await waitFor(() => {
                expect(checkbox).toBeChecked();
            });

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });
    });
});
