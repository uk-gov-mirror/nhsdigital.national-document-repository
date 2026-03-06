// need to use happy-dom for this test file as jsdom doesn't support DOMMatrix https://github.com/jsdom/jsdom/issues/2647
// @vitest-environment happy-dom
import { render, RenderResult, screen, waitFor } from '@testing-library/react';
import DocumentCorrectPage from './DocumentCorrectPage';
import { Mock } from 'vitest';
import { createMemoryHistory } from 'history';
import * as ReactRouter from 'react-router-dom';
import { routeChildren, routes } from '../../types/generic/routes';
import { DOCUMENT_TYPE } from '../../helpers/utils/documentType';
import { Props } from '../../components/blocks/_documentManagement/documentSelectPagesStage/DocumentSelectPagesStage';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        useLocation: (): Mock => mockLocation as Mock,
    };
});
vi.mock(
    '../../components/blocks/_documentManagement/documentSelectPagesStage/DocumentSelectPagesStage',
    () => ({
        default: ({
            baseDocumentBlob,
            documentConfig,
            setPagesToRemove,
        }: Partial<Props>): React.JSX.Element => (
            <>
                <div>Document select page</div>
                {baseDocumentBlob && documentConfig && setPagesToRemove && <div>Data set</div>}
            </>
        ),
    }),
);
vi.mock('../../helpers/utils/errorToParams', () => ({
    errorToParams: (): string => '?encodedError=Error%3A%20Fetch%20failed',
}));
global.fetch = vi.fn(() =>
    Promise.resolve({
        blob: () => Promise.resolve(new Blob()),
    }),
) as unknown as typeof fetch;

const mockNavigate = vi.fn();
let mockLocation = {};

describe('DocumentCorrectPage', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        global.fetch = vi.fn(() =>
            Promise.resolve({
                blob: () => Promise.resolve(new Blob()),
            }),
        ) as unknown as typeof fetch;
        mockLocation = {
            pathname: routeChildren.DOCUMENT_REASSIGN_SELECT_PAGES,
            search: '',
            hash: '',
            state: {
                documentReference: {
                    id: '123',
                    url: 'http://example.com/document.pdf',
                    documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                },
            },
            key: '',
        } as any;
    });

    it('renders', async () => {
        renderPage();

        await waitFor(() => {
            expect(screen.getByText('Document select page')).toBeInTheDocument();
            expect(screen.getByText('Data set')).toBeInTheDocument();
        });
    });

    it('navigates to server error if no document reference in state', async () => {
        mockLocation = {
            pathname: routeChildren.DOCUMENT_REASSIGN_SELECT_PAGES,
            search: '',
            hash: '',
            state: {},
            key: '',
        } as any;

        renderPage();

        expect(mockNavigate).toHaveBeenCalledWith(routes.SERVER_ERROR);
    });

    it('navigates to server error if fetch fails', async () => {
        global.fetch = vi.fn(() =>
            Promise.reject(new Error('Fetch failed')),
        ) as unknown as typeof fetch;

        renderPage();

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                routes.SERVER_ERROR + '?encodedError=Error%3A%20Fetch%20failed',
            );
        });
    });
});

const renderPage = async (): Promise<RenderResult> => {
    const history = createMemoryHistory({
        initialEntries: ['/patient/document-reassign/select-pages'],
        initialIndex: 0,
    });

    return render(
        <ReactRouter.Router location={history.location} navigator={history}>
            <ReactRouter.Routes>
                <ReactRouter.Route
                    path="/patient/document-reassign/*"
                    element={<DocumentCorrectPage />}
                />
            </ReactRouter.Routes>
        </ReactRouter.Router>,
    );
};
