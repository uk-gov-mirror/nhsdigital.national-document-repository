import { render, waitFor, screen, RenderResult } from '@testing-library/react';
import DocumentUploadConfirmStage from './DocumentUploadConfirmStage';
import { formatNhsNumber } from '../../../../helpers/utils/formatNhsNumber';
import { getFormattedDate } from '../../../../helpers/utils/formatDate';
import { buildDocument, buildPatientDetails } from '../../../../helpers/test/testBuilders';
import usePatient from '../../../../helpers/hooks/usePatient';
import {
    DOCUMENT_UPLOAD_STATE,
    UploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';
import * as ReactRouter from 'react-router-dom';
import { MemoryHistory, createMemoryHistory } from 'history';
import userEvent from '@testing-library/user-event';
import { getFormattedPatientFullName } from '../../../../helpers/utils/formatPatientFullName';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';
import { getJourney } from '../../../../helpers/utils/urlManipulations';
import { Mock } from 'vitest';

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
        useNavigate: (): Mock => mockedUseNavigate,
    };
});

const mockedUseNavigate = vi.fn();

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

const mockConfirmFiles = vi.fn();

let mockDocuments: UploadDocument[] = [];

describe('DocumentUploadConfirmStage', () => {
    beforeEach(() => {
        vi.mocked(usePatient).mockReturnValue(patientDetails);

        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        history = createMemoryHistory({ initialEntries: ['/'], initialIndex: 0 });
    });
    afterEach(() => {
        vi.clearAllMocks();
        mockDocuments = [];
    });

    it('renders', async () => {
        renderApp(history);

        await waitFor(async () => {
            expect(screen.getByText('Check files are for the correct patient')).toBeInTheDocument();
        });
    });

    it('should call confirmFiles when confirm button is clicked', async () => {
        renderApp(history);

        await userEvent.click(await screen.findByTestId('confirm-button'));

        await waitFor(() => {
            expect(mockConfirmFiles).toHaveBeenCalled();
        });
    });

    it.each([
        { fileCount: 3, expectedPreviewCount: 3, docType: DOCUMENT_TYPE.LLOYD_GEORGE },
        { fileCount: 1, expectedPreviewCount: 1, docType: DOCUMENT_TYPE.EHR },
    ])(
        'should render correct number files in the preview %s',
        async ({ fileCount, expectedPreviewCount, docType }) => {
            for (let i = 1; i <= fileCount; i++) {
                mockDocuments.push(
                    buildDocument(
                        new File(['file'], `file 1.pdf`, { type: 'application/pdf' }),
                        DOCUMENT_UPLOAD_STATE.SELECTED,
                        docType,
                    ),
                );
            }
            renderApp(history);

            await waitFor(async () => {
                expect(screen.getByTestId('lloyd-george-preview-count').textContent).toBe(
                    `${expectedPreviewCount}`,
                );
            });
        },
    );

    it('should hide preview when the previewed document is removed', async () => {
        mockDocuments.push(
            buildDocument(
                new File(['file'], `file 1.pdf`, { type: 'application/pdf' }),
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.EHR_ATTACHMENTS,
            ),
        );
        mockDocuments.push(
            buildDocument(
                new File(['file'], `file 2.pdf`, { type: 'application/pdf' }),
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.EHR_ATTACHMENTS,
            ),
        );
        renderApp(history);

        const firstDocumentViewButton = await screen.findByTestId(
            `preview-${mockDocuments[0].id}-button`,
        );
        expect(firstDocumentViewButton).toBeInTheDocument();

        await userEvent.click(firstDocumentViewButton);

        await waitFor(() => {
            expect(screen.getByTestId('lloyd-george-preview')).toBeInTheDocument();
        });

        const removeButton = screen.getByTestId(`remove-${mockDocuments[0].id}-button`);
        expect(removeButton).toBeInTheDocument();

        await userEvent.click(removeButton);

        await waitFor(() => {
            expect(screen.queryByTestId('lloyd-george-preview')).not.toBeInTheDocument();
        });
    });

    it('should show preview when 1 pdf remains after removing a document', async () => {
        mockDocuments.push(
            buildDocument(
                new File(['file'], `file 1.pdf`, { type: 'application/pdf' }),
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.EHR_ATTACHMENTS,
            ),
        );
        mockDocuments.push(
            buildDocument(
                new File(['file'], `file 2.txt`, { type: 'text/plain' }),
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.EHR_ATTACHMENTS,
            ),
        );
        renderApp(history);

        await waitFor(() => {
            expect(screen.queryByTestId('lloyd-george-preview')).not.toBeInTheDocument();
        });

        const removeButton = screen.getByTestId(`remove-${mockDocuments[0].id}-button`);
        expect(removeButton).toBeInTheDocument();

        await userEvent.click(removeButton);

        await waitFor(() => {
            expect(screen.queryByTestId('lloyd-george-preview')).not.toBeInTheDocument();
        });
    });

    describe('Navigation', () => {
        it('should navigate to previous screen when go back is clicked', async () => {
            renderApp(history);

            userEvent.click(await screen.findByTestId('go-back-link'));

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith(-1);
            });
        });

        it('renders patient summary fields is inset', async () => {
            renderApp(history);

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
            renderApp(history);

            await waitFor(async () => {
                expect(
                    screen.getByText('Check files are for the correct patient'),
                ).toBeInTheDocument();
                expect(screen.getByTestId('go-back-link')).toBeInTheDocument();
                expect(screen.getByTestId('confirm-button')).toBeInTheDocument();
            });
        });
    });

    const renderApp = (history: MemoryHistory): RenderResult => {
        if (mockDocuments.length === 0) {
            mockDocuments.push(
                buildDocument(
                    new File(['file'], `file 1.pdf`, { type: 'application/pdf' }),
                    DOCUMENT_UPLOAD_STATE.SELECTED,
                    DOCUMENT_TYPE.LLOYD_GEORGE,
                ),
            );
        }

        return render(
            <ReactRouter.Router navigator={history} location={history.location}>
                <DocumentUploadConfirmStage
                    documents={mockDocuments}
                    confirmFiles={mockConfirmFiles}
                    setDocuments={(): void => {}}
                />
            </ReactRouter.Router>,
        );
    };
});
