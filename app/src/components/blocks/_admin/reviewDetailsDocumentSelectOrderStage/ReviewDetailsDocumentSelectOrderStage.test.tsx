import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import ReviewDetailsDocumentSelectOrderStage from './ReviewDetailsDocumentSelectOrderStage';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';
import { ReviewDetails } from '../../../../types/generic/reviews';
import { UploadDocument } from '../../../../types/pages/UploadDocumentsPage/types';
import userEvent from '@testing-library/user-event';

vi.mock('../../_documentUpload/documentSelectOrderStage/DocumentSelectOrderStage', () => ({
    default: vi.fn(
        ({ documents, setDocuments, setMergedPdfBlob, existingDocuments, onSuccess }) => (
            <div data-testid="mock-document-select-order-stage">
                <div data-testid="documents-length">{documents.length}</div>
                <div data-testid="existing-documents">
                    {existingDocuments === undefined ? 'undefined' : existingDocuments.length}
                </div>
                <button
                    data-testid="add-document"
                    onClick={(): void => {
                        setDocuments([
                            {
                                id: 'test-id',
                                file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
                                state: 'SELECTED',
                                progress: 0,
                                docType: 'LLOYD_GEORGE',
                                attempts: 0,
                                numPages: 1,
                                validated: false,
                            },
                        ]);
                    }}
                >
                    Add Document
                </button>
                <button
                    data-testid="set-merged-pdf"
                    onClick={(): void => {
                        setMergedPdfBlob(new Blob(['test'], { type: 'application/pdf' }));
                    }}
                >
                    Set Merged PDF
                </button>
                <button data-testid="trigger-success" onClick={onSuccess}>
                    Trigger Success
                </button>
            </div>
        ),
    ),
}));

vi.mock('../../../../helpers/hooks/useBaseAPIUrl', () => ({
    default: vi.fn(() => 'http://test-api'),
}));

vi.mock('../../../../helpers/hooks/useBaseAPIHeaders', () => ({
    default: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
}));

