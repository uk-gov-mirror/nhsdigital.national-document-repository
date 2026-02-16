import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getUploadSession,
    goToNextDocType,
    goToPreviousDocType,
    handleDocReviewStatusResult,
    handleDocStatusResult,
    handleDocumentStatusUpdates,
    reduceDocumentsForUpload,
    startIntervalTimer,
} from './documentUpload';
import { PatientDetails } from '../../types/generic/patientDetails';
import {
    DOCUMENT_STATUS,
    DOCUMENT_UPLOAD_STATE,
    UploadDocument,
} from '../../types/pages/UploadDocumentsPage/types';
import { DOCUMENT_TYPE } from './documentType';
import uploadDocuments, { generateStitchedFileName } from '../requests/uploadDocuments';
import { zipFiles } from './zip';
import { buildMockUploadSession } from '../test/testBuilders';
import { uploadDocumentForReview } from '../requests/documentReview';
import * as isLocal from './isLocal';
import { DocumentReviewStatus } from '../../types/blocks/documentReview';
import { buildDocumentConfig } from '../test/testBuilders';
import { routes, routeChildren } from '../../types/generic/routes';
import {
    MAX_POLLING_TIME,
    UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS,
} from '../constants/network';
import * as urlManipulations from './urlManipulations';

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
            const documentConfig = buildDocumentConfig();

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
            const documentConfig = buildDocumentConfig({
                multifileZipped: true,
                stitched: false,
            });

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
            expect(result[0].file.name).toBe(
                `${documentConfig.zippedFilename}_(${mockDocuments.length}).zip`,
            );
            expect(result[0].file.type).toBe('application/zip');
            expect(zipFiles).toHaveBeenCalledWith(mockDocuments);
        });

        it('should return original documents when neither stitched nor multifileZipped is true', async () => {
            const documentConfig = buildDocumentConfig({
                stitched: false,
            });

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
            const documentConfig = buildDocumentConfig({
                multifileZipped: true,
                zippedFilename: 'empty_documents',
            });

            const mockZippedBlob = new Blob([''], { type: 'application/zip' });
            vi.mocked(zipFiles).mockResolvedValue(mockZippedBlob);

            const result = await reduceDocumentsForUpload(
                [],
                documentConfig,
                mockMergedPdfBlob,
                mockPatientDetails,
                'version123',
            );

            expect(result).toHaveLength(0);
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
                undefined,
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
                existingDocs[0].id,
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
                undefined,
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
                undefined,
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

        it('should update document state to ERROR when status is INVALID', () => {
            const documentStatusResult = {
                'doc-ref-1': {
                    status: DOCUMENT_STATUS.INVALID as const,
                    error_code: 'ERR_INVALID',
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
                expect(result[0].errorCode).toBe('ERR_INVALID');
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

    describe('startIntervalTimer', async () => {
        const mockUploadDocuments: UploadDocument[] = [
            {
                id: 'doc1',
                file: new File(['content'], 'test.pdf', { type: 'application/pdf' }),
                state: DOCUMENT_UPLOAD_STATE.UPLOADING,
                progress: 50,
                docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                attempts: 0,
                versionId: 'v1',
                ref: 'doc-ref-1',
            },
        ];

        const setInterval = vi.fn();

        const mockSetDocuments = vi.fn();
        const baseUrl = 'https://api.example.com';
        const baseHeaders = { Authorization: 'Bearer token', 'Content-Type': 'application/json' };
        const nhsNumber = '1234567890';

        beforeEach(() => {
            vi.useFakeTimers();
            vi.clearAllMocks();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should call getDocumentStatus and update documents when user can manage record', async () => {
            const patientWithPermission = { ...mockPatientDetails, canManageRecord: true };
            const mockDocumentStatus = {
                'doc-ref-1': { status: DOCUMENT_STATUS.FINAL as const },
            };

            const { getDocumentStatus } = await import('../requests/uploadDocuments');
            vi.mocked(getDocumentStatus).mockResolvedValue(mockDocumentStatus);

            startIntervalTimer(
                mockUploadDocuments,
                setInterval,
                mockUploadDocuments,
                mockSetDocuments,
                patientWithPermission,
                baseUrl,
                baseHeaders,
                1000,
            );

            await vi.advanceTimersByTimeAsync(1000);

            expect(getDocumentStatus).toHaveBeenCalledWith({
                documents: mockUploadDocuments,
                baseUrl,
                baseHeaders,
                nhsNumber,
            });
            expect(mockSetDocuments).toHaveBeenCalled();
        });

        it('should call getDocumentReviewStatus when user cannot manage record', async () => {
            const patientWithoutPermission = { ...mockPatientDetails, canManageRecord: false };
            const mockReviewStatus = {
                id: 'doc1',
                reviewStatus: DocumentReviewStatus.PENDING_REVIEW,
            };

            const { getDocumentReviewStatus } = await import('../requests/documentReview');
            vi.mocked(getDocumentReviewStatus).mockResolvedValue(mockReviewStatus as any);

            startIntervalTimer(
                mockUploadDocuments,
                setInterval,
                mockUploadDocuments,
                mockSetDocuments,
                patientWithoutPermission,
                baseUrl,
                baseHeaders,
                1000,
            );

            await vi.advanceTimersByTimeAsync(1000);

            expect(getDocumentReviewStatus).toHaveBeenCalledWith({
                document: mockUploadDocuments[0],
                baseUrl,
                baseHeaders,
                nhsNumber,
            });
            expect(mockSetDocuments).toHaveBeenCalled();
        });

        it('should update documents locally when isLocal is true', async () => {
            vi.spyOn(isLocal, 'isLocal', 'get').mockReturnValue(true);

            const localDocs = [
                {
                    ...mockUploadDocuments[0],
                    progress: 30,
                    state: DOCUMENT_UPLOAD_STATE.UPLOADING,
                },
            ];

            startIntervalTimer(
                localDocs,
                setInterval,
                localDocs,
                mockSetDocuments,
                mockPatientDetails,
                baseUrl,
                baseHeaders,
                1000,
            );

            await vi.advanceTimersByTimeAsync(1000);

            expect(mockSetDocuments).toHaveBeenCalled();
            const updatedDocs = mockSetDocuments.mock.calls[0][0];
            expect(updatedDocs[0].progress).toBeGreaterThan(30);
            expect(updatedDocs[0].progress).toBeLessThanOrEqual(100);
        });

        it('should set state to SUCCEEDED when progress reaches 100 in local mode', async () => {
            vi.spyOn(isLocal, 'isLocal', 'get').mockReturnValue(true);

            const localDocs = [
                {
                    ...mockUploadDocuments[0],
                    progress: 95,
                    state: DOCUMENT_UPLOAD_STATE.UPLOADING,
                },
            ];

            startIntervalTimer(
                localDocs,
                setInterval,
                localDocs,
                mockSetDocuments,
                mockPatientDetails,
                baseUrl,
                baseHeaders,
                1000,
            );

            await vi.advanceTimersByTimeAsync(1000);

            const updatedDocs = mockSetDocuments.mock.calls[0][0];
            expect(updatedDocs[0].progress).toBe(100);
            expect(updatedDocs[0].state).toBe(DOCUMENT_UPLOAD_STATE.SUCCEEDED);
        });

        it('should set state to INFECTED when virus.pdf file is detected in local mode', async () => {
            vi.spyOn(isLocal, 'isLocal', 'get').mockReturnValue(true);

            const virusDoc = {
                ...mockUploadDocuments[0],
                file: new File(['content'], 'virus.pdf', { type: 'application/pdf' }),
                progress: 95,
                state: DOCUMENT_UPLOAD_STATE.UPLOADING,
            };

            startIntervalTimer(
                [virusDoc],
                setInterval,
                [virusDoc],
                mockSetDocuments,
                mockPatientDetails,
                baseUrl,
                baseHeaders,
                1000,
            );

            await vi.advanceTimersByTimeAsync(1000);

            const updatedDocs = mockSetDocuments.mock.calls[0][0];
            expect(updatedDocs[0].state).toBe(DOCUMENT_UPLOAD_STATE.INFECTED);
        });

        it('should set state to ERROR when virus-failed.pdf file is detected in local mode', async () => {
            vi.spyOn(isLocal, 'isLocal', 'get').mockReturnValue(true);

            const failedDoc = {
                ...mockUploadDocuments[0],
                file: new File(['content'], 'virus-failed.pdf', { type: 'application/pdf' }),
                progress: 95,
                state: DOCUMENT_UPLOAD_STATE.UPLOADING,
            };

            startIntervalTimer(
                [failedDoc],
                setInterval,
                [failedDoc],
                mockSetDocuments,
                mockPatientDetails,
                baseUrl,
                baseHeaders,
                1000,
            );

            await vi.advanceTimersByTimeAsync(1000);

            const updatedDocs = mockSetDocuments.mock.calls[0][0];
            expect(updatedDocs[0].state).toBe(DOCUMENT_UPLOAD_STATE.ERROR);
        });

        it('should not change state when already SCANNING in local mode', async () => {
            vi.spyOn(isLocal, 'isLocal', 'get').mockReturnValue(true);

            const localDocs = [
                {
                    ...mockUploadDocuments[0],
                    progress: 100,
                    state: DOCUMENT_UPLOAD_STATE.SCANNING,
                },
            ];

            startIntervalTimer(
                localDocs,
                setInterval,
                localDocs,
                mockSetDocuments,
                mockPatientDetails,
                baseUrl,
                baseHeaders,
                1000,
            );

            await vi.advanceTimersByTimeAsync(1000);

            const updatedDocs = mockSetDocuments.mock.calls[0][0];
            expect(updatedDocs[0].state).toBe(DOCUMENT_UPLOAD_STATE.SCANNING);
        });
    });

    describe('goToNextDocType', () => {
        const documentTypeList = [
            DOCUMENT_TYPE.LLOYD_GEORGE,
            DOCUMENT_TYPE.EHR,
            DOCUMENT_TYPE.EHR_ATTACHMENTS,
        ];

        const mockSetShowSkipLink = vi.fn();
        const mockSetDocumentType = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should move to next document type in the list', () => {
            const currentDocType = DOCUMENT_TYPE.EHR;

            goToNextDocType(
                documentTypeList,
                currentDocType,
                mockSetShowSkipLink,
                mockSetDocumentType,
                [],
            );

            expect(mockSetDocumentType).toHaveBeenCalledWith(DOCUMENT_TYPE.EHR_ATTACHMENTS);
        });

        it('should set showSkipLink to true when not at the end of the list', () => {
            const currentDocType = DOCUMENT_TYPE.LLOYD_GEORGE;

            goToNextDocType(
                documentTypeList,
                currentDocType,
                mockSetShowSkipLink,
                mockSetDocumentType,
                [],
            );

            expect(mockSetDocumentType).toHaveBeenCalledWith(DOCUMENT_TYPE.EHR);
            expect(mockSetShowSkipLink).toHaveBeenCalledWith(true);
        });

        it('should not change document type when already at the last item', () => {
            const currentDocType = DOCUMENT_TYPE.EHR_ATTACHMENTS;

            goToNextDocType(
                documentTypeList,
                currentDocType,
                mockSetShowSkipLink,
                mockSetDocumentType,
                [],
            );

            expect(mockSetDocumentType).not.toHaveBeenCalled();
            expect(mockSetShowSkipLink).not.toHaveBeenCalled();
        });

        it('should set showSkipLink to false when on last item and there are no uploaded documents', () => {
            const currentDocType = DOCUMENT_TYPE.EHR;

            goToNextDocType(
                documentTypeList,
                currentDocType,
                mockSetShowSkipLink,
                mockSetDocumentType,
                [],
            );

            expect(mockSetDocumentType).toHaveBeenCalledWith(DOCUMENT_TYPE.EHR_ATTACHMENTS);
            expect(mockSetShowSkipLink).toHaveBeenCalledWith(false);
        });

        it('should handle single item list', () => {
            const singleItemList = [DOCUMENT_TYPE.LLOYD_GEORGE];

            goToNextDocType(
                singleItemList,
                DOCUMENT_TYPE.LLOYD_GEORGE,
                mockSetShowSkipLink,
                mockSetDocumentType,
                [],
            );

            expect(mockSetDocumentType).not.toHaveBeenCalled();
            expect(mockSetShowSkipLink).not.toHaveBeenCalled();
        });
    });

    describe('goToPreviousDocType', () => {
        const documentTypeList = [
            DOCUMENT_TYPE.LLOYD_GEORGE,
            DOCUMENT_TYPE.EHR,
            DOCUMENT_TYPE.EHR_ATTACHMENTS,
        ];

        const mockSetShowSkipLink = vi.fn();
        const mockSetDocumentType = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should move to previous document type in the list', () => {
            const currentDocType = DOCUMENT_TYPE.EHR;

            goToPreviousDocType(
                documentTypeList,
                currentDocType,
                mockSetShowSkipLink,
                mockSetDocumentType,
            );

            expect(mockSetDocumentType).toHaveBeenCalledWith(DOCUMENT_TYPE.LLOYD_GEORGE);
            expect(mockSetShowSkipLink).toHaveBeenCalledWith(true);
        });

        it('should not change document type when already at the first item', () => {
            const currentDocType = DOCUMENT_TYPE.LLOYD_GEORGE;

            goToPreviousDocType(
                documentTypeList,
                currentDocType,
                mockSetShowSkipLink,
                mockSetDocumentType,
            );

            expect(mockSetDocumentType).not.toHaveBeenCalled();
            expect(mockSetShowSkipLink).not.toHaveBeenCalled();
        });

        it('should handle moving back from last item to middle item', () => {
            const currentDocType = DOCUMENT_TYPE.EHR_ATTACHMENTS;

            goToPreviousDocType(
                documentTypeList,
                currentDocType,
                mockSetShowSkipLink,
                mockSetDocumentType,
            );

            expect(mockSetDocumentType).toHaveBeenCalledWith(DOCUMENT_TYPE.EHR);
            expect(mockSetShowSkipLink).toHaveBeenCalledWith(true);
        });

        it('should handle single item list', () => {
            const singleItemList = [DOCUMENT_TYPE.LLOYD_GEORGE];

            goToPreviousDocType(
                singleItemList,
                DOCUMENT_TYPE.LLOYD_GEORGE,
                mockSetShowSkipLink,
                mockSetDocumentType,
            );

            expect(mockSetDocumentType).not.toHaveBeenCalled();
            expect(mockSetShowSkipLink).not.toHaveBeenCalled();
        });
    });

    describe('handleDocumentStatusUpdates', () => {
        const mockNavigate = Object.assign(vi.fn(), {
            withParams: vi.fn(),
        });

        let mockInterval = 0;
        let mockVirusRef: { current: boolean };
        let mockCompleteRef: { current: boolean };

        beforeEach(() => {
            vi.clearAllMocks();
            vi.spyOn(globalThis, 'clearInterval');
            vi.spyOn(window, 'clearInterval');
            vi.spyOn(urlManipulations, 'getJourney').mockReturnValue('new');
            mockInterval = 1;
            mockVirusRef = { current: false };
            mockCompleteRef = { current: false };
        });

        it('should navigate to SERVER_ERROR when journey param is update but journey type does not match', () => {
            vi.spyOn(urlManipulations, 'getJourney').mockReturnValue('update');

            const intervalTimer = 123;

            handleDocumentStatusUpdates(
                'new',
                mockNavigate,
                intervalTimer,
                mockInterval,
                mockDocuments,
                mockVirusRef,
                mockCompleteRef,
            );

            expect(globalThis.clearInterval).toHaveBeenCalledWith(intervalTimer);
            expect(mockNavigate).toHaveBeenCalledWith(routes.SERVER_ERROR);
        });

        it('should navigate to SERVER_ERROR when polling time exceeds MAX_POLLING_TIME', () => {
            mockInterval =
                Math.ceil(MAX_POLLING_TIME / UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS) + 1;

            const intervalTimer = 456;

            handleDocumentStatusUpdates(
                'new',
                mockNavigate,
                intervalTimer,
                mockInterval,
                mockDocuments,
                mockVirusRef,
                mockCompleteRef,
            );

            expect(window.clearInterval).toHaveBeenCalledWith(intervalTimer);
            expect(mockNavigate).toHaveBeenCalledWith(routes.SERVER_ERROR);
        });

        it('should return early when documents array is empty', () => {
            handleDocumentStatusUpdates(
                'new',
                mockNavigate,
                123,
                mockInterval,
                [],
                mockVirusRef,
                mockCompleteRef,
            );

            expect(mockNavigate).not.toHaveBeenCalled();
            expect(mockNavigate.withParams).not.toHaveBeenCalled();
        });

        it('should navigate to DOCUMENT_UPLOAD_INFECTED when a document has virus', () => {
            const documentsWithVirus: UploadDocument[] = [
                {
                    ...mockDocuments[0],
                    state: DOCUMENT_UPLOAD_STATE.INFECTED,
                },
            ];

            const intervalTimer = 789;

            handleDocumentStatusUpdates(
                'new',
                mockNavigate,
                intervalTimer,
                mockInterval,
                documentsWithVirus,
                mockVirusRef,
                mockCompleteRef,
            );

            expect(mockVirusRef.current).toBe(true);
            expect(window.clearInterval).toHaveBeenCalledWith(intervalTimer);
            expect(mockNavigate).toHaveBeenCalledWith(routeChildren.DOCUMENT_UPLOAD_INFECTED);
        });

        it('should not navigate to infected page again if virusReference is already true', () => {
            const documentsWithVirus: UploadDocument[] = [
                {
                    ...mockDocuments[0],
                    state: DOCUMENT_UPLOAD_STATE.INFECTED,
                },
            ];

            mockVirusRef.current = true;

            handleDocumentStatusUpdates(
                'new',
                mockNavigate,
                123,
                mockInterval,
                documentsWithVirus,
                mockVirusRef,
                mockCompleteRef,
            );

            expect(mockNavigate).not.toHaveBeenCalledWith(routeChildren.DOCUMENT_UPLOAD_INFECTED);
        });

        it('should navigate to SERVER_ERROR with error params when all documents have failed', () => {
            const allFailedDocs: UploadDocument[] = [
                {
                    ...mockDocuments[0],
                    state: DOCUMENT_UPLOAD_STATE.ERROR,
                    errorCode: 'UC_4006',
                },
                {
                    ...mockDocuments[1],
                    state: DOCUMENT_UPLOAD_STATE.ERROR,
                    errorCode: 'UC_4007',
                },
            ];

            handleDocumentStatusUpdates(
                'new',
                mockNavigate,
                123,
                mockInterval,
                allFailedDocs,
                mockVirusRef,
                mockCompleteRef,
            );

            expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(routes.SERVER_ERROR));
            expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('?encodedError='));
        });

        it('should navigate to DOCUMENT_UPLOAD_COMPLETED when all documents finished successfully', () => {
            const allSucceededDocs: UploadDocument[] = [
                {
                    ...mockDocuments[0],
                    state: DOCUMENT_UPLOAD_STATE.SUCCEEDED,
                },
                {
                    ...mockDocuments[1],
                    state: DOCUMENT_UPLOAD_STATE.SUCCEEDED,
                },
            ];

            const intervalTimer = 101;

            handleDocumentStatusUpdates(
                'new',
                mockNavigate,
                intervalTimer,
                mockInterval,
                allSucceededDocs,
                mockVirusRef,
                mockCompleteRef,
            );

            expect(mockCompleteRef.current).toBe(true);
            expect(window.clearInterval).toHaveBeenCalledWith(intervalTimer);
            expect(mockNavigate.withParams).toHaveBeenCalledWith(
                routeChildren.DOCUMENT_UPLOAD_COMPLETED,
            );
        });

        it('should not navigate to completed page again if completeRef is already true', () => {
            const allSucceededDocs: UploadDocument[] = [
                {
                    ...mockDocuments[0],
                    state: DOCUMENT_UPLOAD_STATE.SUCCEEDED,
                },
            ];

            mockCompleteRef.current = true;

            handleDocumentStatusUpdates(
                'new',
                mockNavigate,
                123,
                mockInterval,
                allSucceededDocs,
                mockVirusRef,
                mockCompleteRef,
            );

            expect(mockNavigate.withParams).not.toHaveBeenCalled();
        });

        it('should navigate to completed page when mix of succeeded and error documents', () => {
            const mixedDocs: UploadDocument[] = [
                {
                    ...mockDocuments[0],
                    state: DOCUMENT_UPLOAD_STATE.SUCCEEDED,
                },
                {
                    ...mockDocuments[1],
                    state: DOCUMENT_UPLOAD_STATE.ERROR,
                    errorCode: 'UC_4006',
                },
            ];

            const intervalTimer = 202;

            handleDocumentStatusUpdates(
                'new',
                mockNavigate,
                intervalTimer,
                mockInterval,
                mixedDocs,
                mockVirusRef,
                mockCompleteRef,
            );

            expect(mockCompleteRef.current).toBe(true);
            expect(window.clearInterval).toHaveBeenCalledWith(intervalTimer);
            expect(mockNavigate.withParams).toHaveBeenCalledWith(
                routeChildren.DOCUMENT_UPLOAD_COMPLETED,
            );
        });

        it('should not navigate when documents are still uploading', () => {
            const uploadingDocs: UploadDocument[] = [
                {
                    ...mockDocuments[0],
                    state: DOCUMENT_UPLOAD_STATE.UPLOADING,
                },
                {
                    ...mockDocuments[1],
                    state: DOCUMENT_UPLOAD_STATE.SUCCEEDED,
                },
            ];

            handleDocumentStatusUpdates(
                'new',
                mockNavigate,
                123,
                mockInterval,
                uploadingDocs,
                mockVirusRef,
                mockCompleteRef,
            );

            expect(mockNavigate).not.toHaveBeenCalled();
            expect(mockNavigate.withParams).not.toHaveBeenCalled();
        });

        it('should not navigate when documents are still scanning', () => {
            const scanningDocs: UploadDocument[] = [
                {
                    ...mockDocuments[0],
                    state: DOCUMENT_UPLOAD_STATE.SCANNING,
                },
            ];

            handleDocumentStatusUpdates(
                'new',
                mockNavigate,
                123,
                mockInterval,
                scanningDocs,
                mockVirusRef,
                mockCompleteRef,
            );

            expect(mockNavigate).not.toHaveBeenCalled();
            expect(mockNavigate.withParams).not.toHaveBeenCalled();
        });

        it('should prioritize virus detection over all documents failed', () => {
            const virusAndFailedDocs: UploadDocument[] = [
                {
                    ...mockDocuments[0],
                    state: DOCUMENT_UPLOAD_STATE.INFECTED,
                },
                {
                    ...mockDocuments[1],
                    state: DOCUMENT_UPLOAD_STATE.ERROR,
                    errorCode: 'UC_4006',
                },
            ];

            const intervalTimer = 303;

            handleDocumentStatusUpdates(
                'new',
                mockNavigate,
                intervalTimer,
                mockInterval,
                virusAndFailedDocs,
                mockVirusRef,
                mockCompleteRef,
            );

            expect(mockNavigate).toHaveBeenCalledWith(routeChildren.DOCUMENT_UPLOAD_INFECTED);
            expect(mockNavigate).not.toHaveBeenCalledWith(
                expect.stringContaining(routes.SERVER_ERROR + '?'),
            );
        });
    });
});
