// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import ReviewDetailsCompletePage from './ReviewDetailsCompletePage';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import { CompleteState } from '../../../../pages/adminRoutesPage/AdminRoutesPage';
import { routeChildren } from '../../../../types/generic/routes';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';

const mockNavigate = vi.fn();
const mockSetPatientDetails = vi.fn();
const mockUsePatientDetailsContext = vi.fn();

vi.mock('react-router-dom', async (): Promise<unknown> => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});

vi.mock('../../../../providers/patientProvider/PatientProvider', () => ({
    usePatientDetailsContext: (): unknown => mockUsePatientDetailsContext(),
}));

describe('ReviewDetailsCompletePage', () => {
    const testReviewSnoMed = '16521000000101';
    const mockPatientDetails = buildPatientDetails();

    beforeEach(() => {
        vi.clearAllMocks();
        mockUsePatientDetailsContext.mockReturnValue([mockPatientDetails, mockSetPatientDetails]);
    });

    describe('Rendering', () => {
        it('renders the page with correct test id', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.getByTestId('review-complete-page')).toBeInTheDocument();
        });

        it('renders the confirmation panel card', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.getByTestId('review-complete-card')).toBeInTheDocument();
            expect(screen.getByTestId('review-complete-card')).toHaveClass(
                'nhsuk-panel--confirmation',
            );
        });

        it('renders the review another document button', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(
                screen.getByRole('button', { name: 'Review another document' }),
            ).toBeInTheDocument();
        });
    });

    describe('CompleteState.PATIENT_MATCHED', () => {
        it('renders correct panel title', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(
                screen.getByRole('heading', {
                    name: 'This document has been matched to the correct patient',
                }),
            ).toBeInTheDocument();
        });

        it('renders correct panel body message', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(
                screen.getByText(
                    /This document has been matched to the patient whose NHS number you entered/,
                ),
            ).toBeInTheDocument();
        });

        it('renders "What happens next" heading', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.getByRole('heading', { name: 'What happens next' })).toBeInTheDocument();
        });

        it('renders PRM team contact email link', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            const emailLink = screen.getByRole('link', { name: 'england.prmteam@nhs.net' });
            expect(emailLink).toBeInTheDocument();
            expect(emailLink).toHaveAttribute('href', 'mailto:england.prmteam@nhs.net');
        });

        it('passes accessibility checks', async () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });
    });

    describe('CompleteState.PATIENT_UNKNOWN', () => {
        it('renders correct panel title', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_UNKNOWN}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.getByRole('heading', { name: 'Review complete' })).toBeInTheDocument();
        });

        it('renders correct panel body message', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_UNKNOWN}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(
                screen.getByText(
                    /You've completed the review of this document. It has been removed from your list/,
                ),
            ).toBeInTheDocument();
        });

        it('renders "What happens next" heading', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_UNKNOWN}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.getByRole('heading', { name: 'What happens next' })).toBeInTheDocument();
        });

        it('renders PCSE process link with correct attributes', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_UNKNOWN}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            const processLink = screen.getByTestId('process-link');
            expect(processLink).toBeInTheDocument();
            expect(processLink).toHaveAttribute(
                'href',
                'https://pcse.england.nhs.uk/services/medical-records/moving-medical-records',
            );
            expect(processLink).toHaveAttribute('target', '_blank');
            expect(processLink).toHaveAttribute('rel', 'noopener noreferrer');
        });

        it('renders PRM team contact email link', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_UNKNOWN}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            const emailLink = screen.getByRole('link', { name: 'england.prmteam@nhs.net' });
            expect(emailLink).toBeInTheDocument();
            expect(emailLink).toHaveAttribute('href', 'mailto:england.prmteam@nhs.net');
        });

        it('renders instruction to print and send document', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_UNKNOWN}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(
                screen.getByText(/Print and send this document to Primary Care Support England/),
            ).toBeInTheDocument();
        });

        it('passes accessibility checks', async () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_UNKNOWN}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });
    });

    describe('CompleteState.NO_FILES_CHOICE', () => {
        it('renders correct panel title', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.getByRole('heading', { name: 'Review complete' })).toBeInTheDocument();
        });

        it('renders correct panel body message', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(
                screen.getByText(
                    /You've completed the review of this document. It has been removed from your list/,
                ),
            ).toBeInTheDocument();
        });

        it('renders patient name with correct formatting', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.getByTestId('patient-name')).toHaveTextContent('Patient name: Doe, John');
        });

        it('renders NHS number with correct formatting', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.getByTestId('nhs-number')).toHaveTextContent('NHS number: 900 000 0009');
        });

        it('renders date of birth with correct formatting', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.getByTestId('dob')).toHaveTextContent('Date of birth: 1 January 1970');
        });

        it('renders "What happens next" heading', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.getByRole('heading', { name: 'What happens next' })).toBeInTheDocument();
        });

        it('renders PRM team contact email link', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            const emailLink = screen.getByRole('link', { name: 'england.prmteam@nhs.net' });
            expect(emailLink).toBeInTheDocument();
            expect(emailLink).toHaveAttribute('href', 'mailto:england.prmteam@nhs.net');
        });

        it('does not render patient details when patientDetails is null', () => {
            mockUsePatientDetailsContext.mockReturnValueOnce([null, mockSetPatientDetails]);

            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.queryByTestId('patient-name')).not.toBeInTheDocument();
            expect(screen.queryByTestId('nhs-number')).not.toBeInTheDocument();
            expect(screen.queryByTestId('dob')).not.toBeInTheDocument();
        });

        it('passes accessibility checks', async () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });
    });

    describe('CompleteState.REVIEW_COMPLETE', () => {
        it('renders correct panel title', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.getByRole('heading', { name: 'Review complete' })).toBeInTheDocument();
        });

        it('renders correct panel body message', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(
                screen.getByText(
                    /You've completed the review of this document. It has been removed from your list/,
                ),
            ).toBeInTheDocument();
        });

        it('renders patient name with correct formatting', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.getByTestId('patient-name')).toHaveTextContent('Patient name: Doe, John');
        });

        it('renders NHS number with correct formatting', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.getByTestId('nhs-number')).toHaveTextContent('NHS number: 900 000 0009');
        });

        it('renders date of birth with correct formatting', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.getByTestId('dob')).toHaveTextContent('Date of birth: 1 January 1970');
        });

        it('renders files added section', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(
                screen.getByRole('heading', { name: 'Files added for this patient' }),
            ).toBeInTheDocument();
            expect(screen.getByText('LloydGeorgerecords.zip')).toBeInTheDocument();
        });

        it('renders "What happens next" heading', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.getByRole('heading', { name: 'What happens next' })).toBeInTheDocument();
        });

        it('does not render duplicate "What happens next" heading outside panel', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            const headings = screen.getAllByRole('heading', { name: 'What happens next' });
            expect(headings).toHaveLength(1);
        });

        it('renders PRM team contact email link', () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            const emailLink = screen.getByRole('link', { name: 'england.prmteam@nhs.net' });
            expect(emailLink).toBeInTheDocument();
            expect(emailLink).toHaveAttribute('href', 'mailto:england.prmteam@nhs.net');
        });

        it('does not render patient details when patientDetails is null', () => {
            mockUsePatientDetailsContext.mockReturnValueOnce([null, mockSetPatientDetails]);

            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.queryByTestId('patient-name')).not.toBeInTheDocument();
            expect(screen.queryByTestId('nhs-number')).not.toBeInTheDocument();
            expect(screen.queryByTestId('dob')).not.toBeInTheDocument();
        });

        it('passes accessibility checks', async () => {
            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });
    });

    describe('Button functionality', () => {
        it('calls setPatientDetails with null when button is clicked', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            const button = screen.getByRole('button', { name: 'Review another document' });
            await user.click(button);

            expect(mockSetPatientDetails).toHaveBeenCalledWith(null);
        });

        it('navigates to admin review page when button is clicked', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            const button = screen.getByRole('button', { name: 'Review another document' });
            await user.click(button);

            expect(mockNavigate).toHaveBeenCalledWith(routeChildren.ADMIN_REVIEW, {
                replace: true,
            });
        });

        it('clears patient details before navigating', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            const button = screen.getByRole('button', { name: 'Review another document' });
            await user.click(button);

            expect(mockSetPatientDetails).toHaveBeenCalledBefore(mockNavigate as Mock);
            expect(mockSetPatientDetails).toHaveBeenCalledWith(null);
            expect(mockNavigate).toHaveBeenCalledWith(routeChildren.ADMIN_REVIEW, {
                replace: true,
            });
        });
    });

    describe('Component props', () => {
        it('accepts completeState prop', () => {
            const { rerender } = render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.getByTestId('review-complete-page')).toBeInTheDocument();

            rerender(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_UNKNOWN}
                    reviewSnoMed={testReviewSnoMed}
                />,
            );

            expect(screen.getByTestId('review-complete-page')).toBeInTheDocument();
        });

        it('accepts reviewSnoMed prop', () => {
            const { rerender } = render(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewSnoMed="test-snomed-1"
                />,
            );

            expect(screen.getByTestId('review-complete-page')).toBeInTheDocument();

            rerender(
                <ReviewDetailsCompletePage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewSnoMed="test-snomed-2"
                />,
            );

            expect(screen.getByTestId('review-complete-page')).toBeInTheDocument();
        });
    });
});
