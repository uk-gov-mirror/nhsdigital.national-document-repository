import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DocumentList from './DocumentList';
import { DOCUMENT_TYPE } from '../../../../../helpers/utils/documentType';
import {
    DOCUMENT_UPLOAD_STATE,
    UploadDocument,
} from '../../../../../types/pages/UploadDocumentsPage/types';
import userEvent from '@testing-library/user-event';

describe('DocumentList', () => {
    const mockDocuments: UploadDocument[] = [
        {
            id: '1',
            file: new File(['content'], 'document1.pdf', { type: 'application/pdf' }),
            position: 1,
            state: DOCUMENT_UPLOAD_STATE.SELECTED,
            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
        },
        {
            id: '2',
            file: new File(['content'], 'document2.pdf', { type: 'application/pdf' }),
            position: 2,
            state: DOCUMENT_UPLOAD_STATE.SELECTED,
            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
        },
        {
            id: '3',
            file: new File(['content'], 'document3.jpg', { type: 'image/jpeg' }),
            position: 3,
            state: DOCUMENT_UPLOAD_STATE.SELECTED,
            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
        },
    ];

    const mockSetPreviewDocument = vi.fn();

    it('renders document list with correct table headers', () => {
        render(
            <DocumentList
                documents={mockDocuments}
                docType={DOCUMENT_TYPE.LLOYD_GEORGE}
                showViewFileColumn={true}
                setPreviewDocument={mockSetPreviewDocument}
            />,
        );

        expect(screen.getByText('Filename')).toBeInTheDocument();
        expect(screen.getByText('Position')).toBeInTheDocument();
        expect(screen.getByText('View file')).toBeInTheDocument();
    });

    it('renders all documents in the list', () => {
        render(
            <DocumentList
                documents={mockDocuments}
                docType={DOCUMENT_TYPE.LLOYD_GEORGE}
                showViewFileColumn={true}
                setPreviewDocument={mockSetPreviewDocument}
            />,
        );

        expect(screen.getByText('document1.pdf')).toBeInTheDocument();
        expect(screen.getByText('document2.pdf')).toBeInTheDocument();
        expect(screen.getByText('document3.jpg')).toBeInTheDocument();
    });

    it('shows position column for stitched documents', () => {
        render(
            <DocumentList
                documents={mockDocuments}
                docType={DOCUMENT_TYPE.LLOYD_GEORGE}
                showViewFileColumn={false}
                setPreviewDocument={mockSetPreviewDocument}
            />,
        );

        expect(screen.getByText('Position')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('hides view file column when showViewFileColumn is false', () => {
        render(
            <DocumentList
                documents={mockDocuments}
                docType={DOCUMENT_TYPE.LLOYD_GEORGE}
                showViewFileColumn={false}
                setPreviewDocument={mockSetPreviewDocument}
            />,
        );

        expect(screen.queryByText('View file')).not.toBeInTheDocument();
    });

    it('renders View button only for PDF files', () => {
        render(
            <DocumentList
                documents={mockDocuments}
                docType={DOCUMENT_TYPE.LLOYD_GEORGE}
                showViewFileColumn={true}
                setPreviewDocument={mockSetPreviewDocument}
            />,
        );

        const viewButtons = screen.getAllByText('View');
        expect(viewButtons).toHaveLength(2);
    });

    it('calls setPreviewDocument when View button is clicked', async () => {
        const user = userEvent.setup();
        render(
            <DocumentList
                documents={mockDocuments}
                docType={DOCUMENT_TYPE.LLOYD_GEORGE}
                showViewFileColumn={true}
                setPreviewDocument={mockSetPreviewDocument}
            />,
        );

        const viewButton = screen.getByTestId('preview-1-button');
        await user.click(viewButton);

        expect(mockSetPreviewDocument).toHaveBeenCalledWith(mockDocuments[0]);
    });

    it('paginates documents correctly when more than 10 items', () => {
        const manyDocuments: UploadDocument[] = Array.from({ length: 15 }, (_, i) => ({
            id: `${i + 1}`,
            file: new File(['content'], `document${i + 1}.pdf`, { type: 'application/pdf' }),
            position: i + 1,
            state: DOCUMENT_UPLOAD_STATE.SELECTED,
            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
        }));

        render(
            <DocumentList
                documents={manyDocuments}
                docType={DOCUMENT_TYPE.LLOYD_GEORGE}
                showViewFileColumn={false}
                setPreviewDocument={mockSetPreviewDocument}
            />,
        );

        expect(screen.getByText('document1.pdf')).toBeInTheDocument();
        expect(screen.getByText('document10.pdf')).toBeInTheDocument();
        expect(screen.queryByText('document11.pdf')).not.toBeInTheDocument();
    });

    it('renders dash for non-PDF files in view column', () => {
        render(
            <DocumentList
                documents={mockDocuments}
                docType={DOCUMENT_TYPE.LLOYD_GEORGE}
                showViewFileColumn={true}
                setPreviewDocument={mockSetPreviewDocument}
            />,
        );

        const tableCells = screen.getAllByRole('cell');
        const dashCell = tableCells.find((cell) => cell.textContent === '-');
        expect(dashCell).toBeInTheDocument();
    });
});
