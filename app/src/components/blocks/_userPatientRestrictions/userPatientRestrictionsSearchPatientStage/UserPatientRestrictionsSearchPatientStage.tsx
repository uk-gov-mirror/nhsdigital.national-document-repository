import { useNavigate } from 'react-router-dom';
import useTitle from '../../../../helpers/hooks/useTitle';
import { usePatientDetailsContext } from '../../../../providers/patientProvider/PatientProvider';
import { PatientDetails } from '../../../../types/generic/patientDetails';
import { routeChildren, routes } from '../../../../types/generic/routes';
import BackButton from '../../../generic/backButton/BackButton';
import PatientSearchForm from '../../../generic/patientSearchForm/PatientSearchForm';
import { UIErrorCode } from '../../../../types/generic/errors';

const UserPatientRestrictionsSearchPatientStage = (): React.JSX.Element => {
    const [, setPatientDetails] = usePatientDetailsContext();
    const navigate = useNavigate();
    const pageTitle = 'Search for a patient';
    useTitle({ pageTitle });

    const onSearchSuccess = (patientDetails: PatientDetails): void => {
        if (patientDetails.deceased) {
            navigate(routes.GENERIC_ERROR + `?errorCode=${UIErrorCode.PATIENT_DECEASED}`);
            return;
        }

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

    return (
        <>
            <BackButton />

            <PatientSearchForm
                onSuccess={onSearchSuccess}
                title="Search for a patient"
                subtitle="Enter the patient's NHS number to add a restriction"
            />
        </>
    );
};

export default UserPatientRestrictionsSearchPatientStage;
