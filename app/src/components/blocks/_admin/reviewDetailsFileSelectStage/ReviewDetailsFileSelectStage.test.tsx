import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import ReviewDetailsFileSelectStage from './ReviewDetailsFileSelectStage';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../../../helpers/utils/documentType';
import {
    DOCUMENT_UPLOAD_STATE,
    ReviewUploadDocument,
    UploadDocumentType,
} from '../../../../types/pages/UploadDocumentsPage/types';
import { routeChildren } from '../../../../types/generic/routes';
import '../../../../helpers/utils/string-extensions';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';

vi.mock('../../../../helpers/utils/documentType');
vi.mock('../../../../helpers/hooks/useTitle', () => ({
    default: vi.fn(),
}));

const mockNavigate = vi.fn();
const mockSetPatientDetails = vi.fn();
const mockUsePatientDetailsContext = vi.fn();
const mockReviewId = 'test-review-123';
let currentReviewId: string | undefined = mockReviewId;

vi.mock('react-router-dom', async (): Promise<unknown> => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        useParams: (): { reviewId: string | undefined } => ({ reviewId: currentReviewId }),
    };
});

vi.mock('../../../../providers/patientProvider/PatientProvider', () => ({
    usePatientDetailsContext: (): unknown => mockUsePatientDetailsContext(),
}));

const mockGetConfigForDocType = getConfigForDocType as Mock;

const makeReviewDoc = (
    name: string,
    state: DOCUMENT_UPLOAD_STATE,
    type: UploadDocumentType,
): ReviewUploadDocument => {
    return {
        id: `id-${name}`,
        file: new File(['%PDF-1.4'], name, { type: 'application/pdf' }),
        docType: DOCUMENT_TYPE.LLOYD_GEORGE,
        attempts: 0,
        state,
        type,
    };
};

const renderApp = ({
    reviewData = null,
    uploadDocuments = [],
    setUploadDocuments = vi.fn() as any,
    mockPatientContext = true,
}: {
    reviewData?: any;
    uploadDocuments?: ReviewUploadDocument[];
    setUploadDocuments?: React.Dispatch<React.SetStateAction<ReviewUploadDocument[]>>;
    mockPatientContext?: boolean;
} = {}) => {
    if (mockPatientContext) {
        mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);
    }

    return render(
        <ReviewDetailsFileSelectStage
            reviewData={reviewData}
            uploadDocuments={uploadDocuments}
            setUploadDocuments={setUploadDocuments}
        />,
    );
};