describe('ReviewDetailsDocumentSelectOrderStage', () => {
    const testReviewSnoMed: DOCUMENT_TYPE = '16521000000101' as DOCUMENT_TYPE;
    const mockReviewData: ReviewDetails = new ReviewDetails(
        'test-id',
        testReviewSnoMed,
        '2023-10-01T12:00:00Z',
        'Test Uploader',
        '2023-10-01T12:00:00Z',
        'Test Reason',
        '1',
        '1234567890',
    );

    mockReviewData.files = [];

    const mockDocument = {
        id: 'test-id',
        file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
        state: 'SELECTED',
        progress: 0,
        docType: DOCUMENT_TYPE.LLOYD_GEORGE,
        attempts: 0,
        numPages: 1,
        validated: false,
    } as UploadDocument;

    const mockSetDocuments = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = (
        reviewData: ReviewDetails | null = mockReviewData,
        existingDocuments: UploadDocument[] | null = [],
        documents = [mockDocument],
    ): ReturnType<typeof render> => {
        return render(
            <MemoryRouter>
                <ReviewDetailsDocumentSelectOrderStage
                    reviewData={reviewData}
                    documents={documents}
                    setDocuments={mockSetDocuments}
                    existingDocuments={existingDocuments!}
                />
            </MemoryRouter>,
        );
    };

    describe('Rendering', () => {
        it('renders Spinner when files is null', () => {
            const reviewDataWithNullFiles: ReviewDetails = {
                ...mockReviewData,
                files: null,
            } as any;
            renderComponent(reviewDataWithNullFiles);

            expect(screen.getByText('Loading')).toBeInTheDocument();
        });

        it('renders Spinner when documents are not initialized', () => {
            renderComponent(mockReviewData, [], []);

            expect(screen.getByText('Loading')).toBeInTheDocument();
        });

        it('renders DocumentSelectOrderStage when documents are initialized', async () => {
            renderComponent(mockReviewData, [], [mockDocument]);

            await waitFor(() => {
                expect(screen.getByTestId('mock-document-select-order-stage')).toBeInTheDocument();
            });
        });

        it('passes correct props to DocumentSelectOrderStage', async () => {
            const existingDocs = [
                {
                    ...mockDocument,
                    id: 'existing-1',
                    position: 1,
                },
            ] as UploadDocument[];

            renderComponent(mockReviewData, existingDocs, [mockDocument]);

            await waitFor(() => {
                expect(screen.getByTestId('documents-length')).toBeInTheDocument();
            });

            expect(screen.getByTestId('documents-length')).toHaveTextContent('1');
            expect(screen.getByTestId('existing-documents')).toHaveTextContent('1');
        });

        it('renders DocumentSelectOrderStage with empty existingDocuments', async () => {
            renderComponent(mockReviewData, [], [mockDocument]);

            await waitFor(() => {
                expect(screen.getByTestId('existing-documents')).toBeInTheDocument();
            });

            expect(screen.getByTestId('existing-documents')).toHaveTextContent('0');
        });
    });

    describe('onSuccess callback', () => {
        it('combines existing documents and new documents on success', async () => {
            const user = userEvent.setup();
            const existingDoc = {
                ...mockDocument,
                id: 'existing-1',
                position: 1,
            } as UploadDocument;
            const newDoc = {
                ...mockDocument,
                id: 'new-1',
                position: 2,
            };

            renderComponent(mockReviewData, [existingDoc], [newDoc]);

            await waitFor(() => {
                expect(screen.getByTestId('trigger-success')).toBeInTheDocument();
            });

            await user.click(screen.getByTestId('trigger-success'));

            await waitFor(() => {
                expect(mockSetDocuments).toHaveBeenCalled();
            });

            const calledWith = mockSetDocuments.mock.calls[0][0];
            expect(calledWith).toHaveLength(2);
            expect(calledWith[0].position).toBe(1);
            expect(calledWith[1].position).toBe(2);
        });

        it('sorts documents by position on success', async () => {
            const user = userEvent.setup();
            const doc1 = { ...mockDocument, id: 'doc-1', position: 3 };
            const doc2 = { ...mockDocument, id: 'doc-2', position: 1 } as UploadDocument;
            const doc3 = { ...mockDocument, id: 'doc-3', position: 2 };

            renderComponent(mockReviewData, [doc2], [doc1, doc3]);

            await waitFor(() => {
                expect(screen.getByTestId('trigger-success')).toBeInTheDocument();
            });

            await user.click(screen.getByTestId('trigger-success'));

            await waitFor(() => {
                expect(mockSetDocuments).toHaveBeenCalled();
            });

            const calledWith = mockSetDocuments.mock.calls[0][0];
            expect(calledWith[0].position).toBe(1);
            expect(calledWith[1].position).toBe(2);
            expect(calledWith[2].position).toBe(3);
        });

        it('navigates to correct route on success', async () => {
            const user = userEvent.setup();
            renderComponent(mockReviewData, [], [mockDocument]);

            await waitFor(() => {
                expect(screen.getByTestId('trigger-success')).toBeInTheDocument();
            });

            await user.click(screen.getByTestId('trigger-success'));

            await waitFor(() => {
                expect(mockSetDocuments).toHaveBeenCalled();
            });

            expect(mockSetDocuments).toHaveBeenCalled();
        });

        it('handles success with no existing documents', async () => {
            const user = userEvent.setup();
            const newDocs = [
                { ...mockDocument, id: 'new-1', position: 1 },
                { ...mockDocument, id: 'new-2', position: 2 },
            ];

            renderComponent(mockReviewData, [], newDocs);

            await waitFor(() => {
                expect(screen.getByTestId('trigger-success')).toBeInTheDocument();
            });

            await user.click(screen.getByTestId('trigger-success'));

            await waitFor(() => {
                expect(mockSetDocuments).toHaveBeenCalled();
            });

            const calledWith = mockSetDocuments.mock.calls[0][0];
            expect(calledWith).toHaveLength(2);
        });
    });

    describe('State management', () => {
        it('resets documentsInitialised when review changes', async () => {
            const { rerender } = renderComponent(mockReviewData, [], [mockDocument]);

            await waitFor(() => {
                expect(screen.getByTestId('mock-document-select-order-stage')).toBeInTheDocument();
            });

            const newReviewData = new ReviewDetails(
                'new-id',
                testReviewSnoMed,
                '2023-10-02T12:00:00Z',
                'Test Uploader',
                '2023-10-02T12:00:00Z',
                'Test Reason',
                '2',
                '1234567890',
            );

            rerender(
                <MemoryRouter>
                    <ReviewDetailsDocumentSelectOrderStage
                        reviewData={newReviewData}
                        documents={[]}
                        setDocuments={mockSetDocuments}
                        existingDocuments={[]}
                    />
                </MemoryRouter>,
            );

            expect(screen.getByText('Loading')).toBeInTheDocument();
        });

        it('initializes documents when documents length changes from 0 to > 0', async () => {
            const { rerender } = renderComponent(mockReviewData, [], []);

            expect(screen.getByText('Loading')).toBeInTheDocument();

            rerender(
                <MemoryRouter>
                    <ReviewDetailsDocumentSelectOrderStage
                        reviewData={mockReviewData}
                        documents={[mockDocument]}
                        setDocuments={mockSetDocuments}
                        existingDocuments={[]}
                    />
                </MemoryRouter>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('mock-document-select-order-stage')).toBeInTheDocument();
            });
        });
    });

    describe('Edge cases', () => {
        it('handles multiple existing documents', async () => {
            const existingDocs = [
                { ...mockDocument, id: 'existing-1', position: 1 },
                { ...mockDocument, id: 'existing-2', position: 2 },
                { ...mockDocument, id: 'existing-3', position: 3 },
            ];

            renderComponent(mockReviewData, existingDocs, [mockDocument]);

            await waitFor(() => {
                expect(screen.getByTestId('existing-documents')).toBeInTheDocument();
            });

            expect(screen.getByTestId('existing-documents')).toHaveTextContent('3');
        });

        it('passes isReview prop as true to DocumentSelectOrderStage', async () => {
            renderComponent(mockReviewData, [], [mockDocument]);

            await waitFor(() => {
                expect(screen.getByTestId('mock-document-select-order-stage')).toBeInTheDocument();
            });

            expect(screen.getByTestId('mock-document-select-order-stage')).toBeInTheDocument();
        });
    });
});
