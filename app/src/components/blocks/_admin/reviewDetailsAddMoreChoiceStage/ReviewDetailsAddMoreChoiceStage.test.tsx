import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import ReviewDetailsAddMoreChoiceStage from './ReviewDetailsAddMoreChoiceStage';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';

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

describe('ReviewDetailsAddMoreChoicePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders the page heading correctly', () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={null} />);

            expect(
                screen.getByRole('heading', {
                    name: 'Do you want to add more files to this patients record?',
                }),
            ).toBeInTheDocument();
        });

        it('renders back button with correct text', () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={null} />);

            expect(screen.getByText('Go back')).toBeInTheDocument();
        });

        it('renders both radio button options', () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={null} />);

            const yesRadio = screen.getByRole('radio', {
                name: /Yes I have more scanned paper records to add for this patient/i,
            });
            const noRadio = screen.getByRole('radio', {
                name: /No, I don't have anymore scanned paper records to add for this patient/i,
            });

            expect(yesRadio).toBeInTheDocument();
            expect(noRadio).toBeInTheDocument();
            expect(yesRadio).not.toBeChecked();
            expect(noRadio).not.toBeChecked();
        });

        it('renders continue button', () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={null} />);

            expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
        });

        it('does not show error message initially', () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={null} />);

            expect(screen.queryByText('Select an option')).not.toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        it('displays error message when continue is clicked without selection', async () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={null} />);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('Select an option')).toBeInTheDocument();
            });
        });

        it('does not navigate when no selection is made', async () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={null} />);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('Select an option')).toBeInTheDocument();
            });
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('clears error message when yes radio button is selected', async () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={null} />);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('Select an option')).toBeInTheDocument();
            });

            const yesRadio = screen.getByRole('radio', {
                name: /Yes I have more scanned paper records to add for this patient/i,
            });
            await userEvent.click(yesRadio);

            await waitFor(() => {
                expect(screen.queryByText('Select an option')).not.toBeInTheDocument();
            });
        });

        it('clears error message when no radio button is selected', async () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={null} />);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('Select an option')).toBeInTheDocument();
            });

            const noRadio = screen.getByRole('radio', {
                name: /No, I don't have anymore scanned paper records to add for this patient/i,
            });
            await userEvent.click(noRadio);

            await waitFor(() => {
                expect(screen.queryByText('Select an option')).not.toBeInTheDocument();
            });
        });
    });

    describe('User Interactions', () => {
        it('allows selecting the yes radio button', async () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={null} />);

            const yesRadio = screen.getByRole('radio', {
                name: /Yes I have more scanned paper records to add for this patient/i,
            });
            await userEvent.click(yesRadio);

            await waitFor(() => {
                expect(yesRadio).toBeChecked();
            });
        });

        it('allows selecting the no radio button', async () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={null} />);

            const noRadio = screen.getByRole('radio', {
                name: /No, I don't have anymore scanned paper records to add for this patient/i,
            });
            await userEvent.click(noRadio);

            await waitFor(() => {
                expect(noRadio).toBeChecked();
            });
        });

        it('allows changing selection from yes to no', async () => {
            render(<ReviewDetailsAddMoreChoiceStage reviewData={null} />);

            const yesRadio = screen.getByRole('radio', {
                name: /Yes I have more scanned paper records to add for this patient/i,
            });
            const noRadio = screen.getByRole('radio', {
                name: /No, I don't have anymore scanned paper records to add for this patient/i,
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
            render(<ReviewDetailsAddMoreChoiceStage reviewData={null} />);

            const form = screen.getByRole('button', { name: 'Continue' }).closest('form');
            const submitHandler = vi.fn((e: Event) => e.preventDefault());
            form?.addEventListener('submit', submitHandler);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            expect(submitHandler).toHaveBeenCalled();
        });
    });

    describe('Accessibility', () => {
        it('passes axe accessibility tests in initial state', async () => {
            const { container } = render(<ReviewDetailsAddMoreChoiceStage reviewData={null} />);

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('passes axe accessibility tests in error state', async () => {
            const { container } = render(<ReviewDetailsAddMoreChoiceStage reviewData={null} />);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('Select an option')).toBeInTheDocument();
            });

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('passes axe accessibility tests with radio button selected', async () => {
            const { container } = render(<ReviewDetailsAddMoreChoiceStage reviewData={null} />);

            const yesRadio = screen.getByRole('radio', {
                name: /Yes I have more scanned paper records to add for this patient/i,
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
