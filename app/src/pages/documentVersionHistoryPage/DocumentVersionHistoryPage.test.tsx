import { render, RenderResult, screen, waitFor } from '@testing-library/react';
import { JSX } from 'react/jsx-runtime';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import useBaseAPIHeaders from '../../helpers/hooks/useBaseAPIHeaders';
import useBaseAPIUrl from '../../helpers/hooks/useBaseAPIUrl';
import usePatient from '../../helpers/hooks/usePatient';
import { getDocumentVersionHistoryResponse } from '../../helpers/requests/getDocumentVersionHistory';
import { mockDocumentVersionHistoryResponse } from '../../helpers/test/getMockVersionHistory';
import { buildPatientDetails, buildSearchResult } from '../../helpers/test/testBuilders';
import { DOCUMENT_TYPE } from '../../helpers/utils/documentType';
import DocumentVersionHistoryPage from './DocumentVersionHistoryPage';

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

vi.mock('../../helpers/hooks/usePatient');
vi.mock('../../helpers/hooks/useBaseAPIUrl');
vi.mock('../../helpers/hooks/useBaseAPIHeaders');
vi.mock('../../helpers/requests/getDocumentVersionHistory');
vi.mock('../../helpers/hooks/useTitle');

const mockedUsePatient = usePatient as Mock;
const mockUseBaseAPIUrl = useBaseAPIUrl as Mock;
const mockUseBaseAPIHeaders = useBaseAPIHeaders as Mock;
const mockGetDocumentVersionHistoryResponse = getDocumentVersionHistoryResponse as Mock;

const mockPatientDetails = buildPatientDetails();
const mockDocumentReference = buildSearchResult({
    documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
    id: 'doc-ref-123',
});

const renderPage = (): RenderResult =>
    render(<DocumentVersionHistoryPage documentReference={mockDocumentReference} />);

describe('DocumentVersionHistoryPage', () => {
    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockedUsePatient.mockReturnValue(mockPatientDetails);
        mockUseBaseAPIUrl.mockReturnValue('http://localhost');
        mockUseBaseAPIHeaders.mockReturnValue({ Authorization: 'Bearer token' });
        mockUseLocation.mockReturnValue({
            state: { documentReference: mockDocumentReference },
        });
        mockGetDocumentVersionHistoryResponse.mockResolvedValue(mockDocumentVersionHistoryResponse);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('loading state', () => {
        it('renders a spinner while the version history is loading', () => {
            mockGetDocumentVersionHistoryResponse.mockReturnValue(new Promise(() => {}));

            renderPage();

            expect(screen.getByText('Loading version history')).toBeInTheDocument();
        });
    });

    describe('page structure', () => {
        it('renders the back button', async () => {
            renderPage();

            await waitFor(() => {
                expect(screen.getByTestId('go-back-button')).toBeInTheDocument();
            });
        });

        it('renders the page heading with the correct document type label', async () => {
            renderPage();

            await waitFor(() => {
                expect(
                    screen.getByRole('heading', {
                        name: /version history for scanned paper notes/i,
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

            renderPage();

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

            renderPage();

            await waitFor(() => {
                expect(
                    screen.getByText('No version history available for this document.'),
                ).toBeInTheDocument();
            });
        });

        it('renders all version history entries with correct headings', async () => {
            renderPage();

            await waitFor(() => {
                expect(screen.getByText('Scanned paper notes: version 3')).toBeInTheDocument();
                expect(screen.getByText('Scanned paper notes: version 2')).toBeInTheDocument();
                expect(screen.getByText('Scanned paper notes: version 1')).toBeInTheDocument();
            });
        });

        it('shows "this is the current version" only for the first (most recent) entry', async () => {
            renderPage();

            await waitFor(() => {
                const currentVersionMessages = screen.getAllByText(
                    "This is the current version shown in this patient's record",
                );
                expect(currentVersionMessages).toHaveLength(1);
            });
        });

        it('renders a "View" link (not a button) for the current version', async () => {
            renderPage();

            await waitFor(() => {
                const viewCurrentLink = screen.getByTestId('view-version-3');
                expect(viewCurrentLink.tagName.toLowerCase()).toBe('a');
                expect(viewCurrentLink).toHaveTextContent('View');
            });
        });

        it('renders a "View" button and a "Restore version" link for each older version', async () => {
            renderPage();

            await waitFor(() => {
                const viewVersion2 = screen.getByTestId('view-version-2');
                expect(viewVersion2.tagName.toLowerCase()).toBe('button');

                const restoreVersion2 = screen.getByTestId('restore-version-2');
                expect(restoreVersion2).toHaveTextContent('Restore version');

                const viewVersion1 = screen.getByTestId('view-version-1');
                expect(viewVersion1.tagName.toLowerCase()).toBe('button');

                const restoreVersion1 = screen.getByTestId('restore-version-1');
                expect(restoreVersion1).toHaveTextContent('Restore version');
            });
        });

        it('does not render a "Restore version" link for the current version', async () => {
            renderPage();

            await waitFor(() => {
                expect(screen.queryByTestId('restore-version-3')).not.toBeInTheDocument();
            });
        });
    });
});
