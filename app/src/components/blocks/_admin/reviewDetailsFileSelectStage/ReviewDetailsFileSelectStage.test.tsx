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

vi.mock('../../../../helpers/utils/documentType');
vi.mock('../../../../helpers/hooks/useTitle', () => ({
    default: vi.fn(),
}));

const mockNavigate = vi.fn();
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

describe('ReviewDetailsFileSelectStage', () => {
    const testReviewSnoMed: DOCUMENT_TYPE = DOCUMENT_TYPE.LLOYD_GEORGE;
    const mockReviewData = {
        snomedCode: testReviewSnoMed,
        files: [
            {
                fileName: 'file1.pdf',
                uploadDate: '2025-01-01',
            },
            {
                fileName: 'file2.pdf',
                uploadDate: '2025-01-02',
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
        render(
            <ReviewDetailsFileSelectStage
                reviewData={null}
                uploadDocuments={[]}
                setUploadDocuments={vi.fn() as any}
            />,
        );

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

        render(
            <ReviewDetailsFileSelectStage
                reviewData={mockReviewData}
                uploadDocuments={documents}
                setUploadDocuments={vi.fn() as any}
            />,
        );

        expect(
            screen.getByRole('heading', {
                name: /Choose files to add to the existing Lloyd george record/i,
            }),
        ).toBeInTheDocument();

        expect(screen.getByText('file1.pdf')).toBeInTheDocument();
        expect(screen.getByText('2025-01-01')).toBeInTheDocument();
        expect(screen.queryByText('existing.pdf')).not.toBeInTheDocument();
    });

    it('allows viewing a selected file and passes the object URL to the PDF viewer', async () => {
        const user = userEvent.setup();
        const documents: ReviewUploadDocument[] = [
            makeReviewDoc('file1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED, UploadDocumentType.REVIEW),
        ];

        render(
            <ReviewDetailsFileSelectStage
                reviewData={mockReviewData}
                uploadDocuments={documents}
                setUploadDocuments={vi.fn() as any}
            />,
        );

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

        render(
            <ReviewDetailsFileSelectStage
                reviewData={mockReviewData}
                uploadDocuments={documents}
                setUploadDocuments={vi.fn() as any}
            />,
        );

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

        render(
            <ReviewDetailsFileSelectStage
                reviewData={mockReviewData}
                uploadDocuments={initialDocs}
                setUploadDocuments={vi.fn() as any}
            />,
        );

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

        render(
            <ReviewDetailsFileSelectStage
                reviewData={mockReviewData}
                uploadDocuments={initialDocs}
                setUploadDocuments={vi.fn() as any}
            />,
        );

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

        render(
            <ReviewDetailsFileSelectStage
                reviewData={mockReviewData}
                uploadDocuments={documents}
                setUploadDocuments={vi.fn() as any}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
