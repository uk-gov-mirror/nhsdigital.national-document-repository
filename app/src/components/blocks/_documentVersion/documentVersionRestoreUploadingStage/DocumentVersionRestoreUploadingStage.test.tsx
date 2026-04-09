// @vitest-environment happy-dom
import { render, screen, act, waitFor, RenderResult } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import DocumentVersionRestoreUploadingStage from './DocumentVersionRestoreUploadingStage';
import {
    DOCUMENT_UPLOAD_STATE,
    UploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { buildPatientDetails, buildUploadSession } from '../../../../helpers/test/testBuilders';
import * as uploadDocumentsModule from '../../../../helpers/requests/uploadDocuments';
import * as documentUploadModule from '../../../../helpers/utils/documentUpload';
import { DocumentReference } from '../../../../types/pages/documentSearchResultsPage/types';

const mockNavigate = vi.fn();
const mockUsePatient = vi.fn();
const mockUseBaseAPIUrl = vi.fn();
const mockUseBaseAPIHeaders = vi.fn();
const mockUseLocation = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): typeof mockNavigate => mockNavigate,
        useLocation: (): unknown => mockUseLocation(),
    };
});

vi.mock('../../../../helpers/hooks/usePatient', () => ({
    default: (): ReturnType<typeof mockUsePatient> => mockUsePatient(),
}));

vi.mock('../../../../helpers/hooks/useBaseAPIUrl', () => ({
    default: (): ReturnType<typeof mockUseBaseAPIUrl> => mockUseBaseAPIUrl(),
}));

vi.mock('../../../../helpers/hooks/useBaseAPIHeaders', () => ({
    default: (): ReturnType<typeof mockUseBaseAPIHeaders> => mockUseBaseAPIHeaders(),
}));

vi.mock('../../../../helpers/utils/isLocal', () => ({
    isLocal: false,
    isMock: vi.fn(() => false),
    isRunningInCypress: vi.fn(() => false),
}));

const mockDocRef = {
    id: 'doc-ref-123',
    fileName: 'test-file.pdf',
    contentType: 'application/pdf',
    documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
    version: '2',
} as DocumentReference;

const buildSelectedUploadDocument = (
    documentReference: DocumentReference = mockDocRef,
): UploadDocument => ({
    id: 'upload-doc-1',
    file: new File([''], 'Lloyd_George_Record.pdf', {
        type: 'application/pdf',
    }),
    state: DOCUMENT_UPLOAD_STATE.SELECTED,
    docType: DOCUMENT_TYPE.LLOYD_GEORGE,
    versionId: documentReference.version,
    progress: 0,
});

const TestWrapper = ({
    documentReference,
}: {
    documentReference: DocumentReference;
}): React.JSX.Element => {
    const [uploadDoc, setUploadDoc] = useState<UploadDocument[]>([
        buildSelectedUploadDocument(documentReference),
    ]);

    return (
        <DocumentVersionRestoreUploadingStage
            documentReferenceToRestore={documentReference}
            documentReference={documentReference}
            uploadDoc={uploadDoc}
            setUploadDoc={setUploadDoc}
        />
    );
};

const renderPage = (documentReference: DocumentReference = mockDocRef): RenderResult =>
    render(
        <MemoryRouter>
            <TestWrapper documentReference={documentReference} />
        </MemoryRouter>,
    );

