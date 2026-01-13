// @vitest-environment happy-dom
import { render, screen, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ReviewDetailsDocumentUploadingStage from './ReviewDetailsDocumentUploadingStage';
import {
    DOCUMENT_UPLOAD_STATE,
    UploadDocumentType,
    ReviewUploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../../../helpers/utils/documentType';
import { ReviewDetails } from '../../../../types/generic/reviews';
import { routes, routeChildren } from '../../../../types/generic/routes';
import { buildLgFile, buildPatientDetails } from '../../../../helpers/test/testBuilders';
import * as uploadDocumentsModule from '../../../../helpers/requests/uploadDocuments';
import * as mergePdfsModule from '../../../../helpers/utils/mergePdfs';
import { JSX } from 'react';

const mockNavigate = vi.fn();
const mockSetDocuments = vi.fn();
const mockUsePatient = vi.fn();
const mockUseBaseAPIUrl = vi.fn();
const mockUseBaseAPIHeaders = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): typeof mockNavigate => mockNavigate,
    };
});

vi.mock('../../../../helpers/hooks/usePatient', () => ({
    default: (): typeof mockUsePatient => mockUsePatient,
}));

vi.mock('../../../../helpers/hooks/useBaseAPIUrl', () => ({
    default: (): typeof mockUseBaseAPIUrl => mockUseBaseAPIUrl,
}));

vi.mock('../../../../helpers/hooks/useBaseAPIHeaders', () => ({
    default: (): typeof mockUseBaseAPIHeaders => mockUseBaseAPIHeaders,
}));

vi.mock('../../../../helpers/utils/urlManipulations', () => ({
    useEnhancedNavigate: (): any => {
        const fn = mockNavigate;
        (fn as any).withParams = mockNavigate;
        return fn;
    },
}));

vi.mock('../../_documentUpload/documentUploadingStage/DocumentUploadingStage', () => ({
    default: ({ documents, startUpload }: any): JSX.Element => (
        <div data-testid="mock-document-uploading-stage">
            <button data-testid="start-upload-button" onClick={startUpload}>
                Start Upload
            </button>
            <div data-testid="documents-count">{documents.length}</div>
        </div>
    ),
}));

vi.mock('../../../../helpers/utils/documentType', async () => {
    const actual = await vi.importActual('../../../../helpers/utils/documentType');
    return {
        ...actual,
        getConfigForDocType: vi.fn((docType) => {
            // Return stitched config for Lloyd George documents (16521000000101)
            if (docType === '16521000000101') {
                return { stitched: true };
            }
            // Default to non-stitched
            return { stitched: false };
        }),
    };
});

vi.mock('../../../../helpers/utils/isLocal', () => ({
    isLocal: false,
    isMock: vi.fn((error: any) => error.message === 'This is a mock'),
    isRunningInCypress: vi.fn(() => false),
}));

