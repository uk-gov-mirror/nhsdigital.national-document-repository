import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { describe, expect, it, Mock, vi } from 'vitest';
import ReviewDetailsAssessmentStage from './ReviewDetailsAssessmentStage';
import { DOWNLOAD_STAGE } from '../../../../types/generic/downloadStage';
import {
    DOCUMENT_UPLOAD_STATE,
    ReviewUploadDocument,
    UploadDocumentType,
} from '../../../../types/pages/UploadDocumentsPage/types';
import { ReviewDetails } from '../../../../types/generic/reviews';
import * as getReviewsModule from '../../../../helpers/requests/getReviews';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';

const mockedUseNavigate = vi.fn();
const mockSetPatientDetails = vi.fn();
const mockUsePatientDetailsContext = vi.fn();

vi.mock('../../../../helpers/utils/getPdfObjectUrl', () => ({
    getPdfObjectUrl: vi.fn().mockResolvedValue(200),
}));

vi.mock('../../../../helpers/utils/isLocal', () => ({
    isLocal: false,
}));
vi.mock('react-router-dom', async () => ({
    ...(await vi.importActual('react-router-dom')),
    useNavigate: (): Mock => mockedUseNavigate,
    useParams: (): { reviewId: string } => ({ reviewId: 'test-review-id.v1' }),
}));

vi.mock('../../../../helpers/hooks/useTitle');
vi.mock('../../../../helpers/hooks/useBaseAPIUrl', () => ({
    default: (): string => 'http://test-api.com',
}));
vi.mock('../../../../helpers/hooks/useBaseAPIHeaders', () => ({
    default: (): { Authorization: string } => ({ Authorization: 'Bearer test-token' }),
}));

vi.mock('../../../../helpers/utils/string-extensions');

vi.mock('../../../generic/backButton/BackButton', () => ({
    default: (): React.ReactElement => <div data-testid="back-button">Back</div>,
}));

vi.mock('../../../generic/spinner/Spinner', () => ({
    default: ({ status }: { status: string }): React.ReactElement => <div>{status}</div>,
}));

vi.mock('./ExistingRecordTable', () => ({
    default: ({
        existingFiles,
        onFileView,
    }: {
        existingFiles: any[];
        onFileView: (filename: string, id: string) => void;
    }): React.ReactElement => (
        <div data-testid="existing-record-table">
            {existingFiles.map((file) => (
                <div key={file.fileName}>
                    <span>{file.fileName}</span>
                    <button onClick={(): void => onFileView(file.fileName, file.id || '')}>
                        View
                    </button>
                </div>
            ))}
        </div>
    ),
}));

vi.mock(
    '../../_documentUpload/documentUploadLloydGeorgePreview/DocumentUploadLloydGeorgePreview',
    () => ({
        default: ({
            documents,
            setMergedPdfBlob,
            stitchedBlobLoaded,
        }: {
            documents: ReviewUploadDocument[];
            setMergedPdfBlob?: (blob: Blob | null) => void;
            stitchedBlobLoaded?: (loaded: boolean) => void;
        }): React.ReactElement => {
            if (stitchedBlobLoaded) {
                setTimeout(() => stitchedBlobLoaded(true), 0);
            }
            return (
                <div data-testid="lloyd-george-preview">
                    Preview for {documents.length} documents
                </div>
            );
        },
    }),
);

vi.mock('../../../../providers/patientProvider/PatientProvider', () => ({
    usePatientDetailsContext: (): unknown => mockUsePatientDetailsContext(),
}));

const mockSetReviewData = vi.fn();
const mockSetDownloadStage = vi.fn();

