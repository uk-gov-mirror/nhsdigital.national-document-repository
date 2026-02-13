import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import * as documentTypeModule from '../../../../helpers/utils/documentType';
import { ReviewDetails } from '../../../../types/generic/reviews';
import ReviewDetailsAddMoreChoiceStage from './ReviewDetailsAddMoreChoiceStage';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';

const mockNavigate = vi.fn();
const mockReviewId = 'test-review-123';
const testData = {
    yesText: 'Yes, I have more scanned paper notes to add for this patient',
    noText: "No, I don't have anymore scanned paper notes to add for this patient",
};

vi.mock('react-router-dom', async (): Promise<unknown> => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        useParams: (): { reviewId: string } => ({ reviewId: mockReviewId }),
    };
});

describe('ReviewDetailsAddMoreChoiceStage', () => {
    const mockReviewData = {
        snomedCode: DOCUMENT_TYPE.LLOYD_GEORGE,
    } as ReviewDetails;

    beforeEach(() => {
        vi.clearAllMocks();
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        const mockGetConfig = vi.spyOn(documentTypeModule, 'getConfigForDocType');
        mockGetConfig.mockReturnValue({
            ...documentTypeModule.getConfigForDocType(DOCUMENT_TYPE.LLOYD_GEORGE),
            multifileZipped: true,
            content: {
                addMoreFilesRadioNoText: testData.noText,
                addMoreFilesRadioYesText: testData.yesText,
            },
        } as any);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders the page heading correctly', () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />);

            expect(
                screen.getByRole('heading', {
                    name: "Do you want to add more files to this patient's record?",
                }),
            ).toBeInTheDocument();
        });

        it('renders back button with correct text', () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />);

            expect(screen.getByText('Go back')).toBeInTheDocument();
        });

        it('renders both radio button options', () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />);

            const yesRadio = screen.getByRole('radio', {
                name: testData.yesText,
            });
            const noRadio = screen.getByRole('radio', {
                name: testData.noText,
            });

            expect(yesRadio).toBeInTheDocument();
            expect(noRadio).toBeInTheDocument();
            expect(yesRadio).not.toBeChecked();
            expect(noRadio).not.toBeChecked();
        });

        it('renders continue button', () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />);

            expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
        });

        it('does not show error message initially', () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />);

            expect(screen.queryByText('Select an option')).not.toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        it('displays error message when continue is clicked without selection', async () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('Select an option')).toBeInTheDocument();
            });
        });

        it('does not navigate when no selection is made', async () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('Select an option')).toBeInTheDocument();
            });
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('clears error message when yes radio button is selected', async () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('Select an option')).toBeInTheDocument();
            });

            const yesRadio = screen.getByRole('radio', {
                name: testData.yesText,
            });
            await userEvent.click(yesRadio);

            await waitFor(() => {
                expect(screen.queryByText('Select an option')).not.toBeInTheDocument();
            });
        });

        it('clears error message when no radio button is selected', async () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('Select an option')).toBeInTheDocument();
            });

            const noRadio = screen.getByRole('radio', {
                name: testData.noText,
            });
            await userEvent.click(noRadio);

            await waitFor(() => {
                expect(screen.queryByText('Select an option')).not.toBeInTheDocument();
            });
        });
    });

    describe('User Interactions', () => {
        it('allows selecting the yes radio button', async () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />);

            const yesRadio = screen.getByRole('radio', {
                name: testData.yesText,
            });
            await userEvent.click(yesRadio);

            await waitFor(() => {
                expect(yesRadio).toBeChecked();
            });
        });

        it('allows selecting the no radio button', async () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />);

            const noRadio = screen.getByRole('radio', {
                name: testData.noText,
            });
            await userEvent.click(noRadio);

            await waitFor(() => {
                expect(noRadio).toBeChecked();
            });
        });

        it('allows changing selection from yes to no', async () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />);

            const yesRadio = screen.getByRole('radio', {
                name: testData.yesText,
            });
            const noRadio = screen.getByRole('radio', {
                name: testData.noText,
            });

            await userEvent.click(yesRadio);
            await waitFor(() => {
                expect(yesRadio).toBeChecked();
            });

            await userEvent.click(noRadio);
            await waitFor(() => {
                expect(noRadio).toBeChecked();
                expect(yesRadio).not.toBeChecked();
            });
        });

        it('prevents default form submission', async () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />);

            const form = screen.getByRole('button', { name: 'Continue' }).closest('form');
            const submitHandler = vi.fn((e: Event) => e.preventDefault());
            form?.addEventListener('submit', submitHandler);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            expect(submitHandler).toHaveBeenCalled();
        });
    });

    describe('Navigation', () => {
        it('navigates to add more files when yes is selected', async () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />);

            const yesRadio = screen.getByRole('radio', {
                name: testData.yesText,
            });
            await userEvent.click(yesRadio);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    `/admin/reviews/${mockReviewId}/upload-additional-files`,
                    undefined,
                );
            });
        });

        it('navigates to upload file order when no is selected and multiple files exist', async () => {
            const mockReviewData = {
                id: 'review-123',
                files: [{ fileName: 'file1.pdf' }, { fileName: 'file2.pdf' }],
            } as any;

            render(<ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />);

            const noRadio = screen.getByRole('radio', {
                name: testData.noText,
            });
            await userEvent.click(noRadio);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    `/admin/reviews/${mockReviewId}/upload-file-order`,
                    undefined,
                );
            });
        });

        it('navigates to upload directly when no is selected and single file exists', async () => {
            const mockReviewData = {
                id: 'review-123',
                files: [{ fileName: 'file1.pdf' }],
            } as any;

            render(<ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />);

            const noRadio = screen.getByRole('radio', {
                name: testData.noText,
            });
            await userEvent.click(noRadio);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    `/admin/reviews/${mockReviewId}/upload`,
                    undefined,
                );
            });
        });

        it('navigates to upload directly when no is selected and no files exist', async () => {
            const mockReviewData = {
                id: 'review-123',
                files: [],
            } as any;

            render(<ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />);

            const noRadio = screen.getByRole('radio', {
                name: testData.noText,
            });
            await userEvent.click(noRadio);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    `/admin/reviews/${mockReviewId}/upload`,
                    undefined,
                );
            });
        });
    });

    describe('Accessibility', () => {
        it('passes axe accessibility tests in initial state', async () => {
            const { container } = render(
                <ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />,
            );

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('passes axe accessibility tests in error state', async () => {
            const { container } = render(
                <ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />,
            );

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('Select an option')).toBeInTheDocument();
            });

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('passes axe accessibility tests with radio button selected', async () => {
            const { container } = render(
                <ReviewDetailsAddMoreChoiceStage reviewData={mockReviewData} />,
            );

            const yesRadio = screen.getByRole('radio', {
                name: testData.yesText,
            });
            await userEvent.click(yesRadio);

            await waitFor(() => {
                expect(yesRadio).toBeChecked();
            });

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });
    });
});
