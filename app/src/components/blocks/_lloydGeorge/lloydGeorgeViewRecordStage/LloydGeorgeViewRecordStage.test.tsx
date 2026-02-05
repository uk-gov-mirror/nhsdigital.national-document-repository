// Imports
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import * as ReactRouter from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';

import LloydGeorgeViewRecordStage, { Props } from './LloydGeorgeViewRecordStage';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { DOWNLOAD_STAGE } from '../../../../types/generic/downloadStage';
import { REPOSITORY_ROLE } from '../../../../types/generic/authRole';
import { LG_RECORD_STAGE } from '../../../../types/blocks/lloydGeorgeStages';
import { getFormattedDate } from '../../../../helpers/utils/formatDate';

import usePatient from '../../../../helpers/hooks/usePatient';
import useRole from '../../../../helpers/hooks/useRole';
import useConfig from '../../../../helpers/hooks/useConfig';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import getDocumentSearchResults from '../../../../helpers/requests/getDocumentSearchResults';

import {
    buildPatientDetails,
    buildLgSearchResult,
    buildConfig,
} from '../../../../helpers/test/testBuilders';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import SessionProvider from '../../../../providers/sessionProvider/SessionProvider';

// Mocks
vi.mock('../../../../helpers/hooks/usePatient');
vi.mock('../../../../helpers/hooks/useRole');
vi.mock('../../../../helpers/hooks/useConfig');
vi.mock('../../../../helpers/hooks/useBaseAPIUrl');
vi.mock('../../../../helpers/hooks/useBaseAPIHeaders');
vi.mock('../../../../helpers/requests/getDocumentSearchResults');
vi.mock('../../../../providers/analyticsProvider/AnalyticsProvider', () => ({
    useAnalyticsContext: vi.fn(() => [null, vi.fn()]),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        Link: (props: ReactRouter.LinkProps): React.JSX.Element => <a {...props} role="link" />,
        useNavigate: (): Mock => mockNavigate,
    };
});

// Constants
const mockNavigate = vi.fn();
const mockedUsePatient = usePatient as Mock;
const mockedUseRole = useRole as Mock;
const mockUseConfig = useConfig as Mock;
const mockUseBaseAPIUrl = useBaseAPIUrl as Mock;
const mockUseBaseAPIHeaders = useBaseAPIHeaders as Mock;
const mockGetDocumentSearchResults = getDocumentSearchResults as Mock;

const mockPdf = buildLgSearchResult();
const mockPatientDetails = buildPatientDetails();

const EMBEDDED_PDF_VIEWER_TITLE = 'Embedded PDF Viewer';

// Test helpers
const TestApp = (props: Omit<Props, 'setStage' | 'stage'>): React.JSX.Element => {
    const history = createMemoryHistory();
    return (
        <ReactRouter.Router navigator={history} location={history.location}>
            <LloydGeorgeViewRecordStage
                {...props}
                setStage={vi.fn()}
                stage={LG_RECORD_STAGE.RECORD}
            />
        </ReactRouter.Router>
    );
};

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

const renderComponent = (propsOverride?: Partial<Props>): void => {
    const props: Omit<Props, 'setStage' | 'stage'> = {
        downloadStage: DOWNLOAD_STAGE.SUCCEEDED,
        lastUpdated: mockPdf.lastUpdated,
        refreshRecord: vi.fn(),
        pdfObjectUrl: 'http://test.com',
        showMenu: true,
        resetDocState: vi.fn(),
        ...propsOverride,
    };

    render(
        <SessionProvider sessionOverride={{ isLoggedIn: true }}>
            <TestApp {...props} />
        </SessionProvider>,
    );
};

