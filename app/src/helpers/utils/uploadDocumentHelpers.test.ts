import { Mock } from 'vitest';
import { uploadDocumentToS3 } from '../requests/uploadDocuments';
import { buildDocument, buildMockUploadSession } from '../test/testBuilders';
import { DOCUMENT_UPLOAD_STATE } from '../../types/pages/UploadDocumentsPage/types';
import * as uploadDocumentHelpersModule from './uploadDocumentHelpers';

vi.mock('../requests/uploadDocuments', () => ({
    ...vi.importActual('../requests/uploadDocuments'),
    uploadDocumentToS3: vi.fn(),
}));

const mockedUploadDocumentToS3 = uploadDocumentToS3 as Mock;

describe('uploadDocumentHelpers', () => {
    describe('uploadSingleDocument', () => {
        it('calls uploadDocumentToS3 with the correct parameters', async () => {
            const mockDocument = buildDocument(
                new File([''], 'test-file.txt'),
                DOCUMENT_UPLOAD_STATE.SELECTED,
            );
            const mockUploadSession = buildMockUploadSession([mockDocument]);
            const mockSetDocuments = vi.fn();

            await uploadDocumentHelpersModule.uploadSingleDocument(
                mockDocument,
                mockUploadSession,
                mockSetDocuments,
            );

            expect(mockedUploadDocumentToS3).toHaveBeenCalledWith({
                document: mockDocument,
                uploadSession: mockUploadSession,
                setDocuments: mockSetDocuments,
            });
        });

        it('marks the document with an error if the upload fails', async () => {
            const mockDocument = buildDocument(
                new File([''], 'test-file.txt'),
                DOCUMENT_UPLOAD_STATE.SELECTED,
            );
            const mockUploadSession = buildMockUploadSession([mockDocument]);
            const mockSetDocuments = vi.fn();

            mockedUploadDocumentToS3.mockRejectedValueOnce(new Error('Upload failed'));

            await uploadDocumentHelpersModule.uploadSingleDocument(
                mockDocument,
                mockUploadSession,
                mockSetDocuments,
            );

            expect(mockSetDocuments).toHaveBeenCalled();

            const updater = mockSetDocuments.mock.calls[0][0] as Function;
            const updatedDocuments = updater([mockDocument]);

            expect(updatedDocuments).toEqual([
                expect.objectContaining({
                    id: mockDocument.id,
                    state: DOCUMENT_UPLOAD_STATE.ERROR,
                    progress: 0,
                }),
            ]);
        });
    });
});
