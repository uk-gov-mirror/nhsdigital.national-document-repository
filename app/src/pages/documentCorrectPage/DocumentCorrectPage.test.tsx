import { render, RenderResult, screen } from '@testing-library/react';
import DocumentCorrectPage from './DocumentCorrectPage';
import { Mock } from 'vitest';
import { createMemoryHistory } from 'history';
import * as ReactRouter from 'react-router-dom';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => vi.fn(),
    };
});

describe('DocumentCorrectPage', () => {
    it('renders', () => {
        renderPage();

        expect(screen.getByText('Document select page')).toBeInTheDocument();
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
