import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReviewDetailsDocumentSelectStage from './ReviewDetailsDocumentSelectStage';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';
import { ReviewDetails } from '../../../../types/generic/reviews';
import {
    DOCUMENT_UPLOAD_STATE,
    UploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';

vi.mock('../../_documentUpload/documentSelectStage/DocumentSelectStage', () => ({
    default: vi.fn(({ documents, setDocuments, documentType, filesErrorRef }) => (
        <div data-testid="mock-document-select-stage">
            <div data-testid="documents-length">{documents.length}</div>
            <div data-testid="document-type">{documentType}</div>
            <button
                data-testid="add-document"
                onClick={(): void => {
                    setDocuments([
                        {
                            id: 'test-id',
                            file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
                            state: 'SELECTED',
                            progress: 0,
                            docType: documentType,
                            attempts: 0,
                            numPages: 1,
                            validated: false,
                        },
                    ]);
                }}
            >
                Add Document
            </button>
            <div data-testid="files-error-ref">
                {filesErrorRef.current !== undefined ? 'has ref' : 'no ref'}
            </div>
        </div>
    )),
}));

vi.mock('../../../generic/spinner/Spinner', () => ({
    default: vi.fn(() => <div data-testid="mock-spinner">Loading...</div>),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: vi.fn(() => vi.fn()),
}));

describe('ReviewDetailsDocumentSelectStage', () => {
    const testReviewSnoMed: DOCUMENT_TYPE = '16521000000101' as DOCUMENT_TYPE;
    const mockReviewData: ReviewDetails = new ReviewDetails(
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

    const mockDocuments: UploadDocument[] = [];
    const mockSetDocuments = vi.fn();

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

    describe('Props handling', () => {
        it('passes correct props to DocumentSelectStage', async () => {
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
                expect(screen.getByTestId('document-type')).toBeInTheDocument();
            });
            expect(screen.getByTestId('document-type')).toHaveTextContent(testReviewSnoMed);
        });

        it('passes documents array to DocumentSelectStage', async () => {
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
                expect(screen.getByTestId('documents-length')).toBeInTheDocument();
            });
            expect(screen.getByTestId('documents-length')).toHaveTextContent('1');
        });
    });
});
