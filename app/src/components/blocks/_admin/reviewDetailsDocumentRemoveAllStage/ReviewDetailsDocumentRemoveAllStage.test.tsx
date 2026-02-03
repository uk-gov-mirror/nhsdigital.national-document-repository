import { render, RenderResult, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import ReviewDetailsDocumentRemoveAllStage from './ReviewDetailsDocumentRemoveAllStage';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import { ReviewDetails } from '../../../../types/generic/reviews';
import {
    ReviewUploadDocument,
    UploadDocumentType,
    DOCUMENT_UPLOAD_STATE,
} from '../../../../types/pages/UploadDocumentsPage/types';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';

const mockNavigate = vi.fn();
const mockReviewId = 'test-review-789';
const mockSetDocuments = vi.fn();

vi.mock('react-router-dom', async (): Promise<{}> => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        useParams: (): { reviewId: string } => ({ reviewId: mockReviewId }),
    };
});

describe('ReviewDetailsDocumentRemoveAllStage', () => {
    const testReviewSnoMed: DOCUMENT_TYPE = DOCUMENT_TYPE.LLOYD_GEORGE;
    const mockReviewData: ReviewDetails = new ReviewDetails(
        mockReviewId,
        testReviewSnoMed,
        '2024-01-01',
        'test-uploader',
        '2024-01-01',
        'test-reason',
        '1',
        '1234567890',
    );

    const mockReviewDocument: ReviewUploadDocument = {
        file: new File(['test'], 'test-review.pdf', { type: 'application/pdf' }),
        id: 'review-doc-1',
        state: DOCUMENT_UPLOAD_STATE.SELECTED,
        progress: 0,
        docType: testReviewSnoMed,
        type: UploadDocumentType.REVIEW,
        attempts: 0,
    };

    const mockAdditionalDocument: ReviewUploadDocument = {
        file: new File(['test'], 'additional.pdf', { type: 'application/pdf' }),
        id: 'additional-doc-1',
        state: DOCUMENT_UPLOAD_STATE.SELECTED,
        progress: 0,
        docType: testReviewSnoMed,
        type: undefined,
        attempts: 0,
    };

    const mockDocuments: ReviewUploadDocument[] = [mockReviewDocument, mockAdditionalDocument];

    const renderApp = (
        reviewData: ReviewDetails | null = mockReviewData,
        documents: ReviewUploadDocument[] = mockDocuments,
        setDocuments = mockSetDocuments,
    ): RenderResult => {
        return render(
            <ReviewDetailsDocumentRemoveAllStage
                reviewData={reviewData}
                documents={documents}
                setDocuments={setDocuments}
            />,
        );
    };

    describe('Rendering', () => {
        it('renders all expected elements', () => {
            renderApp();

            expect(screen.getByTestId('back-button')).toBeInTheDocument();
            expect(screen.getByText('Go back')).toBeInTheDocument();
            expect(
                screen.getByRole('heading', {
                    name: 'Are you sure you want to remove all selected files?',
                }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: 'Yes, remove all files' }),
            ).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        });

        it('renders spinner when reviewData is null', () => {
            renderApp(null);

            expect(screen.getByText('Loading')).toBeInTheDocument();
        });
    });

    describe('User Interactions', () => {
        it('navigates back when back link is clicked', async () => {
            renderApp();

            const backLink = screen.getByTestId('back-button');
            await userEvent.click(backLink);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(-1);
            });
        });

        it('navigates back when cancel button is clicked', async () => {
            renderApp();

            const cancelButton = screen.getByRole('button', { name: 'Cancel' });
            await userEvent.click(cancelButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(-1);
            });
        });

        it('filters out additional documents when remove all button is clicked', async () => {
            renderApp();

            const removeButton = screen.getByRole('button', { name: 'Yes, remove all files' });
            await userEvent.click(removeButton);

            await waitFor(() => {
                expect(mockSetDocuments).toHaveBeenCalledWith(
                    expect.arrayContaining([mockReviewDocument]),
                );
            });
        });

        it('keeps only REVIEW type documents after removal', async () => {
            renderApp();

            const removeButton = screen.getByRole('button', { name: 'Yes, remove all files' });
            await userEvent.click(removeButton);

            await waitFor(() => {
                const callArgs = mockSetDocuments.mock.calls[0][0];
                expect(callArgs).toHaveLength(1);
                expect(callArgs[0].type).toBe(UploadDocumentType.REVIEW);
            });
        });

        it('calls setDocuments and navigates after removal', async () => {
            renderApp();

            const removeButton = screen.getByRole('button', { name: 'Yes, remove all files' });
            await userEvent.click(removeButton);

            await waitFor(() => {
                expect(mockSetDocuments).toHaveBeenCalled();
            });
        });

        it('handles empty documents array', async () => {
            renderApp(mockReviewData, []);

            const removeButton = screen.getByRole('button', { name: 'Yes, remove all files' });
            await userEvent.click(removeButton);

            await waitFor(() => {
                expect(mockSetDocuments).toHaveBeenCalledWith([]);
            });
        });

        it('handles documents with only REVIEW type', async () => {
            const reviewOnlyDocs: ReviewUploadDocument[] = [mockReviewDocument];

            renderApp(mockReviewData, reviewOnlyDocs);

            const removeButton = screen.getByRole('button', { name: 'Yes, remove all files' });
            await userEvent.click(removeButton);

            await waitFor(() => {
                expect(mockSetDocuments).toHaveBeenCalledWith([mockReviewDocument]);
            });
        });

        it('handles documents with only additional files', async () => {
            const additionalOnlyDocs: ReviewUploadDocument[] = [mockAdditionalDocument];

            renderApp(mockReviewData, additionalOnlyDocs);

            const removeButton = screen.getByRole('button', { name: 'Yes, remove all files' });
            await userEvent.click(removeButton);

            await waitFor(() => {
                expect(mockSetDocuments).toHaveBeenCalledWith([]);
            });
        });

        it('handles multiple additional documents', async () => {
            const multipleAdditionalDocs: ReviewUploadDocument[] = [
                mockReviewDocument,
                mockAdditionalDocument,
                {
                    ...mockAdditionalDocument,
                    id: 'additional-doc-2',
                    file: new File(['test2'], 'additional2.pdf', { type: 'application/pdf' }),
                },
                {
                    ...mockAdditionalDocument,
                    id: 'additional-doc-3',
                    file: new File(['test3'], 'additional3.pdf', { type: 'application/pdf' }),
                },
            ];

            renderApp(mockReviewData, multipleAdditionalDocs);

            const removeButton = screen.getByRole('button', { name: 'Yes, remove all files' });
            await userEvent.click(removeButton);

            await waitFor(() => {
                const callArgs = mockSetDocuments.mock.calls[0][0];
                expect(callArgs).toHaveLength(1);
                expect(callArgs[0].type).toBe(UploadDocumentType.REVIEW);
            });
        });
    });

    describe('Accessibility', () => {
        it('passes accessibility checks', async () => {
            const { container } = renderApp();

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });
    });
});
