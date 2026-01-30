// need to use happy-dom for this test file as jsdom doesn't support DOMMatrix https://github.com/jsdom/jsdom/issues/2647
// @vitest-environment happy-dom
import { fireEvent, render, RenderResult, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory, MemoryHistory } from 'history';
import { getDocument } from 'pdfjs-dist';
import { JSX, useRef, useState } from 'react';
import * as ReactRouter from 'react-router-dom';
import usePatient from '../../../../helpers/hooks/usePatient';
import {
    buildDocumentConfig,
    buildLgFile,
    buildPatientDetails,
} from '../../../../helpers/test/testBuilders';
import { PDF_PARSING_ERROR_TYPE } from '../../../../helpers/utils/fileUploadErrorMessages';
import { getFormattedDate } from '../../../../helpers/utils/formatDate';
import { formatNhsNumber } from '../../../../helpers/utils/formatNhsNumber';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { UploadDocument } from '../../../../types/pages/UploadDocumentsPage/types';
import DocumentSelectStage, { Props } from './DocumentSelectStage';
import { getFormattedPatientFullName } from '../../../../helpers/utils/formatPatientFullName';
import { DOCUMENT_TYPE, DOCUMENT_TYPE_CONFIG } from '../../../../helpers/utils/documentType';

vi.mock('../../../../helpers/hooks/usePatient');
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        Link: (props: ReactRouter.LinkProps): JSX.Element => <a {...props} role="link" />,
        useNavigate: (): typeof mockedUseNavigate => mockedUseNavigate,
    };
});
vi.mock('pdfjs-dist');

const patientDetails = buildPatientDetails();

URL.createObjectURL = vi.fn();
const mockedUseNavigate = vi.fn();

let history = createMemoryHistory({
    initialEntries: ['/'],
    initialIndex: 0,
});

const docConfig = buildDocumentConfig();

