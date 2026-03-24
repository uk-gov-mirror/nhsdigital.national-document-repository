import { render, RenderResult, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { Mock } from 'vitest';
import useConfig from '../../helpers/hooks/useConfig';
import { routes } from '../../types/generic/routes';
import { DocumentReference } from '../../types/pages/documentSearchResultsPage/types';
import DocumentVersionRestorePage from './DocumentVersionRestorePage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});

vi.mock(
    '../../components/blocks/_documentVersion/documentVersionRestoreHistoryStage/DocumentVersionRestoreHistoryStage',
    () => ({
        default: (props: {
            documentReference: DocumentReference | null;
            setDocumentReferenceToRestore: (docRef: DocumentReference) => void;
            setDocumentReference: (docRef: DocumentReference) => void;
            setLatestVersion: (version: string) => void;
        }): React.JSX.Element => (
            <div data-testid="history-stage">
                {props.documentReference && (
                    <span data-testid="history-doc-ref">{props.documentReference.id}</span>
                )}
            </div>
        ),
    }),
);

vi.mock('../../components/blocks/_patientDocuments/documentView/DocumentView', () => ({
    default: (props: {
        documentReference: DocumentReference | null;
        viewState?: string;
        isActiveVersion?: boolean;
    }): React.JSX.Element => (
        <div data-testid="document-view">
            {props.viewState && <span data-testid="view-state">{props.viewState}</span>}
            {props.isActiveVersion !== undefined && (
                <span data-testid="is-active-version">{String(props.isActiveVersion)}</span>
            )}
            {props.documentReference && (
                <span data-testid="view-doc-ref">{props.documentReference.id}</span>
            )}
        </div>
    ),
    DOCUMENT_VIEW_STATE: {
        DOCUMENT: 'DOCUMENT',
        VERSION_HISTORY: 'VERSION_HISTORY',
    },
}));

vi.mock('../../helpers/hooks/useConfig');

const mockedUseConfig = useConfig as Mock;

describe('DocumentVersionRestorePage', () => {
    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockedUseConfig.mockReturnValue({
            featureFlags: {
                versionHistoryEnabled: true,
            },
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Feature flag guard', () => {
        it('navigates to home when versionHistoryEnabled is false', async () => {
            mockedUseConfig.mockReturnValue({
                featureFlags: {
                    versionHistoryEnabled: false,
                },
            });

            renderPage();

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.HOME);
            });
        });

        it('renders empty fragment when versionHistoryEnabled is false', () => {
            mockedUseConfig.mockReturnValue({
                featureFlags: {
                    versionHistoryEnabled: false,
                },
            });

            const { container } = renderPage();

            expect(container.innerHTML).toBe('');
        });

        it('does not navigate to home when versionHistoryEnabled is true', () => {
            renderPage();

            expect(mockNavigate).not.toHaveBeenCalledWith(routes.HOME);
        });

        it('navigates to home when featureFlags is undefined', async () => {
            mockedUseConfig.mockReturnValue({
                featureFlags: undefined,
            });

            renderPage();

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.HOME);
            });
        });
    });

    describe('Rendering', () => {
        it('renders the history stage at the index route', () => {
            renderPage();

            expect(screen.getByTestId('history-stage')).toBeInTheDocument();
        });

        it('renders the document view at the view route', () => {
            renderPage('/patient/documents/version-history/view');

            expect(screen.getByTestId('document-view')).toBeInTheDocument();
        });

        it('passes VERSION_HISTORY view state to DocumentView', () => {
            renderPage('/patient/documents/version-history/view');

            expect(screen.getByTestId('view-state')).toHaveTextContent('VERSION_HISTORY');
        });
    });

    describe('State management', () => {
        it('passes null documentReference to history stage initially', () => {
            renderPage();

            expect(screen.queryByTestId('history-doc-ref')).not.toBeInTheDocument();
        });
    });

    const renderPage = (
        initialPath: string = '/patient/documents/version-history',
    ): RenderResult => {
        const router = createMemoryRouter(
            [
                {
                    path: '/patient/documents/version-history/*',
                    element: <DocumentVersionRestorePage />,
                },
            ],
            {
                initialEntries: [initialPath],
            },
        );

        return render(<RouterProvider router={router} />);
    };
});
