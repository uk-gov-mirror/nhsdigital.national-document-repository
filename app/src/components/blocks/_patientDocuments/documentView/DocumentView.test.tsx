import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import DocumentView from './DocumentView';
import usePatient from '../../../../helpers/hooks/usePatient';
import useTitle from '../../../../helpers/hooks/useTitle';
import {
    DOCUMENT_TYPE,
    GetConfigForDocTypeGenericType,
    getConfigForDocTypeGeneric,
} from '../../../../helpers/utils/documentType';
import { DocumentReference } from '../../../../types/pages/documentSearchResultsPage/types';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { buildDocumentConfig, buildPatientDetails } from '../../../../helpers/test/testBuilders';
import userEvent from '@testing-library/user-event';
import { getFormattedDate } from '../../../../helpers/utils/formatDate';
import { ACTION_LINK_KEY } from '../../../../types/blocks/lloydGeorgeActions';
import SessionProvider from '../../../../providers/sessionProvider/SessionProvider';
import { createMemoryHistory } from 'history';
import * as ReactRouter from 'react-router-dom';
import { REPOSITORY_ROLE } from '../../../../types/generic/authRole';
import useRole from '../../../../helpers/hooks/useRole';

// Mock dependencies
vi.mock('../../../../helpers/hooks/usePatient');
vi.mock('../../../../helpers/hooks/useConfig');
vi.mock('../../../../helpers/hooks/useTitle');
vi.mock('../../../../helpers/hooks/useRole');
var realGetConfigForDocTypeGeneric: GetConfigForDocTypeGenericType;

vi.mock('../../../../helpers/utils/documentType', async () => {
    const actual = await vi.importActual<typeof import('../../../../helpers/utils/documentType')>(
        '../../../../helpers/utils/documentType',
    );
    realGetConfigForDocTypeGeneric = actual.getConfigForDocTypeGeneric;
    return {
        ...actual,
        getConfigForDocTypeGeneric: vi.fn(actual.getConfigForDocTypeGeneric),
    };
});
vi.mock('../../../../providers/analyticsProvider/AnalyticsProvider', () => ({
    useAnalyticsContext: vi.fn(() => [null, vi.fn()]),
}));
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockUseNavigate,
        createSearchParams: (): Mock => mockCreateSearchParams,
    };
});

const mockUsePatient = usePatient as Mock;
const mockUseTitle = useTitle as Mock;
const mockUseRole = useRole as Mock;
const mockUseNavigate = vi.fn();
const mockRemoveDocument = vi.fn();
const mockCreateSearchParams = vi.fn();

const EMBEDDED_PDF_VIEWER_TITLE = 'Embedded PDF Viewer';

const mockDocumentReference: DocumentReference = {
    id: 'test-id',
    fileName: 'test-document.pdf',
    author: 'Y12345',
    created: '2023-01-01T10:00:00Z',
    url: 'https://example.com/document.pdf',
    contentType: 'application/pdf',
    documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
    version: '1',
    virusScannerResult: 'clean',
    fileSize: 1024,
    isPdf: true,
};

const mockDocumentRefNotPDF: DocumentReference = {
    id: 'test-id',
    fileName: 'test-document.pdf',
    author: 'Y12345',
    created: '2023-01-01T10:00:00Z',
    url: 'https://example.com/document.pdf',
    contentType: '',
    documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
    version: '1',
    virusScannerResult: 'clean',
    fileSize: 1024,
    isPdf: false,
};

const mockPatientDetails = buildPatientDetails();

const simulateFullscreenChange = (isFullscreen: boolean): void => {
    act(() => {
        // Update the fullscreenElement property to simulate browser state
        Object.defineProperty(document, 'fullscreenElement', {
            writable: true,
            configurable: true,
            value: isFullscreen ? document.documentElement : null,
        });

        // Dispatch the fullscreenchange event
        document.dispatchEvent(new Event('fullscreenchange'));
    });
};