const createMockReviewData = (
    canBeUpdated = true,
    canBeDiscarded = true,
    hasExistingFiles = true,
    snomedCode = '16521000000101' as DOCUMENT_TYPE,
): ReviewDetails => {
    const review = new ReviewDetails(
        'test-review-id',
        snomedCode,
        '2024-01-15T09:00:00Z',
        'test-uploader',
        '2024-01-15T09:00:00Z',
        'test-reason',
        'v1',
        '1234567890',
    );
    review.files = [
        {
            fileName: 'new-file-1.pdf',
            uploadDate: '2024-01-15T10:00:00Z',
            presignedUrl: 'https://test-url-1.com',
        },
        {
            fileName: 'new-file-2.pdf',
            uploadDate: '2024-01-16T10:00:00Z',
            presignedUrl: 'https://test-url-2.com',
        },
    ];
    review.existingFiles = hasExistingFiles
        ? [
              {
                  fileName: 'existing-file-1.pdf',
                  created: '2023-12-01T10:00:00Z',
                  virusScannerResult: 'Clean',
                  id: 'existing-1',
                  fileSize: 1024,
                  version: '1',
                  documentSnomedCodeType: snomedCode,
                  contentType: 'application/pdf',
                  url: 'https://existing-url-1.com',
                  blob: undefined,
              },
          ]
        : [];
    return review;
};

const createMockUploadDocuments = (): ReviewUploadDocument[] => [
    {
        id: 'new-1',
        file: new File(['test content 1'], 'new-file-1.pdf', { type: 'application/pdf' }),
        type: UploadDocumentType.REVIEW,
        state: DOCUMENT_UPLOAD_STATE.SELECTED,
        docType: '16521000000101' as DOCUMENT_TYPE,
        attempts: 0,
    },
    {
        id: 'new-2',
        file: new File(['test content 2'], 'new-file-2.pdf', { type: 'application/pdf' }),
        type: UploadDocumentType.REVIEW,
        state: DOCUMENT_UPLOAD_STATE.SELECTED,
        docType: '16521000000101' as DOCUMENT_TYPE,
        attempts: 0,
    },
    {
        id: 'existing-1',
        file: new File(['existing content'], 'existing-file-1.pdf', { type: 'application/pdf' }),
        type: UploadDocumentType.EXISTING,
        state: DOCUMENT_UPLOAD_STATE.SELECTED,
        docType: '16521000000101' as DOCUMENT_TYPE,
        attempts: 0,
    },
];

describe('ReviewDetailsAssessmentPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('displays spinner when reviewData is null', () => {
            mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={null}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            expect(screen.getByText('Loading')).toBeInTheDocument();
        });

        it('displays spinner only when uploadDocuments is null/undefined or reviewData is null', () => {
            mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);

            const { rerender } = render(
                <ReviewDetailsAssessmentStage
                    reviewData={null}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            expect(screen.getByText('Loading')).toBeInTheDocument();

            rerender(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData()}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={[]}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            expect(
                screen.getByText(/Review the new and existing Scanned paper notes/i),
            ).toBeInTheDocument();
        });

        it('renders page title for review with existing and new files', () => {
            mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData(true, true, true)}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            expect(
                screen.getByText(/Review the new and existing Scanned paper notes/i),
            ).toBeInTheDocument();
        });

        it('renders accept/reject radio buttons when only canBeDiscarded is true', () => {
            mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData(
                        false,
                        true,
                        false,
                        '24511000000107' as DOCUMENT_TYPE,
                    )}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={false}
                />,
            );

            expect(screen.getByRole('radio', { name: 'Accept record' })).toBeInTheDocument();
            expect(screen.getByRole('radio', { name: 'Reject record' })).toBeInTheDocument();
        });

        it('renders add-all and choose-files radio buttons when no existing record', () => {
            mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData(true, true, false)}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={false}
                />,
            );

            expect(screen.getByLabelText('Add all these files')).toBeInTheDocument();
            expect(screen.getByLabelText('Choose which files to add')).toBeInTheDocument();
            expect(
                screen.queryByText(/I don't need these files, they are duplicates/),
            ).not.toBeInTheDocument();
        });

        it('renders all radio options when has existing record in storage', () => {
            mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData(true, true, true)}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            expect(
                screen.getByRole('radio', {
                    name: /Add all files to the existing Scanned paper notes/i,
                }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('radio', { name: /Choose which files to add to the existing/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('radio', {
                    name: /I don't need these files, they are duplicates/i,
                }),
            ).toBeInTheDocument();
        });

        it('displays existing files table when available', () => {
            mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData(true, true, true)}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            expect(screen.getByText('existing-file-1.pdf')).toBeInTheDocument();
        });

        it('displays new files table', () => {
            mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData(true, true, true)}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            expect(screen.getByText('New files')).toBeInTheDocument();
            expect(screen.getByText('new-file-1.pdf')).toBeInTheDocument();
            expect(screen.getByText('new-file-2.pdf')).toBeInTheDocument();
        });

        it('displays "all files" viewing message by default', () => {
            mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData()}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            expect(screen.getByText('You are currently viewing: all files')).toBeInTheDocument();
        });

        it('displays patient demographics', async () => {
            mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData()}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={false}
                />,
            );

            expect(screen.getByTestId('patient-summary')).toBeInTheDocument();
            expect(screen.getByTestId('patient-summary-full-name')).toBeInTheDocument();
            expect(screen.getByTestId('patient-summary-nhs-number')).toBeInTheDocument();
            expect(screen.getByTestId('patient-summary-date-of-birth')).toBeInTheDocument();
        });
    });

    describe('File viewing', () => {
        it('allows viewing new files', async () => {
            const user = userEvent.setup();
            const mockGetReviewById = vi.spyOn(getReviewsModule, 'getReviewById');
            mockGetReviewById.mockResolvedValue(createMockReviewData() as any);

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData()}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const viewButtons = screen.getAllByRole('button', { name: /View/i });
            await act(async () => {
                await user.click(viewButtons[1]);
            });

            await waitFor(() => {
                expect(mockSetDownloadStage).toHaveBeenCalledWith(DOWNLOAD_STAGE.PENDING);
            });
        });

        it('displays selected file name when viewing a specific file', async () => {
            const user = userEvent.setup();
            const reviewData = createMockReviewData();
            const mockGetReviewById = vi.spyOn(getReviewsModule, 'getReviewById');
            mockGetReviewById.mockResolvedValue(reviewData as any);

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={reviewData}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const viewButtons = screen.getAllByRole('button', { name: /View/i });
            await act(async () => {
                await user.click(viewButtons[1]);
            });

            await waitFor(() => {
                expect(mockGetReviewById).toHaveBeenCalled();
            });
        });

        it('displays selected new file when viewing', async () => {
            const user = userEvent.setup();
            const reviewData = createMockReviewData();
            const mockGetReviewById = vi.spyOn(getReviewsModule, 'getReviewById');
            mockGetReviewById.mockResolvedValue(reviewData as any);

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={reviewData}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const viewButtons = screen.getAllByRole('button', { name: /View/i });
            await act(async () => {
                await user.click(viewButtons[1]);
            });

            await waitFor(() => {
                expect(
                    screen.getByText((content, element) => {
                        return (
                            element?.tagName.toLowerCase() === 'strong' &&
                            content.includes('You are currently viewing:') &&
                            content.includes('new-file-1.pdf')
                        );
                    }),
                ).toBeInTheDocument();
            });
        });

        it('displays selected existing file when viewing', async () => {
            const user = userEvent.setup();
            const reviewData = createMockReviewData();

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={reviewData}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const existingFileViewButton = screen.getByTestId('existing-record-table');
            const viewButton = existingFileViewButton.querySelector('button');

            await act(async () => {
                await user.click(viewButton!);
            });

            await waitFor(() => {
                expect(
                    screen.getByText((content, element) => {
                        return (
                            element?.tagName.toLowerCase() === 'strong' &&
                            content.includes('You are currently viewing:') &&
                            content.includes('existing-file-1.pdf')
                        );
                    }),
                ).toBeInTheDocument();
            });
        });

        it('displays "(new files)" label when multiple documents have same filename', async () => {
            const user = userEvent.setup();
            const reviewData = createMockReviewData();
            const mockGetReviewById = vi.spyOn(getReviewsModule, 'getReviewById');
            mockGetReviewById.mockResolvedValue(reviewData as any);

            // Create upload documents with duplicate filenames
            const uploadDocsWithDuplicates: ReviewUploadDocument[] = [
                {
                    id: 'new-1',
                    file: new File(['test content 1'], 'duplicate.pdf', {
                        type: 'application/pdf',
                    }),
                    type: UploadDocumentType.REVIEW,
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    docType: '16521000000101' as DOCUMENT_TYPE,
                    attempts: 0,
                },
                {
                    id: 'new-2',
                    file: new File(['test content 2'], 'duplicate.pdf', {
                        type: 'application/pdf',
                    }),
                    type: UploadDocumentType.REVIEW,
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    docType: '16521000000101' as DOCUMENT_TYPE,
                    attempts: 0,
                },
            ];

            reviewData.files = [
                {
                    fileName: 'duplicate.pdf',
                    uploadDate: '2024-01-15T10:00:00Z',
                    presignedUrl: 'https://test-url-1.com',
                },
            ];

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={reviewData}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={uploadDocsWithDuplicates}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const viewButtons = screen.getAllByRole('button', { name: /View duplicate.pdf/i });
            await act(async () => {
                await user.click(viewButtons[0]); // Click first duplicate
            });

            await waitFor(() => {
                expect(screen.getByText(/\(new files\)/)).toBeInTheDocument();
                expect(
                    screen.getByText((content, element) => {
                        return (
                            element?.tagName.toLowerCase() === 'strong' &&
                            content.includes('You are currently viewing') &&
                            content.includes('duplicate.pdf')
                        );
                    }),
                ).toBeInTheDocument();
            });
        });

        it('displays "(existing files)" label when multiple existing documents have same filename', async () => {
            const user = userEvent.setup();
            const reviewData = createMockReviewData();

            // Create upload documents with duplicate existing filenames
            const uploadDocsWithDuplicates: ReviewUploadDocument[] = [
                {
                    id: 'existing-1',
                    file: new File(['existing content 1'], 'existing-dup.pdf', {
                        type: 'application/pdf',
                    }),
                    type: UploadDocumentType.EXISTING,
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    docType: '16521000000101' as DOCUMENT_TYPE,
                    attempts: 0,
                },
                {
                    id: 'existing-2',
                    file: new File(['existing content 2'], 'existing-dup.pdf', {
                        type: 'application/pdf',
                    }),
                    type: UploadDocumentType.EXISTING,
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    docType: '16521000000101' as DOCUMENT_TYPE,
                    attempts: 0,
                },
            ];

            reviewData.existingFiles = [
                {
                    fileName: 'existing-dup.pdf',
                    created: '2023-12-01T10:00:00Z',
                    virusScannerResult: 'Clean',
                    id: 'existing-1',
                    fileSize: 1024,
                    version: '1',
                    documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
                    contentType: 'application/pdf',
                    url: 'https://existing-url-1.com',
                    blob: undefined,
                },
            ];

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={reviewData}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={uploadDocsWithDuplicates}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const existingFileViewButton = screen.getByTestId('existing-record-table');
            const viewButton = existingFileViewButton.querySelector('button');

            await act(async () => {
                await user.click(viewButton!);
            });

            await waitFor(() => {
                expect(screen.getByText(/\(existing files\)/)).toBeInTheDocument();
                expect(
                    screen.getByText((content, element) => {
                        return (
                            element?.tagName.toLowerCase() === 'strong' &&
                            content.includes('You are currently viewing') &&
                            content.includes('existing-dup.pdf')
                        );
                    }),
                ).toBeInTheDocument();
            });
        });
    });

    describe('Radio button selection', () => {
        it('allows selecting add-all option', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData(true, true, true)}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const addAllRadio = screen.getByRole('radio', {
                name: /Add all files to the existing Scanned paper notes/i,
            });
            await user.click(addAllRadio);

            expect(addAllRadio).toBeChecked();
        });

        it('allows selecting choose-files option', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData(true, true, true)}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const chooseFilesRadio = screen.getByLabelText(
                /Choose which files to add to the existing/i,
            );
            await user.click(chooseFilesRadio);

            expect(chooseFilesRadio).toBeChecked();
        });

        it('allows selecting duplicate option', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData(true, true, true)}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const duplicateRadio = screen.getByLabelText(
                /I don't need these files, they are duplicates/i,
            );
            await user.click(duplicateRadio);

            expect(duplicateRadio).toBeChecked();
        });

        it('allows selecting accept option when only discard is enabled', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData(
                        false,
                        true,
                        false,
                        '24511000000107' as DOCUMENT_TYPE,
                    )}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={false}
                />,
            );

            const acceptRadio = screen.getByRole('radio', { name: 'Accept record' });
            await user.click(acceptRadio);

            expect(acceptRadio).toBeChecked();
        });

        it('allows selecting reject option when only discard is enabled', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData(
                        false,
                        true,
                        false,
                        '24511000000107' as DOCUMENT_TYPE,
                    )}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={false}
                />,
            );

            const rejectRadio = screen.getByRole('radio', { name: 'Reject record' });
            await user.click(rejectRadio);

            expect(rejectRadio).toBeChecked();
        });
    });

    describe('Continue button behavior', () => {
        it('shows error when continue is clicked without selecting an option', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData()}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            expect(screen.getByText('There is a problem')).toBeInTheDocument();
            expect(
                screen.getByText('Select what you want to do with these files'),
            ).toBeInTheDocument();
        });

        it('navigates to add more choice when add-all is selected with existing files', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData(true, true, true)}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const addAllRadio = screen.getByRole('radio', {
                name: /Add all files to the existing Scanned paper notes/i,
            });
            await user.click(addAllRadio);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            expect(mockedUseNavigate).toHaveBeenCalledWith(
                '/admin/reviews/test-review-id.v1/add-more-choice',
                undefined,
            );
        });

        it('navigates to choose which files when choose-files is selected', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData(true, true, true)}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const chooseFilesRadio = screen.getByRole('radio', {
                name: /Choose which files to add to the existing/i,
            });
            await user.click(chooseFilesRadio);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            expect(mockedUseNavigate).toHaveBeenCalledWith(
                '/admin/reviews/test-review-id.v1/files',
                undefined,
            );
        });

        it('navigates to no files choice when duplicate is selected', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData(true, true, true)}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const duplicateRadio = screen.getByRole('radio', {
                name: /I don't need these files, they are duplicates/i,
            });
            await user.click(duplicateRadio);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            expect(mockedUseNavigate).toHaveBeenCalledWith(
                '/admin/reviews/test-review-id.v1/no-files-choice',
                undefined,
            );
        });

        it('navigates to no files choice when reject is selected', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData(false, true, false, DOCUMENT_TYPE.EHR)}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={false}
                />,
            );

            const rejectRadio = screen.getByRole('radio', { name: 'Reject record' });
            await user.click(rejectRadio);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            expect(mockedUseNavigate).toHaveBeenCalledWith(
                '/admin/reviews/test-review-id.v1/no-files-choice',
                undefined,
            );
        });
    });

    describe('Error handling', () => {
        it('shows error summary when continue is clicked without selecting an option', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData()}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            expect(screen.getByText('There is a problem')).toBeInTheDocument();
            expect(screen.getByText('Select an option')).toBeInTheDocument();
        });

        it('error summary focuses on the error when shown', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData()}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            const errorSummary = screen.getByRole('alert', { name: /there is a problem/i });
            expect(errorSummary).toHaveFocus();
        });

        it('clears error when an option is selected and continue is clicked', async () => {
            const user = userEvent.setup();

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData()}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            expect(screen.getByText('There is a problem')).toBeInTheDocument();

            const addAllRadio = screen.getByLabelText(/Add all files to the existing/i);
            await user.click(addAllRadio);
            await user.click(continueButton);

            expect(screen.queryByText('There is a problem')).not.toBeInTheDocument();
        });
    });

    describe('Error handling for file viewing', () => {
        it('navigates to SESSION_EXPIRED when getReviewById returns 403', async () => {
            const user = userEvent.setup();
            const mockGetReviewById = vi.spyOn(getReviewsModule, 'getReviewById');
            mockGetReviewById.mockRejectedValue({ code: '403' });

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData()}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const viewButtons = screen.getAllByRole('button', { name: /View/i });
            await act(async () => {
                await user.click(viewButtons[1]);
            });

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith('/session-expired');
            });
        });

        it('navigates to SERVER_ERROR when getReviewById returns other error', async () => {
            const user = userEvent.setup();
            const mockGetReviewById = vi.spyOn(getReviewsModule, 'getReviewById');
            mockGetReviewById.mockRejectedValue(new Error('Server error'));

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData()}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            const viewButtons = screen.getAllByRole('button', { name: /View/i });
            await act(async () => {
                await user.click(viewButtons[1]);
            });

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith(
                    expect.stringContaining('/server-error'),
                );
            });
        });
    });

    describe('Navigation with accept action and multifileReview', () => {
        it('navigates to UPLOAD when accept is selected with single file', async () => {
            const user = userEvent.setup();
            const singleFileReviewData = createMockReviewData(
                false,
                true,
                false,
                '24511000000107' as DOCUMENT_TYPE,
            );
            singleFileReviewData.files = [
                {
                    fileName: 'single-file.pdf',
                    uploadDate: '2024-01-15T09:00:00Z',
                    presignedUrl: 'http://example.com',
                },
            ];

            const singleUploadDoc = [
                {
                    id: 'new-1',
                    file: new File(['test content'], 'single-file.pdf', {
                        type: 'application/pdf',
                    }),
                    type: UploadDocumentType.REVIEW,
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    docType: '24511000000107' as DOCUMENT_TYPE,
                    attempts: 0,
                },
            ];

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={singleFileReviewData}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={singleUploadDoc}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={false}
                />,
            );

            const acceptRadio = screen.getByLabelText(/Accept record/i);
            await user.click(acceptRadio);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith(
                    '/admin/reviews/test-review-id.v1/upload',
                    undefined,
                );
            });
        });

        it('navigates to UPLOAD_FILE_ORDER when accept is selected with multiple files', async () => {
            const user = userEvent.setup();
            const multipleFileReviewData = createMockReviewData(
                false,
                true,
                false,
                '24511000000107' as DOCUMENT_TYPE,
            );
            multipleFileReviewData.files = [
                {
                    fileName: 'file-1.pdf',
                    uploadDate: '2024-01-15T09:00:00Z',
                    presignedUrl: 'http://example.com/1',
                },
                {
                    fileName: 'file-2.pdf',
                    uploadDate: '2024-01-16T09:00:00Z',
                    presignedUrl: 'http://example.com/2',
                },
            ];

            const multiUploadDocs: ReviewUploadDocument[] = [
                {
                    id: 'new-1',
                    file: new File(['test content 1'], 'file-1.pdf', { type: 'application/pdf' }),
                    type: UploadDocumentType.REVIEW,
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    docType: '24511000000107' as DOCUMENT_TYPE,
                    attempts: 0,
                },
                {
                    id: 'new-2',
                    file: new File(['test content 2'], 'file-2.pdf', { type: 'application/pdf' }),
                    type: UploadDocumentType.REVIEW,
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    docType: '24511000000107' as DOCUMENT_TYPE,
                    attempts: 0,
                },
            ];

            render(
                <ReviewDetailsAssessmentStage
                    reviewData={multipleFileReviewData}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={multiUploadDocs}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={false}
                />,
            );

            const acceptRadio = screen.getByLabelText(/Accept record/i);
            await user.click(acceptRadio);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith(
                    '/admin/reviews/test-review-id.v1/upload-file-order',
                    undefined,
                );
            });
        });
    });

    describe('Back button', () => {
        it('renders back button', () => {
            render(
                <ReviewDetailsAssessmentStage
                    reviewData={createMockReviewData()}
                    setReviewData={mockSetReviewData}
                    uploadDocuments={createMockUploadDocuments()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    setDownloadStage={mockSetDownloadStage}
                    hasExistingRecordInStorage={true}
                />,
            );

            expect(screen.getByTestId('back-button')).toBeInTheDocument();
        });
    });
});