describe('<LloydGeorgeViewRecordStage />', () => {
    const mockExitFullscreen = vi.fn();
    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockedUsePatient.mockReturnValue(mockPatientDetails);
        mockUseConfig.mockReturnValue(buildConfig());

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

        mockUseBaseAPIUrl.mockReturnValue('http://test-api.com');
        mockUseBaseAPIHeaders.mockReturnValue({ Authorization: 'Bearer token' });
        mockedUseRole.mockReturnValue(REPOSITORY_ROLE.GP_ADMIN);

        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('shows LG record content and hides empty state', async () => {
            renderComponent();

            await screen.findByTitle(EMBEDDED_PDF_VIEWER_TITLE);

            expect(screen.getByText('View in full screen')).toBeInTheDocument();
            expect(screen.getByText('Lloyd George record')).toBeInTheDocument();
            expect(screen.getByText(`Last updated: ${mockPdf.lastUpdated}`)).toBeInTheDocument();
            expect(
                screen.queryByText(/This patient does not have a Lloyd George record/i),
            ).not.toBeInTheDocument();
        });

        it.each([DOWNLOAD_STAGE.INITIAL, DOWNLOAD_STAGE.PENDING, DOWNLOAD_STAGE.REFRESH])(
            'shows loading indicator for download stage: %s',
            async (stage) => {
                renderComponent({ downloadStage: stage, pdfObjectUrl: '' });

                expect(screen.getByRole('progressbar', { name: 'Loading...' })).toBeInTheDocument();
            },
        );

        it('renders empty state when there is no LG record', async () => {
            renderComponent({ downloadStage: DOWNLOAD_STAGE.NO_RECORDS });
            expect(
                screen.getByText(
                    'This patient does not have a Lloyd George record stored in this service.',
                ),
            ).toBeInTheDocument();
        });

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
            mockedUsePatient.mockReturnValue(buildPatientDetails({ deceased: true }));
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

        it.each([[REPOSITORY_ROLE.GP_ADMIN], [REPOSITORY_ROLE.GP_CLINICAL]])(
            'does not show callout/button for role: %s',
            async (role) => {
                mockedUseRole.mockReturnValue(role);
                renderComponent();

                expect(screen.queryByText('Before downloading')).not.toBeInTheDocument();
                expect(
                    screen.queryByRole('button', { name: 'Download and remove files' }),
                ).not.toBeInTheDocument();
            },
        );

        it('renders Add Files button when upload 2 is enabled and patient already has a record', () => {
            mockUseConfig.mockReturnValueOnce(
                buildConfig({}, { uploadDocumentIteration2Enabled: true }),
            );

            renderComponent({ downloadStage: DOWNLOAD_STAGE.SUCCEEDED });

            expect(screen.getByTestId('add-files-btn')).toBeInTheDocument();
        });

        it('does not render cannot upload content when upload is disabled and patient already has a record', () => {
            renderComponent({ downloadStage: DOWNLOAD_STAGE.SUCCEEDED });

            expect(screen.queryByText('Uploading files')).not.toBeInTheDocument();
        });

        it('does not render cannot upload content when upload is enabled and patient has no record', () => {
            mockUseConfig.mockReturnValueOnce(
                buildConfig({}, { uploadLloydGeorgeWorkflowEnabled: true }),
            );
            renderComponent({ downloadStage: DOWNLOAD_STAGE.NO_RECORDS });

            expect(screen.queryByText('Uploading files')).not.toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('has no violations when no record is available', async () => {
            renderComponent({ downloadStage: DOWNLOAD_STAGE.NO_RECORDS });

            await screen.findByText(/This patient does not have a Lloyd George record/i);

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });

        it('has no violations when record is displayed', async () => {
            renderComponent();

            await screen.findByTitle(EMBEDDED_PDF_VIEWER_TITLE);

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });

        it('has no violations in full screen mode', async () => {
            renderComponent();

            await userEvent.click(
                await screen.findByRole('button', { name: 'View in full screen' }),
            );

            // Simulate entering fullscreen
            simulateFullscreenChange(true);

            await screen.findByText('Exit full screen');

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });
    });

    describe('Navigation', () => {
        it('navigates to deceased audit screen for GP user', async () => {
            mockedUseRole.mockReturnValue(REPOSITORY_ROLE.GP_ADMIN);
            mockedUsePatient.mockReturnValue(buildPatientDetails({ deceased: true }));

            renderComponent();

            await userEvent.click(screen.getByTestId('go-back-button'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    routeChildren.PATIENT_ACCESS_AUDIT_DECEASED,
                );
            });
        });

        it('navigates to verify patient screen for PCSE user', async () => {
            mockedUseRole.mockReturnValue(REPOSITORY_ROLE.PCSE);
            mockedUsePatient.mockReturnValue(buildPatientDetails({ deceased: true }));

            renderComponent();

            await userEvent.click(screen.getByTestId('go-back-button'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.VERIFY_PATIENT);
            });
        });

        it('navigates to verify patient screen for non-deceased patient', async () => {
            mockedUseRole.mockReturnValue(REPOSITORY_ROLE.GP_ADMIN);
            mockedUsePatient.mockReturnValue(buildPatientDetails({ deceased: false }));

            renderComponent();

            await userEvent.click(screen.getByTestId('go-back-button'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.VERIFY_PATIENT);
            });
        });

        it('navigates to logout page when Sign Out is clicked', async () => {
            renderComponent();

            await userEvent.click(
                await screen.findByRole('button', { name: 'View in full screen' }),
            );

            // Simulate entering fullscreen
            simulateFullscreenChange(true);

            await userEvent.click(screen.getByTestId('sign-out-link'));

            await waitFor(() => {
                expect(mockExitFullscreen).toHaveBeenCalled();
                expect(mockNavigate).toHaveBeenCalledWith(routes.LOGOUT);
            });
        });
    });

    describe('Add Files functionality', () => {
        beforeEach(() => {
            mockUseConfig.mockReturnValue(
                buildConfig({}, { uploadDocumentIteration2Enabled: true }),
            );
            mockGetDocumentSearchResults.mockResolvedValue([
                {
                    fileName: 'test-document.pdf',
                    id: 'test-doc-id-123',
                },
            ]);
            (global.fetch as Mock).mockResolvedValue({
                blob: vi
                    .fn()
                    .mockResolvedValue(new Blob(['pdf content'], { type: 'application/pdf' })),
            });
        });

        it('navigates to upload page with correct state when Add Files is clicked', async () => {
            renderComponent({ downloadStage: DOWNLOAD_STAGE.SUCCEEDED });

            await userEvent.click(screen.getByTestId('add-files-btn'));

            await waitFor(() => {
                expect(mockGetDocumentSearchResults).toHaveBeenCalledWith({
                    nhsNumber: mockPatientDetails.nhsNumber,
                    baseUrl: 'http://test-api.com',
                    baseHeaders: { Authorization: 'Bearer token' },
                });
            });

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    expect.objectContaining({
                        pathname: routes.DOCUMENT_UPLOAD,
                        search: 'journey=update',
                    }),
                    expect.objectContaining({
                        state: expect.objectContaining({
                            journey: 'update',
                            existingDocuments: expect.arrayContaining([
                                expect.objectContaining({
                                    fileName: 'test-document.pdf',
                                    documentId: 'test-doc-id-123',
                                }),
                            ]),
                        }),
                    }),
                );
            });
        });

        it('fetches PDF blob from pdfObjectUrl', async () => {
            const pdfUrl = 'http://test.com/pdf';
            renderComponent({ downloadStage: DOWNLOAD_STAGE.SUCCEEDED, pdfObjectUrl: pdfUrl });

            await userEvent.click(screen.getByTestId('add-files-btn'));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(pdfUrl);
            });
        });

        it('navigates to server error page when patient NHS number is missing', async () => {
            mockedUsePatient.mockReturnValue(buildPatientDetails({ nhsNumber: undefined }));
            renderComponent({ downloadStage: DOWNLOAD_STAGE.SUCCEEDED });

            await userEvent.click(screen.getByTestId('add-files-btn'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.SERVER_ERROR);
            });
        });

        it('does not show Add Files button when upload feature is disabled', () => {
            mockUseConfig.mockReturnValue(
                buildConfig({}, { uploadLloydGeorgeWorkflowEnabled: false }),
            );
            renderComponent({ downloadStage: DOWNLOAD_STAGE.SUCCEEDED });

            expect(screen.queryByTestId('add-files-btn')).not.toBeInTheDocument();
        });

        it('does not show Add Files button when no record is available', () => {
            renderComponent({ downloadStage: DOWNLOAD_STAGE.NO_RECORDS });

            expect(screen.queryByTestId('add-files-btn')).not.toBeInTheDocument();
        });
    });

    describe('Download stages', () => {
        it.each([DOWNLOAD_STAGE.FAILED, DOWNLOAD_STAGE.NO_RECORDS, DOWNLOAD_STAGE.TIMEOUT])(
            'renders error component for download stage: %s',
            async (stage) => {
                renderComponent({ downloadStage: stage });

                expect(screen.queryByTitle(EMBEDDED_PDF_VIEWER_TITLE)).not.toBeInTheDocument();
                expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
            },
        );
    });

    describe('Component lifecycle', () => {
        it('calls resetDocState and refreshRecord on mount', async () => {
            const mockResetDocState = vi.fn();
            const mockRefreshRecord = vi.fn();

            renderComponent({
                resetDocState: mockResetDocState,
                refreshRecord: mockRefreshRecord,
            });

            await waitFor(() => {
                expect(mockResetDocState).toHaveBeenCalledTimes(1);
                expect(mockRefreshRecord).toHaveBeenCalledTimes(1);
            });
        });

        it('does not call resetDocState and refreshRecord on re-render', async () => {
            const mockResetDocState = vi.fn();
            const mockRefreshRecord = vi.fn();

            const { rerender } = render(
                <SessionProvider sessionOverride={{ isLoggedIn: true }}>
                    <TestApp
                        downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                        lastUpdated={mockPdf.lastUpdated}
                        refreshRecord={mockRefreshRecord}
                        pdfObjectUrl="http://test.com"
                        showMenu={true}
                        resetDocState={mockResetDocState}
                    />
                </SessionProvider>,
            );

            await waitFor(() => {
                expect(mockResetDocState).toHaveBeenCalledTimes(1);
            });

            rerender(
                <SessionProvider sessionOverride={{ isLoggedIn: true }}>
                    <TestApp
                        downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                        lastUpdated="2023-01-02"
                        refreshRecord={mockRefreshRecord}
                        pdfObjectUrl="http://test.com"
                        showMenu={true}
                        resetDocState={mockResetDocState}
                    />
                </SessionProvider>,
            );

            expect(mockResetDocState).toHaveBeenCalledTimes(1);
            expect(mockRefreshRecord).toHaveBeenCalledTimes(1);
        });
    });

    describe('Menu variations', () => {
        it('applies correct CSS class when showMenu is false', () => {
            renderComponent({ showMenu: false });

            const flexRow = document.querySelector('.lloydgeorge_record-stage_flex-row--upload');
            expect(flexRow).toBeInTheDocument();
        });

        it('applies correct CSS class when showMenu is true', () => {
            renderComponent({ showMenu: true });

            const flexRow = document.querySelector('.lloydgeorge_record-stage_flex-row--menu');
            expect(flexRow).toBeInTheDocument();
        });
    });

    describe('RecordCard props', () => {
        it('passes empty pdfObjectUrl to RecordCard when no record in storage pdf viewer should not visible', () => {
            renderComponent({ downloadStage: DOWNLOAD_STAGE.PENDING, pdfObjectUrl: '' });

            expect(screen.queryByTitle(EMBEDDED_PDF_VIEWER_TITLE)).not.toBeInTheDocument();
        });

        it('passes pdfObjectUrl to RecordCard when record is in storage', async () => {
            renderComponent({ downloadStage: DOWNLOAD_STAGE.SUCCEEDED });

            await screen.findByTitle(EMBEDDED_PDF_VIEWER_TITLE);

            expect(screen.getByTitle(EMBEDDED_PDF_VIEWER_TITLE)).toBeInTheDocument();
        });
    });
});
