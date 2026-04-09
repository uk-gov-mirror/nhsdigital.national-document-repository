import { render, RenderResult, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { Mock } from 'vitest';
import { buildSearchResult } from '../../helpers/test/testBuilders';
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
                <button
                    data-testid="set-restore-ref"
                    onClick={(): void =>
                        props.setDocumentReferenceToRestore({
                            ...buildSearchResult({ id: 'restore-ref', version: '2' }),
                            url: 'https://test-url',
                            isPdf: true,
                        })
                    }
                />
                <button
                    data-testid="set-doc-ref"
                    onClick={(): void =>
                        props.setDocumentReference({
                            ...buildSearchResult({ id: 'doc-ref' }),
                            url: 'https://test-url',
                            isPdf: true,
                        })
                    }
                />
                <button
                    data-testid="set-latest-version"
                    onClick={(): void => props.setLatestVersion('3')}
                />
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

vi.mock(
    '../../components/blocks/_documentVersion/documentVersionRestoreConfirmStage/DocumentVersionRestoreConfirmStage',
    () => ({
        default: (props: {
            documentReferenceToRestore: DocumentReference | null;
        }): React.JSX.Element => (
            <div data-testid="confirm-stage">
                {props.documentReferenceToRestore && (
                    <span data-testid="confirm-doc-ref">{props.documentReferenceToRestore.id}</span>
                )}
            </div>
        ),
    }),
);

vi.mock(
    '../../components/blocks/_documentVersion/documentVersionRestoreUploadingStage/DocumentVersionRestoreUploadingStage',
    () => ({
        default: (props: {
            documentReferenceToRestore: DocumentReference | null;
            documentReference: DocumentReference | null;
            uploadDoc: unknown[];
            setUploadDoc: unknown;
        }): React.JSX.Element => (
            <div data-testid="uploading-stage">
                {props.documentReferenceToRestore && (
                    <span data-testid="uploading-restore-ref">
                        {props.documentReferenceToRestore.id}
                    </span>
                )}
                {props.documentReference && (
                    <span data-testid="uploading-doc-ref">{props.documentReference.id}</span>
                )}
            </div>
        ),
    }),
);

vi.mock(
    '../../components/blocks/_documentVersion/documentVersionRestoreCompleteStage/DocumentVersionRestoreCompleteStage',
    () => ({
        default: (props: { resetState: () => void }): React.JSX.Element => (
            <div data-testid="complete-stage">
                <button data-testid="reset-state-btn" onClick={props.resetState} />
            </div>
        ),
    }),
);

describe('DocumentVersionRestorePage', () => {
    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
    });

    afterEach(() => {
        vi.clearAllMocks();
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

        it('renders the confirm stage at the restore-confirm route', () => {
            renderPage('/patient/documents/version-history/restore-confirm');

            expect(screen.getByTestId('confirm-stage')).toBeInTheDocument();
        });

        it('renders the uploading stage at the restore-uploading route', () => {
            renderPage('/patient/documents/version-history/restore-uploading');

            expect(screen.getByTestId('uploading-stage')).toBeInTheDocument();
        });

        it('renders the complete stage at the restore-complete route', () => {
            renderPage('/patient/documents/version-history/restore-complete');

            expect(screen.getByTestId('complete-stage')).toBeInTheDocument();
        });
    });

    describe('State management', () => {
        it('passes null documentReference to history stage initially', () => {
            renderPage();

            expect(screen.queryByTestId('history-doc-ref')).not.toBeInTheDocument();
        });

        it('passes null documentReferenceToRestore to confirm stage initially', () => {
            renderPage('/patient/documents/version-history/restore-confirm');

            expect(screen.queryByTestId('confirm-doc-ref')).not.toBeInTheDocument();
        });

        it('passes empty documents array and null refs to uploading stage initially', () => {
            renderPage('/patient/documents/version-history/restore-uploading');

            expect(screen.queryByTestId('uploading-restore-ref')).not.toBeInTheDocument();
            expect(screen.queryByTestId('uploading-doc-ref')).not.toBeInTheDocument();
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
