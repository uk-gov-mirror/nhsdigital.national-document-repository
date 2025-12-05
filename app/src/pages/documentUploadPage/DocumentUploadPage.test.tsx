// need to use happy-dom for this test file as jsdom doesn't support DOMMatrix https://github.com/jsdom/jsdom/issues/2647
// @vitest-environment happy-dom
import { render, RenderResult, screen, waitFor } from '@testing-library/react';
import DocumentUploadPage from './DocumentUploadPage';
import {
    buildPatientDetails,
    buildLgFile,
    buildUploadSession,
    buildConfig,
    buildDocument,
} from '../../helpers/test/testBuilders';
import usePatient from '../../helpers/hooks/usePatient';
import useConfig from '../../helpers/hooks/useConfig';
import useBaseAPIHeaders from '../../helpers/hooks/useBaseAPIHeaders';
import useBaseAPIUrl from '../../helpers/hooks/useBaseAPIUrl';
import * as ReactRouter from 'react-router-dom';
import { createMemoryHistory } from 'history';
import uploadDocuments, {
    getDocumentStatus,
    uploadDocumentToS3,
} from '../../helpers/requests/uploadDocuments';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import {
    DOCUMENT_UPLOAD_STATE,
    DOCUMENT_STATUS,
} from '../../types/pages/UploadDocumentsPage/types';
import { routeChildren, routes } from '../../types/generic/routes';
import { DocumentStatusResult } from '../../types/generic/uploadResult';
import userEvent from '@testing-library/user-event';
import { DOCUMENT_TYPE } from '../../helpers/utils/documentType';

vi.mock('axios');
vi.mock('../../helpers/hooks/useConfig');
vi.mock('../../helpers/hooks/usePatient');
vi.mock('../../helpers/hooks/useBaseAPIHeaders');
vi.mock('../../helpers/hooks/useBaseAPIUrl');
vi.mock('../../helpers/requests/uploadDocuments');
vi.mock('pdfjs-dist', () => ({
    getDocument: vi.fn(() => ({
        promise: Promise.resolve({
            numPages: 1,
            getPage: (): Promise<any> => Promise.resolve({}),
        }),
    })),
}));

const mockPatientDetails = buildPatientDetails();
const mockedUsePatient = usePatient as Mock;
const mockNavigate = vi.fn();
const mockUseConfig = useConfig as Mock;
const mockUseBaseAPIHeaders = useBaseAPIHeaders as Mock;
const mockUseBaseAPIUrl = useBaseAPIUrl as Mock;
const mockUploadDocuments = uploadDocuments as Mock;
const mockGetDocumentStatus = getDocumentStatus as Mock;
const mockUploadDocumentToS3 = uploadDocumentToS3 as Mock;

vi.mock('react-router-dom', async () => ({
    ...(await vi.importActual('react-router-dom')),
    useNavigate: (): Mock => mockNavigate,
    useLocation: (): any => ({
        pathname: '/patient/document-upload',
        state: {},
        search: '',
        hash: '',
        key: 'default',
    }),
}));

const mockUseLocation = vi.fn();
vi.spyOn(ReactRouter, 'useLocation').mockImplementation(mockUseLocation);

const baseUrl = 'http://localhost';
const baseHeaders = { Authorization: 'Bearer token' };