describe('ReviewDetailsFileSelectStage', () => {
    const testReviewSnoMed: DOCUMENT_TYPE = DOCUMENT_TYPE.LLOYD_GEORGE;
    const mockReviewData = {
        snomedCode: testReviewSnoMed,
        files: [
            {
                fileName: 'file1.pdf',
                uploadDate: 1769710585,
            },
            {
                fileName: 'file2.pdf',
                uploadDate: 1769710585,
            },
        ],
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
        currentReviewId = mockReviewId;

        mockGetConfigForDocType.mockReturnValue({
            displayName: 'lloyd george record',
        });

        (globalThis.URL as any).createObjectURL = vi.fn(() => 'blob:mock-url');
        (HTMLElement.prototype as any).scrollIntoView = vi.fn();
    });

    it('renders a spinner when reviewData is null', () => {
        renderApp();

        expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    });

    it('renders heading and only shows REVIEW documents in the table', () => {
        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
            makeReviewDoc(
                'existing.pdf',
                DOCUMENT_UPLOAD_STATE.UNSELECTED,
                UploadDocumentType.EXISTING,
            ),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: documents });

        expect(
            screen.getByRole('heading', {
                name: /Choose files to add to the existing Lloyd george record/i,
            }),
        ).toBeInTheDocument();

        expect(screen.getByText('file1.pdf')).toBeInTheDocument();
        expect(screen.getByText('21 January 1970')).toBeInTheDocument();
        expect(screen.queryByText('existing.pdf')).not.toBeInTheDocument();
    });

    it('renders patient demographics', () => {
        mockUsePatientDetailsContext.mockReturnValue([buildPatientDetails(), mockSetPatientDetails]);

        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
            makeReviewDoc(
                'existing.pdf',
                DOCUMENT_UPLOAD_STATE.UNSELECTED,
                UploadDocumentType.EXISTING,
            ),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: documents, mockPatientContext: false });

        expect(screen.getByTestId('patient-summary')).toBeInTheDocument();
        expect(screen.getByTestId('patient-summary-full-name')).toBeInTheDocument();
        expect(screen.getByTestId('patient-summary-nhs-number')).toBeInTheDocument();
        expect(screen.getByTestId('patient-summary-date-of-birth')).toBeInTheDocument();
    });

    it('allows viewing a selected file and passes the object URL to the PDF viewer', async () => {
        const user = userEvent.setup();
        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: documents });

        await user.click(screen.getByRole('button', { name: /View file1\.pdf/i }));

        expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/You are currently viewing: file1.pdf/i)).toBeInTheDocument();
        expect(screen.getByTestId('pdf-viewer')).toHaveAttribute('src', 'blob:mock-url');
    });

    it('shows an error summary if Continue is clicked with no selected files, and scrolls to it', async () => {
        const user = userEvent.setup();
        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: documents });

        await user.click(screen.getByRole('button', { name: 'Continue' }));

        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('There is a problem')).toBeInTheDocument();
        expect(screen.getByText('You need to select an option')).toBeInTheDocument();

        await waitFor(() => {
            expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
                behavior: 'smooth',
            });
        });
    });

    it('clears the error summary after selecting a file', async () => {
        const user = userEvent.setup();
        const initialDocs: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        const Wrapper = (): React.JSX.Element => {
            const [docs, setDocs] = useState<ReviewUploadDocument[]>(initialDocs);
            return (
                <ReviewDetailsFileSelectStage
                    reviewData={mockReviewData}
                    uploadDocuments={docs}
                    setUploadDocuments={setDocs}
                />
            );
        };

        mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);
        render(<Wrapper />);

        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('alert')).toBeInTheDocument();

        const checkbox = screen.getByRole('checkbox', { name: /Select file1\.pdf/i });
        await user.click(checkbox);

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(checkbox).toBeChecked();
    });

    it('navigates to add-more-choice when all files are selected', async () => {
        const user = userEvent.setup();
        const initialDocs: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.SELECTED, UploadDocumentType.REVIEW),
            makeReviewDoc('file2.pdf', DOCUMENT_UPLOAD_STATE.SELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: initialDocs });

        await user.click(screen.getByRole('button', { name: 'Continue' }));

        expect(mockNavigate).toHaveBeenCalledWith(
            routeChildren.ADMIN_REVIEW_ADD_MORE_CHOICE.replace(':reviewId', mockReviewId),
            undefined,
        );
    });

    it('navigates to download-choice when some files are unselected', async () => {
        const user = userEvent.setup();
        const initialDocs: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.SELECTED, UploadDocumentType.REVIEW),
            makeReviewDoc('file2.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: initialDocs });

        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(mockNavigate).toHaveBeenCalledWith(
            routeChildren.ADMIN_REVIEW_DOWNLOAD_CHOICE.replace(':reviewId', mockReviewId),
        );
    });

    it('does not navigate if reviewId is missing', async () => {
        const user = userEvent.setup();
        currentReviewId = undefined;

        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.SELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: documents });

        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('renders back button', () => {
        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: documents });

        expect(screen.getByTestId('back-button')).toBeInTheDocument();
        expect(screen.getByText('Go back')).toBeInTheDocument();
    });

    it('renders continue section with guidance text', () => {
        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: documents });

        expect(
            screen.getByText('If you need to add any more files you can do this next.'),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    });

    it('renders table headers correctly', () => {
        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: documents });

        expect(screen.getByRole('columnheader', { name: 'Filename' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Date received' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'View file' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Select' })).toBeInTheDocument();
    });

    it('allows multiple files to be selected', async () => {
        const user = userEvent.setup();
        const initialDocs: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
            makeReviewDoc('file2.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        const Wrapper = (): React.JSX.Element => {
            const [docs, setDocs] = useState<ReviewUploadDocument[]>(initialDocs);
            return (
                <ReviewDetailsFileSelectStage
                    reviewData={mockReviewData}
                    uploadDocuments={docs}
                    setUploadDocuments={setDocs}
                />
            );
        };

        mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);
        render(<Wrapper />);

        const checkbox1 = screen.getByRole('checkbox', { name: /Select file1\.pdf/i });
        const checkbox2 = screen.getByRole('checkbox', { name: /Select file2\.pdf/i });

        await user.click(checkbox1);
        await user.click(checkbox2);

        expect(checkbox1).toBeChecked();
        expect(checkbox2).toBeChecked();
    });

    it('allows unselecting a previously selected file', async () => {
        const user = userEvent.setup();
        const initialDocs: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.SELECTED, UploadDocumentType.REVIEW),
        ];

        const Wrapper = (): React.JSX.Element => {
            const [docs, setDocs] = useState<ReviewUploadDocument[]>(initialDocs);
            return (
                <ReviewDetailsFileSelectStage
                    reviewData={mockReviewData}
                    uploadDocuments={docs}
                    setUploadDocuments={setDocs}
                />
            );
        };

        mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);
        render(<Wrapper />);

        const checkbox = screen.getByRole('checkbox', { name: /Select file1\.pdf/i });
        expect(checkbox).toBeChecked();

        await user.click(checkbox);
        expect(checkbox).not.toBeChecked();
    });

    it('switches between viewing different files', async () => {
        const user = userEvent.setup();
        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
            makeReviewDoc('file2.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: documents });

        await user.click(screen.getByRole('button', { name: /View file1\.pdf/i }));
        expect(screen.getByText(/You are currently viewing: file1.pdf/i)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /View file2\.pdf/i }));
        expect(screen.getByText(/You are currently viewing: file2.pdf/i)).toBeInTheDocument();

        expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(2);
    });

    it('displays formatted upload dates correctly', () => {
        const mockReviewDataWithDates = {
            snomedCode: testReviewSnoMed,
            files: [
                {
                    fileName: 'file1.pdf',
                    uploadDate: 1609459200000, // 1 January 2021 in milliseconds
                },
                {
                    fileName: 'file2.pdf',
                    uploadDate: 1612137600000, // 1 February 2021 in milliseconds
                },
            ],
        } as any;

        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
            makeReviewDoc('file2.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({ reviewData: mockReviewDataWithDates, uploadDocuments: documents });

        expect(screen.getByText('1 January 2021')).toBeInTheDocument();
        expect(screen.getByText('1 February 2021')).toBeInTheDocument();
    });

    it('renders new files section heading', () => {
        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: documents });

        expect(screen.getByRole('heading', { name: 'New files' })).toBeInTheDocument();
    });

    it('shows error message in fieldset when no files are selected', async () => {
        const user = userEvent.setup();
        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: documents });

        await user.click(screen.getByRole('button', { name: 'Continue' }));

        expect(screen.getByText('Select at least one file')).toBeInTheDocument();
    });

    it('does not render PDF viewer when no file is selected', () => {
        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: documents });

        expect(screen.queryByTestId('pdf-viewer')).not.toBeInTheDocument();
        expect(screen.queryByText(/You are currently viewing:/i)).not.toBeInTheDocument();
    });

    it('calls setUploadDocuments when a file is selected', async () => {
        const user = userEvent.setup();
        const mockSetDocs = vi.fn();
        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: documents, setUploadDocuments: mockSetDocs });

        const checkbox = screen.getByRole('checkbox', { name: /Select file1\.pdf/i });
        
        await user.click(checkbox);
        
        expect(mockSetDocs).toHaveBeenCalled();
    });

    it('maintains checkbox state across re-renders', () => {
        const selectedDoc = makeReviewDoc(
            'selected.pdf',
            DOCUMENT_UPLOAD_STATE.SELECTED,
            UploadDocumentType.REVIEW,
        );
        const unselectedDoc = makeReviewDoc(
            'unselected.pdf',
            DOCUMENT_UPLOAD_STATE.UNSELECTED,
            UploadDocumentType.REVIEW,
        );

        const { rerender } = renderApp({
            reviewData: mockReviewData,
            uploadDocuments: [selectedDoc, unselectedDoc],
        });

        expect(screen.getByRole('checkbox', { name: /Select selected\.pdf/i })).toBeChecked();
        expect(
            screen.getByRole('checkbox', { name: /Select unselected\.pdf/i }),
        ).not.toBeChecked();

        mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);
        rerender(
            <ReviewDetailsFileSelectStage
                reviewData={mockReviewData}
                uploadDocuments={[selectedDoc, unselectedDoc]}
                setUploadDocuments={vi.fn() as any}
            />,
        );

        expect(screen.getByRole('checkbox', { name: /Select selected\.pdf/i })).toBeChecked();
        expect(
            screen.getByRole('checkbox', { name: /Select unselected\.pdf/i }),
        ).not.toBeChecked();
    });

    it('renders correct document type display name in heading', () => {
        mockGetConfigForDocType.mockReturnValue({
            displayName: 'test document type',
        });

        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: documents });

        expect(
            screen.getByRole('heading', {
                name: /Choose files to add to the existing Test document type/i,
            }),
        ).toBeInTheDocument();
    });

    it('only filters and displays REVIEW type documents in table', () => {
        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('review1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
            makeReviewDoc('review2.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
            makeReviewDoc(
                'existing1.pdf',
                DOCUMENT_UPLOAD_STATE.UNSELECTED,
                UploadDocumentType.EXISTING,
            ),
            makeReviewDoc(
                'existing2.pdf',
                DOCUMENT_UPLOAD_STATE.UNSELECTED,
                UploadDocumentType.EXISTING,
            ),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: documents });

        expect(screen.getByText('review1.pdf')).toBeInTheDocument();
        expect(screen.getByText('review2.pdf')).toBeInTheDocument();
        expect(screen.queryByText('existing1.pdf')).not.toBeInTheDocument();
        expect(screen.queryByText('existing2.pdf')).not.toBeInTheDocument();
    });
});