describe('RestoreVersionUploadingStage', () => {
    const mockPatientDetails = buildPatientDetails();

    beforeEach(() => {
        vi.clearAllMocks();
        import.meta.env.VITE_ENVIRONMENT = 'vitest';

        mockUsePatient.mockReturnValue(mockPatientDetails);
        mockUseBaseAPIUrl.mockReturnValue('http://test-api');
        mockUseBaseAPIHeaders.mockReturnValue({ Authorization: 'Bearer test-token' });
        mockUseLocation.mockReturnValue({
            state: { documentReference: mockDocRef },
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders the DocumentUploadingStage component', async () => {
        await act(async () => {
            renderPage();
        });

        expect(screen.getByTestId('arf-upload-uploading-stage-header')).toBeInTheDocument();
    });

    it('initialises with one document from the document reference', async () => {
        await act(async () => {
            renderPage();
        });

        expect(screen.getByText(/Lloyd_George_Record/)).toBeInTheDocument();
    });

    it('calls getUploadSession when startUpload is triggered', async () => {
        const getUploadSessionSpy = vi
            .spyOn(documentUploadModule, 'getUploadSession')
            .mockImplementation(
                async (
                    _isUpload,
                    _nhsNumber,
                    _baseUrl,
                    _baseHeaders,
                    _docRefId,
                    documents,
                    _setDocs,
                ) => buildUploadSession(documents),
            );
        vi.spyOn(uploadDocumentsModule, 'uploadDocumentToS3').mockResolvedValue();
        vi.spyOn(documentUploadModule, 'startIntervalTimer').mockReturnValue(123);

        await act(async () => {
            renderPage();
        });

        expect(getUploadSessionSpy).toHaveBeenCalledWith(
            true,
            mockPatientDetails.nhsNumber,
            'http://test-api',
            { Authorization: 'Bearer test-token' },
            'doc-ref-123',
            expect.arrayContaining([
                expect.objectContaining({
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                    versionId: '2',
                }),
            ]),
            expect.any(Function),
        );
    });

    it('navigates to the restore complete page when polling marks the document as succeeded', async () => {
        vi.spyOn(documentUploadModule, 'getUploadSession').mockImplementation(
            async (_isUpload, _nhsNumber, _baseUrl, _baseHeaders, _docRefId, documents, _setDocs) =>
                buildUploadSession(documents),
        );
        vi.spyOn(uploadDocumentsModule, 'uploadDocumentToS3').mockResolvedValue();
        vi.spyOn(documentUploadModule, 'startIntervalTimer').mockImplementation(
            (_uploadingDocuments, setInterval, _documents, setDocuments) => {
                setDocuments((prev) =>
                    prev.map((document) => ({
                        ...document,
                        state: DOCUMENT_UPLOAD_STATE.SUCCEEDED,
                    })),
                );
                setInterval(1);
                return 123;
            },
        );

        await act(async () => {
            renderPage();
        });

        await waitFor(
            () => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    routeChildren.DOCUMENT_VERSION_RESTORE_COMPLETE,
                );
            },
            { timeout: 3000 },
        );
    });

    it('navigates to infected page when polling marks the document as infected', async () => {
        vi.spyOn(documentUploadModule, 'getUploadSession').mockImplementation(
            async (_isUpload, _nhsNumber, _baseUrl, _baseHeaders, _docRefId, documents, _setDocs) =>
                buildUploadSession(documents),
        );
        vi.spyOn(uploadDocumentsModule, 'uploadDocumentToS3').mockResolvedValue();
        vi.spyOn(documentUploadModule, 'startIntervalTimer').mockImplementation(
            (_uploadingDocuments, setInterval, _documents, setDocuments) => {
                setDocuments((prev) =>
                    prev.map((document) => ({
                        ...document,
                        state: DOCUMENT_UPLOAD_STATE.INFECTED,
                    })),
                );
                setInterval(1);
                return 123;
            },
        );

        await act(async () => {
            renderPage();
        });

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(routeChildren.DOCUMENT_UPLOAD_INFECTED);
        });
    });

    it('navigates to server error when polling marks the document as error', async () => {
        vi.spyOn(documentUploadModule, 'getUploadSession').mockImplementation(
            async (_isUpload, _nhsNumber, _baseUrl, _baseHeaders, _docRefId, documents, _setDocs) =>
                buildUploadSession(documents),
        );
        vi.spyOn(uploadDocumentsModule, 'uploadDocumentToS3').mockResolvedValue();
        vi.spyOn(documentUploadModule, 'startIntervalTimer').mockImplementation(
            (_uploadingDocuments, setInterval, _documents, setDocuments) => {
                setDocuments((prev) =>
                    prev.map((document) => ({
                        ...document,
                        state: DOCUMENT_UPLOAD_STATE.ERROR,
                    })),
                );
                setInterval(1);
                return 123;
            },
        );

        await act(async () => {
            renderPage();
        });

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(routes.SERVER_ERROR);
        });
    });

    it('navigates to server error when polling exceeds the maximum timeout', async () => {
        vi.spyOn(documentUploadModule, 'getUploadSession').mockImplementation(
            async (_isUpload, _nhsNumber, _baseUrl, _baseHeaders, _docRefId, documents, _setDocs) =>
                buildUploadSession(documents),
        );
        vi.spyOn(uploadDocumentsModule, 'uploadDocumentToS3').mockResolvedValue();
        vi.spyOn(documentUploadModule, 'startIntervalTimer').mockImplementation(
            (_uploadingDocuments, setInterval) => {
                setInterval(121);
                return 123;
            },
        );

        await act(async () => {
            renderPage();
        });

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(routes.SERVER_ERROR);
        });
    });

    it('navigates to session expired on 403 error during upload', async () => {
        const error = new Error('Forbidden') as any;
        error.response = { status: 403 };
        vi.spyOn(documentUploadModule, 'getUploadSession').mockRejectedValue(error);

        await act(async () => {
            renderPage();
        });

        expect(mockNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
    });

    it('navigates to server error on non-403 error during upload', async () => {
        const error = new Error('Server Error') as any;
        error.response = { status: 500 };
        vi.spyOn(documentUploadModule, 'getUploadSession').mockRejectedValue(error);

        await act(async () => {
            renderPage();
        });

        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(routes.SERVER_ERROR));
    });

    it('navigates to session expired when the S3 upload returns 403', async () => {
        const error = new Error('Forbidden') as any;
        error.response = { status: 403 };

        vi.spyOn(documentUploadModule, 'getUploadSession').mockImplementation(
            async (_isUpload, _nhsNumber, _baseUrl, _baseHeaders, _docRefId, documents, _setDocs) =>
                buildUploadSession(documents),
        );
        vi.spyOn(uploadDocumentsModule, 'uploadDocumentToS3').mockRejectedValue(error);
        vi.spyOn(documentUploadModule, 'startIntervalTimer').mockReturnValue(1);

        await act(async () => {
            renderPage();
        });

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
        });
    });

    it('navigates to server error when the S3 upload returns a non-403 error', async () => {
        const error = new Error('Upload failed') as any;
        error.response = { status: 500 };

        vi.spyOn(documentUploadModule, 'getUploadSession').mockImplementation(
            async (_isUpload, _nhsNumber, _baseUrl, _baseHeaders, _docRefId, documents, _setDocs) =>
                buildUploadSession(documents),
        );
        vi.spyOn(uploadDocumentsModule, 'uploadDocumentToS3').mockRejectedValue(error);
        vi.spyOn(documentUploadModule, 'startIntervalTimer').mockReturnValue(1);

        await act(async () => {
            renderPage();
        });

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(routes.SERVER_ERROR));
        });
    });
});
