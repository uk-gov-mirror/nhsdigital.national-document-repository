import { render, screen, waitFor } from '@testing-library/react';
import React, { act } from 'react';
import DocumentSearchResultsPage from './DocumentSearchResultsPage';
import userEvent from '@testing-library/user-event';
import {
    buildPatientDetails,
    buildSearchResult,
    buildUserAuth,
} from '../../helpers/test/testBuilders';
import { routeChildren, routes } from '../../types/generic/routes';
import axios from 'axios';
import usePatient from '../../helpers/hooks/usePatient';
import * as ReactRouter from 'react-router-dom';
import { History, createMemoryHistory } from 'history';
import { runAxeTest } from '../../helpers/test/axeTestHelper';
import { afterEach, beforeEach, describe, expect, it, vi, Mock, Mocked } from 'vitest';
import SessionProvider, { Session } from '../../providers/sessionProvider/SessionProvider';
import { REPOSITORY_ROLE } from '../../types/generic/authRole';
import getDocumentSearchResults from '../../helpers/requests/getDocumentSearchResults';
import getDocument from '../../helpers/requests/getDocument';
import useConfig from '../../helpers/hooks/useConfig';

const mockedUseNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({
    ...(await vi.importActual('react-router-dom')),
    useNavigate: (): Mock => mockedUseNavigate,
    Link: (props: ReactRouter.LinkProps): React.JSX.Element => <a {...props} role="link" />,
}));

vi.mock('axios');
Date.now = (): number => new Date('2020-01-01T00:00:00.000Z').getTime();
vi.mock('../../helpers/hooks/useBaseAPIHeaders');
vi.mock('../../helpers/hooks/usePatient');
vi.mock('../../helpers/hooks/useConfig');
vi.mock('../../helpers/requests/getDocumentSearchResults');
vi.mock('../../helpers/requests/getDocument');

const mockedAxios = axios as Mocked<typeof axios>;
const mockedUsePatient = usePatient as Mock;
const mockedGetSearchResults = getDocumentSearchResults as Mock;
const mockedGetDocument = getDocument as Mock;
const mockedUseConfig = useConfig as Mock;
const mockPatient = buildPatientDetails();

let history = createMemoryHistory({
    initialEntries: ['/patient/documents'],
    initialIndex: 0,
});

