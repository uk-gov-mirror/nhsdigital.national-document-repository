import { render, waitFor, screen } from '@testing-library/react';
import DocumentUploadCompleteStage from './DocumentUploadCompleteStage';
import userEvent from '@testing-library/user-event';
import { routes } from '../../../../types/generic/routes';
import { LinkProps, MemoryRouter } from 'react-router-dom';
import {
    buildDocumentConfig,
    buildLgFile,
    buildPatientDetails,
} from '../../../../helpers/test/testBuilders';
import { getFormattedDate } from '../../../../helpers/utils/formatDate';
import { formatNhsNumber } from '../../../../helpers/utils/formatNhsNumber';
import usePatient from '../../../../helpers/hooks/usePatient';
import { getFormattedPatientFullName } from '../../../../helpers/utils/formatPatientFullName';
import {
    DOCUMENT_UPLOAD_STATE,
    UploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';

const mockNavigate = vi.fn();
vi.mock('../../../../helpers/hooks/usePatient');
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        Link: (props: LinkProps) => <a {...props} role="link" />,
    };
});

URL.createObjectURL = vi.fn();

const patientDetails = buildPatientDetails();
const docConfig = buildDocumentConfig();

describe('DocumentUploadCompleteStage', () => {
    let documents: UploadDocument[] = [];
    beforeEach(() => {
        vi.mocked(usePatient).mockReturnValue(patientDetails);
        import.meta.env.VITE_ENVIRONMENT = 'vitest';

        documents = [
            {
                docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                id: '1',
                file: buildLgFile(1),
                attempts: 0,
                state: DOCUMENT_UPLOAD_STATE.SUCCEEDED,
                numPages: 5,
                position: 1,
            },
        ];
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders', async () => {
        renderApp(documents);

        const expectedFullName = getFormattedPatientFullName(patientDetails);
        expect(screen.getByTestId('patient-name').textContent).toEqual(
            'Patient name: ' + expectedFullName,
        );

        const expectedNhsNumber = formatNhsNumber(patientDetails.nhsNumber);
        expect(screen.getByTestId('nhs-number').textContent).toEqual(
            'NHS number: ' + expectedNhsNumber,
        );

        const expectedDob = getFormattedDate(new Date(patientDetails.birthDate));
        expect(screen.getByTestId('dob').textContent).toEqual('Date of birth: ' + expectedDob);

        expect(
            screen.queryByText('You are not the data controller', {
                exact: false,
            }),
        ).not.toBeInTheDocument();
    });

    it('should navigate to search when clicking the search link', async () => {
        delete (globalThis as any).location;
        globalThis.location = { search: '?journey=update' } as any;

        renderApp(documents);

        await userEvent.click(screen.getByTestId('search-patient-link'));

        await waitFor(async () => {
            expect(mockNavigate).toHaveBeenCalledWith(routes.SEARCH_PATIENT, { replace: true });
        });
    });

    it('should navigate to home when clicking the go to home button', async () => {
        renderApp(documents);

        await userEvent.click(screen.getByTestId('home-btn'));

        await waitFor(async () => {
            expect(mockNavigate).toHaveBeenCalledWith(routes.HOME, { replace: true });
        });
    });

    it('should navigate to home if not all documents are in a finished state', async () => {
        documents.push({
            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
            id: '2',
            file: buildLgFile(2),
            attempts: 0,
            state: DOCUMENT_UPLOAD_STATE.UPLOADING,
            numPages: 3,
            position: 2,
        });

        renderApp(documents);

        await waitFor(async () => {
            expect(mockNavigate).toHaveBeenCalledWith(routes.HOME);
        });
    });

    it('should navigate to patient documents if partial upload complete', async () => {
        documents.push({
            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
            id: '2',
            file: buildLgFile(2),
            attempts: 0,
            state: DOCUMENT_UPLOAD_STATE.ERROR,
            numPages: 3,
            position: 2,
        });

        renderApp(documents);

        await userEvent.click(screen.getByTestId('patient-docs-btn'));

        await waitFor(async () => {
            expect(mockNavigate).toHaveBeenCalledWith(routes.PATIENT_DOCUMENTS, { replace: true });
        });
    });

    it.each([
        { docState: DOCUMENT_UPLOAD_STATE.SUCCEEDED, expectedTitle: 'Upload complete' },
        { docState: DOCUMENT_UPLOAD_STATE.ERROR, expectedTitle: 'Upload partially complete' },
    ])('should set the page title based on upload success', async ({ docState, expectedTitle }) => {
        documents = [
            {
                docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                id: '2',
                file: buildLgFile(2),
                attempts: 0,
                state: docState,
                numPages: 3,
                position: 2,
            },
        ];

        renderApp(documents);

        expect(screen.getByTestId('page-title').textContent).toBe(expectedTitle);
    });

    it('should list failed documents', async () => {
        documents.push({
            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
            id: '2',
            file: buildLgFile(2),
            attempts: 0,
            state: DOCUMENT_UPLOAD_STATE.ERROR,
            numPages: 3,
            position: 2,
        });

        renderApp(documents);

        await userEvent.click(screen.getByTestId('accordion-toggle-button'));

        expect(screen.getByText(documents[1].file.name)).toBeInTheDocument();
    });

    it('should render non-data controller message when user is not data controller', async () => {
        vi.mocked(usePatient).mockReturnValueOnce(
            buildPatientDetails({
                canManageRecord: false,
            }),
        );

        renderApp(documents);

        expect(
            screen.getByText('You are not the data controller', {
                exact: false,
            }),
        ).toBeInTheDocument();
    });

    const renderApp = (documents: UploadDocument[]): void => {
        render(
            <MemoryRouter>
                <DocumentUploadCompleteStage documents={documents} documentConfig={docConfig} />,
            </MemoryRouter>,
        );
    };
});
