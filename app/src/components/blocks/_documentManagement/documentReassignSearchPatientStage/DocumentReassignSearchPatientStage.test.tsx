import { render, screen } from '@testing-library/react';
import { Mock } from 'vitest';
import DocumentReassignSearchPatientStage from './DocumentReassignSearchPatientStage';
import userEvent from '@testing-library/user-event';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { GlobalConfig } from '../../../../providers/configProvider/ConfigProvider';
import { PatientDetails } from '../../../../types/generic/patientDetails';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';
import { UIErrorCode } from '../../../../types/generic/errors';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        Link: ({
            children,
            onClick,
        }: {
            children: React.ReactNode;
            onClick?: () => void;
        }): React.JSX.Element => <button onClick={onClick}>{children}</button>,
    };
});
vi.mock('../../../generic/pdfViewer/PdfViewer', () => ({
    default: (): React.JSX.Element => <div data-testid="mock-pdf-preview" />,
}));
vi.mock('../../../../helpers/utils/handlePatientSearch', async () => {
    const actual = await vi.importActual('../../../../helpers/utils/handlePatientSearch');
    return {
        ...actual,
        handleSearch: mockHandleSearch,
    };
});
vi.mock('../../../../helpers/hooks/useBaseAPIHeaders', () => ({
    default: (): Record<string, string> => ({
        'Content-Type': 'application/json',
        Authorization: 'test-token',
    }),
}));
vi.mock('../../../../helpers/hooks/useConfig', () => ({
    default: (): GlobalConfig => ({
        mockLocal: {
            patientIsActive: true,
            patientIsDeceased: false,
        },
        featureFlags: {
            uploadDocumentIteration3Enabled: true,
            uploadArfWorkflowEnabled: false,
            uploadLambdaEnabled: true,
            uploadLloydGeorgeWorkflowEnabled: true,
        },
    }),
}));
vi.mock('../../../../helpers/hooks/useBaseAPIUrl');

const mockNavigate = vi.fn();
const mockHandleSearch = vi.hoisted(() => vi.fn());

describe('DocumentReassignSearchPatientStage', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockHandleSearch.mockImplementation(({ handleSuccess }) => {
            handleSuccess(buildPatientDetails() as PatientDetails);
        });
    });

    it('renders the patient search form', () => {
        render(
            <DocumentReassignSearchPatientStage
                reassignedPagesBlob={new Blob()}
                setPatientForReassign={vi.fn()}
            />,
        );

        expect(screen.getByText('Search for the correct patient')).toBeInTheDocument();
    });

    it('navigates to error page when patient is deceased', async () => {
        render(
            <DocumentReassignSearchPatientStage
                reassignedPagesBlob={new Blob()}
                setPatientForReassign={vi.fn()}
            />,
        );

        mockHandleSearch.mockImplementationOnce(({ handleSuccess }) => {
            handleSuccess(buildPatientDetails({ deceased: true }) as PatientDetails);
        });

        const searchInput = screen.getByTestId('nhs-number-input');
        await userEvent.type(searchInput, '1234567890');
        const searchButton = screen.getByTestId('search-submit-btn');
        await userEvent.click(searchButton);

        expect(mockNavigate).toHaveBeenCalledWith(
            routes.GENERIC_ERROR + `?errorCode=${UIErrorCode.PATIENT_DECEASED}`,
        );
    });

    it('navigates to verify patient details on successful search', async () => {
        render(
            <DocumentReassignSearchPatientStage
                reassignedPagesBlob={new Blob()}
                setPatientForReassign={vi.fn()}
            />,
        );

        const searchInput = screen.getByTestId('nhs-number-input');
        await userEvent.type(searchInput, '1234567890');
        const searchButton = screen.getByTestId('search-submit-btn');
        await userEvent.click(searchButton);

        expect(mockNavigate).toHaveBeenCalledWith(
            routeChildren.DOCUMENT_REASSIGN_VERIFY_PATIENT_DETAILS,
        );
    });

    it("navigates to download pages when don't know the NHS number is clicked", async () => {
        render(
            <DocumentReassignSearchPatientStage
                reassignedPagesBlob={new Blob()}
                setPatientForReassign={vi.fn()}
            />,
        );

        const dontKnowButton = screen.getByText("I don't know the NHS number");
        await userEvent.click(dontKnowButton);

        expect(mockNavigate).toHaveBeenCalledWith(routeChildren.DOCUMENT_REASSIGN_DOWNLOAD_PAGES);
    });
});