const renderComponent = (
    documentReference: DocumentReference | null = mockDocumentReference,
): void => {
    const history = createMemoryHistory();
    render(
        <SessionProvider sessionOverride={{ isLoggedIn: true }}>
            <ReactRouter.Router navigator={history} location={history.location}>
                <DocumentView
                    documentReference={documentReference}
                    removeDocument={mockRemoveDocument}
                />
            </ReactRouter.Router>
        </SessionProvider>,
    );
};

describe('DocumentView', () => {
    const mockExitFullscreen = vi.fn();
    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockUsePatient.mockReturnValue(mockPatientDetails);
        mockUseRole.mockReturnValue(REPOSITORY_ROLE.GP_ADMIN);

        vi.mocked(getConfigForDocTypeGeneric).mockImplementation(realGetConfigForDocTypeGeneric);

        // Mock fullscreen API
        Object.defineProperty(document, 'fullscreenEnabled', {
            writable: true,
            configurable: true,
            value: true,
        });

        Object.defineProperty(document, 'fullscreenElement', {
            writable: true,
            configurable: true,
            value: null,
        });

        Object.defineProperty(document, 'exitFullscreen', {
            writable: true,
            configurable: true,
            value: mockExitFullscreen,
        });

        // Mock fetch
        global.fetch = vi.fn().mockResolvedValue({
            blob: () => Promise.resolve(new Blob()),
        });
    });

    describe('Component rendering', () => {
        it('renders the document view with all components', () => {
            renderComponent();

            expect(screen.getByText('Lloyd George records')).toBeInTheDocument();
            expect(screen.getByTestId('patient-summary')).toBeInTheDocument();
            expect(screen.getByTestId('go-back-button')).toBeInTheDocument();
        });

        it('sets the page title correctly', () => {
            renderComponent();

            expect(mockUseTitle).toHaveBeenCalledWith({ pageTitle: 'Lloyd George records' });
        });

        it('navigates to patient documents when documentReference is null', () => {
            renderComponent(null);

            expect(mockUseNavigate).toHaveBeenCalledWith(routes.PATIENT_DOCUMENTS);
        });
    });

    describe('Fullscreen mode', () => {
        it('shows full screen mode with patient info', async () => {
            const patientName = `${mockPatientDetails.familyName}, ${mockPatientDetails.givenName}`;
            const dob = getFormattedDate(new Date(mockPatientDetails.birthDate));

            renderComponent();

            await screen.findByTitle(EMBEDDED_PDF_VIEWER_TITLE);
            await userEvent.click(screen.getByText('View in full screen'));

            // Simulate the browser entering fullscreen
            simulateFullscreenChange(true);

            await screen.findByText('Exit full screen');

            expect(screen.getByText(patientName)).toBeInTheDocument();
            expect(screen.getByText(new RegExp(dob))).toBeInTheDocument();
            expect(screen.getByText(/NHS number/)).toBeInTheDocument();
        });

        it('shows deceased tag for deceased patients', async () => {
            mockUsePatient.mockReturnValue(buildPatientDetails({ deceased: true }));
            renderComponent();

            expect(screen.getByTestId('deceased-patient-tag')).toBeInTheDocument();
        });

        it('returns to regular view when exiting full screen', async () => {
            renderComponent();

            await userEvent.click(await screen.findByText('View in full screen'));
            // Simulate entering fullscreen
            simulateFullscreenChange(true);

            await userEvent.click(await screen.findByText('Exit full screen'));
            // Simulate exiting fullscreen
            simulateFullscreenChange(false);

            expect(screen.getByText('View in full screen')).toBeInTheDocument();
        });

        it('should navigate to logout page when sign out is clicked in fullscreen', async () => {
            renderComponent();

            await screen.findByTitle(EMBEDDED_PDF_VIEWER_TITLE);
            await userEvent.click(screen.getByText('View in full screen'));

            // Simulate the browser entering fullscreen
            simulateFullscreenChange(true);

            const signOutButton = screen.getByTestId('sign-out-link');
            fireEvent.click(signOutButton);

            await waitFor(() => {
                expect(mockExitFullscreen).toHaveBeenCalled();
                expect(mockUseNavigate).toHaveBeenCalledWith(routes.LOGOUT);
            });
        });
    });

    describe('Document details', () => {
        it('displays formatted creation date', () => {
            renderComponent();

            expect(screen.queryByTestId('document-file-name')).not.toBeInTheDocument();
            expect(screen.getByText(/Created by practice:/)).toBeInTheDocument();
        });

        it('displays document type label in record card', () => {
            renderComponent();

            expect(screen.getByTestId('record-card-container')).toHaveTextContent(
                buildDocumentConfig().content.viewDocumentTitle as string,
            );
        });

        it('displays file name, document is not a PDF', () => {
            renderComponent(mockDocumentRefNotPDF);

            expect(screen.queryByTestId('document-file-name')).toBeInTheDocument();
        });
    });

    describe('Add Files functionality', () => {
        it('navigates to upload page when add files is clicked', async () => {
            renderComponent();

            const addFilesButton = screen.getByTestId(ACTION_LINK_KEY.ADD);
            fireEvent.click(addFilesButton);

            await waitFor(() => {
                expect(mockUseNavigate).toHaveBeenCalledWith(
                    expect.objectContaining({
                        pathname: routeChildren.DOCUMENT_UPLOAD_SELECT_FILES,
                    }),
                    expect.objectContaining({
                        state: expect.objectContaining({
                            journey: 'update',
                            existingDocuments: expect.arrayContaining([
                                expect.objectContaining({
                                    fileName: mockDocumentReference.fileName,
                                }),
                            ]),
                        }),
                    }),
                );
            });
        });

        it('navigates to server error when patient has no NHS number', async () => {
            mockUsePatient.mockReturnValue({ nhsNumber: null });

            renderComponent();

            const addFilesButton = screen.getByTestId(ACTION_LINK_KEY.ADD);
            fireEvent.click(addFilesButton);

            await waitFor(() => {
                expect(mockUseNavigate).toHaveBeenCalledWith(routes.SERVER_ERROR);
            });
        });

        it.each([
            {
                canBeUpdated: true,
                role: REPOSITORY_ROLE.GP_ADMIN,
                deceased: false,
                fullscreen: false,
                addBtnVisible: true,
            },
            {
                canBeUpdated: true,
                role: REPOSITORY_ROLE.GP_CLINICAL,
                deceased: false,
                fullscreen: false,
                addBtnVisible: true,
            },
            {
                canBeUpdated: true,
                role: REPOSITORY_ROLE.PCSE,
                deceased: false,
                fullscreen: false,
                addBtnVisible: false,
            },
            {
                canBeUpdated: true,
                role: REPOSITORY_ROLE.GP_ADMIN,
                deceased: true,
                fullscreen: false,
                addBtnVisible: false,
            },
            {
                canBeUpdated: false,
                role: REPOSITORY_ROLE.GP_ADMIN,
                deceased: false,
                fullscreen: false,
                addBtnVisible: false,
            },
            {
                canBeUpdated: false,
                role: REPOSITORY_ROLE.GP_ADMIN,
                deceased: false,
                fullscreen: true,
                addBtnVisible: false,
            },
        ])(
            'displays add button when %s',
            async ({ canBeUpdated, role, deceased, fullscreen, addBtnVisible }) => {
                vi.mocked(getConfigForDocTypeGeneric).mockImplementation(
                    (docType) =>
                        ({
                            ...realGetConfigForDocTypeGeneric(docType),
                            canBeUpdated,
                        }) as any,
                );

                mockUseRole.mockReturnValue(role);
                mockUsePatient.mockReturnValue(buildPatientDetails({ deceased }));

                renderComponent();

                if (fullscreen) {
                    await screen.findByTitle(EMBEDDED_PDF_VIEWER_TITLE);
                    await userEvent.click(screen.getByText('View in full screen'));

                    // Simulate the browser entering fullscreen
                    simulateFullscreenChange(true);
                }

                await waitFor(() => {
                    expect(screen.queryAllByTestId(ACTION_LINK_KEY.ADD)).toHaveLength(
                        addBtnVisible ? 1 : 0,
                    );
                });
            },
        );
    });

    describe('Document actions', () => {
        it('calls removeDocument when remove action is triggered', () => {
            renderComponent();

            const removeRecordLink = screen.getByTestId(ACTION_LINK_KEY.DELETE);
            fireEvent.click(removeRecordLink);
            expect(mockRemoveDocument).toHaveBeenCalled();
        });

        it('navigates to download success page when download action is triggered', () => {
            vi.useFakeTimers();
            renderComponent();

            const downloadRecordLink = screen.getByTestId(ACTION_LINK_KEY.DOWNLOAD);
            fireEvent.click(downloadRecordLink);

            vi.advanceTimersByTime(5000000);
            expect(mockUseNavigate).toHaveBeenCalledWith(routes.DOWNLOAD_COMPLETE);
            vi.useRealTimers();
        });

        it('does not show reassign button when document type does not support it', () => {
            vi.mocked(getConfigForDocTypeGeneric).mockImplementation(
                (docType) =>
                    ({
                        ...realGetConfigForDocTypeGeneric(docType),
                        canBeUpdated: false,
                    }) as any,
            );

            renderComponent();

            const reassignRecordLink = screen.queryByTestId(ACTION_LINK_KEY.REASSIGN);
            expect(reassignRecordLink).not.toBeInTheDocument();
        });

        it('does not show reassign button when patient is deceased', () => {
            mockUsePatient.mockReturnValue(buildPatientDetails({ deceased: true }));

            renderComponent();

            const reassignRecordLink = screen.queryByTestId(ACTION_LINK_KEY.REASSIGN);
            expect(reassignRecordLink).not.toBeInTheDocument();
        });

        it('navigates to document reassign page when reassign action is triggered', async () => {
            renderComponent();

            const reassignRecordLink = screen.getByTestId(ACTION_LINK_KEY.REASSIGN);
            await userEvent.click(reassignRecordLink);

            expect(mockUseNavigate).toHaveBeenCalledWith(
                expect.objectContaining({
                    pathname: routeChildren.DOCUMENT_REASSIGN_SELECT_PAGES,
                }),
                expect.objectContaining({
                    state: expect.objectContaining({
                        documentReference: mockDocumentReference,
                    }),
                }),
            );
        });

        it('navigates to version history page when version history action is triggered', async () => {
            renderComponent();

            const versionHistoryLink = screen.getByTestId(ACTION_LINK_KEY.HISTORY);
            await userEvent.click(versionHistoryLink);

            await waitFor(() => {
                expect(mockUseNavigate).toHaveBeenCalledWith(
                    expect.objectContaining({
                        pathname: routeChildren.DOCUMENT_VERSION_HISTORY,
                    }),
                    expect.objectContaining({
                        state: expect.objectContaining({
                            documentReference: mockDocumentReference,
                        }),
                    }),
                );
            });
        });

        it('shows version history action for deceased patients', () => {
            mockUsePatient.mockReturnValue(buildPatientDetails({ deceased: true }));

            renderComponent();

            expect(screen.getByTestId(ACTION_LINK_KEY.HISTORY)).toBeInTheDocument();
        });
    });

    describe('Role-based rendering', () => {
        it('shows menu for GP_ADMIN role when not in fullscreen', () => {
            renderComponent();

            // Menu should be available for GP_ADMIN
            expect(screen.getByTestId('record-menu-card')).toBeInTheDocument();
        });

        it('does not show menu when in fullscreen mode', async () => {
            renderComponent();

            await screen.findByTitle(EMBEDDED_PDF_VIEWER_TITLE);
            await userEvent.click(screen.getByText('View in full screen'));

            // Simulate the browser entering fullscreen
            simulateFullscreenChange(true);

            // Check that fullscreen layout is different
            expect(screen.getByText('Exit full screen')).toBeInTheDocument();
            expect(screen.queryByTestId('record-menu-card')).not.toBeInTheDocument();
        });
    });
});
