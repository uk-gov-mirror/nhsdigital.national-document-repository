// @vitest-environment happy-dom
import { act, render, RenderResult, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as uploadDocumentsModule from '../../../../helpers/requests/uploadDocuments';
import {
    buildDocument,
    buildDocumentConfig,
    buildPatientDetails,
    buildUploadSession,
} from '../../../../helpers/test/testBuilders';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';
import * as documentUploadModule from '../../../../helpers/utils/documentUpload';
import { routeChildren, routes } from '../../../../types/generic/routes';
import {
    DOCUMENT_UPLOAD_STATE,
    UploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';
import ProgressingPage, { ProgressingPageProps } from './ProgressingPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): typeof mockNavigate => mockNavigate,
    };
});

vi.mock('../../../../helpers/utils/isLocal', () => ({
    isLocal: false,
    isMock: vi.fn(() => false),
    isRunningInCypress: vi.fn(() => false),
}));

const buildSelectedDocument = (name = 'test-file.pdf'): UploadDocument =>
    buildDocument(
        new File(['test'], name, { type: 'application/pdf' }),
        DOCUMENT_UPLOAD_STATE.SELECTED,
        DOCUMENT_TYPE.LLOYD_GEORGE,
    );

type WrapperProps = Omit<ProgressingPageProps, 'documents' | 'setDocuments'> & {
    initialDocuments: UploadDocument[];
};

const StatefulWrapper = ({ initialDocuments, ...rest }: WrapperProps): React.JSX.Element => {
    const [documents, setDocuments] = useState<UploadDocument[]>(initialDocuments);
    return <ProgressingPage documents={documents} setDocuments={setDocuments} {...rest} />;
};