describe('ReviewDetailsDocumentUploadingStage', (): void => {
    const mockPatientDetails = buildPatientDetails();
    const testReviewData: ReviewDetails = new ReviewDetails(
        'test-review-id',
        '16521000000102' as DOCUMENT_TYPE,
        '2023-10-01T12:00:00Z',
        'Test Uploader',
        '2023-10-01T12:00:00Z',
        'Test Reason',
        '1',
        '1234567890',
    );

    let mockDocuments: ReviewUploadDocument[];

    beforeEach((): void => {
        vi.clearAllMocks();
        import.meta.env.VITE_ENVIRONMENT = 'vitest';

        mockUsePatient.mockReturnValue(mockPatientDetails);
        mockUseBaseAPIUrl.mockReturnValue('http://test-api');
        mockUseBaseAPIHeaders.mockReturnValue({ Authorization: 'Bearer test-token' });

        mockDocuments = [
            {
                id: 'test-doc-1',
                file: buildLgFile(1),
                state: DOCUMENT_UPLOAD_STATE.SELECTED,
                progress: 0,
                docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                attempts: 0,
                type: UploadDocumentType.REVIEW,
                ref: 'test-ref-1',
            },
        ];

        vi.spyOn(uploadDocumentsModule, 'default').mockResolvedValue({
            'test-doc-1': {
                url: 'https://test-s3-url.com',
                fields: {} as any,
            },
        });

        vi.spyOn(uploadDocumentsModule, 'generateStitchedFileName').mockReturnValue(
            'test-lloyd-george.pdf',
        );
        vi.spyOn(uploadDocumentsModule, 'uploadDocumentToS3').mockResolvedValue();
        vi.spyOn(uploadDocumentsModule, 'getDocumentStatus').mockResolvedValue({});
        vi.spyOn(mergePdfsModule, 'mergePdfsFromUploadDocuments').mockResolvedValue(
            new Blob(['merged pdf'], { type: 'application/pdf' }),
        );
    });

    afterEach((): void => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    const renderComponent = (
        documents = mockDocuments,
        reviewData: ReviewDetails | null = testReviewData,
        existingId?: string,
    ): ReturnType<typeof render> => {
        return render(
            <MemoryRouter>
                <ReviewDetailsDocumentUploadingStage
                    reviewData={reviewData}
                    documents={documents}
                    setDocuments={mockSetDocuments}
                    existingId={existingId}
                />
            </MemoryRouter>,
        );
    };

    describe('Rendering', (): void => {
        it('displays loading state initially', async (): Promise<void> => {
            renderComponent();
            // Non-stitched documents don't need preparation
            await waitFor((): void => {
                expect(screen.getByTestId('mock-document-uploading-stage')).toBeInTheDocument();
            });
        });

        it('renders spinner with "Preparing documents" during file preparation for stitched documents', async (): Promise<void> => {
            const stitchedReviewData = new ReviewDetails(
                'test-review-id',
                '16521000000101' as DOCUMENT_TYPE,
                '2023-10-01T12:00:00Z',
                'Test Uploader',
                '2023-10-01T12:00:00Z',
                'Test Reason',
                '1',
                '1234567890',
            );

            const documentsWithExisting = [
                {
                    ...mockDocuments[0],
                    type: UploadDocumentType.EXISTING,
                    versionId: 'v1',
                },
            ];

            renderComponent(documentsWithExisting, stitchedReviewData);

            expect(screen.getByText('Preparing documents')).toBeInTheDocument();

            // Eventually renders the upload stage
            await waitFor((): void => {
                expect(screen.getByTestId('mock-document-uploading-stage')).toBeInTheDocument();
            });
        });
    });

    describe('Document normalization on entry', (): void => {
        it('normalizes document states to SELECTED on entry', async (): Promise<void> => {
            const documentsWithDifferentStates = [
                {
                    ...mockDocuments[0],
                    state: DOCUMENT_UPLOAD_STATE.UPLOADING,
                },
            ];

            renderComponent(documentsWithDifferentStates);

            await waitFor((): void => {
                expect(mockSetDocuments).toHaveBeenCalled();
            });

            const setDocumentsCall = mockSetDocuments.mock.calls[0][0];
            const updatedDocs = setDocumentsCall(documentsWithDifferentStates);
            expect(updatedDocs[0].state).toBe(DOCUMENT_UPLOAD_STATE.SELECTED);
        });

        it('does not update documents if all are already SELECTED', async (): Promise<void> => {
            renderComponent();

            await waitFor((): void => {
                const calls = mockSetDocuments.mock.calls.filter((call): boolean => {
                    const result = call[0](mockDocuments);
                    return result !== mockDocuments;
                });
                expect(calls.length).toBe(0);
            });
        });
    });

    describe('Document preparation for stitched documents', (): void => {
        it('merges PDFs for stitched document types', async (): Promise<void> => {
            const stitchedReviewData = new ReviewDetails(
                'test-review-id',
                '16521000000101' as DOCUMENT_TYPE,
                '2023-10-01T12:00:00Z',
                'Test Uploader',
                '2023-10-01T12:00:00Z',
                'Test Reason',
                '1',
                '1234567890',
            );

            const documentsWithExisting = [
                {
                    ...mockDocuments[0],
                    type: UploadDocumentType.EXISTING,
                    versionId: 'v1',
                },
            ];

            renderComponent(documentsWithExisting, stitchedReviewData);

            await waitFor((): void => {
                expect(mergePdfsModule.mergePdfsFromUploadDocuments).toHaveBeenCalled();
            });
        });
    });

    describe('Error handling', (): void => {
        it('navigates to SERVER_ERROR on general error during upload', async (): Promise<void> => {
            const error = {
                response: { status: 500 },
            };
            vi.spyOn(uploadDocumentsModule, 'default').mockRejectedValueOnce(error);

            const stitchedReviewData = new ReviewDetails(
                'test-review-id',
                '16521000000101' as DOCUMENT_TYPE,
                '2023-10-01T12:00:00Z',
                'Test Uploader',
                '2023-10-01T12:00:00Z',
                'Test Reason',
                '1',
                '1234567890',
            );

            const documentsWithExisting = [
                {
                    ...mockDocuments[0],
                    type: UploadDocumentType.EXISTING,
                    versionId: 'v1',
                },
            ];

            renderComponent(documentsWithExisting, stitchedReviewData);

            await waitFor(
                (): void => {
                    expect(screen.queryByText('Preparing documents')).not.toBeInTheDocument();
                },
                { timeout: 2000 },
            );

            await waitFor((): void => {
                expect(screen.getByTestId('start-upload-button')).toBeInTheDocument();
            });

            const startButton = screen.getByTestId('start-upload-button');
            startButton.click();

            await waitFor((): void => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    expect.stringContaining(routes.SERVER_ERROR),
                );
            });
        });

        it('navigates to DOCUMENT_UPLOAD_INFECTED when virus is detected', async (): Promise<void> => {
            const documentsWithVirus = [
                {
                    ...mockDocuments[0],
                    state: DOCUMENT_UPLOAD_STATE.INFECTED,
                },
            ];

            renderComponent(documentsWithVirus);

            await waitFor((): void => {
                expect(mockNavigate).toHaveBeenCalledWith(routeChildren.DOCUMENT_UPLOAD_INFECTED);
            });
        });

        it('navigates to SERVER_ERROR when document has error state', async (): Promise<void> => {
            const documentsWithError = [
                {
                    ...mockDocuments[0],
                    state: DOCUMENT_UPLOAD_STATE.ERROR,
                    error: 'TEST_ERROR',
                },
            ];

            renderComponent(documentsWithError as ReviewUploadDocument[]);

            await waitFor((): void => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    expect.stringContaining(routes.SERVER_ERROR),
                );
            });
        });
    });

    describe('Upload completion', (): void => {
        it('navigates to ADMIN_REVIEW_COMPLETE when all documents succeed', async (): Promise<void> => {
            const succeededDocuments = [
                {
                    ...mockDocuments[0],
                    state: DOCUMENT_UPLOAD_STATE.SUCCEEDED,
                },
            ];

            renderComponent(succeededDocuments);

            await waitFor((): void => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    expect.stringContaining('test-review-id.1'),
                );
            });
        });
    });

    describe('Polling mechanism', (): void => {
        it('sets up interval timer for document status polling', async (): Promise<void> => {
            const setIntervalSpy = vi.spyOn(window, 'setInterval');

            const stitchedReviewData = new ReviewDetails(
                'test-review-id',
                '16521000000101' as DOCUMENT_TYPE,
                '2023-10-01T12:00:00Z',
                'Test Uploader',
                '2023-10-01T12:00:00Z',
                'Test Reason',
                '1',
                '1234567890',
            );

            const documentsWithExisting = [
                {
                    ...mockDocuments[0],
                    type: UploadDocumentType.EXISTING,
                    versionId: 'v1',
                },
            ];

            renderComponent(documentsWithExisting, stitchedReviewData);

            await waitFor(
                (): void => {
                    expect(screen.queryByText('Preparing documents')).not.toBeInTheDocument();
                },
                { timeout: 2000 },
            );

            await waitFor((): void => {
                expect(screen.getByTestId('start-upload-button')).toBeInTheDocument();
            });

            const startButton = screen.getByTestId('start-upload-button');
            startButton.click();

            await waitFor((): void => {
                expect(setIntervalSpy).toHaveBeenCalled();
            });
        });

        it('clears interval when all documents are finished', async (): Promise<void> => {
            const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

            const succeededDocuments = [
                {
                    ...mockDocuments[0],
                    state: DOCUMENT_UPLOAD_STATE.SUCCEEDED,
                },
            ];

            renderComponent(succeededDocuments);

            await waitFor((): void => {
                expect(clearIntervalSpy).toHaveBeenCalled();
            });
        });
    });

    describe('Props validation', (): void => {
        it('handles multiple documents', async (): Promise<void> => {
            const multipleDocuments = [
                mockDocuments[0],
                {
                    ...mockDocuments[0],
                    id: 'test-doc-2',
                    file: buildLgFile(2),
                    ref: 'test-ref-2',
                },
            ];

            renderComponent(multipleDocuments);

            await waitFor(
                (): void => {
                    expect(screen.getByTestId('documents-count')).toHaveTextContent('2');
                },
                { timeout: 1000 },
            );
        });

        it('handles existingId prop', async (): Promise<void> => {
            renderComponent(mockDocuments, testReviewData, 'existing-doc-id');

            await waitFor((): void => {
                expect(screen.getByTestId('mock-document-uploading-stage')).toBeInTheDocument();
            });
        });
    });

    describe('Session handling', (): void => {
        it('navigates to SESSION_EXPIRED on 403 error during upload', async (): Promise<void> => {
            const error = {
                response: { status: 403 },
            };
            vi.spyOn(uploadDocumentsModule, 'default').mockRejectedValueOnce(error);

            const stitchedReviewData = new ReviewDetails(
                'test-review-id',
                '16521000000101' as DOCUMENT_TYPE,
                '2023-10-01T12:00:00Z',
                'Test Uploader',
                '2023-10-01T12:00:00Z',
                'Test Reason',
                '1',
                '1234567890',
            );

            const documentsWithExisting = [
                {
                    ...mockDocuments[0],
                    type: UploadDocumentType.EXISTING,
                    versionId: 'v1',
                },
            ];

            renderComponent(documentsWithExisting, stitchedReviewData);

            await waitFor(
                (): void => {
                    expect(screen.queryByText('Preparing documents')).not.toBeInTheDocument();
                },
                { timeout: 2000 },
            );

            await waitFor((): void => {
                expect(screen.getByTestId('start-upload-button')).toBeInTheDocument();
            });

            const startButton = screen.getByTestId('start-upload-button');
            await act(async () => {
                startButton.click();
            });

            await waitFor((): void => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
            });
        });
    });

    describe('S3 Upload error handling', (): void => {
        it('marks document as failed and navigates to SERVER_ERROR on S3 upload failure', async (): Promise<void> => {
            const error = {
                response: { status: 500 },
            };
            vi.spyOn(uploadDocumentsModule, 'uploadDocumentToS3').mockRejectedValueOnce(error);

            const stitchedReviewData = new ReviewDetails(
                'test-review-id',
                '16521000000101' as DOCUMENT_TYPE,
                '2023-10-01T12:00:00Z',
                'Test Uploader',
                '2023-10-01T12:00:00Z',
                'Test Reason',
                '1',
                '1234567890',
            );

            const documentsWithExisting = [
                {
                    ...mockDocuments[0],
                    type: UploadDocumentType.EXISTING,
                    versionId: 'v1',
                },
            ];

            renderComponent(documentsWithExisting, stitchedReviewData);

            await waitFor(
                (): void => {
                    expect(screen.queryByText('Preparing documents')).not.toBeInTheDocument();
                },
                { timeout: 2000 },
            );

            await waitFor((): void => {
                expect(screen.getByTestId('start-upload-button')).toBeInTheDocument();
            });

            const startButton = screen.getByTestId('start-upload-button');
            await act(async () => {
                startButton.click();
            });

            await waitFor((): void => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    expect.stringContaining(routes.SERVER_ERROR),
                );
            });
        });
    });

    describe('Additional edge cases', (): void => {
        it('handles empty document array', async (): Promise<void> => {
            renderComponent([]);

            await waitFor((): void => {
                expect(screen.getByTestId('documents-count')).toHaveTextContent('0');
            });
        });

        it('handles document without error code in ERROR state', async (): Promise<void> => {
            const documentsWithErrorNoCode = [
                {
                    ...mockDocuments[0],
                    state: DOCUMENT_UPLOAD_STATE.ERROR,
                },
            ];

            renderComponent(documentsWithErrorNoCode as ReviewUploadDocument[]);

            await waitFor((): void => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.SERVER_ERROR);
            });
        });

        it('handles documents with mixed states', async (): Promise<void> => {
            const mixedDocuments = [
                mockDocuments[0],
                {
                    ...mockDocuments[0],
                    id: 'test-doc-2',
                    file: buildLgFile(2),
                    state: DOCUMENT_UPLOAD_STATE.UPLOADING,
                    ref: 'test-ref-2',
                },
            ];

            renderComponent(mixedDocuments);

            await waitFor((): void => {
                expect(screen.getByTestId('documents-count')).toHaveTextContent('2');
            });
        });
    });
});
