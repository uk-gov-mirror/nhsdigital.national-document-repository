// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import DocumentRemovePagesConfirmStage from './DocumentRemovePagesConfirmStage';
import {
    buildDocumentReference,
    buildLgFile,
    buildPatientDetails,
} from '../../../../helpers/test/testBuilders';
import { Mock } from 'vitest';
import usePatient from '../../../../helpers/hooks/usePatient';
import userEvent from '@testing-library/user-event';
import * as downloadFileModule from '../../../../helpers/utils/downloadFile';
import { routeChildren } from '../../../../types/generic/routes';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        Link: ({ children, to, ...props }: any): React.JSX.Element => (
            <a href={to} {...props}>
                {children}
            </a>
        ),
    };
});
vi.mock('pdfjs-dist', () => ({
    getDocument: (): any => ({
        promise: Promise.resolve({
            extractPages: mockExtractPages,
        }),
    }),
}));
vi.mock('../../../../helpers/hooks/usePatient');

const mockScrollIntoView = vi.fn();
const mockPageScrollIntoView = vi.fn();
const mockQuerySelector = vi.fn();

vi.mock('../../../generic/pdfViewer/PdfViewer', () => ({
    default: ({ viewerRef }: { viewerRef?: React.RefObject<any> }): React.JSX.Element => {
        if (viewerRef) {
            (viewerRef as React.RefObject<any>).current = {
                scrollIntoView: mockScrollIntoView,
                iframe: {
                    contentWindow: {
                        document: {
                            querySelector: mockQuerySelector,
                        },
                    },
                },
            };
        }
        return <div data-testid="mock-pdf-viewer">MockPdfViewer</div>;
    },
}));
vi.mock('../../../../helpers/utils/downloadFile');

const mockNavigate = vi.fn();
const mockExtractPages = vi.fn();
const mockUsePatient = usePatient as Mock;
const mockDownloadFile = downloadFileModule.downloadFile as Mock;

describe('DocumentRemovePagesConfirmStage', () => {
    beforeEach(() => {
        mockUsePatient.mockReturnValue(buildPatientDetails());
        mockScrollIntoView.mockClear();
        mockPageScrollIntoView.mockClear();
        mockQuerySelector.mockClear();
    });

    it('renders correctly', async () => {
        const pagesToRemove = ['1', '3-4', '5'];

        const file = buildLgFile(1);
        const buffer = await file.arrayBuffer();

        mockExtractPages.mockResolvedValueOnce(new Uint8Array(buffer));

        render(
            <DocumentRemovePagesConfirmStage
                documentReference={buildDocumentReference()}
                baseDocumentBlob={file}
                pagesToRemove={pagesToRemove}
            />,
        );

        await waitFor(() => {
            pagesToRemove.forEach((page) => {
                expect(screen.getByText(`Page ${page}`)).toBeInTheDocument();
            });
        });
    });

    it('does not generate the removed pages blob until the base document blob is available', async () => {
        render(
            <DocumentRemovePagesConfirmStage
                documentReference={buildDocumentReference()}
                baseDocumentBlob={null}
                pagesToRemove={['1']}
            />,
        );

        await waitFor(() => {
            expect(mockExtractPages).not.toHaveBeenCalled();
        });
    });

    it('should download the removed pages PDF when download button is clicked', async () => {
        const pagesToRemove = ['1', '3-4', '5'];

        const file = buildLgFile(1);
        const buffer = await file.arrayBuffer();

        mockExtractPages.mockResolvedValueOnce(new Uint8Array(buffer));

        render(
            <DocumentRemovePagesConfirmStage
                documentReference={buildDocumentReference()}
                baseDocumentBlob={file}
                pagesToRemove={pagesToRemove}
            />,
        );

        let downloadButton;
        await waitFor(() => {
            downloadButton = screen.getByTestId('download-removed-pages-link');
            expect(downloadButton).toBeInTheDocument();
        });

        await userEvent.click(downloadButton!);

        await waitFor(() => {
            expect(mockDownloadFile).toHaveBeenCalled();
        });
    });

    it('should scroll to the correct page when view link is clicked', async () => {
        const pagesToRemove = ['1', '3-4', '5'];

        const file = buildLgFile(1);
        const buffer = await file.arrayBuffer();

        mockExtractPages.mockResolvedValueOnce(new Uint8Array(buffer));

        const mockPageElement = { scrollIntoView: mockPageScrollIntoView };
        mockQuerySelector.mockReturnValue(mockPageElement);

        render(
            <DocumentRemovePagesConfirmStage
                documentReference={buildDocumentReference()}
                baseDocumentBlob={file}
                pagesToRemove={pagesToRemove}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Page 1')).toBeInTheDocument();
        });

        // Click the "View" link for the first page
        const viewLinks = screen.getAllByText('View');
        await userEvent.click(viewLinks[0]);

        // Should query for the correct page element (page 1 is at index 0 in pagesToRemove, so data-page-number="1")
        expect(mockQuerySelector).toHaveBeenCalledWith('.page[data-page-number="1"]');
        expect(mockPageScrollIntoView).toHaveBeenCalledWith({ behavior: 'instant' });
        expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('should handle page ranges correctly when view link is clicked', async () => {
        const pagesToRemove = ['1', '3-4', '5'];

        const file = buildLgFile(1);
        const buffer = await file.arrayBuffer();

        mockExtractPages.mockResolvedValueOnce(new Uint8Array(buffer));

        const mockPageElement = { scrollIntoView: mockPageScrollIntoView };
        mockQuerySelector.mockReturnValue(mockPageElement);

        render(
            <DocumentRemovePagesConfirmStage
                documentReference={buildDocumentReference()}
                baseDocumentBlob={file}
                pagesToRemove={pagesToRemove}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Page 3-4')).toBeInTheDocument();
        });

        // Click the "View" link for the page range "3-4" (second item)
        const viewLinks = screen.getAllByText('View');
        await userEvent.click(viewLinks[1]);

        // For range "3-4", it should use the first number (3), which is at index 2 in the original document
        // parsePageNumbersToIndices(['1', '3-4', '5']) returns [0, 2, 3, 4]
        // Index of (3-1)=2 in [0, 2, 3, 4] is 1, so data-page-number="2"
        expect(mockQuerySelector).toHaveBeenCalledWith('.page[data-page-number="2"]');
        expect(mockPageScrollIntoView).toHaveBeenCalledWith({ behavior: 'instant' });
        expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('navigates to reassign search patient screen when continue button clicked', async () => {
        const pagesToRemove = ['1', '3-4', '5'];

        const file = buildLgFile(1);
        const buffer = await file.arrayBuffer();

        mockExtractPages.mockResolvedValueOnce(new Uint8Array(buffer));

        render(
            <DocumentRemovePagesConfirmStage
                documentReference={buildDocumentReference()}
                baseDocumentBlob={file}
                pagesToRemove={pagesToRemove}
            />,
        );

        let continueButton;
        await waitFor(() => {
            continueButton = screen.getByTestId('continue-button');
            expect(continueButton).toBeInTheDocument();
        });
        await userEvent.click(continueButton!);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                routeChildren.DOCUMENT_REASSIGN_SEARCH_PATIENT,
            );
        });
    });
});
