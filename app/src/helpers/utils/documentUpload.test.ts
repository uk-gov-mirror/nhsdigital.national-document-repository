import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reduceDocumentsForUpload } from './documentUpload';
import { PatientDetails } from '../../types/generic/patientDetails';
import { DOCUMENT_UPLOAD_STATE, UploadDocument } from '../../types/pages/UploadDocumentsPage/types';
import { DOCUMENT_TYPE, DOCUMENT_TYPE_CONFIG } from './documentType';
import { generateStitchedFileName } from '../requests/uploadDocuments';
import { zipFiles } from './zip';

vi.mock('../requests/uploadDocuments');
vi.mock('./zip');
vi.mock('uuid', () => ({
    v4: vi.fn(() => 'mock-uuid-123'),
}));

describe('documentUpload', () => {
    const mockPatientDetails = {
        nhsNumber: '1234567890',
        givenName: ['John'],
        familyName: 'Doe',
        birthDate: '1980-01-01',
        postalCode: 'AB12 3CD',
        superseded: false,
        restricted: false,
        active: true,
        deceased: false,
    } as PatientDetails;

    const mockDocuments: UploadDocument[] = [
        {
            id: 'doc1',
            file: new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
            state: DOCUMENT_UPLOAD_STATE.SELECTED,
            progress: 0,
            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
            attempts: 0,
            versionId: 'v1',
        },
        {
            id: 'doc2',
            file: new File(['content2'], 'file2.pdf', { type: 'application/pdf' }),
            state: DOCUMENT_UPLOAD_STATE.SELECTED,
            progress: 0,
            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
            attempts: 0,
            versionId: 'v1',
        },
    ];

    const mockMergedPdfBlob = new Blob(['merged pdf content'], { type: 'application/pdf' });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('reduceDocumentsForUpload', () => {
        it('should return stitched document when documentConfig.stitched is true', async () => {
            const documentConfig: DOCUMENT_TYPE_CONFIG = {
                stitched: true,
                multifileZipped: false,
                snomedCode: DOCUMENT_TYPE.LLOYD_GEORGE,
                displayName: 'Scanned paper notes',
                canBeUpdated: false,
                associatedSnomed: '',
                multifileUpload: false,
                multifileReview: false,
                canBeDiscarded: false,
                singleDocumentOnly: true,
                acceptedFileTypes: [],
                content: {},
            };

            vi.mocked(generateStitchedFileName).mockReturnValue('stitched_file.pdf');

            const result = await reduceDocumentsForUpload(
                mockDocuments,
                documentConfig,
                mockMergedPdfBlob,
                mockPatientDetails,
                'version123',
            );

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                id: 'mock-uuid-123',
                file: expect.any(File),
                state: DOCUMENT_UPLOAD_STATE.SELECTED,
                progress: 0,
                docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                attempts: 0,
                versionId: 'version123',
            });
            expect(result[0].file.name).toBe('stitched_file.pdf');
            expect(generateStitchedFileName).toHaveBeenCalledWith(
                mockPatientDetails,
                documentConfig,
            );
        });

        it('should return zipped document when documentConfig.multifileZipped is true', async () => {
            const documentConfig: DOCUMENT_TYPE_CONFIG = {
                stitched: false,
                multifileZipped: true,
                snomedCode: DOCUMENT_TYPE.LLOYD_GEORGE,
                zippedFilename: 'test_documents',
                displayName: 'Scanned paper notes',
                canBeUpdated: false,
                associatedSnomed: '',
                multifileUpload: false,
                multifileReview: false,
                canBeDiscarded: false,
                singleDocumentOnly: true,
                acceptedFileTypes: [],
                content: {},
            };

            const mockZippedBlob = new Blob(['zipped content'], { type: 'application/zip' });
            vi.mocked(zipFiles).mockResolvedValue(mockZippedBlob);

            const result = await reduceDocumentsForUpload(
                mockDocuments,
                documentConfig,
                mockMergedPdfBlob,
                mockPatientDetails,
                'version123',
            );

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                id: 'mock-uuid-123',
                file: expect.any(File),
                state: DOCUMENT_UPLOAD_STATE.SELECTED,
                progress: 0,
                docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                attempts: 0,
                versionId: 'version123',
            });
            expect(result[0].file.name).toBe('test_documents_(2).zip');
            expect(result[0].file.type).toBe('application/zip');
            expect(zipFiles).toHaveBeenCalledWith(mockDocuments);
        });

        it('should return original documents when neither stitched nor multifileZipped is true', async () => {
            const documentConfig: DOCUMENT_TYPE_CONFIG = {
                stitched: false,
                multifileZipped: false,
                snomedCode: DOCUMENT_TYPE.LLOYD_GEORGE,
                zippedFilename: 'test_documents',
                displayName: 'Scanned paper notes',
                canBeUpdated: false,
                associatedSnomed: '',
                multifileUpload: false,
                multifileReview: false,
                canBeDiscarded: false,
                singleDocumentOnly: true,
                acceptedFileTypes: [],
                content: {},
            };

            const result = await reduceDocumentsForUpload(
                mockDocuments,
                documentConfig,
                mockMergedPdfBlob,
                mockPatientDetails,
                'version123',
            );

            expect(result).toEqual(mockDocuments);
            expect(generateStitchedFileName).not.toHaveBeenCalled();
            expect(zipFiles).not.toHaveBeenCalled();
        });

        it('should handle empty documents array for zipped files', async () => {
            const documentConfig: DOCUMENT_TYPE_CONFIG = {
                stitched: false,
                multifileZipped: true,
                snomedCode: DOCUMENT_TYPE.LLOYD_GEORGE,
                zippedFilename: 'empty_documents',
                displayName: 'Scanned paper notes',
                canBeUpdated: false,
                associatedSnomed: '',
                multifileUpload: false,
                multifileReview: false,
                canBeDiscarded: false,
                singleDocumentOnly: true,
                acceptedFileTypes: [],
                content: {},
            };

            const mockZippedBlob = new Blob([''], { type: 'application/zip' });
            vi.mocked(zipFiles).mockResolvedValue(mockZippedBlob);

            const result = await reduceDocumentsForUpload(
                [],
                documentConfig,
                mockMergedPdfBlob,
                mockPatientDetails,
                'version123',
            );

            expect(result).toHaveLength(1);
            expect(result[0].file.name).toBe('empty_documents_(0).zip');
        });
    });
});
