// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import ReviewDetailsCompleteStage from './ReviewDetailsCompleteStage';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import { CompleteState } from '../../../../pages/adminRoutesPage/AdminRoutesPage';
import { routeChildren } from '../../../../types/generic/routes';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';
import {
    DOCUMENT_UPLOAD_STATE,
    UploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';
import { DocumentReviewStatus } from '../../../../types/blocks/documentReview';
import { patchReview } from '../../../../helpers/requests/patchReviews';
import { ReviewDetails } from '../../../../types/generic/reviews';

const mockNavigate = vi.fn();
const mockSetPatientDetails = vi.fn();
const mockUsePatientDetailsContext = vi.fn();
const mockPatchReview = patchReview as Mock;

vi.mock('../../../../helpers/requests/patchReviews');

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

vi.mock('../../../../helpers/hooks/useBaseAPIUrl', () => ({
    default: (): string => 'https://api.example.com',
}));

vi.mock('../../../../helpers/hooks/useBaseAPIHeaders', () => ({
    default: (): Record<string, string> => ({
        authorization: 'Bearer token',
        'Content-Type': 'application/json',
    }),
}));

describe('ReviewDetailsCompletePage', () => {
    const mockPatientDetails = buildPatientDetails();
    let mockReviewData: ReviewDetails | null = null;
    const mockFile = new File(['test content'], 'LloydGeorgerecords.zip', {
        type: 'application/zip',
    });
    const mockReviewUploadDocuments: UploadDocument[] = [
        {
            state: DOCUMENT_UPLOAD_STATE.SUCCEEDED,
            file: mockFile,
            id: 'test-id-1',
            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
            attempts: 1,
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockUsePatientDetailsContext.mockReturnValue([mockPatientDetails, mockSetPatientDetails]);
    });

    describe('Rendering', () => {
        it('renders the page with correct test id', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByTestId('review-complete-page')).toBeInTheDocument();
        });

        it('renders the confirmation panel card', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByTestId('review-complete-card')).toBeInTheDocument();
            expect(screen.getByTestId('review-complete-card')).toHaveClass(
                'nhsuk-panel--confirmation',
            );
        });

        it('renders the review another document button', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(
                screen.getByRole('button', { name: 'Go to documents to review' }),
            ).toBeInTheDocument();
        });
    });

    describe('CompleteState.PATIENT_MATCHED', () => {
        it('renders correct panel title', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
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
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
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
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByRole('heading', { name: 'What happens next' })).toBeInTheDocument();
        });

        it('renders PRM team contact email link', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            const emailLink = screen.getByRole('link', { name: 'england.prmteam@nhs.net' });
            expect(emailLink).toBeInTheDocument();
            expect(emailLink).toHaveAttribute('href', 'mailto:england.prmteam@nhs.net');
        });

        it('passes accessibility checks', async () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });
    });

    describe('CompleteState.PATIENT_UNKNOWN', () => {
        it('renders correct panel title', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_UNKNOWN}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByRole('heading', { name: 'Review complete' })).toBeInTheDocument();
        });

        it('renders correct panel body message', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_UNKNOWN}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
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
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_UNKNOWN}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByRole('heading', { name: 'What happens next' })).toBeInTheDocument();
        });

        it('renders PCSE process link with correct attributes', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_UNKNOWN}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
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
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_UNKNOWN}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            const emailLink = screen.getByRole('link', { name: 'england.prmteam@nhs.net' });
            expect(emailLink).toBeInTheDocument();
            expect(emailLink).toHaveAttribute('href', 'mailto:england.prmteam@nhs.net');
        });

        it('renders instruction to print and send document', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_UNKNOWN}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(
                screen.getByText(/Print and send this document to Primary Care Support England/),
            ).toBeInTheDocument();
        });

        it('passes accessibility checks', async () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_UNKNOWN}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });
    });

    describe('CompleteState.NO_FILES_CHOICE', () => {
        it('renders correct panel title', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByRole('heading', { name: 'Review complete' })).toBeInTheDocument();
        });

        it('renders correct panel body message', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
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
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByTestId('patient-name')).toHaveTextContent('Patient name: Doe, John');
        });

        it('renders NHS number with correct formatting', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByTestId('nhs-number')).toHaveTextContent('NHS number: 900 000 0009');
        });

        it('renders date of birth with correct formatting', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByTestId('dob')).toHaveTextContent('Date of birth: 1 January 1970');
        });

        it('renders "What happens next" heading', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByRole('heading', { name: 'What happens next' })).toBeInTheDocument();
        });

        it('renders PRM team contact email link', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            const emailLink = screen.getByRole('link', { name: 'england.prmteam@nhs.net' });
            expect(emailLink).toBeInTheDocument();
            expect(emailLink).toHaveAttribute('href', 'mailto:england.prmteam@nhs.net');
        });

        it('does not render patient details when patientDetails is null', () => {
            mockUsePatientDetailsContext.mockReturnValueOnce([null, mockSetPatientDetails]);

            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.queryByTestId('patient-name')).not.toBeInTheDocument();
            expect(screen.queryByTestId('nhs-number')).not.toBeInTheDocument();
            expect(screen.queryByTestId('dob')).not.toBeInTheDocument();
        });

        it('passes accessibility checks', async () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.NO_FILES_CHOICE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });
    });

    describe('CompleteState.REVIEW_COMPLETE', () => {
        it('renders correct panel title', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByRole('heading', { name: 'Upload complete' })).toBeInTheDocument();
        });

        it('renders completion message', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(
                screen.getByText(
                    /You have completed the review of this document. It has been removed from your list of documents to review/,
                ),
            ).toBeInTheDocument();
        });

        it('renders patient name with correct formatting', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByTestId('patient-name')).toHaveTextContent('Patient name: Doe, John');
        });

        it('renders NHS number with correct formatting', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByTestId('nhs-number')).toHaveTextContent('NHS number: 900 000 0009');
        });

        it('renders date of birth with correct formatting', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByTestId('dob')).toHaveTextContent('Date of birth: 1 January 1970');
        });

        it('renders "What to do next" heading', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByRole('heading', { name: 'What to do next' })).toBeInTheDocument();
        });

        it('renders ordered list with instructions', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(
                screen.getByText(
                    /You'll find this document in the patient's record within this service/,
                ),
            ).toBeInTheDocument();
            expect(
                screen.getByText(/Follow your usual process for managing a new patient record/),
            ).toBeInTheDocument();
            expect(
                screen.getByText(
                    /When you've done this, you can remove any digital copies of these files/,
                ),
            ).toBeInTheDocument();
        });

        it('renders link to search for patient', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            const searchLink = screen.getByRole('link', {
                name: 'searching using their NHS number',
            });
            expect(searchLink).toBeInTheDocument();
            expect(searchLink).toHaveAttribute('href', '/patient/search');
        });

        it('renders PRM team contact email link', () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            const emailLink = screen.getByRole('link', { name: 'england.prmteam@nhs.net' });
            expect(emailLink).toBeInTheDocument();
            expect(emailLink).toHaveAttribute('href', 'mailto:england.prmteam@nhs.net');
        });

        it('does not render patient details when patientDetails is null', () => {
            mockUsePatientDetailsContext.mockReturnValueOnce([null, mockSetPatientDetails]);

            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.queryByTestId('patient-name')).not.toBeInTheDocument();
            expect(screen.queryByTestId('nhs-number')).not.toBeInTheDocument();
            expect(screen.queryByTestId('dob')).not.toBeInTheDocument();
        });

        it('passes accessibility checks', async () => {
            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
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
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            const button = screen.getByRole('button', { name: 'Go to documents to review' });
            await user.click(button);

            expect(mockSetPatientDetails).toHaveBeenCalledWith(null);
        });

        it('navigates to admin review page when button is clicked', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            const button = screen.getByRole('button', { name: 'Go to documents to review' });
            await user.click(button);

            expect(mockNavigate).toHaveBeenCalledWith(routeChildren.ADMIN_REVIEW, {
                replace: true,
            });
        });

        it('clears patient details before navigating', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.REVIEW_COMPLETE}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            const button = screen.getByRole('button', { name: 'Go to documents to review' });
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
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByTestId('review-complete-page')).toBeInTheDocument();

            rerender(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_UNKNOWN}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByTestId('review-complete-page')).toBeInTheDocument();
        });

        it('accepts reviewData prop', () => {
            const { rerender } = render(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewData={mockReviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByTestId('review-complete-page')).toBeInTheDocument();

            rerender(
                <ReviewDetailsCompleteStage
                    completeState={CompleteState.PATIENT_MATCHED}
                    reviewData={null}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(screen.getByTestId('review-complete-page')).toBeInTheDocument();
        });
    });

    describe('patchReviewStatus', () => {
        it.each([
            {
                completeState: CompleteState.PATIENT_MATCHED,
                expectedStatus: DocumentReviewStatus.REASSIGNED,
                expectedDocRef: undefined,
            },
            {
                completeState: CompleteState.PATIENT_UNKNOWN,
                expectedStatus: DocumentReviewStatus.REASSIGNED_PATIENT_UNKNOWN,
                expectedDocRef: undefined,
            },
            {
                completeState: CompleteState.NO_FILES_CHOICE,
                expectedStatus: DocumentReviewStatus.REJECTED,
                expectedDocRef: undefined,
            },
            {
                completeState: CompleteState.REVIEW_COMPLETE,
                expectedStatus: DocumentReviewStatus.APPROVED,
                expectedDocRef: 'doc-ref-id',
            },
        ])('should call patchReview with correct parameters %s', (theory) => {
            const reviewData = new ReviewDetails(
                'test-review-id',
                DOCUMENT_TYPE.LLOYD_GEORGE,
                '2023-10-01T00:00:00Z',
                'test',
                '2023-10-01T00:00:00Z',
                'rejected',
                '1',
                mockPatientDetails.nhsNumber,
            );
            mockReviewUploadDocuments[0].ref = theory.expectedDocRef;

            const expectedRequest = {
                reviewStatus: theory.expectedStatus,
                documentReferenceId: theory.expectedDocRef,
            };

            render(
                <ReviewDetailsCompleteStage
                    completeState={theory.completeState}
                    reviewData={reviewData}
                    reviewUploadDocuments={mockReviewUploadDocuments}
                />,
            );

            expect(mockPatchReview).toHaveBeenCalledWith(
                'https://api.example.com',
                {
                    authorization: 'Bearer token',
                    'Content-Type': 'application/json',
                },
                reviewData.id,
                reviewData.version,
                reviewData.nhsNumber,
                expectedRequest,
            );
        });
    });
});
