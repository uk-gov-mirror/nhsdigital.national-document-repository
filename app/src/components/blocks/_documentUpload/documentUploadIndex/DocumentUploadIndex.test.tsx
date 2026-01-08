import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import DocumentUploadIndex from './DocumentUploadIndex';
import usePatient from '../../../../helpers/hooks/usePatient';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import getDocument from '../../../../helpers/requests/getDocument';
import getDocumentSearchResults from '../../../../helpers/requests/getDocumentSearchResults';
import { isMock } from '../../../../helpers/utils/isLocal';
import axios, { AxiosError } from 'axios';
import { routeChildren, routes } from '../../../../types/generic/routes';
import userEvent from '@testing-library/user-event';
import { DOCUMENT_TYPE_CONFIG, getConfigForDocType } from '../../../../helpers/utils/documentType';

vi.mock('../../../../styles/right-chevron-circle.svg', () => ({
    ReactComponent: () => 'svg',
}));
vi.mock('../../../../helpers/hooks/usePatient');
vi.mock('../../../../helpers/hooks/useBaseAPIUrl');
vi.mock('../../../../helpers/hooks/useBaseAPIHeaders');
vi.mock('../../../../helpers/requests/getDocument');
vi.mock('../../../../helpers/requests/getDocumentSearchResults');
vi.mock('../../../../helpers/utils/isLocal');
vi.mock('axios');
vi.mock('../../../../helpers/utils/documentType', async () => {
    const actual = await vi.importActual('../../../../helpers/utils/documentType');
    return {
        ...actual,
        getConfigForDocType: vi.fn(),
    };
});
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});
vi.mock('../../../generic/patientSummary/PatientSummary', () => ({
    default: () => <div>Patient Summary Component</div>,
}));

const mockSetDocumentType = vi.fn();
const mockSetJourney = vi.fn();
const mockUpdateExistingDocuments = vi.fn();
const mockNavigate = vi.fn();

const defaultProps = {
    setDocumentType: mockSetDocumentType,
    setJourney: mockSetJourney,
    updateExistingDocuments: mockUpdateExistingDocuments,
};

const mockPatient = {
    nhsNumber: '1234567890',
    givenName: ['John'],
    familyName: 'Doe',
    birthDate: '1990-01-01',
    postalCode: 'AB1 2CD',
    canManageRecord: true,
};

const renderComponent = (props = defaultProps) => {
    return render(
        <BrowserRouter>
            <DocumentUploadIndex {...props} />
        </BrowserRouter>,
    );
};

