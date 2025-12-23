import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReviewDetailsDocumentUploadingStage from './ReviewDetailsDocumentUploadingStage';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';

const mockStartUpload = vi.fn();

vi.mock('../../_documentUpload/documentUploadingStage/DocumentUploadingStage', () => ({
    default: vi.fn(({ documents, startUpload }) => {
        mockStartUpload.mockImplementation(startUpload);
        return (
            <div data-testid="mock-document-uploading-stage">
                <div data-testid="documents-length">{documents.length}</div>
                <button
                    data-testid="trigger-upload"
                    onClick={(): void => {
                        void startUpload();
                    }}
                >
                    Start Upload
                </button>
            </div>
        );
    }),
}));

describe('ReviewDetailsDocumentUploadingStage', () => {
    const testReviewSnoMed: DOCUMENT_TYPE = '16521000000101' as DOCUMENT_TYPE;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders DocumentUploadingStage component', () => {
            render(<ReviewDetailsDocumentUploadingStage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByTestId('mock-document-uploading-stage')).toBeInTheDocument();
        });

        it('initializes with empty documents array', () => {
            render(<ReviewDetailsDocumentUploadingStage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByTestId('documents-length')).toHaveTextContent('0');
        });
    });

    describe('Props handling', () => {
        it('accepts reviewSnoMed prop', () => {
            const { rerender } = render(
                <ReviewDetailsDocumentUploadingStage reviewSnoMed={testReviewSnoMed} />,
            );

            expect(screen.getByTestId('mock-document-uploading-stage')).toBeInTheDocument();

            rerender(<ReviewDetailsDocumentUploadingStage reviewSnoMed={DOCUMENT_TYPE.EHR} />);

            expect(screen.getByTestId('mock-document-uploading-stage')).toBeInTheDocument();
        });

        it('handles reviewSnoMed as optional prop', () => {
            render(<ReviewDetailsDocumentUploadingStage reviewSnoMed={DOCUMENT_TYPE.EHR} />);

            expect(screen.getByTestId('mock-document-uploading-stage')).toBeInTheDocument();
        });
    });

    describe('Upload functionality', () => {
        it('provides startUpload function to child component', () => {
            render(<ReviewDetailsDocumentUploadingStage reviewSnoMed={testReviewSnoMed} />);

            expect(screen.getByTestId('trigger-upload')).toBeInTheDocument();
        });

        it('startUpload function resolves without error', async () => {
            render(<ReviewDetailsDocumentUploadingStage reviewSnoMed={testReviewSnoMed} />);

            await expect(mockStartUpload()).resolves.toBeUndefined();
        });

        it('startUpload is an async function', async () => {
            render(<ReviewDetailsDocumentUploadingStage reviewSnoMed={testReviewSnoMed} />);

            const result = mockStartUpload();
            expect(result).toBeInstanceOf(Promise);
            await result;
        });
    });
});
