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
import { useState } from 'react';
import { DocumentReference } from '../../../../types/pages/documentSearchResultsPage/types';

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
vi.mock('../../../../helpers/hooks/usePatient');

vi.mock('../../../../helpers/utils/documentManagement/pageNumbers', async () => {
    const actual = await vi.importActual(
        '../../../../helpers/utils/documentManagement/pageNumbers',
    );
    return {
        ...actual,
        extractPdfBlobUsingSelectedPages: mockExtractPdfBlobUsingSelectedPages,
    };
});

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
const mockExtractPdfBlobUsingSelectedPages = vi.hoisted(() => vi.fn());
const mockUsePatient = usePatient as Mock;
const mockDownloadFile = downloadFileModule.downloadFile as Mock;

let pagesToRemove: number[][] = [];

describe('DocumentRemovePagesConfirmStage', () => {
    beforeEach(() => {
        mockUsePatient.mockReturnValue(buildPatientDetails());
        mockScrollIntoView.mockClear();
        mockPageScrollIntoView.mockClear();
        mockQuerySelector.mockClear();

        pagesToRemove = [[1], [3, 4], [6]];
    });

    it('renders correctly', async () => {
        await renderComponent();

        await waitFor(() => {
            pagesToRemove.forEach((pageRange) => {
                if (pageRange.length === 1) {
                    expect(screen.getByText(`Page ${pageRange[0]}`)).toBeInTheDocument();
                } else {
                    expect(
                        screen.getByText(`Page ${pageRange[0]}-${pageRange.at(-1)!}`),
                    ).toBeInTheDocument();
                }
            });
        });
    });

    it('does not generate the removed pages blob until the base document blob is available', async () => {
        pagesToRemove = [[0]];
        await renderComponent(false);

        await waitFor(() => {
            expect(mockExtractPdfBlobUsingSelectedPages).not.toHaveBeenCalled();
        });
    });

    it('should download the removed pages PDF when download button is clicked', async () => {
        await renderComponent();

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
        const mockPageElement = { scrollIntoView: mockPageScrollIntoView };
        mockQuerySelector.mockReturnValue(mockPageElement);

        await renderComponent();

        await waitFor(() => {
            expect(screen.getByText('Page 1')).toBeInTheDocument();
        });

        const viewLinks = screen.getAllByText('View');
        await userEvent.click(viewLinks[0]);

        expect(mockQuerySelector).toHaveBeenCalledWith('.page[data-page-number="1"]');
        expect(mockPageScrollIntoView).toHaveBeenCalledWith({ behavior: 'instant' });
        expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('should handle page ranges correctly when view link is clicked', async () => {
        const mockPageElement = { scrollIntoView: mockPageScrollIntoView };
        mockQuerySelector.mockReturnValue(mockPageElement);

        await renderComponent();

        await waitFor(() => {
            expect(screen.getByText('Page 3-4')).toBeInTheDocument();
        });

        const viewLinks = screen.getAllByText('View');
        await userEvent.click(viewLinks[1]);

        expect(mockQuerySelector).toHaveBeenCalledWith('.page[data-page-number="2"]');
        expect(mockPageScrollIntoView).toHaveBeenCalledWith({ behavior: 'instant' });
        expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('navigates to reassign search patient screen when continue button clicked', async () => {
        await renderComponent();

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

type TestAppProps = {
    documentReference?: DocumentReference;
    baseDocumentBlob?: Blob | null;
    reassignedPagesBlob?: Blob | null;
};

const TestApp = ({
    documentReference,
    baseDocumentBlob,
    reassignedPagesBlob,
}: TestAppProps): React.JSX.Element => {
    const [reassignedPagesBlobState, setReassignedPagesBlobState] = useState<Blob | null>(
        reassignedPagesBlob ?? null,
    );
    return (
        <DocumentRemovePagesConfirmStage
            documentReference={documentReference ?? buildDocumentReference()}
            baseDocumentBlob={baseDocumentBlob ?? null}
            pagesToRemove={pagesToRemove}
            reassignedPagesBlob={reassignedPagesBlobState}
            setReassignedPagesBlob={setReassignedPagesBlobState}
        />
    );
};

const renderComponent = async (
    createBaseBlob: boolean = true,
    props: Partial<TestAppProps> = {},
): Promise<void> => {
    if (createBaseBlob) {
        const file = buildLgFile(1);

        mockExtractPdfBlobUsingSelectedPages.mockResolvedValueOnce(file);

        props.baseDocumentBlob = file;
    }

    render(<TestApp {...props} />);
};