describe('ProgressingPage', () => {
    const mockPatientDetails = buildPatientDetails();
    const mockBaseUrl = 'http://test-api';
    const mockBaseHeaders = { 'Content-Type': 'application/json', Authorization: 'Bearer token' };
    const mockDocumentConfig = buildDocumentConfig();

    let mockDocuments: UploadDocument[];

    const renderComponent = (propsOverride: Partial<WrapperProps> = {}): RenderResult => {
        const wrapperProps: WrapperProps = {
            initialDocuments: mockDocuments,
            documentConfig: mockDocumentConfig,
            journey: 'upload',
            patientDetails: mockPatientDetails,
            baseUrl: mockBaseUrl,
            baseHeaders: mockBaseHeaders,
            prepareDocuments: vi.fn().mockResolvedValue(undefined),
            onAllFinished: vi.fn(),
            ...propsOverride,
        };

        return render(
            <MemoryRouter>
                <StatefulWrapper {...wrapperProps} />
            </MemoryRouter>,
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockDocuments = [buildSelectedDocument()];
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const mockSuccessfulUpload = (): {
        getUploadSessionSpy: any;
        uploadToS3Spy: any;
        startIntervalSpy: any;
    } => {
        const getUploadSessionSpy = vi
            .spyOn(documentUploadModule, 'getUploadSession')
            .mockImplementation(async (_isUpload, _nhsNumber, _b, _h, _d, docs, _setDocs) =>
                buildUploadSession(docs),
            );
        const uploadToS3Spy = vi
            .spyOn(uploadDocumentsModule, 'uploadDocumentToS3')
            .mockResolvedValue();
        const startIntervalSpy = vi
            .spyOn(documentUploadModule, 'startIntervalTimer')
            .mockReturnValue(1);
        return { getUploadSessionSpy, uploadToS3Spy, startIntervalSpy };
    };

    const mockUploadWithDocumentState = (state: DOCUMENT_UPLOAD_STATE): void => {
        vi.spyOn(documentUploadModule, 'getUploadSession').mockImplementation(
            async (_isUpload, _nhsNumber, _b, _h, _d, docs, _setDocs) => buildUploadSession(docs),
        );
        vi.spyOn(uploadDocumentsModule, 'uploadDocumentToS3').mockResolvedValue();
        vi.spyOn(documentUploadModule, 'startIntervalTimer').mockImplementation(
            (_uploadingDocuments, setInterval, _documents, setDocuments) => {
                setDocuments((prev) =>
                    prev.map((doc) => ({
                        ...doc,
                        state,
                    })),
                );
                setInterval(1);
                return 1;
            },
        );
    };

    const mockUploadWithPollingTimeout = (): void => {
        vi.spyOn(documentUploadModule, 'getUploadSession').mockImplementation(
            async (_isUpload, _nhsNumber, _b, _h, _d, docs, _setDocs) => buildUploadSession(docs),
        );
        vi.spyOn(uploadDocumentsModule, 'uploadDocumentToS3').mockResolvedValue();
        vi.spyOn(documentUploadModule, 'startIntervalTimer').mockImplementation(
            (_uploadingDocuments, setInterval) => {
                setInterval(121);
                return 123;
            },
        );
    };

    describe('rendering', () => {
        it('renders the page header for upload journey', async () => {
            mockSuccessfulUpload();

            await act(async () => {
                renderComponent();
            });

            expect(screen.getByTestId('arf-upload-uploading-stage-header')).toHaveTextContent(
                'Your documents are uploading',
            );
        });

        it('renders the page header for restore journey', async () => {
            mockSuccessfulUpload();

            await act(async () => {
                renderComponent({ journey: 'restore' });
            });

            expect(screen.getByTestId('arf-upload-uploading-stage-header')).toHaveTextContent(
                'Restoring scanned paper notes',
            );
        });

        it('renders the page header for update journey', async () => {
            mockSuccessfulUpload();

            await act(async () => {
                renderComponent({ journey: 'update' });
            });

            expect(screen.getByTestId('arf-upload-uploading-stage-header')).toHaveTextContent(
                'Uploading additional files',
            );
        });

        it('renders the warning callout with stay on page message', async () => {
            mockSuccessfulUpload();

            await act(async () => {
                renderComponent();
            });

            expect(screen.getByText('Stay on this page')).toBeInTheDocument();
            expect(
                screen.getByText(/Do not close or navigate away from this page/),
            ).toBeInTheDocument();
        });

        it('renders the document filename in the table', async () => {
            mockSuccessfulUpload();

            await act(async () => {
                renderComponent();
            });

            expect(screen.getByText('test-file.pdf')).toBeInTheDocument();
        });

        it('renders the stitched warning text for stitched document config on upload', async () => {
            mockSuccessfulUpload();

            await act(async () => {
                renderComponent({
                    documentConfig: buildDocumentConfig({ stitched: true }),
                    journey: 'upload',
                });
            });

            expect(
                screen.getByText(
                    'Your files will be combined into one document when the upload is complete.',
                ),
            ).toBeInTheDocument();
        });
    });

    describe('prepareDocuments', () => {
        it('shows a loading spinner while prepareDocuments is running', async () => {
            let resolvePrepare: () => void;
            const preparePromise = new Promise<void>((resolve) => {
                resolvePrepare = resolve;
            });

            mockSuccessfulUpload();

            await act(async () => {
                renderComponent({
                    prepareDocuments: () => preparePromise,
                });
            });

            expect(screen.getByText('preparing upload')).toBeInTheDocument();

            await act(async () => {
                resolvePrepare!();
            });
        });

        it('calls prepareDocuments on mount', async () => {
            const mockPrepareDocuments = vi.fn().mockResolvedValue(undefined);

            mockSuccessfulUpload();

            await act(async () => {
                renderComponent({ prepareDocuments: mockPrepareDocuments });
            });

            expect(mockPrepareDocuments).toHaveBeenCalledTimes(1);
        });
    });

    describe('startUpload', () => {
        it('calls getUploadSession with correct parameters', async () => {
            const { getUploadSessionSpy } = mockSuccessfulUpload();

            await act(async () => {
                renderComponent({ documentReferenceId: 'doc-ref-123' });
            });

            expect(getUploadSessionSpy).toHaveBeenCalledWith(
                true,
                mockPatientDetails.nhsNumber,
                mockBaseUrl,
                mockBaseHeaders,
                'doc-ref-123',
                expect.arrayContaining([
                    expect.objectContaining({
                        state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    }),
                ]),
                expect.any(Function),
            );
        });

        it('calls uploadDocumentToS3 for each document', async () => {
            const { uploadToS3Spy } = mockSuccessfulUpload();

            await act(async () => {
                renderComponent();
            });

            expect(uploadToS3Spy).toHaveBeenCalled();
        });

        it('starts the interval timer after upload session is created', async () => {
            const { startIntervalSpy } = mockSuccessfulUpload();

            await act(async () => {
                renderComponent();
            });

            expect(startIntervalSpy).toHaveBeenCalled();
        });
    });

    describe('event callbacks - onAllFinished', () => {
        it('calls onAllFinished when all documents succeed', async () => {
            const mockOnAllFinished = vi.fn();

            mockUploadWithDocumentState(DOCUMENT_UPLOAD_STATE.SUCCEEDED);

            await act(async () => {
                renderComponent({ onAllFinished: mockOnAllFinished });
            });

            await waitFor(() => {
                expect(mockOnAllFinished).toHaveBeenCalled();
            });
        });

        it('navigates to HOME by default when all documents succeed and onAllFinished is not provided', async () => {
            mockUploadWithDocumentState(DOCUMENT_UPLOAD_STATE.SUCCEEDED);

            await act(async () => {
                renderComponent({ onAllFinished: undefined });
            });

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.HOME);
            });
        });
    });

    describe('event callbacks - onInfected', () => {
        it('calls onInfected when a document is infected', async () => {
            const mockOnInfected = vi.fn();

            mockUploadWithDocumentState(DOCUMENT_UPLOAD_STATE.INFECTED);

            await act(async () => {
                renderComponent({ onInfected: mockOnInfected });
            });

            await waitFor(() => {
                expect(mockOnInfected).toHaveBeenCalled();
            });
        });

        it('navigates to DOCUMENT_UPLOAD_INFECTED by default when onInfected is not provided', async () => {
            mockUploadWithDocumentState(DOCUMENT_UPLOAD_STATE.INFECTED);

            await act(async () => {
                renderComponent({ onInfected: undefined });
            });

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routeChildren.DOCUMENT_UPLOAD_INFECTED);
            });
        });
    });

    describe('event callbacks - onFailedDocument', () => {
        it('calls onFailedDocument when a document has an error', async () => {
            const mockOnFailedDocument = vi.fn();

            mockUploadWithDocumentState(DOCUMENT_UPLOAD_STATE.ERROR);

            await act(async () => {
                renderComponent({ onFailedDocument: mockOnFailedDocument });
            });

            await waitFor(() => {
                expect(mockOnFailedDocument).toHaveBeenCalledWith(
                    expect.objectContaining({
                        state: DOCUMENT_UPLOAD_STATE.ERROR,
                    }),
                );
            });
        });

        it('navigates to SERVER_ERROR by default when onFailedDocument is not provided', async () => {
            mockUploadWithDocumentState(DOCUMENT_UPLOAD_STATE.ERROR);

            await act(async () => {
                renderComponent({ onFailedDocument: undefined });
            });

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.SERVER_ERROR);
            });
        });
    });

    describe('event callbacks - onSessionExpired', () => {
        it('calls onSessionExpired on 403 error during getUploadSession', async () => {
            const mockOnSessionExpired = vi.fn();
            const error = new Error('Forbidden') as any;
            error.response = { status: 403 };

            vi.spyOn(documentUploadModule, 'getUploadSession').mockRejectedValue(error);

            await act(async () => {
                renderComponent({ onSessionExpired: mockOnSessionExpired });
            });

            await waitFor(() => {
                expect(mockOnSessionExpired).toHaveBeenCalled();
            });
        });

        it('navigates to SESSION_EXPIRED by default on 403 error', async () => {
            const error = new Error('Forbidden') as any;
            error.response = { status: 403 };

            vi.spyOn(documentUploadModule, 'getUploadSession').mockRejectedValue(error);

            await act(async () => {
                renderComponent({ onSessionExpired: undefined });
            });

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
            });
        });

        it('calls onSessionExpired when S3 upload returns 403', async () => {
            const mockOnSessionExpired = vi.fn();
            const error = new Error('Forbidden') as any;
            error.response = { status: 403 };

            mockSuccessfulUpload();
            vi.spyOn(uploadDocumentsModule, 'uploadDocumentToS3').mockRejectedValue(error);

            await act(async () => {
                renderComponent({ onSessionExpired: mockOnSessionExpired });
            });

            await waitFor(() => {
                expect(mockOnSessionExpired).toHaveBeenCalled();
            });
        });
    });

    describe('event callbacks - onUploadError', () => {
        it('calls onUploadError on non-403 error during getUploadSession', async () => {
            const mockOnUploadError = vi.fn();
            const error = new Error('Server Error') as any;
            error.response = { status: 500 };

            vi.spyOn(documentUploadModule, 'getUploadSession').mockRejectedValue(error);

            await act(async () => {
                renderComponent({ onUploadError: mockOnUploadError });
            });

            await waitFor(() => {
                expect(mockOnUploadError).toHaveBeenCalledWith(expect.objectContaining(error));
            });
        });

        it('navigates to SERVER_ERROR by default on non-403 error', async () => {
            const error = new Error('Server Error') as any;
            error.response = { status: 500 };

            vi.spyOn(documentUploadModule, 'getUploadSession').mockRejectedValue(error);

            await act(async () => {
                renderComponent({ onUploadError: undefined });
            });

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    expect.stringContaining(routes.SERVER_ERROR),
                );
            });
        });

        it('calls onUploadError when S3 upload returns non-403 error', async () => {
            const mockOnUploadError = vi.fn();
            const error = new Error('Upload failed') as any;
            error.response = { status: 500 };

            mockSuccessfulUpload();
            vi.spyOn(uploadDocumentsModule, 'uploadDocumentToS3').mockRejectedValue(error);

            await act(async () => {
                renderComponent({ onUploadError: mockOnUploadError });
            });

            await waitFor(() => {
                expect(mockOnUploadError).toHaveBeenCalled();
            });
        });
    });

    describe('event callbacks - onPollingTimeout', () => {
        it('calls onPollingTimeout when polling exceeds max timeout', async () => {
            const mockOnPollingTimeout = vi.fn();

            mockUploadWithPollingTimeout();

            await act(async () => {
                renderComponent({ onPollingTimeout: mockOnPollingTimeout });
            });

            await waitFor(() => {
                expect(mockOnPollingTimeout).toHaveBeenCalled();
            });
        });

        it('navigates to SERVER_ERROR by default when polling times out', async () => {
            mockUploadWithPollingTimeout();

            await act(async () => {
                renderComponent({ onPollingTimeout: undefined });
            });

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.SERVER_ERROR);
            });
        });
    });

    describe('navigation guards', () => {
        it('navigates to HOME if documents are not in SELECTED state on mount', async () => {
            const uploadingDoc = buildDocument(
                new File(['test'], 'test.pdf', { type: 'application/pdf' }),
                DOCUMENT_UPLOAD_STATE.UPLOADING,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            );

            await act(async () => {
                renderComponent({ initialDocuments: [uploadingDoc] });
            });

            expect(mockNavigate).toHaveBeenCalledWith(routes.HOME);
        });
    });

    describe('virus scanning display', () => {
        it('shows virus scan status when documents are in SCANNING state', async () => {
            const scanningDoc = buildDocument(
                new File(['test'], 'test.pdf', { type: 'application/pdf' }),
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            );

            mockUploadWithDocumentState(DOCUMENT_UPLOAD_STATE.SCANNING);

            await act(async () => {
                renderComponent({ initialDocuments: [scanningDoc] });
            });

            await waitFor(() => {
                expect(screen.getByText('Virus scan in progress...')).toBeInTheDocument();
            });
        });
    });
});
