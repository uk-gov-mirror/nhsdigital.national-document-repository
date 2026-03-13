import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mergePdfsFromUploadDocuments } from './mergePdfs';
import { DOWNLOAD_STAGE } from '../../types/generic/downloadStage';
import { ReviewUploadDocument } from '../../types/pages/UploadDocumentsPage/types';
import { DOCUMENT_UPLOAD_STATE } from '../../types/pages/UploadDocumentsPage/types';
import { DOCUMENT_TYPE } from './documentType';

vi.mock('axios');

const mockAdd = vi.fn();
const mockSaveAsBuffer = vi.fn();

vi.mock('pdf-merger-js', () => {
    class PDFMergerMock {
        async add(data: unknown): Promise<void> {
            mockAdd(data);
        }

        async saveAsBuffer(): Promise<Uint8Array> {
            return mockSaveAsBuffer();
        }
    }

    return { default: PDFMergerMock };
});

describe('mergePdfsFromUploadDocuments', () => {
    const mockSetPdfObjectUrl = vi.fn();
    const mockSetDownloadStage = vi.fn();
    const mockObjectUrl = 'blob:http://localhost:3000/test-blob-id';
    const originalCreateObjectURL = URL.createObjectURL;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdd.mockClear().mockResolvedValue(undefined);
        mockSaveAsBuffer.mockClear().mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
        URL.createObjectURL = vi.fn((): string => mockObjectUrl);
    });

    afterEach(() => {
        URL.createObjectURL = originalCreateObjectURL;
    });

    const createMockFile = (name: string): File => {
        return new File(['test content'], name, { type: 'application/pdf' });
    };

    const createMockBlob = (): Blob => {
        return new Blob(['blob content'], { type: 'application/pdf' });
    };

    const createMockUploadDocument = (
        overrides?: Partial<ReviewUploadDocument>,
    ): ReviewUploadDocument => {
        return {
            state: DOCUMENT_UPLOAD_STATE.SELECTED,
            file: createMockFile('test.pdf'),
            id: 'test-id',
            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
            ...overrides,
        };
    };

    describe('Empty documents array', () => {
        it('returns undefined when uploadDocuments array is empty', async () => {
            const result = await mergePdfsFromUploadDocuments(
                [],
                mockSetPdfObjectUrl,
                mockSetDownloadStage,
            );

            expect(result).toBeUndefined();
        });

        it('sets download stage to FAILED when uploadDocuments array is empty', async () => {
            await mergePdfsFromUploadDocuments([], mockSetPdfObjectUrl, mockSetDownloadStage);

            expect(mockSetDownloadStage).toHaveBeenCalledWith(DOWNLOAD_STAGE.FAILED);
        });

        it('does not call setPdfObjectUrl when uploadDocuments array is empty', async () => {
            await mergePdfsFromUploadDocuments([], mockSetPdfObjectUrl, mockSetDownloadStage);

            expect(mockSetPdfObjectUrl).not.toHaveBeenCalled();
        });

        it('does not add any PDFs to merger when uploadDocuments array is empty', async () => {
            await mergePdfsFromUploadDocuments([], mockSetPdfObjectUrl, mockSetDownloadStage);

            expect(mockAdd).not.toHaveBeenCalled();
        });
    });

    describe('Single document', () => {
        it('merges a single document with only a file property', async () => {
            const uploadDocument = createMockUploadDocument();
            mockSaveAsBuffer.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

            const result = await mergePdfsFromUploadDocuments(
                [uploadDocument],
                mockSetPdfObjectUrl,
                mockSetDownloadStage,
            );

            expect(mockAdd).toHaveBeenCalledTimes(1);
            expect(mockAdd).toHaveBeenCalledWith(uploadDocument.file);
            expect(result).toBeInstanceOf(Blob);
        });

        it('merges a single document with a blob property', async () => {
            const mockBlob = createMockBlob();
            const uploadDocument = createMockUploadDocument({ blob: mockBlob });
            mockSaveAsBuffer.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

            const result = await mergePdfsFromUploadDocuments(
                [uploadDocument],
                mockSetPdfObjectUrl,
                mockSetDownloadStage,
            );

            expect(mockAdd).toHaveBeenCalledTimes(1);
            expect(mockAdd).toHaveBeenCalledWith(mockBlob);
            expect(result).toBeInstanceOf(Blob);
        });

        it('creates object URL from merged PDF', async () => {
            const uploadDocument = createMockUploadDocument();
            mockSaveAsBuffer.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

            await mergePdfsFromUploadDocuments(
                [uploadDocument],
                mockSetPdfObjectUrl,
                mockSetDownloadStage,
            );

            expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
            expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
        });

        it('calls setPdfObjectUrl with created object URL', async () => {
            const uploadDocument = createMockUploadDocument();
            mockSaveAsBuffer.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

            await mergePdfsFromUploadDocuments(
                [uploadDocument],
                mockSetPdfObjectUrl,
                mockSetDownloadStage,
            );

            expect(mockSetPdfObjectUrl).toHaveBeenCalledWith(mockObjectUrl);
        });

        it('returns a blob with correct type', async () => {
            const uploadDocument = createMockUploadDocument();
            mockSaveAsBuffer.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

            const result = await mergePdfsFromUploadDocuments(
                [uploadDocument],
                mockSetPdfObjectUrl,
                mockSetDownloadStage,
            );

            expect(result).toBeInstanceOf(Blob);
            expect(result?.type).toBe('application/pdf');
        });
    });

    describe('Multiple documents', () => {
        it('merges multiple documents with only file properties', async () => {
            const uploadDocuments = [
                createMockUploadDocument({ id: 'doc1', file: createMockFile('doc1.pdf') }),
                createMockUploadDocument({ id: 'doc2', file: createMockFile('doc2.pdf') }),
                createMockUploadDocument({ id: 'doc3', file: createMockFile('doc3.pdf') }),
            ];
            mockSaveAsBuffer.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

            const result = await mergePdfsFromUploadDocuments(
                uploadDocuments,
                mockSetPdfObjectUrl,
                mockSetDownloadStage,
            );

            expect(mockAdd).toHaveBeenCalledTimes(3);
            expect(mockAdd).toHaveBeenCalledWith(uploadDocuments[0].file);
            expect(mockAdd).toHaveBeenCalledWith(uploadDocuments[1].file);
            expect(mockAdd).toHaveBeenCalledWith(uploadDocuments[2].file);
            expect(result).toBeInstanceOf(Blob);
        });

        it('merges multiple documents with blob properties', async () => {
            const mockBlob1 = createMockBlob();
            const mockBlob2 = createMockBlob();
            const mockBlob3 = createMockBlob();

            const uploadDocuments = [
                createMockUploadDocument({ id: 'doc1', blob: mockBlob1 }),
                createMockUploadDocument({ id: 'doc2', blob: mockBlob2 }),
                createMockUploadDocument({ id: 'doc3', blob: mockBlob3 }),
            ];
            mockSaveAsBuffer.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

            const result = await mergePdfsFromUploadDocuments(
                uploadDocuments,
                mockSetPdfObjectUrl,
                mockSetDownloadStage,
            );

            expect(mockAdd).toHaveBeenCalledTimes(3);
            expect(mockAdd).toHaveBeenNthCalledWith(1, mockBlob1);
            expect(mockAdd).toHaveBeenNthCalledWith(2, mockBlob2);
            expect(mockAdd).toHaveBeenNthCalledWith(3, mockBlob3);
            expect(result).toBeInstanceOf(Blob);
        });

        it('merges mixed documents with both file and blob properties', async () => {
            const mockBlob = createMockBlob();
            const uploadDocuments = [
                createMockUploadDocument({ id: 'doc1' }), // only file
                createMockUploadDocument({ id: 'doc2', blob: mockBlob }), // has blob
                createMockUploadDocument({ id: 'doc3' }), // only file
            ];
            mockSaveAsBuffer.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

            const result = await mergePdfsFromUploadDocuments(
                uploadDocuments,
                mockSetPdfObjectUrl,
                mockSetDownloadStage,
            );

            expect(mockAdd).toHaveBeenCalledTimes(3);
            expect(mockAdd).toHaveBeenCalledWith(uploadDocuments[0].file);
            expect(mockAdd).toHaveBeenCalledWith(mockBlob);
            expect(mockAdd).toHaveBeenCalledWith(uploadDocuments[2].file);
            expect(result).toBeInstanceOf(Blob);
        });

        it('sets PDF object URL after merging multiple documents', async () => {
            const uploadDocuments = [
                createMockUploadDocument({ id: 'doc1' }),
                createMockUploadDocument({ id: 'doc2' }),
            ];
            mockSaveAsBuffer.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

            await mergePdfsFromUploadDocuments(
                uploadDocuments,
                mockSetPdfObjectUrl,
                mockSetDownloadStage,
            );

            expect(mockSetPdfObjectUrl).toHaveBeenCalledWith(mockObjectUrl);
        });
    });

    describe('PDF merging process', () => {
        it('converts buffer to Uint8Array correctly', async () => {
            const uploadDocument = createMockUploadDocument();
            const mockBuffer = new Uint8Array([10, 20, 30, 40, 50]);
            mockSaveAsBuffer.mockResolvedValue(mockBuffer);

            const result = await mergePdfsFromUploadDocuments(
                [uploadDocument],
                mockSetPdfObjectUrl,
                mockSetDownloadStage,
            );

            expect(mockSaveAsBuffer).toHaveBeenCalledTimes(1);
            expect(result).toBeInstanceOf(Blob);
        });

        it('calls merger saveAsBuffer method', async () => {
            const uploadDocument = createMockUploadDocument();
            mockSaveAsBuffer.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

            await mergePdfsFromUploadDocuments(
                [uploadDocument],
                mockSetPdfObjectUrl,
                mockSetDownloadStage,
            );

            expect(mockSaveAsBuffer).toHaveBeenCalledTimes(1);
        });

        it('processes documents sequentially', async () => {
            const uploadDocuments = [
                createMockUploadDocument({ id: 'doc1' }),
                createMockUploadDocument({ id: 'doc2' }),
                createMockUploadDocument({ id: 'doc3' }),
            ];
            mockSaveAsBuffer.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

            await mergePdfsFromUploadDocuments(
                uploadDocuments,
                mockSetPdfObjectUrl,
                mockSetDownloadStage,
            );

            expect(mockAdd).toHaveBeenCalledTimes(3);
            expect(mockSaveAsBuffer).toHaveBeenCalledTimes(1);
        });
    });

    describe('Return value', () => {
        it('returns the merged PDF blob', async () => {
            const uploadDocument = createMockUploadDocument();
            mockSaveAsBuffer.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

            const result = await mergePdfsFromUploadDocuments(
                [uploadDocument],
                mockSetPdfObjectUrl,
                mockSetDownloadStage,
            );

            expect(result).toBeInstanceOf(Blob);
            expect(result).not.toBeUndefined();
        });

        it('returns blob with correct content type', async () => {
            const uploadDocument = createMockUploadDocument();
            mockSaveAsBuffer.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

            const result = await mergePdfsFromUploadDocuments(
                [uploadDocument],
                mockSetPdfObjectUrl,
                mockSetDownloadStage,
            );

            expect(result?.type).toBe('application/pdf');
        });
    });
});
