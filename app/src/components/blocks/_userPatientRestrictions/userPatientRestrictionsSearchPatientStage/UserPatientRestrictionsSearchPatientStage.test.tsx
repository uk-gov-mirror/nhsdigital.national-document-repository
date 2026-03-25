import { render, screen } from '@testing-library/react';
import { Mock } from 'vitest';
import UserPatientRestrictionsSearchPatientStage from './UserPatientRestrictionsSearchPatientStage';
import { UIErrorCode } from '../../../../types/generic/errors';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { PatientDetails } from '../../../../types/generic/patientDetails';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';
import { AxiosError } from 'axios';
import userEvent from '@testing-library/user-event';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});
vi.mock('../../../../providers/patientProvider/PatientProvider', () => ({
    usePatientDetailsContext: (): unknown => mockUsePatientDetailsContext(),
}));

vi.mock('../../../generic/patientSearchForm/PatientSearchForm', () => ({
    default: ({
        onSuccess,
        onError,
    }: {
        onSuccess: (details: PatientDetails) => void;
        onError: (error: AxiosError) => void;
    }): React.JSX.Element => {
        return (
            <>
                <button
                    onClick={(): void => onSuccess(mockPatientDetails)}
                    data-testid="success-button"
                ></button>
                <button
                    onClick={(): void => onError(mockAxiosError)}
                    data-testid="error-button"
                ></button>
            </>
        );
    },
}));

vi.mock('../../../../helpers/utils/handlePatientSearch', () => ({
    handlePatientSearchError: mockHandlePatientSearchError,
}));

const mockNavigate = vi.fn();
const mockUsePatientDetailsContext = vi.fn();
const mockHandlePatientSearchError = vi.hoisted(() => vi.fn());
let mockPatientDetails = buildPatientDetails();
let mockAxiosError = {
    response: {
        status: 403,
        data: {
            err_code: 'SP_4006',
        },
    },
} as unknown as AxiosError;

describe('UserPatientRestrictionsSearchPatientStage', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockUsePatientDetailsContext.mockReturnValue([{}, vi.fn()]);
    });

    it('navigates to the error page if the user is not the data controller', async () => {
        mockPatientDetails = buildPatientDetails({ canManageRecord: false });

        render(<UserPatientRestrictionsSearchPatientStage />);

        const successButton = screen.getByTestId('success-button');
        await userEvent.click(successButton);

        expect(mockNavigate).toHaveBeenCalledWith(
            `${routes.GENERIC_ERROR}?errorCode=${UIErrorCode.PATIENT_NOT_REGISTERED_AT_YOUR_PRACTICE}`,
        );
    });

    it('navigates to the verify patient stage if the user is the data controller', async () => {
        const setPatientDetails = vi.fn();
        mockUsePatientDetailsContext.mockReturnValue([{}, setPatientDetails]);
        mockPatientDetails = buildPatientDetails({ canManageRecord: true });

        render(<UserPatientRestrictionsSearchPatientStage />);

        const successButton = screen.getByTestId('success-button');
        await userEvent.click(successButton);

        expect(setPatientDetails).toHaveBeenCalledWith(mockPatientDetails);
        expect(mockNavigate).toHaveBeenCalledWith(
            routeChildren.USER_PATIENT_RESTRICTIONS_VERIFY_PATIENT,
        );
    });

    it('navigates to the generic error page if patient access is restricted', async () => {
        render(<UserPatientRestrictionsSearchPatientStage />);

        const errorButton = screen.getByTestId('error-button');
        await userEvent.click(errorButton);

        expect(mockNavigate).toHaveBeenCalledWith(
            `${routes.GENERIC_ERROR}?errorCode=${UIErrorCode.PATIENT_ACCESS_RESTRICTED}`,
        );
    });
});
