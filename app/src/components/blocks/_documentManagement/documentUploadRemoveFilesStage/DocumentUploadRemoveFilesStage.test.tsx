import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    UploadDocument,
    DOCUMENT_UPLOAD_STATE,
} from '../../../../types/pages/UploadDocumentsPage/types';
import DocumentUploadRemoveFilesStage from './DocumentUploadRemoveFilesStage';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';
import { routes } from '../../../../types/generic/routes';

const mockNavigate = vi.fn();
const mockWithParams = vi.fn();

vi.mock('../../../../helpers/hooks/usePatient');
vi.mock('../../../../helpers/utils/urlManipulations', () => ({
    useEnhancedNavigate: (): {
        (delta: number): void;
        withParams: typeof mockWithParams;
    } => {
        const nav = mockNavigate as unknown as (delta: number) => void;
        return Object.assign(nav, { withParams: mockWithParams });
    },
}));

URL.createObjectURL = vi.fn();

describe('DocumentUploadRemoveFilesStage', () => {
    let documents: UploadDocument[];
    const mockSetDocuments = vi.fn();

    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        documents = [
            {
                id: '1',
                file: new File(['test'], 'test1.pdf'),
                state: DOCUMENT_UPLOAD_STATE.SELECTED,
                docType: DOCUMENT_TYPE.LLOYD_GEORGE,
            },
            {
                id: '2',
                file: new File(['test'], 'test2.pdf'),
                state: DOCUMENT_UPLOAD_STATE.SELECTED,
                docType: DOCUMENT_TYPE.EHR,
            },
            {
                id: '3',
                file: new File(['test'], 'test3.pdf'),
                state: DOCUMENT_UPLOAD_STATE.SELECTED,
                docType: DOCUMENT_TYPE.LLOYD_GEORGE,
            },
        ];
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders the confirmation page with all elements', async () => {
            render(
                <DocumentUploadRemoveFilesStage
                    documents={documents}
                    setDocuments={mockSetDocuments}
                    documentType={DOCUMENT_TYPE.LLOYD_GEORGE}
                />,
            );

            await waitFor(() => {
                expect(
                    screen.getByText('Are you sure you want to remove all selected files?'),
                ).toBeInTheDocument();
            });
            expect(screen.getByTestId('remove-files-button')).toBeInTheDocument();
            expect(screen.getByText('Yes, remove all files')).toBeInTheDocument();
            expect(screen.getByText('Cancel')).toBeInTheDocument();
        });
    });

    describe('Remove files button functionality', () => {
        it('calls onSuccess callback when provided and does not call setDocuments or navigate', async () => {
            const mockOnSuccess = vi.fn();
            const user = userEvent.setup();

            render(
                <DocumentUploadRemoveFilesStage
                    documents={documents}
                    setDocuments={mockSetDocuments}
                    documentType={DOCUMENT_TYPE.LLOYD_GEORGE}
                    onSuccess={mockOnSuccess}
                />,
            );

            const removeButton = screen.getByTestId('remove-files-button');
            await user.click(removeButton);

            expect(mockOnSuccess).toHaveBeenCalledTimes(1);
            expect(mockSetDocuments).not.toHaveBeenCalled();
            expect(mockWithParams).not.toHaveBeenCalled();
        });

        it('filters documents by type and navigates when onSuccess is not provided', async () => {
            const user = userEvent.setup();

            render(
                <DocumentUploadRemoveFilesStage
                    documents={documents}
                    setDocuments={mockSetDocuments}
                    documentType={DOCUMENT_TYPE.LLOYD_GEORGE}
                />,
            );

            const removeButton = screen.getByTestId('remove-files-button');
            await user.click(removeButton);

            expect(mockSetDocuments).toHaveBeenCalledTimes(1);
            const filteredDocuments = mockSetDocuments.mock.calls[0][0];
            expect(filteredDocuments).toHaveLength(1);
            expect(filteredDocuments[0].docType).toBe(DOCUMENT_TYPE.EHR);
            expect(mockWithParams).toHaveBeenCalledWith(routes.DOCUMENT_UPLOAD);
        });

        it('removes all documents of the specified type', async () => {
            const user = userEvent.setup();

            render(
                <DocumentUploadRemoveFilesStage
                    documents={documents}
                    setDocuments={mockSetDocuments}
                    documentType={DOCUMENT_TYPE.EHR}
                />,
            );

            const removeButton = screen.getByTestId('remove-files-button');
            await user.click(removeButton);

            expect(mockSetDocuments).toHaveBeenCalledTimes(1);
            const filteredDocuments = mockSetDocuments.mock.calls[0][0];
            expect(filteredDocuments).toHaveLength(2);
            expect(
                filteredDocuments.every(
                    (doc: UploadDocument) => doc.docType === DOCUMENT_TYPE.LLOYD_GEORGE,
                ),
            ).toBe(true);
        });

        it('prevents default event behavior when clicking remove button', async () => {
            const user = userEvent.setup();

            render(
                <DocumentUploadRemoveFilesStage
                    documents={documents}
                    setDocuments={mockSetDocuments}
                    documentType={DOCUMENT_TYPE.LLOYD_GEORGE}
                />,
            );

            const removeButton = screen.getByTestId('remove-files-button');
            const clickEvent = vi.fn((e) => e.preventDefault());

            removeButton.onclick = clickEvent;
            await user.click(removeButton);

            expect(clickEvent).toHaveBeenCalled();
        });
    });

    describe('Cancel button functionality', () => {
        it('navigates back when cancel button is clicked', async () => {
            const user = userEvent.setup();

            render(
                <DocumentUploadRemoveFilesStage
                    documents={documents}
                    setDocuments={mockSetDocuments}
                    documentType={DOCUMENT_TYPE.LLOYD_GEORGE}
                />,
            );

            const cancelButton = screen.getByText('Cancel');
            await user.click(cancelButton);

            expect(mockNavigate).toHaveBeenCalledWith(-1);
        });

        it('does not call setDocuments when cancel is clicked', async () => {
            const user = userEvent.setup();

            render(
                <DocumentUploadRemoveFilesStage
                    documents={documents}
                    setDocuments={mockSetDocuments}
                    documentType={DOCUMENT_TYPE.LLOYD_GEORGE}
                />,
            );

            const cancelButton = screen.getByText('Cancel');
            await user.click(cancelButton);

            expect(mockSetDocuments).not.toHaveBeenCalled();
        });
    });
});
