import { render, waitFor, screen, RenderResult } from '@testing-library/react';
import DocumentUploadConfirmStage from './DocumentUploadConfirmStage';
import { formatNhsNumber } from '../../../../helpers/utils/formatNhsNumber';
import { getFormattedDate } from '../../../../helpers/utils/formatDate';
import { buildDocumentConfig, buildPatientDetails } from '../../../../helpers/test/testBuilders';
import usePatient from '../../../../helpers/hooks/usePatient';
import {
    DOCUMENT_UPLOAD_STATE,
    UploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';
import * as ReactRouter from 'react-router-dom';
import { MemoryHistory, createMemoryHistory } from 'history';
import userEvent from '@testing-library/user-event';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { getFormattedPatientFullName } from '../../../../helpers/utils/formatPatientFullName';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';
import { getJourney } from '../../../../helpers/utils/urlManipulations';

vi.mock('../../../../helpers/hooks/usePatient');
vi.mock('../../../../helpers/utils/urlManipulations', async () => {
    const actual = await vi.importActual('../../../../helpers/utils/urlManipulations');
    return {
        ...actual,
        getJourney: vi.fn(),
    };
});
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockedUseNavigate,
    };
});

const mockedUseNavigate = vi.fn();

vi.mock('./components/DocumentList', async () => {
    const actual = await vi.importActual('./components/DocumentList');
    return {
        ...actual,
        default: ({ documents }: { documents: UploadDocument[] }): React.JSX.Element => {
            return (
                <div data-testid="document-list">
                    Document List with
                    <span data-testid="document-list-count">{documents.length}</span>
                    documents
                </div>
            );
        },
    };
});

vi.mock('../documentUploadLloydGeorgePreview/DocumentUploadLloydGeorgePreview', () => ({
    default: ({
        documents,
        stitchedBlobLoaded,
    }: {
        documents: UploadDocument[];
        stitchedBlobLoaded?: (loaded: boolean) => void;
    }): React.JSX.Element => {
        // Simulate the PDF stitching completion
        if (stitchedBlobLoaded) {
            setTimeout(() => stitchedBlobLoaded(true), 0);
        }
        return (
            <div data-testid="lloyd-george-preview">
                Lloyd George Preview for documents
                <span data-testid="lloyd-george-preview-count">{documents.length}</span>
            </div>
        );
    },
}));

const patientDetails = buildPatientDetails();

URL.createObjectURL = vi.fn();

let history = createMemoryHistory({
    initialEntries: ['/'],
    initialIndex: 0,
});

let docConfig = buildDocumentConfig();
const mockConfirmFiles = vi.fn();

describe('DocumentUploadConfirmStage', () => {
    beforeEach(() => {
        vi.mocked(usePatient).mockReturnValue(patientDetails);

        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        history = createMemoryHistory({ initialEntries: ['/'], initialIndex: 0 });
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders', async () => {
        renderApp(history, 1);

        await waitFor(async () => {
            expect(screen.getByText('Check files are for the correct patient')).toBeInTheDocument();
        });
    });

    it('should call confirmFiles when confirm button is clicked', async () => {
        renderApp(history, 1);

        await userEvent.click(await screen.findByTestId('confirm-button'));

        await waitFor(() => {
            expect(mockConfirmFiles).toHaveBeenCalled();
        });
    });

    it.each([
        { fileCount: 3, expectedPreviewCount: 3, stitched: true },
        { fileCount: 1, expectedPreviewCount: 1, stitched: false },
    ])(
        'should render correct number files in the preview %s',
        async ({ fileCount, expectedPreviewCount, stitched }) => {
            docConfig = buildDocumentConfig({
                snomedCode: DOCUMENT_TYPE.EHR,
                stitched,
            });

            renderApp(history, fileCount);

            await waitFor(async () => {
                expect(screen.getByTestId('lloyd-george-preview-count').textContent).toBe(
                    `${expectedPreviewCount}`,
                );
            });
        },
    );

    describe('Navigation', () => {
        it('should navigate to previous screen when go back is clicked', async () => {
            renderApp(history, 1);

            userEvent.click(await screen.findByTestId('go-back-link'));

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith(-1);
            });
        });

        it('renders patient summary fields is inset', async () => {
            renderApp(history, 1);

            const insetText = screen
                .getByText('Make sure that all files uploaded are for this patient only:')
                .closest('.nhsuk-inset-text');
            expect(insetText).toBeInTheDocument();

            const expectedFullName = getFormattedPatientFullName(patientDetails);
            expect(screen.getByText(/Patient name/i)).toBeInTheDocument();
            expect(screen.getByText(expectedFullName)).toBeInTheDocument();

            expect(screen.getByText(/NHS number/i)).toBeInTheDocument();
            const expectedNhsNumber = formatNhsNumber(patientDetails.nhsNumber);
            expect(screen.getByText(expectedNhsNumber)).toBeInTheDocument();

            expect(screen.getByText(/Date of birth/i)).toBeInTheDocument();
            const expectedDob = getFormattedDate(new Date(patientDetails.birthDate));
            expect(screen.getByText(expectedDob)).toBeInTheDocument();
        });
    });

    describe('Update Journey', () => {
        beforeEach(() => {
            vi.mocked(getJourney).mockReturnValue('update');
            delete (globalThis as any).location;
            globalThis.location = { search: '?journey=update' } as any;

            history = createMemoryHistory({
                initialEntries: ['/?journey=update'],
                initialIndex: 0,
            });
        });

        it('should still render all page elements correctly', async () => {
            renderApp(history, 1);

            await waitFor(async () => {
                expect(
                    screen.getByText('Check files are for the correct patient'),
                ).toBeInTheDocument();
                expect(screen.getByTestId('go-back-link')).toBeInTheDocument();
                expect(screen.getByTestId('confirm-button')).toBeInTheDocument();
            });
        });
    });

    const renderApp = (history: MemoryHistory, docsLength: number): RenderResult => {
        const documents: UploadDocument[] = [];
        for (let i = 1; i <= docsLength; i++) {
            documents.push({
                attempts: 0,
                id: `${i}`,
                docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                file: new File(['file'], `file ${i}.pdf`, { type: 'application/pdf' }),
                state: DOCUMENT_UPLOAD_STATE.SELECTED,
            });
        }

        return render(
            <ReactRouter.Router navigator={history} location={history.location}>
                <DocumentUploadConfirmStage
                    documents={documents}
                    confirmFiles={mockConfirmFiles}
                    setDocuments={() => {}}
                />
            </ReactRouter.Router>,
        );
    };
});
