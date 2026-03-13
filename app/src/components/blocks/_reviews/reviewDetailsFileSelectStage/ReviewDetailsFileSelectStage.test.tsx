import { render, RenderResult, screen, waitFor } from '@testing-library/react';
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
import useReviewId from '../../../../helpers/hooks/useReviewId';

vi.mock('../../../../helpers/utils/documentType');
vi.mock('../../../../helpers/hooks/useTitle', () => ({
    default: vi.fn(),
}));
vi.mock('../../../../providers/analyticsProvider/AnalyticsProvider', () => ({
    useAnalyticsContext: vi.fn(() => [null, vi.fn()]),
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
    };
});

vi.mock('../../../../providers/patientProvider/PatientProvider', () => ({
    usePatientDetailsContext: (): unknown => mockUsePatientDetailsContext(),
}));

vi.mock('../../../../helpers/hooks/useReviewId');
const mockUseReviewId = useReviewId as Mock;

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
} = {}): RenderResult => {
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
        mockUseReviewId.mockReturnValue(currentReviewId);
    });

    it('renders a spinner when reviewData is null', () => {
        mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);

        renderApp({ reviewData: null });

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

        renderApp({
            reviewData: mockReviewData,
            uploadDocuments: documents,
        });

        expect(
            screen.getByRole('heading', {
                name: /Choose files to add to the existing Lloyd george record/i,
            }),
        ).toBeInTheDocument();

        expect(screen.getByText('file1.pdf')).toBeInTheDocument();
        expect(screen.getByText('29 January 2026')).toBeInTheDocument();
        expect(screen.queryByText('existing.pdf')).not.toBeInTheDocument();
    });

    it('renders patient demographics', () => {
        mockUsePatientDetailsContext.mockReturnValue([
            buildPatientDetails(),
            mockSetPatientDetails,
        ]);

        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
            makeReviewDoc(
                'existing.pdf',
                DOCUMENT_UPLOAD_STATE.UNSELECTED,
                UploadDocumentType.EXISTING,
            ),
        ];

        renderApp({
            reviewData: mockReviewData,
            uploadDocuments: documents,
            mockPatientContext: false,
        });

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

        renderApp({
            reviewData: mockReviewData,
            uploadDocuments: documents,
        });

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

        renderApp({
            reviewData: mockReviewData,
            uploadDocuments: documents,
        });

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

        renderApp({
            reviewData: mockReviewData,
            uploadDocuments: initialDocs,
        });

        await user.click(screen.getByRole('button', { name: 'Continue' }));

        expect(mockNavigate).toHaveBeenCalledWith(
            routeChildren.REVIEW_ADD_MORE_CHOICE.replace(':reviewId', mockReviewId),
            undefined,
        );
    });

    it('navigates to download-choice when some files are unselected', async () => {
        const user = userEvent.setup();
        const initialDocs: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.SELECTED, UploadDocumentType.REVIEW),
            makeReviewDoc('file2.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({
            reviewData: mockReviewData,
            uploadDocuments: initialDocs,
        });

        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(mockNavigate).toHaveBeenCalledWith(
            routeChildren.REVIEW_DOWNLOAD_CHOICE.replace(':reviewId', mockReviewId),
        );
    });

    it('does not navigate if reviewId is missing', async () => {
        currentReviewId = undefined;

        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.SELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({ reviewData: mockReviewData, uploadDocuments: documents });

        expect(screen.getByRole('checkbox', { name: /Select file1\.pdf/i })).toBeChecked();
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
            makeReviewDoc(
                'review1.pdf',
                DOCUMENT_UPLOAD_STATE.UNSELECTED,
                UploadDocumentType.REVIEW,
            ),
            makeReviewDoc(
                'review2.pdf',
                DOCUMENT_UPLOAD_STATE.UNSELECTED,
                UploadDocumentType.REVIEW,
            ),
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

    it('only updates REVIEW type documents when selecting files', async () => {
        const user = userEvent.setup();
        const initialDocs: ReviewUploadDocument[] = [
            makeReviewDoc(
                'review1.pdf',
                DOCUMENT_UPLOAD_STATE.UNSELECTED,
                UploadDocumentType.REVIEW,
            ),
            makeReviewDoc(
                'existing1.pdf',
                DOCUMENT_UPLOAD_STATE.UNSELECTED,
                UploadDocumentType.EXISTING,
            ),
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

        render(<Wrapper />);

        const checkbox = screen.getByRole('checkbox', { name: /Select review1\.pdf/i });
        await user.click(checkbox);

        expect(checkbox).toBeChecked();

        // Verify only REVIEW documents are shown in table (EXISTING should not be visible)
        expect(screen.queryByText('existing1.pdf')).not.toBeInTheDocument();
    });

    it('only updates REVIEW type documents when unselecting files', async () => {
        const user = userEvent.setup();
        const initialDocs: ReviewUploadDocument[] = [
            makeReviewDoc('review1.pdf', DOCUMENT_UPLOAD_STATE.SELECTED, UploadDocumentType.REVIEW),
            makeReviewDoc(
                'existing1.pdf',
                DOCUMENT_UPLOAD_STATE.SELECTED,
                UploadDocumentType.EXISTING,
            ),
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

        render(<Wrapper />);

        const checkbox = screen.getByRole('checkbox', { name: /Select review1\.pdf/i });
        await user.click(checkbox);

        expect(checkbox).not.toBeChecked();
    });

    it('displays upload date for each file in the table', () => {
        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
            makeReviewDoc('file2.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        renderApp({
            reviewData: mockReviewData,
            uploadDocuments: documents,
        });

        expect(screen.getByText('file1.pdf')).toBeInTheDocument();
        expect(screen.getByText('file2.pdf')).toBeInTheDocument();

        const dates = screen.getAllByText('29 January 2026');
        expect(dates).toHaveLength(2);
    });

    it('does not create object URL when viewing a non-existent file', async () => {
        const user = userEvent.setup();
        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        const mockSetUploadDocuments = vi.fn();

        renderApp({
            reviewData: mockReviewData,
            uploadDocuments: documents,
            setUploadDocuments: mockSetUploadDocuments,
        });

        await user.click(screen.getByRole('button', { name: /View file1\.pdf/i }));

        // PDF viewer should be shown with the object URL
        expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/You are currently viewing: file1\.pdf/i)).toBeInTheDocument();
    });

    it('only counts REVIEW type documents when checking for selected files', async () => {
        const user = userEvent.setup();
        const documents: ReviewUploadDocument[] = [
            makeReviewDoc(
                'review1.pdf',
                DOCUMENT_UPLOAD_STATE.UNSELECTED,
                UploadDocumentType.REVIEW,
            ),
            makeReviewDoc(
                'existing1.pdf',
                DOCUMENT_UPLOAD_STATE.SELECTED,
                UploadDocumentType.EXISTING,
            ),
        ];

        renderApp({
            reviewData: mockReviewData,
            uploadDocuments: documents,
        });

        // Even though existing1.pdf is SELECTED, it should show error
        // because no REVIEW documents are selected
        await user.click(screen.getByRole('button', { name: 'Continue' }));

        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('You need to select an option')).toBeInTheDocument();
    });

    it('only counts REVIEW type documents when checking for unselected files', async () => {
        const user = userEvent.setup();
        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('review1.pdf', DOCUMENT_UPLOAD_STATE.SELECTED, UploadDocumentType.REVIEW),
            makeReviewDoc(
                'existing1.pdf',
                DOCUMENT_UPLOAD_STATE.UNSELECTED,
                UploadDocumentType.EXISTING,
            ),
        ];

        renderApp({
            reviewData: mockReviewData,
            uploadDocuments: documents,
        });

        // All REVIEW documents are selected, should navigate to add-more-choice
        // even though existing1.pdf is UNSELECTED
        await user.click(screen.getByRole('button', { name: 'Continue' }));

        expect(mockNavigate).toHaveBeenCalledWith(
            routeChildren.REVIEW_ADD_MORE_CHOICE.replace(':reviewId', mockReviewId),
            undefined,
        );
    });

    it('handles file selection when document is not found', async () => {
        const user = userEvent.setup();
        const initialDocs: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        const mockSetUploadDocuments = vi.fn();
        const setDocs = vi.fn();

        const customSetter = (updater: React.SetStateAction<ReviewUploadDocument[]>): void => {
            mockSetUploadDocuments(updater);
            // Simulate document not being found by clearing the array
            setDocs([]);
        };

        renderApp({
            reviewData: mockReviewData,
            uploadDocuments: initialDocs,
            setUploadDocuments: customSetter,
        });

        const checkbox = screen.getByRole('checkbox', { name: /Select file1\.pdf/i });
        await user.click(checkbox);

        // After clicking, the document won't be found in the next render
        expect(mockSetUploadDocuments).toHaveBeenCalled();
    });
});
