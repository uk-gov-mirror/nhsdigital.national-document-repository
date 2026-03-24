import { render, RenderResult, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JSX } from 'react/jsx-runtime';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import usePatient from '../../../../helpers/hooks/usePatient';
import getDocument from '../../../../helpers/requests/getDocument';
import getDocumentSearchResults from '../../../../helpers/requests/getDocumentSearchResults';
import { getDocumentVersionHistoryResponse } from '../../../../helpers/requests/getDocumentVersionHistory';
import { mockDocumentVersionHistoryResponse } from '../../../../helpers/test/getMockVersionHistory';
import { buildPatientDetails, buildSearchResult } from '../../../../helpers/test/testBuilders';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';
import * as fhirUtil from '../../../../helpers/utils/fhirUtil';
import { getObjectUrl } from '../../../../helpers/utils/getPdfObjectUrl';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { DocumentReference } from '../../../../types/pages/documentSearchResultsPage/types';
import DocumentVersionRestoreHistoryStage from './DocumentVersionRestoreHistoryStage';

const mockNavigate = vi.fn();
const mockUseLocation = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        useLocation: (): unknown => mockUseLocation(),
        Link: ({ children, to, ...props }: any): JSX.Element => (
            <a href={to} {...props}>
                {children}
            </a>
        ),
    };
});

vi.mock('../../../../helpers/hooks/usePatient');
vi.mock('../../../../helpers/hooks/useBaseAPIUrl');
vi.mock('../../../../helpers/hooks/useBaseAPIHeaders');
vi.mock('../../../../helpers/requests/getDocumentVersionHistory');
vi.mock('../../../../helpers/requests/getDocument');
vi.mock('../../../../helpers/requests/getDocumentSearchResults');
vi.mock('../../../../helpers/hooks/useTitle');
vi.mock('../../../../helpers/utils/getPdfObjectUrl');
vi.mock('../../../../helpers/utils/isLocal', () => ({
    isLocal: false,
}));

const mockedUsePatient = usePatient as Mock;
const mockUseBaseAPIUrl = useBaseAPIUrl as Mock;
const mockUseBaseAPIHeaders = useBaseAPIHeaders as Mock;
const mockGetDocumentVersionHistoryResponse = getDocumentVersionHistoryResponse as Mock;
const mockGetDocument = getDocument as Mock;
const mockGetDocumentSearchResults = getDocumentSearchResults as Mock;
const mockGetObjectUrl = getObjectUrl as Mock;
const mockSetDocumentReference = vi.fn();

const mockPatientDetails = buildPatientDetails();
const mockDocumentReference = buildSearchResult({
    documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
    id: 'doc-ref-123',
});

