import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import {
    getUploadSession,
    handleDocReviewStatusResult,
    handleDocStatusResult,
    reduceDocumentsForUpload,
} from './documentUpload';
import { PatientDetails } from '../../types/generic/patientDetails';
import {
    DOCUMENT_STATUS,
    DOCUMENT_UPLOAD_STATE,
    UploadDocument,
} from '../../types/pages/UploadDocumentsPage/types';
import { DOCUMENT_TYPE, DOCUMENT_TYPE_CONFIG } from './documentType';
import uploadDocuments, { generateStitchedFileName } from '../requests/uploadDocuments';
import { zipFiles } from './zip';
import { buildMockUploadSession } from '../test/testBuilders';
import { uploadDocumentForReview } from '../requests/documentReview';
import * as isLocal from './isLocal';
import { DocumentReviewStatus } from '../../types/blocks/documentReview';

vi.mock('../requests/uploadDocuments');
vi.mock('../requests/documentReview');
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
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        vi.spyOn(isLocal, 'isLocal', 'get').mockReturnValue(false);
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

    describe('getUploadSession', () => {
        const baseUrl = 'https://api.example.com';
        const baseHeaders = { Authorization: 'Bearer token', 'Content-Type': 'application/json' };
        const mockSetDocuments = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should return mock upload session when isLocal is true', async () => {
            vi.spyOn(isLocal, 'isLocal', 'get').mockReturnValueOnce(true);

            const result = await getUploadSession(
                mockPatientDetails,
                baseUrl,
                baseHeaders,
                [],
                mockDocuments,
                mockSetDocuments,
            );

            expect(result).toEqual(buildMockUploadSession(mockDocuments));
        });

        it('should call uploadDocuments when user can manage patient record', async () => {
            const patientWithPermission = {
                ...mockPatientDetails,
                canManageRecord: true,
            };

            const mockUploadSession = {
                doc1: { url: 'presigned-url-1' },
                doc2: { url: 'presigned-url-2' },
            };

            vi.mocked(uploadDocuments).mockResolvedValue(mockUploadSession);

            const existingDocs = [{ ...mockDocuments[0], id: 'existing-doc-id' }];

            const result = await getUploadSession(
                patientWithPermission,
                baseUrl,
                baseHeaders,
                existingDocs,
                mockDocuments,
                mockSetDocuments,
            );

            expect(uploadDocuments).toHaveBeenCalledWith({
                nhsNumber: patientWithPermission.nhsNumber,
                documents: mockDocuments,
                baseUrl,
                baseHeaders,
                documentReferenceId: 'existing-doc-id',
            });
            expect(result).toEqual(mockUploadSession);
        });

        it('should call uploadDocumentForReview when user cannot manage patient record', async () => {
            const patientWithoutPermission = {
                ...mockPatientDetails,
                canManageRecord: false,
            };

            const mockReviewDocs = [
                {
                    id: 'review-id-1',
                    version: 'v1',
                    files: [{ presignedUrl: 'review-url-1' }],
                },
                {
                    id: 'review-id-2',
                    version: 'v2',
                    files: [{ presignedUrl: 'review-url-2' }],
                },
            ];

            vi.mocked(uploadDocumentForReview)
                .mockResolvedValueOnce(mockReviewDocs[0] as any)
                .mockResolvedValueOnce(mockReviewDocs[1] as any);

            const result = await getUploadSession(
                patientWithoutPermission,
                baseUrl,
                baseHeaders,
                [],
                mockDocuments,
                mockSetDocuments,
            );

            expect(uploadDocumentForReview).toHaveBeenCalledTimes(2);
            expect(uploadDocumentForReview).toHaveBeenCalledWith({
                nhsNumber: patientWithoutPermission.nhsNumber,
                document: mockDocuments[0],
                baseUrl,
                baseHeaders,
            });
            expect(mockSetDocuments).toHaveBeenCalled();
            expect(result).toEqual({
                'review-id-1': { url: 'review-url-1' },
                'review-id-2': { url: 'review-url-2' },
            });
        });

        it('should update document ids and versions when uploading for review', async () => {
            const patientWithoutPermission = {
                ...mockPatientDetails,
                canManageRecord: false,
            };

            const mockReview = {
                id: 'new-review-id',
                version: 'new-version',
                files: [{ presignedUrl: 'new-presigned-url' }],
            };

            vi.mocked(uploadDocumentForReview).mockResolvedValue(mockReview as any);

            await getUploadSession(
                patientWithoutPermission,
                baseUrl,
                baseHeaders,
                [],
                [mockDocuments[0]],
                mockSetDocuments,
            );

            const setDocumentsCall = mockSetDocuments.mock.calls[0][0];
            expect(setDocumentsCall[0].id).toBe('new-review-id');
            expect(setDocumentsCall[0].versionId).toBe('new-version');
        });
    });

    describe('handleDocStatusResult', () => {
        const mockSetDocuments = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should update document state to SUCCEEDED when status is FINAL', () => {
            const documentStatusResult = {
                'doc-ref-1': { status: DOCUMENT_STATUS.FINAL as const },
            };

            const mockDocs: UploadDocument[] = [
                {
                    ...mockDocuments[0],
                    ref: 'doc-ref-1',
                    state: DOCUMENT_UPLOAD_STATE.UPLOADING,
                },
            ];

            mockSetDocuments.mockImplementation((updateFn) => {
                const result = updateFn(mockDocs);
                expect(result[0].state).toBe(DOCUMENT_UPLOAD_STATE.SUCCEEDED);
            });

            handleDocStatusResult(documentStatusResult, mockSetDocuments);

            expect(mockSetDocuments).toHaveBeenCalledTimes(1);
        });

        it('should update document state to INFECTED when status is INFECTED', () => {
            const documentStatusResult = {
                'doc-ref-1': { status: DOCUMENT_STATUS.INFECTED as const },
            };

            const mockDocs: UploadDocument[] = [
                {
                    ...mockDocuments[0],
                    ref: 'doc-ref-1',
                    state: DOCUMENT_UPLOAD_STATE.UPLOADING,
                },
            ];

            mockSetDocuments.mockImplementation((updateFn) => {
                const result = updateFn(mockDocs);
                expect(result[0].state).toBe(DOCUMENT_UPLOAD_STATE.INFECTED);
            });

            handleDocStatusResult(documentStatusResult, mockSetDocuments);

            expect(mockSetDocuments).toHaveBeenCalledTimes(1);
        });

        it('should update document state to ERROR when status is NOT_FOUND', () => {
            const documentStatusResult = {
                'doc-ref-1': { status: DOCUMENT_STATUS.NOT_FOUND as const, error_code: 'ERR_404' },
            };

            const mockDocs: UploadDocument[] = [
                {
                    ...mockDocuments[0],
                    ref: 'doc-ref-1',
                    state: DOCUMENT_UPLOAD_STATE.UPLOADING,
                },
            ];

            mockSetDocuments.mockImplementation((updateFn) => {
                const result = updateFn(mockDocs);
                expect(result[0].state).toBe(DOCUMENT_UPLOAD_STATE.ERROR);
                expect(result[0].errorCode).toBe('ERR_404');
            });

            handleDocStatusResult(documentStatusResult, mockSetDocuments);

            expect(mockSetDocuments).toHaveBeenCalledTimes(1);
        });

        it('should update document state to ERROR when status is CANCELLED', () => {
            const documentStatusResult = {
                'doc-ref-1': {
                    status: DOCUMENT_STATUS.CANCELLED as const,
                    error_code: 'ERR_CANCELLED',
                },
            };

            const mockDocs: UploadDocument[] = [
                {
                    ...mockDocuments[0],
                    ref: 'doc-ref-1',
                    state: DOCUMENT_UPLOAD_STATE.UPLOADING,
                },
            ];

            mockSetDocuments.mockImplementation((updateFn) => {
                const result = updateFn(mockDocs);
                expect(result[0].state).toBe(DOCUMENT_UPLOAD_STATE.ERROR);
                expect(result[0].errorCode).toBe('ERR_CANCELLED');
            });

            handleDocStatusResult(documentStatusResult, mockSetDocuments);

            expect(mockSetDocuments).toHaveBeenCalledTimes(1);
        });

        it('should handle multiple documents with different statuses', () => {
            const documentStatusResult = {
                'doc-ref-1': { status: DOCUMENT_STATUS.FINAL as const },
                'doc-ref-2': { status: DOCUMENT_STATUS.INFECTED as const },
                'doc-ref-3': { status: DOCUMENT_STATUS.NOT_FOUND as const, error_code: 'ERR_404' },
            };

            const mockDocs: UploadDocument[] = [
                { ...mockDocuments[0], ref: 'doc-ref-1', state: DOCUMENT_UPLOAD_STATE.UPLOADING },
                { ...mockDocuments[1], ref: 'doc-ref-2', state: DOCUMENT_UPLOAD_STATE.UPLOADING },
                { ...mockDocuments[0], ref: 'doc-ref-3', state: DOCUMENT_UPLOAD_STATE.UPLOADING },
            ];

            mockSetDocuments.mockImplementation((updateFn) => {
                const result = updateFn(mockDocs);
                expect(result[0].state).toBe(DOCUMENT_UPLOAD_STATE.SUCCEEDED);
                expect(result[1].state).toBe(DOCUMENT_UPLOAD_STATE.INFECTED);
                expect(result[2].state).toBe(DOCUMENT_UPLOAD_STATE.ERROR);
                expect(result[2].errorCode).toBe('ERR_404');
            });

            handleDocStatusResult(documentStatusResult, mockSetDocuments);

            expect(mockSetDocuments).toHaveBeenCalledTimes(1);
        });

        it('should not modify documents without matching refs', () => {
            const documentStatusResult = {
                'doc-ref-1': { status: DOCUMENT_STATUS.FINAL as const },
            };

            const mockDocs: UploadDocument[] = [
                { ...mockDocuments[0], ref: 'doc-ref-2', state: DOCUMENT_UPLOAD_STATE.UPLOADING },
            ];

            mockSetDocuments.mockImplementation((updateFn) => {
                const result = updateFn(mockDocs);
                expect(result[0].state).toBe(DOCUMENT_UPLOAD_STATE.UPLOADING);
            });

            handleDocStatusResult(documentStatusResult, mockSetDocuments);

            expect(mockSetDocuments).toHaveBeenCalledTimes(1);
        });

        it('should preserve other document properties when updating state', () => {
            const documentStatusResult = {
                'doc-ref-1': { status: DOCUMENT_STATUS.FINAL as const },
            };

            const mockDocs: UploadDocument[] = [
                {
                    ...mockDocuments[0],
                    ref: 'doc-ref-1',
                    state: DOCUMENT_UPLOAD_STATE.UPLOADING,
                    progress: 75,
                },
            ];

            mockSetDocuments.mockImplementation((updateFn) => {
                const result = updateFn(mockDocs);
                expect(result[0].progress).toBe(75);
                expect(result[0].docType).toBe(DOCUMENT_TYPE.LLOYD_GEORGE);
                expect(result[0].file).toBe(mockDocs[0].file);
            });

            handleDocStatusResult(documentStatusResult, mockSetDocuments);

            expect(mockSetDocuments).toHaveBeenCalledTimes(1);
        });
    });

    describe('handleDocReviewStatusResult', () => {
        const mockSetDocuments = vi.fn();

        const baseDoc: UploadDocument = {
            id: 'doc1',
            file: new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
            state: DOCUMENT_UPLOAD_STATE.UPLOADING,
            progress: 0,
            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
            attempts: 0,
            versionId: 'v1',
        };

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should update document state to SUCCEEDED when status is PENDING_REVIEW', () => {
            const reviewStatusDto = {
                id: 'doc1',
                reviewStatus: DocumentReviewStatus.PENDING_REVIEW,
            };

            mockSetDocuments.mockImplementation((updateFn) => {
                const result = updateFn([baseDoc]);
                expect(result[0].state).toBe(DOCUMENT_UPLOAD_STATE.SUCCEEDED);
            });

            // 1 = DocumentReviewStatus.PENDING_REVIEW
            handleDocReviewStatusResult(reviewStatusDto as any, mockSetDocuments);

            expect(mockSetDocuments).toHaveBeenCalledTimes(1);
        });

        it('should update document state to INFECTED when status is VIRUS_SCAN_FAILED', () => {
            const reviewStatusDto = {
                id: 'doc1',
                reviewStatus: DocumentReviewStatus.VIRUS_SCAN_FAILED,
            };

            mockSetDocuments.mockImplementation((updateFn) => {
                const result = updateFn([baseDoc]);
                expect(result[0].state).toBe(DOCUMENT_UPLOAD_STATE.INFECTED);
            });

            // 2 = DocumentReviewStatus.VIRUS_SCAN_FAILED
            handleDocReviewStatusResult(reviewStatusDto as any, mockSetDocuments);

            expect(mockSetDocuments).toHaveBeenCalledTimes(1);
        });

        it('should update document state to SCANNING when status is REVIEW_PENDING_UPLOAD', () => {
            const reviewStatusDto = {
                id: 'doc1',
                reviewStatus: DocumentReviewStatus.REVIEW_PENDING_UPLOAD,
            };

            mockSetDocuments.mockImplementation((updateFn) => {
                const result = updateFn([baseDoc]);
                expect(result[0].state).toBe(DOCUMENT_UPLOAD_STATE.SCANNING);
            });

            handleDocReviewStatusResult(reviewStatusDto as any, mockSetDocuments);

            expect(mockSetDocuments).toHaveBeenCalledTimes(1);
        });

        it('should update document state to ERROR and set errorCode for unknown status', () => {
            const reviewStatusDto = {
                id: 'doc1',
                reviewStatus: 'unknown',
                reviewReason: 'Some error reason',
            };

            mockSetDocuments.mockImplementation((updateFn) => {
                const result = updateFn([baseDoc]);
                expect(result[0].state).toBe(DOCUMENT_UPLOAD_STATE.ERROR);
                expect(result[0].errorCode).toBe('Some error reason');
            });

            handleDocReviewStatusResult(reviewStatusDto as any, mockSetDocuments);

            expect(mockSetDocuments).toHaveBeenCalledTimes(1);
        });

        it('should not modify documents with non-matching ids', () => {
            const reviewStatusDto = {
                id: 'other-doc',
                reviewStatus: DocumentReviewStatus.PENDING_REVIEW,
            };

            mockSetDocuments.mockImplementation((updateFn) => {
                const result = updateFn([baseDoc]);
                expect(result[0].state).toBe(DOCUMENT_UPLOAD_STATE.UPLOADING);
            });

            handleDocReviewStatusResult(reviewStatusDto as any, mockSetDocuments);

            expect(mockSetDocuments).toHaveBeenCalledTimes(1);
        });

        it('should preserve other document properties when updating state', () => {
            const reviewStatusDto = {
                id: 'doc1',
                reviewStatus: DocumentReviewStatus.PENDING_REVIEW,
            };

            const docWithProps = { ...baseDoc, progress: 55, attempts: 2 };

            mockSetDocuments.mockImplementation((updateFn) => {
                const result = updateFn([docWithProps]);
                expect(result[0].progress).toBe(55);
                expect(result[0].attempts).toBe(2);
                expect(result[0].file).toBe(docWithProps.file);
            });

            handleDocReviewStatusResult(reviewStatusDto as any, mockSetDocuments);

            expect(mockSetDocuments).toHaveBeenCalledTimes(1);
        });
    });
});