describe('DocumentUploadIndex', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        (usePatient as Mock).mockReturnValue(mockPatient);
        (useBaseAPIUrl as Mock).mockReturnValue('http://localhost:3000');
        (useBaseAPIHeaders as Mock).mockReturnValue({});
        (getConfigForDocType as Mock).mockReturnValue({
            singleDocumentOnly: true,
        } as DOCUMENT_TYPE_CONFIG);
    });

    it('renders the page title correctly', () => {
        renderComponent();
        expect(screen.getByTestId('page-title')).toBeInTheDocument();
        expect(screen.getByText('Choose a document type to upload')).toBeInTheDocument();
    });

    it('renders document type cards for each configured document type', () => {
        renderComponent();
        const uploadLinks = screen.getAllByTestId(/upload-\d+-link/);
        expect(uploadLinks.length).toBeGreaterThan(0);
    });

    it('handles document type selection for non-single document types', async () => {
        (getConfigForDocType as Mock).mockReturnValueOnce({
            singleDocumentOnly: false,
        } as DOCUMENT_TYPE_CONFIG);

        renderComponent();
        const firstUploadLink = screen.getAllByTestId(/upload-\d+-link/)[0];

        await act(async () => {
            await userEvent.click(firstUploadLink);
        });

        await waitFor(() => {
            expect(mockSetDocumentType).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith(routeChildren.DOCUMENT_UPLOAD_SELECT_FILES);
        });
    });

    it('shows spinner when loading next document', async () => {
        (getDocumentSearchResults as Mock).mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve([]), 1000)),
        );

        renderComponent();
        const firstUploadLink = screen.getAllByTestId(/upload-\d+-link/)[0];

        await act(async () => {
            userEvent.click(firstUploadLink);
        });

        await waitFor(() => {
            expect(screen.getByText('Loading existing document...')).toBeInTheDocument();
        });
    });

    it('navigates to server error when patient details are missing', async () => {
        (usePatient as Mock).mockReturnValue(null);

        renderComponent();
        const firstUploadLink = screen.getAllByTestId(/upload-\d+-link/)[0];

        await act(async () => {
            userEvent.click(firstUploadLink);
        });

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(routes.SERVER_ERROR);
        });
    });

    it('handles single document type with no existing documents', async () => {
        (getDocumentSearchResults as Mock).mockResolvedValue([]);

        renderComponent();
        const firstUploadLink = screen.getAllByTestId(/upload-\d+-link/)[0];

        await act(async () => {
            userEvent.click(firstUploadLink);
        });

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(routeChildren.DOCUMENT_UPLOAD_SELECT_FILES);
        });
    });

    it('handles single document type with existing document', async () => {
        const mockSearchResult = {
            id: 'doc-123',
            fileName: 'test.pdf',
            version: '1',
        };

        (getDocumentSearchResults as Mock).mockResolvedValue([mockSearchResult]);
        (getDocument as Mock).mockResolvedValue({ url: 'http://example.com/doc.pdf' });
        global.fetch = vi.fn().mockResolvedValue({
            blob: () => Promise.resolve(new Blob(['test'], { type: 'application/pdf' })),
        });

        renderComponent();
        const firstUploadLink = screen.getAllByTestId(/upload-\d+-link/)[0];

        await act(async () => {
            userEvent.click(firstUploadLink);
        });

        await waitFor(() => {
            expect(mockSetJourney).toHaveBeenCalledWith('update');
            expect(mockUpdateExistingDocuments).toHaveBeenCalledWith([
                expect.objectContaining({
                    fileName: 'test.pdf',
                    documentId: 'doc-123',
                    versionId: '1',
                }),
            ]);
        });
    });

    it('handles search error', async () => {
        const mockError = new AxiosError('Network Error');
        (getDocumentSearchResults as Mock).mockRejectedValue(mockError);
        (isMock as Mock).mockReturnValue(true);
        (axios.get as Mock).mockResolvedValue({
            data: new Blob(['mock data'], { type: 'application/pdf' }),
        });

        renderComponent();
        const firstUploadLink = screen.getAllByTestId(/upload-\d+-link/)[0];

        await act(async () => {
            userEvent.click(firstUploadLink);
        });

        await waitFor(() => {
            expect(mockUpdateExistingDocuments).toHaveBeenCalledWith([
                expect.objectContaining({
                    fileName: 'testFile.pdf',
                    documentId: 'mock-document-id',
                    versionId: '1',
                }),
            ]);
        });
    });

    it('handles 403 error and redirects to session expired', async () => {
        const mockError = new AxiosError('Forbidden');
        mockError.response = { status: 403 } as any;
        (getDocumentSearchResults as Mock).mockRejectedValue(mockError);
        (isMock as Mock).mockReturnValue(false);

        renderComponent();
        const firstUploadLink = screen.getAllByTestId(/upload-\d+-link/)[0];

        await act(async () => {
            userEvent.click(firstUploadLink);
        });

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
        });
    });

    it('handles other errors and redirects to server error with message', async () => {
        const mockError = new AxiosError();
        mockError.message = 'Server Error';
        mockError.response = { status: 500 } as any;
        (getDocumentSearchResults as Mock).mockRejectedValue(mockError);
        (isMock as Mock).mockReturnValue(false);

        renderComponent();
        const firstUploadLink = screen.getAllByTestId(/upload-\d+-link/)[0];

        await act(async () => {
            userEvent.click(firstUploadLink);
        });

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                `${routes.SERVER_ERROR}?message=Server%20Error`,
            );
        });
    });
});
