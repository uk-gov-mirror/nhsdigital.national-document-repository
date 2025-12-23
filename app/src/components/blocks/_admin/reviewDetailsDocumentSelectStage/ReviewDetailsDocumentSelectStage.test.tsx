import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReviewDetailsDocumentSelectStage from './ReviewDetailsDocumentSelectStage';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';

// Mock DocumentSelectStage component we are testing just ReviewDetailsDocumentSelectStage component
vi.mock('../../_documentUpload/documentSelectStage/DocumentSelectStage', () => ({
    default: vi.fn(({ documents, setDocuments, documentType, filesErrorRef }) => (
        <div data-testid="mock-document-select-stage">
            <div data-testid="documents-length">{documents.length}</div>
            <div data-testid="document-type">{documentType}</div>
            <button
                data-testid="add-document"
                onClick={(): void => {
                    setDocuments([
                        {
                            id: 'test-id',
                            file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
                            state: 'SELECTED',
                            progress: 0,
                            docType: documentType,
                            attempts: 0,
                            numPages: 1,
                            validated: false,
                        },
                    ]);
                }}
            >
                Add Document
            </button>
            <div data-testid="files-error-ref">
                {filesErrorRef.current !== undefined ? 'has ref' : 'no ref'}
            </div>
        </div>
    )),
}));

describe('ReviewDetailsDocumentSelectStage', () => {
    const testReviewSnoMed: DOCUMENT_TYPE = '16521000000101' as DOCUMENT_TYPE;

    describe('Rendering', () => {
        it('renders DocumentSelectStage component', () => {
            render(<ReviewDetailsDocumentSelectStage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByTestId('mock-document-select-stage')).toBeInTheDocument();
        });

        it('initializes with empty documents array', () => {
            render(<ReviewDetailsDocumentSelectStage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByTestId('documents-length')).toHaveTextContent('0');
        });

        it('passes filesErrorRef to DocumentSelectStage', () => {
            render(<ReviewDetailsDocumentSelectStage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByTestId('files-error-ref')).toHaveTextContent('has ref');
        });
    });

    describe('Props handling', () => {
        it('accepts reviewSnoMed prop', () => {
            const { rerender } = render(
                <ReviewDetailsDocumentSelectStage reviewSnoMed={testReviewSnoMed} />,
            );

            expect(screen.getByTestId('mock-document-select-stage')).toBeInTheDocument();

            rerender(<ReviewDetailsDocumentSelectStage reviewSnoMed={DOCUMENT_TYPE.EHR} />);

            expect(screen.getByTestId('mock-document-select-stage')).toBeInTheDocument();
        });

        it('handles reviewSnoMed as optional prop', () => {
            render(<ReviewDetailsDocumentSelectStage reviewSnoMed={DOCUMENT_TYPE.EHR} />);

            expect(screen.getByTestId('mock-document-select-stage')).toBeInTheDocument();
        });
    });
});
