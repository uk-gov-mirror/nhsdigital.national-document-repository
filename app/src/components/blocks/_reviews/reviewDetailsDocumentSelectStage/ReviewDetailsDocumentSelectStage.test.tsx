// need to use happy-dom for this test file as jsdom doesn't support DOMMatrix and scrollIntoView
// @vitest-environment happy-dom
import { render, screen, waitFor, fireEvent, RenderResult } from '@testing-library/react';
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
import { getDocument } from 'pdfjs-dist';
import { PDF_PARSING_ERROR_TYPE } from '../../../../helpers/utils/fileUploadErrorMessages';
import getReviewNavigationFormat from '../../../../helpers/getReviewNavigationFormat';

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
    const testReviewSnomed: DOCUMENT_TYPE = DOCUMENT_TYPE.LLOYD_GEORGE;

    let mockReviewData: ReviewDetails;
    let mockDocuments: UploadDocument[];
    let mockSetDocuments: SetUploadDocuments;

    beforeEach(() => {
        vi.clearAllMocks();

        mockReviewData = new ReviewDetails(
            'test-review-id',
            testReviewSnomed,
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

    const renderApp = (props?: {
        reviewData?: ReviewDetails | null;
        documents?: UploadDocument[];
        setDocuments?: SetUploadDocuments;
    }): RenderResult => {
        const defaultProps = {
            reviewData: mockReviewData,
            documents: mockDocuments,
            setDocuments: mockSetDocuments,
        };

        return render(<ReviewDetailsDocumentSelectStage {...defaultProps} {...props} />);
    };

    describe('Rendering', () => {
        it('shows spinner when reviewData is null', () => {
            renderApp({ reviewData: null });

            expect(screen.getByTestId('mock-spinner')).toBeInTheDocument();
        });

        it('shows spinner when files is null', () => {
            renderApp({ reviewData: { ...mockReviewData, files: null } as any });

            expect(screen.getByTestId('mock-spinner')).toBeInTheDocument();
        });

        it('shows spinner when documents are not initialised', () => {
            renderApp();

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
                    docType: testReviewSnomed,
                    attempts: 0,
                    numPages: 1,
                    validated: false,
                },
            ];

            render(
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
            expect(screen.getByText('Choose scanned paper notes to upload')).toBeInTheDocument();
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
                    docType: testReviewSnomed,
                    attempts: 0,
                    numPages: 1,
                    validated: false,
                },
            ];

            renderApp({ documents: testDocuments });

            await waitFor(() => {
                expect(screen.queryByTestId('mock-spinner')).not.toBeInTheDocument();
            });

            // The file name should be displayed in the document table
            expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
        });

        it('navigates to previous page on back clicked', async () => {
            const user = userEvent.setup();
            const testDocuments: UploadDocument[] = [
                {
                    id: 'test-id',
                    file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    progress: 0,
                    docType: testReviewSnomed,
                    attempts: 0,
                    numPages: 1,
                    validated: false,
                },
            ];

            renderApp({ documents: testDocuments });

            await waitFor(() => {
                expect(screen.queryByTestId('mock-spinner')).not.toBeInTheDocument();
            });

            const backButton = screen.getByTestId('back-button');
            await user.click(backButton);

            expect(mockNavigate).toHaveBeenCalledWith(-1);
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
                    docType: testReviewSnomed,
                    attempts: 0,
                    numPages: 1,
                    validated: false,
                },
            ];

            renderApp({ documents: testDocuments });

            await waitFor(() => {
                expect(screen.queryByTestId('mock-spinner')).not.toBeInTheDocument();
            });

            const continueButton = screen.getByRole('button', { name: /continue/i });
            await user.click(continueButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    routeChildren.REVIEW_UPLOAD_FILE_ORDER.replaceAll(
                        ':reviewId',
                        getReviewNavigationFormat(mockReviewData.id, mockReviewData.version),
                    ),
                );
            });
        });

        it('constructs correct reviewId with different version number', async () => {
            const user = userEvent.setup();
            const customReviewData = new ReviewDetails(
                'custom-id',
                testReviewSnomed,
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
                    docType: testReviewSnomed,
                    attempts: 0,
                    numPages: 1,
                    validated: false,
                },
            ];

            renderApp({ reviewData: customReviewData, documents: testDocuments });

            await waitFor(() => {
                expect(screen.queryByTestId('mock-spinner')).not.toBeInTheDocument();
            });

            const continueButton = screen.getByRole('button', { name: /continue/i });
            await user.click(continueButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('custom-id_5'));
            });
        });
    });

    describe('Error handling', () => {
        const errorCases = [
            ['password protected file', PDF_PARSING_ERROR_TYPE.PASSWORD_MISSING],
            ['invalid PDF structure', PDF_PARSING_ERROR_TYPE.INVALID_PDF_STRUCTURE],
            ['empty PDF', PDF_PARSING_ERROR_TYPE.EMPTY_PDF],
        ];

        it.each(errorCases)(
            'navigates to admin file errors page when user selects a %s',
            async (_description, errorType) => {
                const testDocuments: UploadDocument[] = [
                    {
                        id: 'test-id',
                        file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
                        state: DOCUMENT_UPLOAD_STATE.SELECTED,
                        progress: 0,
                        docType: testReviewSnomed,
                        attempts: 0,
                        numPages: 1,
                        validated: false,
                    },
                ];

                renderApp({ documents: testDocuments });

                await waitFor(() => {
                    expect(screen.queryByTestId('mock-spinner')).not.toBeInTheDocument();
                });

                // Set up mock to throw error AFTER component is ready
                vi.mocked(getDocument).mockImplementationOnce(() => {
                    throw new Error(errorType as string);
                });

                const errorFile = new File(['test'], 'error-file.pdf', { type: 'application/pdf' });
                const dropzone = screen.getByTestId('dropzone');
                fireEvent.drop(dropzone, {
                    dataTransfer: { files: [errorFile] },
                });

                await waitFor(() => {
                    expect(mockNavigate).toHaveBeenCalledWith(
                        routeChildren.REVIEW_FILE_ERRORS.replaceAll(
                            ':reviewId',
                            'test-review-id_1',
                        ),
                    );
                });
            },
        );

        it('navigates to admin file errors page when user selects a non-PDF file', async () => {
            const testDocuments: UploadDocument[] = [
                {
                    id: 'test-id',
                    file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    progress: 0,
                    docType: testReviewSnomed,
                    attempts: 0,
                    numPages: 1,
                    validated: false,
                },
            ];

            renderApp({ documents: testDocuments });

            await waitFor(() => {
                expect(screen.queryByTestId('mock-spinner')).not.toBeInTheDocument();
            });

            const nonPdfFile = new File(['test'], 'nonPdfFile.txt', { type: 'text/plain' });
            const dropzone = screen.getByTestId('dropzone');
            fireEvent.drop(dropzone, {
                dataTransfer: { files: [nonPdfFile] },
            });

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    routeChildren.REVIEW_FILE_ERRORS.replaceAll(':reviewId', 'test-review-id_1'),
                );
            });
        });
    });
});
