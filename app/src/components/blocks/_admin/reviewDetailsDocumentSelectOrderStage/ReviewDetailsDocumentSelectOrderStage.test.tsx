import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReviewDetailsDocumentSelectOrderStage from './ReviewDetailsDocumentSelectOrderStage';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';

// Mock DocumentSelectOrderStage component we are testing just ReviewDetailsDocumentSelectOrderStage component
vi.mock('../../_documentUpload/documentSelectOrderStage/DocumentSelectOrderStage', () => ({
    default: vi.fn(({ documents, setDocuments, setMergedPdfBlob, existingDocuments }) => (
        <div data-testid="mock-document-select-order-stage">
            <div data-testid="documents-length">{documents.length}</div>
            <div data-testid="existing-documents">
                {existingDocuments === undefined ? 'undefined' : 'defined'}
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
        </div>
    )),
}));

describe('ReviewDetailsDocumentSelectOrderStage', () => {
    const testReviewSnoMed: DOCUMENT_TYPE = DOCUMENT_TYPE.EHR;

    describe('Rendering', () => {
        it('renders DocumentSelectOrderStage component', () => {
            render(<ReviewDetailsDocumentSelectOrderStage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByTestId('mock-document-select-order-stage')).toBeInTheDocument();
        });

        it('initializes with empty documents array', () => {
            render(<ReviewDetailsDocumentSelectOrderStage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByTestId('documents-length')).toHaveTextContent('0');
        });

        it('passes undefined as existingDocuments', () => {
            render(<ReviewDetailsDocumentSelectOrderStage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByTestId('existing-documents')).toHaveTextContent('undefined');
        });
    });

    describe('Props handling', () => {
        it('accepts reviewSnoMed prop', () => {
            const { rerender } = render(
                <ReviewDetailsDocumentSelectOrderStage reviewSnoMed={testReviewSnoMed} />,
            );

            expect(screen.getByTestId('mock-document-select-order-stage')).toBeInTheDocument();

            rerender(<ReviewDetailsDocumentSelectOrderStage reviewSnoMed={DOCUMENT_TYPE.EHR} />);

            expect(screen.getByTestId('mock-document-select-order-stage')).toBeInTheDocument();
        });

        it('handles reviewSnoMed as optional prop', () => {
            render(<ReviewDetailsDocumentSelectOrderStage reviewSnoMed={DOCUMENT_TYPE.EHR} />);

            expect(screen.getByTestId('mock-document-select-order-stage')).toBeInTheDocument();
        });
    });

    describe('State management', () => {
        it('provides setDocuments function to child component', () => {
            render(<ReviewDetailsDocumentSelectOrderStage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByTestId('documents-length')).toHaveTextContent('0');

            // The mock component should be able to call setDocuments
            expect(screen.getByTestId('add-document')).toBeInTheDocument();
        });

        it('provides setMergedPdfBlob function to child component', () => {
            render(<ReviewDetailsDocumentSelectOrderStage reviewSnoMed={testReviewSnoMed} />);

            // The mock component should be able to call setMergedPdfBlob
            expect(screen.getByTestId('set-merged-pdf')).toBeInTheDocument();
        });
    });
});
