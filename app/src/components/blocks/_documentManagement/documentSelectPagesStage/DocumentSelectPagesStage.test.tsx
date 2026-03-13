// need to use happy-dom for this test file as jsdom doesn't support DOMMatrix https://github.com/jsdom/jsdom/issues/2647
// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import DocumentSelectPagesStage from './DocumentSelectPagesStage';
import {
    buildDocumentConfig,
    buildLgFile,
    buildPatientDetails,
} from '../../../../helpers/test/testBuilders';
import { Mock } from 'vitest';
import usePatient from '../../../../helpers/hooks/usePatient';
import { userEvent } from '@testing-library/user-event';
import { getDocument } from 'pdfjs-dist';
import { routeChildren, routes } from '../../../../types/generic/routes';

vi.mock('../../../../helpers/hooks/usePatient');
vi.mock('../../../../providers/analyticsProvider/AnalyticsProvider', async () => ({
    ...(await vi.importActual('../../../../providers/analyticsProvider/AnalyticsProvider')),
    useAnalyticsContext: (): [null, Mock] => [null, vi.fn()],
}));
vi.mock('react-router-dom', async () => ({
    ...(await vi.importActual('react-router-dom')),
    useNavigate: (): Mock => mockNavigate,
}));
vi.mock('pdfjs-dist');

const mockUsePatient = usePatient as Mock;
const mockGetDocument = getDocument as Mock;
const mockNavigate = vi.fn();
const mockPatient = buildPatientDetails();

describe('DocumentSelectPagesStage', () => {
    beforeEach(() => {
        mockUsePatient.mockReturnValue(mockPatient);
    });

    it('should display loading preview text when baseDocumentBlob is null', () => {
        renderApp();

        expect(screen.getByText('Loading preview...')).toBeInTheDocument();
    });

    it('should display an error message when no page numbers are entered', async () => {
        const file = buildLgFile(1);
        renderApp(file);

        const submitButton = screen.getByTestId('continue-button');

        await userEvent.click(submitButton);

        expect(
            screen.getAllByText(
                'Please enter at least one page, or range of pages that you want to remove.',
            ),
        ).toHaveLength(2);
    });

    it('should display an error message when invalid page numbers are entered', async () => {
        const file = buildLgFile(1);
        renderApp(file);

        const input = screen.getByTestId('page-numbers-input');
        const submitButton = screen.getByTestId('continue-button');

        await userEvent.type(input, 'invalid input');
        await userEvent.click(submitButton);

        expect(
            screen.getAllByText(
                'Please enter valid page numbers. Separate page numbers using a comma, or use a dash for page ranges. For example, 1-5, 8, 11-14.',
            ),
        ).toHaveLength(2);
    });

    it('should display an error message when entered page numbers are out of range', async () => {
        mockGetDocument.mockReturnValueOnce({
            promise: Promise.resolve({
                numPages: 10,
            }),
        });

        const file = buildLgFile(1);
        renderApp(file);

        const input = screen.getByTestId('page-numbers-input');
        const submitButton = screen.getByTestId('continue-button');

        await userEvent.type(input, '0, 2-3, 100');
        await userEvent.click(submitButton);

        expect(screen.getAllByText('One or more page numbers are out of range.')).toHaveLength(2);
    });

    it('should display an error message when user enters all pages', async () => {
        mockGetDocument.mockReturnValueOnce({
            promise: Promise.resolve({
                numPages: 10,
            }),
        });

        const file = buildLgFile(1);
        renderApp(file);

        const input = screen.getByTestId('page-numbers-input');
        const submitButton = screen.getByTestId('continue-button');

        await userEvent.type(input, '1-10');
        await userEvent.click(submitButton);

        await waitFor(() => {
            expect(
                screen.getAllByText('You cannot remove all pages from the document.'),
            ).toHaveLength(2);
        });
    });

    it('should navigate to server error page when PDF parsing fails', async () => {
        mockGetDocument.mockRejectedValueOnce(new Error('PDF parsing error'));

        const file = buildLgFile(1);
        renderApp(file);

        const input = screen.getByTestId('page-numbers-input');
        const submitButton = screen.getByTestId('continue-button');

        await userEvent.type(input, '1-2');
        await userEvent.click(submitButton);

        // We can't directly test navigation, but we can check for the presence of the error message
        expect(mockNavigate).toHaveBeenCalledWith(routes.SERVER_ERROR);
    });

    it('should navigate to confirm removed pages stage when valid page numbers are entered', async () => {
        mockGetDocument.mockReturnValueOnce({
            promise: Promise.resolve({
                numPages: 10,
            }),
        });

        const file = buildLgFile(1);
        renderApp(file);

        const input = screen.getByTestId('page-numbers-input');
        const submitButton = screen.getByTestId('continue-button');

        await userEvent.type(input, '1, 3-4');
        await userEvent.click(submitButton);

        expect(mockNavigate).toHaveBeenCalledWith(
            routeChildren.DOCUMENT_REASSIGN_CONFIRM_REMOVED_PAGES,
        );
    });
});

const renderApp = (document: File | null = null): void => {
    render(
        <DocumentSelectPagesStage
            baseDocumentBlob={document}
            documentConfig={buildDocumentConfig()}
            pagesToRemove={[]}
            setPagesToRemove={vi.fn()}
        />,
    );
};