describe('DocumentUploadPage', (): void => {
    beforeEach(() => {
        vi.useFakeTimers();
        import.meta.env.VITE_ENVIRONMENT = 'vitest';

        // Mock globalThis.location
        delete (globalThis as any).location;
        globalThis.location = {
            search: '',
        } as any;
        mockedUsePatient.mockReturnValue(mockPatientDetails);
        mockUseConfig.mockReturnValue(
            buildConfig(
                {},
                {
                    uploadLambdaEnabled: true,
                    uploadLloydGeorgeWorkflowEnabled: true,
                    uploadDocumentIteration3Enabled: false,
                },
            ),
        );
        mockUseBaseAPIUrl.mockReturnValue(baseUrl);
        mockUseBaseAPIHeaders.mockReturnValue(baseHeaders);
        mockUseLocation.mockReturnValue({
            pathname: '/patient/document-upload',
            state: {},
            search: '',
            hash: '',
            key: 'default',
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    const renderPage = async (): Promise<RenderResult> => {
        const history = createMemoryHistory({
            initialEntries: ['/patient/document-upload'],
            initialIndex: 0,
        });

        return render(
            <ReactRouter.Router location={history.location} navigator={history}>
                <ReactRouter.Routes>
                    <ReactRouter.Route
                        path="/patient/document-upload/*"
                        element={<DocumentUploadPage />}
                    />
                </ReactRouter.Routes>
            </ReactRouter.Router>,
        );
    };

    describe('Feature flags', () => {
        it('redirects to home when uploadLambdaEnabled is false', async () => {
            mockUseConfig.mockReturnValue(
                buildConfig(
                    {},
                    {
                        uploadLambdaEnabled: false,
                        uploadLloydGeorgeWorkflowEnabled: true,
                    },
                ),
            );

            await renderPage();

            expect(mockNavigate).toHaveBeenCalledWith(routes.HOME);
        });

        it('redirects to home when uploadLloydGeorgeWorkflowEnabled is false', async () => {
            mockUseConfig.mockReturnValue(
                buildConfig(
                    {},
                    {
                        uploadLambdaEnabled: true,
                        uploadLloydGeorgeWorkflowEnabled: false,
                    },
                ),
            );

            await renderPage();

            expect(mockNavigate).toHaveBeenCalledWith(routes.HOME);
        });

        it('renders page when both feature flags are enabled', async () => {
            vi.useRealTimers(); // Use real timers for this test

            mockUseConfig.mockReturnValue(
                buildConfig(
                    {},
                    {
                        uploadLambdaEnabled: true,
                        uploadLloydGeorgeWorkflowEnabled: true,
                        uploadDocumentIteration3Enabled: false,
                    },
                ),
            );

            const { container } = await renderPage();
            expect(container).toBeInTheDocument();

            await waitFor(() => {
                const pageTitle = screen.getByTestId('page-title');
                expect(pageTitle).toBeInTheDocument();
                expect(pageTitle).toHaveTextContent('Choose Lloyd George files to upload');
            });

            vi.useFakeTimers(); // Reset back to fake timers
        });

        it('renders doc type select index when iteration3 flag is enabled', async () => {
            vi.useRealTimers(); // Use real timers for this test

            mockUseConfig.mockReturnValue(
                buildConfig(
                    {},
                    {
                        uploadLambdaEnabled: true,
                        uploadLloydGeorgeWorkflowEnabled: true,
                        uploadDocumentIteration3Enabled: true,
                    },
                ),
            );

            const { container } = await renderPage();
            expect(container).toBeInTheDocument();

            await waitFor(() => {
                expect(screen.getByTestId('page-title')).toHaveTextContent(
                    'Choose a document type to upload',
                );
            });

            vi.useFakeTimers(); // Reset back to fake timers
        });

        it('navigates to file select page when iteration3 flag is enabled and doc type selected', async () => {
            vi.useRealTimers(); // Use real timers for this test

            mockUseConfig.mockReturnValue(
                buildConfig(
                    {},
                    {
                        uploadLambdaEnabled: true,
                        uploadLloydGeorgeWorkflowEnabled: true,
                        uploadDocumentIteration3Enabled: true,
                    },
                ),
            );

            const { container } = await renderPage();
            expect(container).toBeInTheDocument();

            let docTypeLink: HTMLElement;

            await waitFor(() => {
                docTypeLink = screen.getByTestId(`upload-${DOCUMENT_TYPE.LLOYD_GEORGE}-link`);
                expect(docTypeLink).toBeInTheDocument();
            });

            await userEvent.click(docTypeLink!);

            expect(mockNavigate).toHaveBeenCalledWith(routeChildren.DOCUMENT_UPLOAD_SELECT_FILES);

            vi.useFakeTimers(); // Reset back to fake timers
        });
    });

    describe('Update journey validation', () => {
        it('loads existing documents for update journey', async () => {
            const mockBlob = new Blob(['test'], { type: 'application/pdf' });
            mockUseLocation.mockReturnValue({
                pathname: '/patient/document-upload?journey=update',
                state: {
                    journey: 'update',
                    existingDocuments: [
                        {
                            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                            blob: mockBlob,
                            fileName: 'test.pdf',
                            documentId: 'doc-123',
                        },
                    ],
                },
                search: '?journey=update',
                hash: '',
                key: 'default',
            });

            const { container } = await renderPage();

            expect(container).toBeInTheDocument();
            expect(mockNavigate).not.toHaveBeenCalledWith(routes.SERVER_ERROR);
        });
    });

    describe('Document upload flow', () => {
        it('handles successful document upload', async () => {
            const testFile = buildLgFile(1);
            const testDocument = buildDocument(
                testFile,
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            );
            const mockUploadSession = buildUploadSession([testDocument]);

            mockUploadDocuments.mockResolvedValue(mockUploadSession);
            mockUploadDocumentToS3.mockResolvedValue({ status: 200 });

            await renderPage();

            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('handles document status polling', async () => {
            const testFile = buildLgFile(1);
            const testDocument = buildDocument(
                testFile,
                DOCUMENT_UPLOAD_STATE.UPLOADING,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            );

            testDocument.ref = 'test-ref-123';

            const mockStatusResult: DocumentStatusResult = {
                'test-ref-123': {
                    status: DOCUMENT_STATUS.FINAL,
                },
            };

            mockGetDocumentStatus.mockResolvedValue(mockStatusResult);

            await renderPage();

            expect(mockNavigate).not.toHaveBeenCalled();
        });
    });

    describe('Interval timer management', () => {
        it('clears interval on component unmount', async () => {
            const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

            const { unmount } = await renderPage();

            unmount();

            expect(clearIntervalSpy).toHaveBeenCalled();
        });
    });
});