describe('DocumentSelectStage', () => {
    beforeEach(() => {
        vi.mocked(usePatient).mockReturnValue(patientDetails);

        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        history = createMemoryHistory({ initialEntries: ['/'], initialIndex: 0 });
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly', async () => {
        renderApp(history);

        await waitFor(async () => {
            expect(
                screen.getByText(docConfig.content.uploadFilesSelectTitle as string),
            ).toBeInTheDocument();
        });

        const warningTexts = docConfig.content.chooseFilesWarningText;
        if (warningTexts) {
            expect(screen.getByText('Important')).toBeInTheDocument();
            const textsArray = ([] as string[]).concat(warningTexts);
            textsArray.forEach((text) => {
                const p = screen.getByText(text);
                expect(p.tagName.toLowerCase()).toBe('p');
                expect(screen.getByText(text)).toBeInTheDocument();
            });
        }
    });

    describe('file handling', () => {
        let lgDocumentOne: File, lgDocumentTwo: File;
        beforeEach(() => {
            lgDocumentOne = buildLgFile(1);
            lgDocumentTwo = buildLgFile(2);
        });

        it('can upload PDF file using drag and drop and button', async () => {
            renderApp(history);

            const uploadInput = screen.getByTestId('button-input');
            const dropzone = screen.getByTestId('dropzone');

            expect(
                screen.getByText('Drag and drop a file or multiple files here'),
            ).toBeInTheDocument();
            expect(dropzone);

            fireEvent.drop(dropzone, { dataTransfer: { files: [lgDocumentOne] } });

            const file1 = await screen.findByText(lgDocumentOne.name);
            expect(file1).toBeInTheDocument();

            await userEvent.upload(uploadInput, lgDocumentTwo);

            const file2 = await screen.findByText(lgDocumentTwo.name);
            expect(file2).toBeInTheDocument();

            const fileSelectedCount = screen.getAllByTestId('file-selected-count');
            expect(fileSelectedCount).toHaveLength(2);
            expect(fileSelectedCount[0]).toHaveTextContent('2 files chosen');
            expect(fileSelectedCount[1]).toHaveTextContent('2 files chosen');
        });

        it('can select and then remove a file', async () => {
            renderApp(history);

            await userEvent.upload(screen.getByTestId('button-input'), [
                lgDocumentOne,
                lgDocumentTwo,
            ]);

            let removeFile: HTMLElement;
            await waitFor(async () => {
                removeFile = await screen.findByRole('button', {
                    name: `Remove ${lgDocumentTwo.name} from selection`,
                });
            });

            await userEvent.click(removeFile!);

            await waitFor(async () => {
                expect(screen.getByText(lgDocumentOne.name)).toBeInTheDocument();
                expect(screen.queryByText(lgDocumentTwo.name)).not.toBeInTheDocument();
            });

            expect(
                screen.getByRole('heading', { level: 2, name: 'Before you upload' }),
            ).toBeInTheDocument();
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

        it('should show remove files error message when skip is clicked after selecting a file', async () => {
            const config = {
                ...docConfig,
                stitched: false,
            };
            renderApp(history, {
                showSkipLink: true,
                documentConfig: config,
            });

            await userEvent.upload(screen.getByTestId('button-input'), [
                buildLgFile(1),
            ]);

            await userEvent.click(await screen.findByTestId('skip-link'));

            await waitFor(() => {
                expect(screen.getByTestId('error-box')).toHaveTextContent(
                    'Remove files before you skip to the next step',
                );
            });
        });
    });

    describe('Navigation', () => {
        let lgDocumentOne: File;
        beforeEach(async () => {
            lgDocumentOne = await buildLgFile(1);
        });

        it('should navigate to the remove all screen when clicking remove all files', async () => {
            renderApp(history);
            const lgDocumentOne = await buildLgFile(1);

            await userEvent.upload(screen.getByTestId('button-input'), [lgDocumentOne]);

            await userEvent.click(await screen.findByTestId('remove-all-button'));

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith({
                    pathname: routeChildren.DOCUMENT_UPLOAD_REMOVE_ALL,
                    search: '',
                });
            });
        });

        it('should navigate to the previous screen when go back is clicked', async () => {
            renderApp(history);

            await userEvent.click(await screen.findByTestId('back-button'));

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith(routes.VERIFY_PATIENT);
            });
        });

        it('should call goToPreviousDocType when go back is clicked and function is provided', async () => {
            const goToPreviousDocType = vi.fn();
            renderApp(history, {
                goToPreviousDocType,
            });

            await userEvent.click(await screen.findByTestId('back-button'));

            await waitFor(() => {
                expect(goToPreviousDocType).toHaveBeenCalled();
            });
        });

        it('should call backLinkOverride when go back is clicked and function is provided', async () => {
            const backLinkOverride = 'test';
            renderApp(history, {
                backLinkOverride,
            });

            await userEvent.click(await screen.findByTestId('back-button'));

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith(backLinkOverride);
            });
        });

        it('should call goToNextDocType when skip clicked and function is provided', async () => {
            const goToNextDocType = vi.fn();
            renderApp(history, {
                goToNextDocType,
                showSkipLink: true,
            });

            await userEvent.click(await screen.findByTestId('skip-link'));

            await waitFor(() => {
                expect(goToNextDocType).toHaveBeenCalled();
            });
        });

        it('should navigate to select order when skip clicked and doc is stitched', async () => {
            renderApp(history, {
                showSkipLink: true,
            });

            await userEvent.click(await screen.findByTestId('skip-link'));

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith({
                    "pathname": routeChildren.DOCUMENT_UPLOAD_SELECT_ORDER,
                    "search": "",
                });
            });
        });

        it('should navigate to confirm page when skip clicked and doc is not stitched', async () => {
            const config = {
                ...docConfig,
                stitched: false,
            };
            renderApp(history, {
                showSkipLink: true,
                documentConfig: config,
            });

            await userEvent.click(await screen.findByTestId('skip-link'));

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith({
                    "pathname": routeChildren.DOCUMENT_UPLOAD_CONFIRMATION,
                    "search": "",
                });
            });
        });

        const errorCases = [
            ['password protected file', PDF_PARSING_ERROR_TYPE.PASSWORD_MISSING],
            ['invalid PDF structure', PDF_PARSING_ERROR_TYPE.INVALID_PDF_STRUCTURE],
            ['empty PDF', PDF_PARSING_ERROR_TYPE.EMPTY_PDF],
        ];

        it.each(errorCases)(
            'should navigate to file errors page when user selects a file that is a %s',
            async (_description, errorType) => {
                renderApp(history);

                vi.mocked(getDocument).mockImplementationOnce(() => {
                    throw new Error(errorType);
                });

                const dropzone = screen.getByTestId('dropzone');
                fireEvent.drop(dropzone, {
                    dataTransfer: { files: [lgDocumentOne] },
                });

                await waitFor(() => {
                    expect(mockedUseNavigate).toHaveBeenCalledWith(
                        routeChildren.DOCUMENT_UPLOAD_FILE_ERRORS,
                    );
                });
            },
        );

        it('should navigate to file errors page when user selects a file that is not a PDF', async () => {
            renderApp(history);
            const dropzone = screen.getByTestId('dropzone');
            const nonPdfFile = { ...lgDocumentOne, name: 'nonPdfFile.txt', type: 'text/plain' };
            fireEvent.drop(dropzone, {
                dataTransfer: { files: [nonPdfFile] },
            });

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith(
                    routeChildren.DOCUMENT_UPLOAD_FILE_ERRORS,
                );
            });
        });

        it('should navigate to file errors page when user selects a file that is a duplicate file name', async () => {
            renderApp(history);
            const dropzone = screen.getByTestId('dropzone');
            fireEvent.drop(dropzone, {
                dataTransfer: { files: [lgDocumentOne] },
            });

            await waitFor(() => {
                expect(screen.getByText(lgDocumentOne.name)).toBeInTheDocument();
            });

            fireEvent.drop(dropzone, {
                dataTransfer: { files: [lgDocumentOne] },
            });

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith(
                    routeChildren.DOCUMENT_UPLOAD_FILE_ERRORS,
                );
            });
        });
    });

    describe('Update Journey', () => {
        beforeEach(() => {
            delete (globalThis as any).location;
            globalThis.location = { search: '?journey=update' } as any;
        });

        it('should render correct title for update journey with Lloyd George document type', async () => {
            renderApp(history);

            await waitFor(async () => {
                expect(
                    screen.getByText(docConfig.content.addFilesSelectTitle as string),
                ).toBeInTheDocument();
            });
        });

        it('should upload files in update journey using drag and drop', async () => {
            renderApp(history);

            const lgDocumentOne = buildLgFile(1);
            const dropzone = screen.getByTestId('dropzone');

            fireEvent.drop(dropzone, { dataTransfer: { files: [lgDocumentOne] } });

            const file1 = await screen.findByText(lgDocumentOne.name);
            expect(file1).toBeInTheDocument();

            const fileSelectedCount = screen.getAllByTestId('file-selected-count');
            expect(fileSelectedCount).toHaveLength(2);
            expect(fileSelectedCount[0]).toHaveTextContent('1 file chosen');
            expect(fileSelectedCount[1]).toHaveTextContent('1 file chosen');
        });

        it('should upload multiple files in update journey using file input', async () => {
            renderApp(history);

            const lgDocumentOne = buildLgFile(1);
            const lgDocumentTwo = buildLgFile(2);
            const uploadInput = screen.getByTestId('button-input');

            await userEvent.upload(uploadInput, [lgDocumentOne, lgDocumentTwo]);

            const file1 = await screen.findByText(lgDocumentOne.name);
            const file2 = await screen.findByText(lgDocumentTwo.name);

            expect(file1).toBeInTheDocument();
            expect(file2).toBeInTheDocument();

            const fileSelectedCount = screen.getAllByTestId('file-selected-count');
            expect(fileSelectedCount).toHaveLength(2);
            expect(fileSelectedCount[0]).toHaveTextContent('2 files chosen');
            expect(fileSelectedCount[1]).toHaveTextContent('2 files chosen');
        });

        it('should remove individual files in update journey', async () => {
            renderApp(history);

            const lgDocumentOne = buildLgFile(1);
            const lgDocumentTwo = buildLgFile(2);

            await userEvent.upload(screen.getByTestId('button-input'), [
                lgDocumentOne,
                lgDocumentTwo,
            ]);

            let removeFile: HTMLElement;
            await waitFor(async () => {
                removeFile = await screen.findByRole('button', {
                    name: `Remove ${lgDocumentTwo.name} from selection`,
                });
            });

            await userEvent.click(removeFile!);

            await waitFor(async () => {
                expect(screen.getByText(lgDocumentOne.name)).toBeInTheDocument();
                expect(screen.queryByText(lgDocumentTwo.name)).not.toBeInTheDocument();
            });

            const fileSelectedCount = screen.getAllByTestId('file-selected-count');
            expect(fileSelectedCount).toHaveLength(2);
            expect(fileSelectedCount[0]).toHaveTextContent('1 file chosen');
        });

        it('should navigate to remove all screen when clicking remove all files in update journey', async () => {
            renderApp(history);
            const lgDocumentOne = buildLgFile(1);

            await userEvent.upload(screen.getByTestId('button-input'), [lgDocumentOne]);

            await userEvent.click(await screen.findByTestId('remove-all-button'));

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith({
                    pathname: routeChildren.DOCUMENT_UPLOAD_REMOVE_ALL,
                    search: 'journey=update',
                });
            });
        });

        it('should navigate to select order screen when continue is clicked in update journey', async () => {
            vi.mocked(getDocument).mockImplementationOnce(
                () =>
                    ({
                        promise: Promise.resolve({
                            numPages: 1,
                            getPage: vi.fn().mockResolvedValue({}),
                            destroy: vi.fn().mockResolvedValue(undefined),
                        }),
                    }) as any,
            );

            renderApp(history);
            const lgDocumentOne = buildLgFile(1);

            await userEvent.upload(screen.getByTestId('button-input'), [lgDocumentOne]);

            await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith({
                    pathname: routeChildren.DOCUMENT_UPLOAD_SELECT_ORDER,
                    search: 'journey=update',
                });
            });
        });

        it('should display patient summary correctly in update journey', async () => {
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

        it('should show error when trying to continue without selecting files in update journey', async () => {
            renderApp(history);

            await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));

            await waitFor(() => {
                expect(screen.getByTestId('error-box')).toBeInTheDocument();
                expect(screen.getByText('There is a problem')).toBeInTheDocument();
            });
        });

        it('should navigate to file errors page when user selects invalid file in update journey', async () => {
            renderApp(history);

            vi.mocked(getDocument).mockImplementationOnce(() => {
                throw new Error(PDF_PARSING_ERROR_TYPE.INVALID_PDF_STRUCTURE);
            });

            const lgDocumentOne = buildLgFile(1);
            const dropzone = screen.getByTestId('dropzone');

            fireEvent.drop(dropzone, {
                dataTransfer: { files: [lgDocumentOne] },
            });

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith(
                    routeChildren.DOCUMENT_UPLOAD_FILE_ERRORS,
                );
            });
        });

        it('should navigate back to verify patient screen when back button is clicked in update journey', async () => {
            renderApp(history);

            await userEvent.click(await screen.findByTestId('back-button'));

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith(routes.VERIFY_PATIENT);
            });
        });

        it('should display "Before you upload" instructions in update journey', async () => {
            renderApp(history);

            expect(
                screen.getByRole('heading', { level: 2, name: 'Before you upload' }),
            ).toBeInTheDocument();

            expect(screen.getByText('You can only upload PDF files')).toBeInTheDocument();
            expect(screen.getByText('Check your files open correctly')).toBeInTheDocument();
            expect(screen.getByText('Remove any passwords from files')).toBeInTheDocument();
        });
    });

    type TestAppProps = {
        goToPreviousDocType?: () => void;
        goToNextDocType?: () => void;
        backLinkOverride?: string;
        showSkipLink?: boolean;
        documentConfig?: DOCUMENT_TYPE_CONFIG;
    };

    const TestApp = ({ goToPreviousDocType, goToNextDocType, backLinkOverride, showSkipLink, documentConfig }: TestAppProps): JSX.Element => {
        const [documents, setDocuments] = useState<Array<UploadDocument>>([]);
        const filesErrorRef = useRef<boolean>(false);

        return (
            <DocumentSelectStage
                documents={documents}
                setDocuments={setDocuments}
                documentType={docConfig.snomedCode as DOCUMENT_TYPE}
                filesErrorRef={filesErrorRef}
                documentConfig={documentConfig ?? docConfig}
                goToPreviousDocType={goToPreviousDocType}
                goToNextDocType={goToNextDocType}
                showSkiplink={showSkipLink}
                backLinkOverride={backLinkOverride}
            />
        );
    };

    const renderApp = (history: MemoryHistory, props: Partial<TestAppProps> = {}): RenderResult => {
        return render(
            <ReactRouter.Router navigator={history} location={history.location}>
                <TestApp {...props} />
            </ReactRouter.Router>,
        );
    };
});