describe('<DocumentSearchResultsPage />', () => {
    beforeEach(() => {
        sessionStorage.setItem('UserSession', '');
        history = createMemoryHistory({
            initialEntries: ['/'],
            initialIndex: 0,
        });

        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockedUseConfig.mockReturnValue({
            featureFlags: {
                uploadDocumentIteration3Enabled: true,
            },
        });
    });
    afterEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it.each([
            { role: REPOSITORY_ROLE.GP_ADMIN, title: 'Lloyd George records' },
            { role: REPOSITORY_ROLE.GP_CLINICAL, title: 'Lloyd George records' },
            { role: REPOSITORY_ROLE.PCSE, title: 'Manage Lloyd George records' },
        ])(
            'renders the page after a successful response from api when role is $role',
            async ({ role, title }) => {
                mockedGetSearchResults.mockResolvedValue([buildSearchResult()]);

                renderPage(history, role);

                const pageTitle = screen.getByTestId('page-title');
                expect(pageTitle).toBeInTheDocument();
                expect(pageTitle).toHaveTextContent(title);

                await waitFor(() => {
                    expect(
                        screen.queryByRole('progressbar', { name: 'Loading...' }),
                    ).not.toBeInTheDocument();
                });
            },
        );

        it('displays a progress bar when the document search results are being requested', async () => {
            mockedGetSearchResults.mockImplementationOnce(async () => {
                await new Promise((resolve) => {
                    setTimeout(() => {
                        // To delay the mock request, and give a chance for the progress bar to appear
                        resolve(null);
                    }, 500);
                });
                return Promise.resolve([buildSearchResult()]);
            });

            renderPage(history);

            expect(screen.getByRole('progressbar', { name: 'Loading...' })).toBeInTheDocument();
        });

        it('displays a message when a document search returns no results', async () => {
            mockedGetSearchResults.mockImplementation(async () => {
                return Promise.resolve({ data: [] });
            });

            renderPage(history);

            await waitFor(() => {
                expect(
                    screen.getByText('There are no documents available for this patient.'),
                ).toBeInTheDocument();
            });

            expect(
                screen.queryByRole('button', { name: 'Download all documents' }),
            ).not.toBeInTheDocument();
            expect(screen.queryByTestId('delete-all-documents-btn')).not.toBeInTheDocument();
        });

        it('displays a service error when document search fails with bad request', async () => {
            const errorResponse = {
                response: {
                    status: 400,
                    message: 'bad request',
                },
            };
            mockedGetSearchResults.mockRejectedValueOnce(errorResponse);

            renderPage(history);

            await waitFor(() => {
                expect(screen.getByTestId('service-error')).toBeInTheDocument();
            });
        });

        it.each([
            {
                featureFlagEnabled: true,
                role: REPOSITORY_ROLE.GP_ADMIN,
                deceased: false,
                uploadBtnVisible: true,
            },
            {
                featureFlagEnabled: true,
                role: REPOSITORY_ROLE.GP_CLINICAL,
                deceased: false,
                uploadBtnVisible: true,
            },
            {
                featureFlagEnabled: true,
                role: REPOSITORY_ROLE.PCSE,
                deceased: false,
                uploadBtnVisible: false,
            },
            {
                featureFlagEnabled: true,
                role: REPOSITORY_ROLE.GP_ADMIN,
                deceased: true,
                uploadBtnVisible: false,
            },
            {
                featureFlagEnabled: false,
                role: REPOSITORY_ROLE.GP_ADMIN,
                deceased: false,
                uploadBtnVisible: false,
            },
        ])(
            'displays upload button when %s',
            async ({ featureFlagEnabled, role, deceased, uploadBtnVisible }) => {
                mockedGetSearchResults.mockResolvedValue([buildSearchResult()]);
                mockedUseConfig.mockReturnValue({
                    featureFlags: {
                        uploadDocumentIteration3Enabled: featureFlagEnabled,
                    },
                });

                renderPage(history, role, deceased);

                await waitFor(() => {
                    expect(screen.queryAllByTestId('upload-button')).toHaveLength(
                        uploadBtnVisible ? 1 : 0,
                    );
                });
            },
        );
    });

    describe('Accessibility', () => {
        it('pass accessibility checks at loading screen', async () => {
            mockedGetSearchResults.mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 20000)),
            );
            renderPage(history);

            expect(screen.getByRole('status')).toBeInTheDocument();

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });

        it('pass accessibility checks when displaying search result', async () => {
            mockedGetSearchResults.mockImplementation(() => Promise.resolve([buildSearchResult()]));

            renderPage(history);

            await waitFor(() => {
                expect(screen.getByTestId('subtitle')).toBeInTheDocument();
            });

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });

        it('pass accessibility checks when error boxes are showing up', async () => {
            mockedGetSearchResults.mockImplementation(() => Promise.resolve([buildSearchResult()]));
            const errorResponse = {
                response: {
                    status: 400,
                    data: { message: 'An error occurred', err_code: 'SP_1001' },
                },
            };
            renderPage(history, REPOSITORY_ROLE.PCSE);

            const downloadButton = await screen.findByRole('button', {
                name: 'Download all documents',
            });

            vi.spyOn(mockedAxios, 'get').mockRejectedValueOnce(errorResponse);
            await userEvent.click(downloadButton);

            expect(
                await screen.findByText('Sorry, the service is currently unavailable.'),
            ).toBeInTheDocument();
            expect(
                await screen.findByText('An error has occurred while preparing your download'),
            ).toBeInTheDocument();

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });
    });

    describe('Navigation', () => {
        it('navigates to session expire page when a document search return 403 unauthorised error', async () => {
            const errorResponse = {
                response: {
                    status: 403,
                    message: 'An error occurred',
                },
            };
            mockedGetSearchResults.mockRejectedValueOnce(errorResponse);

            renderPage(history);

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
            });
        });

        it('navigates to server error page when document search return 500 server error', async () => {
            const errorResponse = {
                response: {
                    status: 500,
                    message: 'An error occurred',
                },
            };
            mockedGetSearchResults.mockRejectedValueOnce(errorResponse);

            renderPage(history);

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith(
                    expect.stringContaining(routes.SERVER_ERROR),
                );
            });
        });

        it('loads the document and navigates to view screen on view link clicked', async () => {
            mockedGetSearchResults.mockResolvedValue([buildSearchResult()]);

            renderPage(history);

            await waitFor(() => {
                expect(
                    screen.queryByRole('progressbar', { name: 'Loading...' }),
                ).not.toBeInTheDocument();
            });

            const viewLink = screen.getByTestId('view-0-link');
            await act(async () => {
                await userEvent.click(viewLink);
            });

            expect(mockedGetDocument).toHaveBeenCalledTimes(1);
            expect(mockedUseNavigate).toHaveBeenCalledWith(routeChildren.DOCUMENT_VIEW);
        });

        it('navigates to server error when load document fails with 500', async () => {
            mockedGetSearchResults.mockResolvedValue([buildSearchResult()]);

            const errorResponse = {
                response: {
                    status: 500,
                    message: 'server error',
                },
            };
            mockedGetDocument.mockRejectedValue(errorResponse);

            renderPage(history);

            await waitFor(() => {
                expect(
                    screen.queryByRole('progressbar', { name: 'Loading...' }),
                ).not.toBeInTheDocument();
            });

            const viewLink = screen.getByTestId('view-0-link');
            await act(async () => {
                await userEvent.click(viewLink);
            });

            expect(mockedGetDocument).toHaveBeenCalledTimes(1);
            expect(mockedUseNavigate).toHaveBeenCalledWith(routeChildren.DOCUMENT_VIEW);
            expect(mockedUseNavigate).toHaveBeenCalledWith(
                expect.stringContaining(routes.SERVER_ERROR),
            );
        });

        it('navigates to session expired when load document fails with 403', async () => {
            mockedGetSearchResults.mockResolvedValue([buildSearchResult()]);

            const errorResponse = {
                response: {
                    status: 403,
                    message: 'forbidden',
                },
            };
            mockedGetDocument.mockRejectedValue(errorResponse);

            renderPage(history);

            await waitFor(() => {
                expect(
                    screen.queryByRole('progressbar', { name: 'Loading...' }),
                ).not.toBeInTheDocument();
            });

            const viewLink = screen.getByTestId('view-0-link');
            await act(async () => {
                await userEvent.click(viewLink);
            });

            expect(mockedGetDocument).toHaveBeenCalledTimes(1);
            expect(mockedUseNavigate).toHaveBeenCalledWith(routeChildren.DOCUMENT_VIEW);
            expect(mockedUseNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
        });
    });

    const renderPage = (history: History, role?: REPOSITORY_ROLE, deceased?: boolean): void => {
        mockedUsePatient.mockReturnValue(buildPatientDetails({ deceased: deceased }));

        const auth: Session = {
            auth: buildUserAuth({ role: role ?? REPOSITORY_ROLE.GP_ADMIN }),
            isLoggedIn: true,
        };
        render(
            <SessionProvider sessionOverride={auth}>
                <ReactRouter.Router navigator={history} location={history.location}>
                    <DocumentSearchResultsPage />
                </ReactRouter.Router>
                ,
            </SessionProvider>,
        );
    };
});
