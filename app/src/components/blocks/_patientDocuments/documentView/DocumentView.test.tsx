import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import DocumentView from './DocumentView';
import usePatient from '../../../../helpers/hooks/usePatient';
import useTitle from '../../../../helpers/hooks/useTitle';
import { DOCUMENT_TYPE, getDocumentTypeLabel } from '../../../../helpers/utils/documentType';
import { DocumentReference } from '../../../../types/pages/documentSearchResultsPage/types';
import { routes } from '../../../../types/generic/routes';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';
import userEvent from '@testing-library/user-event';
import { getFormattedDate } from '../../../../helpers/utils/formatDate';
import { lloydGeorgeRecordLinks } from '../../../../types/blocks/lloydGeorgeActions';
import SessionProvider from '../../../../providers/sessionProvider/SessionProvider';
import { createMemoryHistory } from 'history';
import * as ReactRouter from 'react-router-dom';
import { REPOSITORY_ROLE } from '../../../../types/generic/authRole';
import useRole from '../../../../helpers/hooks/useRole';

// Mock dependencies
vi.mock('../../../../helpers/hooks/usePatient');
vi.mock('../../../../helpers/hooks/useTitle');
vi.mock('../../../../helpers/hooks/useRole');
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockUseNavigate,
        createSearchParams: () => mockCreateSearchParams,
    };
});

const mockUsePatient = usePatient as Mock;
const mockUseTitle = useTitle as Mock;
const mockUseRole = useRole as Mock;
const mockUseNavigate = vi.fn();
const mockRemoveDocuments = vi.fn();
const mockCreateSearchParams = vi.fn();

const EMBEDDED_PDF_VIEWER_TITLE = 'Embedded PDF Viewer';

const mockDocumentReference: DocumentReference = {
    id: 'test-id',
    fileName: 'test-document.pdf',
    created: '2023-01-01T10:00:00Z',
    url: 'https://example.com/document.pdf',
    contentType: 'application/pdf',
    documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
    version: '1',
    virusScannerResult: 'clean',
    fileSize: 1024,
    isPdf: true,
};

const mockPatientDetails = buildPatientDetails();

const simulateFullscreenChange = (isFullscreen: boolean) => {
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

type Props = {
    documentReference: DocumentReference | null;
};

const TestApp = ({ documentReference }: Props) => {
    const history = createMemoryHistory();
    return (
        <ReactRouter.Router navigator={history} location={history.location}>
            <DocumentView
                documentReference={documentReference}
                removeDocuments={mockRemoveDocuments}
            />
        </ReactRouter.Router>
    );
};

const renderComponent = (documentReference: DocumentReference | null = mockDocumentReference) => {
    render(
        <SessionProvider sessionOverride={{ isLoggedIn: true }}>
            <TestApp documentReference={documentReference} />
        </SessionProvider>,
    );
};

describe('DocumentView', () => {
    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockUsePatient.mockReturnValue(mockPatientDetails);
        mockUseRole.mockReturnValue(REPOSITORY_ROLE.GP_ADMIN);

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
    });

    describe('Document details', () => {
        it('displays formatted creation date', () => {
            renderComponent();

            expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
        });

        it.each(
            Array.from(Object.values(DOCUMENT_TYPE)).filter((type) => type !== DOCUMENT_TYPE.ALL),
        )('displays document type label in record card when doc type is %s', (documentType) => {
            renderComponent({
                ...mockDocumentReference,
                documentSnomedCodeType: documentType,
            });

            expect(screen.getByTestId('record-card-container')).toHaveTextContent(
                getDocumentTypeLabel(documentType),
            );
        });
    });

    describe('Add Files functionality', () => {
        it('shows add files section for Lloyd George documents when not in fullscreen', () => {
            renderComponent();

            expect(screen.getByTestId('add-files-btn')).toBeInTheDocument();
        });

        it('does not show add files section when in fullscreen', async () => {
            renderComponent();

            await screen.findByTitle(EMBEDDED_PDF_VIEWER_TITLE);
            await userEvent.click(screen.getByText('View in full screen'));

            // Simulate the browser entering fullscreen
            simulateFullscreenChange(true);

            expect(screen.queryByText('Add Files')).not.toBeInTheDocument();
        });

        it('does not show add files section for non-Lloyd George documents', () => {
            const nonLGDocument = {
                ...mockDocumentReference,
                documentSnomedCodeType: DOCUMENT_TYPE.EHR,
            };

            renderComponent(nonLGDocument);

            expect(screen.queryByText('Add Files')).not.toBeInTheDocument();
        });

        it('navigates to upload page when add files is clicked', async () => {
            renderComponent();

            const addFilesButton = screen.getByTestId('add-files-btn');
            fireEvent.click(addFilesButton);

            await waitFor(() => {
                expect(mockUseNavigate).toHaveBeenCalledWith(
                    expect.objectContaining({
                        pathname: routes.DOCUMENT_UPLOAD,
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

            const addFilesButton = screen.getByTestId('add-files-btn');
            fireEvent.click(addFilesButton);

            await waitFor(() => {
                expect(mockUseNavigate).toHaveBeenCalledWith(routes.SERVER_ERROR);
            });
        });
    });

    describe('Document actions', () => {
        it('calls removeDocuments when remove action is triggered', () => {
            renderComponent();

            // Assuming the first record link is remove action
            const removeRecordLink = screen.getByTestId(lloydGeorgeRecordLinks[0].key);
            fireEvent.click(removeRecordLink);
            expect(mockRemoveDocuments).toHaveBeenCalledWith(
                mockDocumentReference.documentSnomedCodeType,
            );
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
