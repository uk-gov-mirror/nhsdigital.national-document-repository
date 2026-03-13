import { useNavigate } from 'react-router-dom';
import { routes } from '../../../../types/generic/routes';
import PatientVerifyForm from '../../../generic/patientVerifyForm/PatientVerifyForm';
import { PatientDetails } from '../../../../types/generic/patientDetails';
import BackButton from '../../../generic/backButton/BackButton';

type Props = {
    patientDetails: PatientDetails | null;
    onConfirmPatientDetails: () => void;
};

const DocumentReassignVerifyPatientDetailsStage = ({
    patientDetails,
    onConfirmPatientDetails,
}: Props): React.JSX.Element => {
    const navigate = useNavigate();

    if (!patientDetails) {
        navigate(routes.HOME);
        return <></>;
    }

    return (
        <>
            <BackButton />

            <h1>Patient details</h1>

            <PatientVerifyForm onSubmit={onConfirmPatientDetails} patientDetails={patientDetails} />
        </>
    );
};

export default DocumentReassignVerifyPatientDetailsStage;
