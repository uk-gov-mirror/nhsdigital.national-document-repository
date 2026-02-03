import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import ReviewDetailsDocumentSelectStage from './ReviewDetailsDocumentSelectStage';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';
import { ReviewDetails } from '../../../../types/generic/reviews';
import {
    DOCUMENT_UPLOAD_STATE,
    SetUploadDocuments,
    UploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';
import { routeChildren } from '../../../../types/generic/routes';

const mockNavigate = vi.fn();

// Mock pdfjs-dist to avoid DOMMatrix issues in test environment
vi.mock('pdfjs-dist', () => ({
    getDocument: vi.fn(() => ({
        promise: Promise.resolve({
            getPage: vi.fn(() => Promise.resolve({})),
            numPages: 1,
            destroy: vi.fn(() => Promise.resolve()),
        }),
    })),
}));

// Mock PatientSummary component as it's not relevant for these tests
vi.mock('../../../generic/patientSummary/PatientSummary', () => ({
    default: Object.assign(
        vi.fn(() => null),
        {
            Child: vi.fn(() => null),
        },
    ),
    PatientInfo: {
        FULL_NAME: 'fullName',
        NHS_NUMBER: 'nhsNumber',
        BIRTH_DATE: 'birthDate',
    },
}));

// Mock Spinner component
vi.mock('../../../generic/spinner/Spinner', () => ({
    default: vi.fn(() => <div data-testid="mock-spinner">Loading...</div>),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: vi.fn(() => mockNavigate),
}));

describe('ReviewDetailsDocumentSelectStage', () => {
    const testReviewSnoMed: DOCUMENT_TYPE = DOCUMENT_TYPE.LLOYD_GEORGE;

    let mockReviewData: ReviewDetails;
    let mockDocuments: UploadDocument[];
    let mockSetDocuments: SetUploadDocuments;

    beforeEach(() => {
        vi.clearAllMocks();

        mockReviewData = new ReviewDetails(
            'test-review-id',
            testReviewSnoMed,
            '2024-01-01T12:00:00Z',
            'Test Uploader',
            '2024-01-01T12:00:00Z',
            'Test Reason',
            '1',
            '1234567890',
        );
        mockReviewData.files = [];

        mockDocuments = [];
        mockSetDocuments = vi.fn() as SetUploadDocuments;
    });

    describe('Rendering', () => {
        it('shows spinner when reviewData is null', () => {
            render(
                <ReviewDetailsDocumentSelectStage
                    reviewData={null}
                    documents={mockDocuments}
                    setDocuments={mockSetDocuments}
                />,
            );

            expect(screen.getByTestId('mock-spinner')).toBeInTheDocument();
        });

        it('shows spinner when files is null', () => {
            render(
                <ReviewDetailsDocumentSelectStage
                    reviewData={{ ...mockReviewData, files: null } as any}
                    documents={mockDocuments}
                    setDocuments={mockSetDocuments}
                />,
            );

            expect(screen.getByTestId('mock-spinner')).toBeInTheDocument();
        });

        it('shows spinner when documents are not initialised', () => {
            render(
                <ReviewDetailsDocumentSelectStage
                    reviewData={mockReviewData}
                    documents={mockDocuments}
                    setDocuments={mockSetDocuments}
                />,
            );

            expect(screen.getByTestId('mock-spinner')).toBeInTheDocument();
        });
    });

    describe('Integration with DocumentSelectStage', () => {
        it('renders the DocumentSelectStage component when documents are initialized', async () => {
            const testDocuments: UploadDocument[] = [
                {
                    id: 'test-id',
                    file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    progress: 0,
                    docType: testReviewSnoMed,
                    attempts: 0,
                    numPages: 1,
                    validated: false,
                },
            ];

            const { rerender } = render(
                <ReviewDetailsDocumentSelectStage
                    reviewData={mockReviewData}
                    documents={[]}
                    setDocuments={mockSetDocuments}
                />,
            );

            rerender(
                <ReviewDetailsDocumentSelectStage
                    reviewData={mockReviewData}
                    documents={testDocuments}
                    setDocuments={mockSetDocuments}
                />,
            );

            await waitFor(() => {
                expect(screen.queryByTestId('mock-spinner')).not.toBeInTheDocument();
            });

            // Check that the actual DocumentSelectStage component is rendered
            // by looking for the page title
            expect(
                screen.getByText('Choose scanned paper notes files to upload'),
            ).toBeInTheDocument();
        });

        it('displays document information correctly', async () => {
            const testDocuments: UploadDocument[] = [
                {
                    id: 'test-id',
                    file: new File(['test content'], 'test-document.pdf', {
                        type: 'application/pdf',
                    }),
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    progress: 0,
                    docType: testReviewSnoMed,
                    attempts: 0,
                    numPages: 1,
                    validated: false,
                },
            ];

            const { rerender } = render(
                <ReviewDetailsDocumentSelectStage
                    reviewData={mockReviewData}
                    documents={[]}
                    setDocuments={mockSetDocuments}
                />,
            );

            rerender(
                <ReviewDetailsDocumentSelectStage
                    reviewData={mockReviewData}
                    documents={testDocuments}
                    setDocuments={mockSetDocuments}
                />,
            );

            await waitFor(() => {
                expect(screen.queryByTestId('mock-spinner')).not.toBeInTheDocument();
            });

            // The file name should be displayed in the document table
            expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
        });

        it('provides correct back link based on review ID', async () => {
            const user = userEvent.setup();
            const testDocuments: UploadDocument[] = [
                {
                    id: 'test-id',
                    file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    progress: 0,
                    docType: testReviewSnoMed,
                    attempts: 0,
                    numPages: 1,
                    validated: false,
                },
            ];

            const { rerender } = render(
                <ReviewDetailsDocumentSelectStage
                    reviewData={mockReviewData}
                    documents={[]}
                    setDocuments={mockSetDocuments}
                />,
            );

            rerender(
                <ReviewDetailsDocumentSelectStage
                    reviewData={mockReviewData}
                    documents={testDocuments}
                    setDocuments={mockSetDocuments}
                />,
            );

            await waitFor(() => {
                expect(screen.queryByTestId('mock-spinner')).not.toBeInTheDocument();
            });

            const expectedBackLink = routeChildren.ADMIN_REVIEW_ADD_MORE_CHOICE.replaceAll(
                ':reviewId',
                'test-review-id.1',
            );

            const backButton = screen.getByTestId('back-button');
            await user.click(backButton);

            expect(mockNavigate).toHaveBeenCalledWith(expectedBackLink);
        });
    });

    describe('Continue button navigation', () => {
        it('navigates to upload file order page when continue is clicked with documents', async () => {
            const user = userEvent.setup();
            const testDocuments: UploadDocument[] = [
                {
                    id: 'test-id',
                    file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    progress: 0,
                    docType: testReviewSnoMed,
                    attempts: 0,
                    numPages: 1,
                    validated: false,
                },
            ];

            const { rerender } = render(
                <ReviewDetailsDocumentSelectStage
                    reviewData={mockReviewData}
                    documents={[]}
                    setDocuments={mockSetDocuments}
                />,
            );

            rerender(
                <ReviewDetailsDocumentSelectStage
                    reviewData={mockReviewData}
                    documents={testDocuments}
                    setDocuments={mockSetDocuments}
                />,
            );

            await waitFor(() => {
                expect(screen.queryByTestId('mock-spinner')).not.toBeInTheDocument();
            });

            const continueButton = screen.getByRole('button', { name: /continue/i });
            await user.click(continueButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    routeChildren.ADMIN_REVIEW_UPLOAD_FILE_ORDER.replaceAll(
                        ':reviewId',
                        'test-review-id.1',
                    ),
                );
            });
        });

        it('constructs correct reviewId with different version number', async () => {
            const user = userEvent.setup();
            const customReviewData = new ReviewDetails(
                'custom-id',
                testReviewSnoMed,
                '2024-01-01T12:00:00Z',
                'Test Uploader',
                '2024-01-01T12:00:00Z',
                'Test Reason',
                '5',
                '1234567890',
            );
            customReviewData.files = [];

            const testDocuments: UploadDocument[] = [
                {
                    id: 'test-id',
                    file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    progress: 0,
                    docType: testReviewSnoMed,
                    attempts: 0,
                    numPages: 1,
                    validated: false,
                },
            ];

            const { rerender } = render(
                <ReviewDetailsDocumentSelectStage
                    reviewData={customReviewData}
                    documents={[]}
                    setDocuments={mockSetDocuments}
                />,
            );

            rerender(
                <ReviewDetailsDocumentSelectStage
                    reviewData={customReviewData}
                    documents={testDocuments}
                    setDocuments={mockSetDocuments}
                />,
            );

            await waitFor(() => {
                expect(screen.queryByTestId('mock-spinner')).not.toBeInTheDocument();
            });

            const continueButton = screen.getByRole('button', { name: /continue/i });
            await user.click(continueButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('custom-id.5'));
            });
        });
    });
});
