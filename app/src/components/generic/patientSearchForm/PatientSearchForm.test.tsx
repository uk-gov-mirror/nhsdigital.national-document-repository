import { render, screen } from '@testing-library/react';
import PatientSearchForm from './PatientSearchForm';
import userEvent from '@testing-library/user-event';
import useConfig from '../../../helpers/hooks/useConfig';
import { Mock } from 'vitest';
import usePatient from '../../../helpers/hooks/usePatient';
import { buildPatientDetails } from '../../../helpers/test/testBuilders';
import { getFormattedPatientFullName } from '../../../helpers/utils/formatPatientFullName';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): unknown => mockNavigate,
        Link: ({
            children,
            onClick,
        }: {
            children: React.ReactNode;
            onClick?: () => void;
        }): React.JSX.Element => <button onClick={onClick}>{children}</button>,
    };
});
vi.mock('../../../helpers/utils/handlePatientSearch', async () => ({
    ...(await vi.importActual('../../../helpers/utils/handlePatientSearch')),
    handlePatientSearchError: mockHandlePatientSearchError,
    handleSearch: mockHandleSearch,
}));
vi.mock('../../../helpers/hooks/useBaseAPIHeaders');
vi.mock('../../../helpers/hooks/useConfig');
vi.mock('../../../helpers/hooks/useBaseAPIUrl');
vi.mock('../../../helpers/hooks/usePatient');

const mockNavigate = vi.fn();
const mockHandlePatientSearchError = vi.hoisted(() => vi.fn());
const mockHandleSearch = vi.hoisted(() => vi.fn());
const mockUseConfig = useConfig as Mock;
const mockUsePatient = usePatient as Mock;

describe('PatientSearchForm', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockUseConfig.mockReturnValue({
            mockLocal: true,
        });
    });

    it('calls custom error handler on failure when provided', async () => {
        renderComponent();

        const error = {
            response: {
                status: 403,
                data: {
                    err_code: 'SP_4006',
                },
            },
        };
        mockHandleSearch.mockResolvedValue([null, 403, error]);

        const input = screen.getByTestId('nhs-number-input');
        await userEvent.type(input, '1234567890');
        const errorButton = screen.getByTestId('search-submit-btn');
        await userEvent.click(errorButton);

        expect(mockError).toHaveBeenCalledWith(error);
    });

    it('sets input error to errorCode when error code is set', async () => {
        renderComponent();

        const errorCode = 'patient not found';
        const error = {
            response: {
                status: 404,
                data: {
                    err_code: errorCode,
                },
            },
        };
        mockHandleSearch.mockResolvedValue([errorCode, 404, error]);

        const input = screen.getByTestId('nhs-number-input');
        await userEvent.type(input, '1234567890');
        const errorButton = screen.getByTestId('search-submit-btn');
        await userEvent.click(errorButton);

        expect(screen.getAllByText(errorCode)).toHaveLength(2);
    });

    it('calls default error handler when error code is not set', async () => {
        renderComponent();

        const statusCode = 403;
        const error = {
            response: {
                status: statusCode,
                data: {
                    err_code: null,
                },
            },
        };
        mockHandleSearch.mockResolvedValue([null, statusCode, error]);

        const input = screen.getByTestId('nhs-number-input');
        await userEvent.type(input, '1234567890');
        const errorButton = screen.getByTestId('search-submit-btn');
        await userEvent.click(errorButton);

        expect(mockHandlePatientSearchError).toHaveBeenCalledWith(
            statusCode,
            mockNavigate,
            expect.anything(),
            error,
        );
    });

    it('should call onSuccess when search is successful', async () => {
        renderComponent();

        const patientDetails = {
            name: 'John Doe',
            nhsNumber: '1234567890',
            dateOfBirth: '01/01/1980',
        };
        mockHandleSearch.mockImplementation(({ handleSuccess }) => {
            handleSuccess(patientDetails);
            return null;
        });

        const input = screen.getByTestId('nhs-number-input');
        await userEvent.type(input, '1234567890');
        const continueButton = screen.getByTestId('search-submit-btn');
        await userEvent.click(continueButton);

        expect(mockSuccess).toHaveBeenCalledWith(patientDetails);
    });

    it('should render patient details when displayPatientDetails is true', async () => {
        const patient = buildPatientDetails();
        mockUsePatient.mockReturnValue(patient);

        render(
            <PatientSearchForm
                onSuccess={mockSuccess}
                onError={mockError}
                title="Patient search"
                displayPatientDetails={true}
            />,
        );

        expect(screen.getByText(getFormattedPatientFullName(patient))).toBeInTheDocument();
    });

    it('should not render patient details when displayPatientDetails is false', async () => {
        const patient = buildPatientDetails();
        mockUsePatient.mockReturnValue(patient);

        render(
            <PatientSearchForm
                onSuccess={mockSuccess}
                onError={mockError}
                title="Patient search"
                displayPatientDetails={false}
            />,
        );

        expect(screen.queryByText(getFormattedPatientFullName(patient))).not.toBeInTheDocument();
    });

    it('should call secondaryAction fn when provided with secondaryActionText', async () => {
        const mockSecondaryAction = vi.fn();

        render(
            <PatientSearchForm
                onSuccess={mockSuccess}
                onError={mockError}
                title="Patient search"
                secondaryActionText="Can't find NHS number?"
                onSecondaryActionClicked={mockSecondaryAction}
            />,
        );

        const secondaryActionButton = screen.getByText("Can't find NHS number?");
        await userEvent.click(secondaryActionButton);

        expect(mockSecondaryAction).toHaveBeenCalled();
    });

    it('displays spinner while search is in progress', async () => {
        renderComponent();

        mockHandleSearch.mockResolvedValue(new Promise(() => {}));

        const input = screen.getByTestId('nhs-number-input');
        await userEvent.type(input, '1234567890');
        const continueButton = screen.getByTestId('search-submit-btn');
        await userEvent.click(continueButton);

        expect(screen.getByText('Searching...')).toBeInTheDocument();
    });
});

const mockSuccess = vi.fn();
const mockError = vi.fn();
const renderComponent = (): void => {
    render(
        <PatientSearchForm onSuccess={mockSuccess} onError={mockError} title="Patient search" />,
    );
};