describe('DocumentVersionRestoreHistoryStage', () => {
    const renderApp = (
        documentReference: DocumentReference | null = mockDocumentReference,
    ): RenderResult =>
        render(
            <DocumentVersionRestoreHistoryStage
                documentReference={documentReference}
                setDocumentReferenceToRestore={mockSetDocumentReference}
                setDocumentReference={vi.fn()}
                setLatestVersion={vi.fn()}
            />,
        );

    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockedUsePatient.mockReturnValue(mockPatientDetails);
        mockUseBaseAPIUrl.mockReturnValue('http://localhost');
        mockUseBaseAPIHeaders.mockReturnValue({ Authorization: 'Bearer token' });
        mockUseLocation.mockReturnValue({
            state: { documentReference: mockDocumentReference },
        });
        mockGetDocumentVersionHistoryResponse.mockResolvedValue(mockDocumentVersionHistoryResponse);
        mockGetDocument.mockResolvedValue({
            url: 'http://test-url.com/doc.pdf',
            contentType: 'application/pdf',
        });
        mockGetDocumentSearchResults.mockResolvedValue([
            buildSearchResult({ id: 'latest-doc-ref-id' }),
        ]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('loading state', () => {
        it('renders a spinner while the version history is loading', () => {
            mockGetDocumentVersionHistoryResponse.mockReturnValue(new Promise(() => {}));

            renderApp();

            expect(screen.getByText('Loading version history')).toBeInTheDocument();
        });
    });

    describe('navigation', () => {
        it('fetches version history using the latest document reference id from search', async () => {
            const viewedVersionDocumentReference = buildSearchResult({
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                id: 'doc-ref-viewed-version',
            });

            mockGetDocumentSearchResults.mockResolvedValue([
                buildSearchResult({ id: 'doc-ref-from-search' }),
            ]);

            renderApp(viewedVersionDocumentReference);

            await waitFor(() => {
                expect(mockGetDocumentVersionHistoryResponse).toHaveBeenCalledWith(
                    expect.objectContaining({
                        documentReferenceId: 'doc-ref-from-search',
                    }),
                );
            });
        });

        it('navigates to server error page when the API call fails', async () => {
            mockGetDocumentVersionHistoryResponse.mockRejectedValue(new Error('API error'));

            renderApp();

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.SERVER_ERROR);
            });
        });
    });

    describe('page structure', () => {
        it('renders the back button', async () => {
            renderApp();

            await waitFor(() => {
                expect(screen.getByTestId('go-back-button')).toBeInTheDocument();
            });
        });

        it('renders the page heading with the correct document type label', async () => {
            renderApp();

            await waitFor(() => {
                expect(
                    screen.getByRole('heading', {
                        name: /version history for scanned paper notes/i,
                    }),
                ).toBeInTheDocument();
            });
        });

        it('renders the correct heading for an EHR document type', async () => {
            const ehrDocumentReference = buildSearchResult({
                documentSnomedCodeType: DOCUMENT_TYPE.EHR,
            });

            renderApp(ehrDocumentReference);

            await waitFor(() => {
                expect(
                    screen.getByRole('heading', {
                        name: /version history for electronic health record/i,
                    }),
                ).toBeInTheDocument();
            });
        });
    });

    describe('version history timeline', () => {
        it('renders "no version history" message when the bundle has an empty entries array', async () => {
            mockGetDocumentVersionHistoryResponse.mockResolvedValue({
                resourceType: 'Bundle',
                type: 'history',
                total: 0,
                entry: [],
            });

            renderApp();

            await waitFor(() => {
                expect(
                    screen.getByText('No version history available for this document.'),
                ).toBeInTheDocument();
            });
        });

        it('renders "no version history" message when the bundle has no entry property', async () => {
            mockGetDocumentVersionHistoryResponse.mockResolvedValue({
                resourceType: 'Bundle',
                type: 'history',
                total: 0,
            });

            renderApp();

            await waitFor(() => {
                expect(
                    screen.getByText('No version history available for this document.'),
                ).toBeInTheDocument();
            });
        });

        it('renders all version history entries with correct headings', async () => {
            renderApp();

            await waitFor(() => {
                expect(screen.getByText('Scanned paper notes: version 3')).toBeInTheDocument();
                expect(screen.getByText('Scanned paper notes: version 2')).toBeInTheDocument();
                expect(screen.getByText('Scanned paper notes: version 1')).toBeInTheDocument();
            });
        });

        it('shows "this is the current version" only for the first (most recent) entry', async () => {
            renderApp();

            await waitFor(() => {
                const currentVersionMessages = screen.getAllByText(
                    "This is the current version shown in this patient's record",
                );
                expect(currentVersionMessages).toHaveLength(1);
            });
        });

        it('renders a "View" link (not a button) for the current version', async () => {
            renderApp();

            await waitFor(() => {
                const viewCurrentLink = screen.getByTestId('view-version-3');
                expect(viewCurrentLink.tagName.toLowerCase()).toBe('a');
                expect(viewCurrentLink).toHaveTextContent('View');
            });
        });

        it('renders a "View" button for each older version without a restore link', async () => {
            renderApp();

            await waitFor(() => {
                const viewVersion2 = screen.getByTestId('view-version-2');
                expect(viewVersion2.tagName.toLowerCase()).toBe('button');

                const viewVersion1 = screen.getByTestId('view-version-1');
                expect(viewVersion1.tagName.toLowerCase()).toBe('button');
            });
        });

        it('does not render any "Restore version" links', async () => {
            renderApp();

            await waitFor(() => {
                expect(screen.queryByText('Restore version')).not.toBeInTheDocument();
            });
        });
    });

    describe('error handling', () => {
        it('navigates to server error when the version history API call fails', async () => {
            mockGetDocumentVersionHistoryResponse.mockRejectedValue(new Error('API error'));

            renderApp();

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.SERVER_ERROR);
            });
        });
    });

    describe('handleViewVersion', () => {
        it('navigates to version history view when clicking View on the current version', async () => {
            const user = userEvent.setup();
            renderApp();

            await waitFor(() => {
                expect(screen.getByTestId('view-version-3')).toBeInTheDocument();
            });

            await user.click(screen.getByTestId('view-version-3'));

            await waitFor(() => {
                expect(mockSetDocumentReference).toHaveBeenCalled();
                expect(mockNavigate).toHaveBeenCalledWith(
                    routeChildren.DOCUMENT_VIEW_VERSION_HISTORY,
                    expect.objectContaining({
                        state: expect.objectContaining({
                            isActiveVersion: true,
                        }),
                    }),
                );
            });
        });

        it('navigates to version history view when clicking View on an older version', async () => {
            const user = userEvent.setup();
            renderApp();

            await waitFor(() => {
                expect(screen.getByTestId('view-version-2')).toBeInTheDocument();
            });

            await user.click(screen.getByTestId('view-version-2'));

            await waitFor(() => {
                expect(mockSetDocumentReference).toHaveBeenCalled();
                expect(mockNavigate).toHaveBeenCalledWith(
                    routeChildren.DOCUMENT_VIEW_VERSION_HISTORY,
                    expect.objectContaining({
                        state: expect.objectContaining({
                            isActiveVersion: false,
                        }),
                    }),
                );
            });
        });

        it('navigates to session expired when document loading returns 403', async () => {
            const user = userEvent.setup();
            mockGetDocument.mockRejectedValue({
                response: {
                    status: 403,
                },
            });

            renderApp();

            await waitFor(() => {
                expect(screen.getByTestId('view-version-2')).toBeInTheDocument();
            });

            await user.click(screen.getByTestId('view-version-2'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
            });
        });

        it('continues to version history view when document loading returns 404', async () => {
            const user = userEvent.setup();
            mockGetDocument.mockRejectedValue({
                response: {
                    status: 404,
                },
            });

            renderApp();

            await waitFor(() => {
                expect(screen.getByTestId('view-version-2')).toBeInTheDocument();
            });

            await user.click(screen.getByTestId('view-version-2'));

            await waitFor(() => {
                expect(mockGetObjectUrl).not.toHaveBeenCalled();
                expect(mockSetDocumentReference).toHaveBeenCalledWith(undefined);
            });

            expect(mockNavigate).toHaveBeenCalledWith(
                routeChildren.DOCUMENT_VIEW_VERSION_HISTORY,
                expect.objectContaining({
                    state: expect.objectContaining({
                        isActiveVersion: false,
                    }),
                }),
            );
        });

        it('navigates to server error with params when document loading returns 500', async () => {
            const user = userEvent.setup();
            mockGetDocument.mockRejectedValue({
                response: {
                    status: 500,
                    data: {
                        err_code: 'ERR500',
                        interaction_id: 'interaction-123',
                    },
                },
            });

            renderApp();

            await waitFor(() => {
                expect(screen.getByTestId('view-version-2')).toBeInTheDocument();
            });

            await user.click(screen.getByTestId('view-version-2'));

            await waitFor(() => {
                expect(
                    mockNavigate.mock.calls.some(
                        ([path]) =>
                            typeof path === 'string' && /^\/server-error\?encodedError=/.test(path),
                    ),
                ).toBe(true);
            });
        });

        it('navigates to server error when getDocumentReferenceFromFhir throws', async () => {
            const user = userEvent.setup();
            vi.spyOn(fhirUtil, 'getDocumentReferenceFromFhir').mockImplementation(() => {
                throw new Error('invalid fhir reference');
            });

            renderApp();

            await waitFor(() => {
                expect(screen.getByTestId('view-version-2')).toBeInTheDocument();
            });

            await user.click(screen.getByTestId('view-version-2'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.SERVER_ERROR);
            });
        });

        it('navigates to session expired when handleViewVersion catches a 403 error', async () => {
            const user = userEvent.setup();
            vi.spyOn(fhirUtil, 'getDocumentReferenceFromFhir').mockImplementation(() => {
                throw {
                    response: {
                        status: 403,
                    },
                };
            });

            renderApp();

            await waitFor(() => {
                expect(screen.getByTestId('view-version-2')).toBeInTheDocument();
            });

            await user.click(screen.getByTestId('view-version-2'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
            });
        });
    });
});
