import { act, render, screen, waitFor } from '@testing-library/react';
import {
    UploadDocument,
    DOCUMENT_UPLOAD_STATE,
} from '../../../../types/pages/UploadDocumentsPage/types';
import DocumentUploadLloydGeorgePreview from './DocumentUploadLloydGeorgePreview';
import getMergedPdfBlob from '../../../../helpers/utils/pdfMerger';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';
import { buildDocumentConfig } from '../../../../helpers/test/testBuilders';
import { Mock } from 'vitest';

const mockNavigate = vi.fn();

vi.mock('../../../../helpers/hooks/usePatient');
vi.mock('../../../../helpers/utils/pdfMerger');
vi.mock('react-router-dom', () => ({
    useNavigate: (): Mock => mockNavigate,
}));
vi.mock('../../../../providers/analyticsProvider/AnalyticsProvider', () => ({
    useAnalyticsContext: vi.fn(() => [null, vi.fn()]),
}));

URL.createObjectURL = (): string => 'https://example.com';

const createMockDocument = (id: string): UploadDocument => ({
    state: DOCUMENT_UPLOAD_STATE.SELECTED,
    file: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
    id,
    docType: DOCUMENT_TYPE.LLOYD_GEORGE,
});

const docConfig = buildDocumentConfig();

describe('DocumentUploadCompleteStage', () => {
    let documents: UploadDocument[];
    const mockSetMergedPdfBlob = vi.fn();

    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        documents = [];
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders without documents', async () => {
            vi.mocked(getMergedPdfBlob).mockResolvedValue(
                new Blob([''], { type: 'application/pdf' }),
            );

            await act(async () => {
                render(
                    <DocumentUploadLloydGeorgePreview
                        documents={documents}
                        setMergedPdfBlob={mockSetMergedPdfBlob}
                        documentConfig={docConfig}
                    />,
                );
            });

            expect(screen.queryByTestId('pdf-viewer')).not.toBeInTheDocument();
        });

        it('renders pdf viewer and calls setMergedPdfBlob with the merged PDF blob when it has docs', async () => {
            const testDocuments = [createMockDocument('1')];
            const mockBlob = new Blob(['test pdf content'], { type: 'application/pdf' });
            vi.mocked(getMergedPdfBlob).mockResolvedValue(mockBlob);

            const stitchedBlobLoaded = vi.fn();

            await act(async () => {
                render(
                    <DocumentUploadLloydGeorgePreview
                        documents={testDocuments}
                        setMergedPdfBlob={mockSetMergedPdfBlob}
                        stitchedBlobLoaded={stitchedBlobLoaded}
                        documentConfig={docConfig}
                    />,
                );
            });

            expect(await screen.findByTestId('pdf-viewer')).toBeInTheDocument();

            await waitFor(() => {
                expect(mockSetMergedPdfBlob).toHaveBeenCalledWith(mockBlob);
                expect(stitchedBlobLoaded).toHaveBeenCalledTimes(2);
            });
        });
    });
});
