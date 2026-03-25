import { useNavigate } from 'react-router-dom';
import useTitle from '../../../../helpers/hooks/useTitle';
import { usePatientDetailsContext } from '../../../../providers/patientProvider/PatientProvider';
import { PatientDetails } from '../../../../types/generic/patientDetails';
import { routeChildren, routes } from '../../../../types/generic/routes';
import BackButton from '../../../generic/backButton/BackButton';
import PatientSearchForm from '../../../generic/patientSearchForm/PatientSearchForm';
import { UIErrorCode } from '../../../../types/generic/errors';
import { AxiosError } from 'axios';
import { ErrorResponse } from '../../../../types/generic/errorResponse';

const UserPatientRestrictionsSearchPatientStage = (): React.JSX.Element => {
    const [, setPatientDetails] = usePatientDetailsContext();
    const navigate = useNavigate();
    const pageTitle = 'Search for a patient';
    useTitle({ pageTitle });

    const onSearchSuccess = (patientDetails: PatientDetails): void => {
        if (!patientDetails.canManageRecord) {
            navigate(
                routes.GENERIC_ERROR +
                    `?errorCode=${UIErrorCode.PATIENT_NOT_REGISTERED_AT_YOUR_PRACTICE}`,
            );
            return;
        }

        setPatientDetails(patientDetails);
        navigate(routeChildren.USER_PATIENT_RESTRICTIONS_VERIFY_PATIENT);
    };

    const onSearchError = (error: AxiosError): void => {
        const errorResponse = error.response?.data as ErrorResponse;
        if (errorResponse?.err_code === 'SP_4006') {
            navigate(routes.GENERIC_ERROR + `?errorCode=${UIErrorCode.PATIENT_ACCESS_RESTRICTED}`);
        }
    };

    return (
        <>
            <BackButton />

            <PatientSearchForm
                onSuccess={onSearchSuccess}
                onError={onSearchError}
                title="Search for a patient"
                subtitle="Enter the patient's NHS number to add a restriction"
            />
        </>
    );
};

export default UserPatientRestrictionsSearchPatientStage;
