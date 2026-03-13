import useTitle from '../../../../helpers/hooks/useTitle';
import BackButton from '../../../generic/backButton/BackButton';
import { PatientDetails } from '../../../../types/generic/patientDetails';
import PatientVerifyForm from '../../../generic/patientVerifyForm/PatientVerifyForm';

type ReviewDetailsPatientVerifyStageProps = {
    onSubmit: () => void;
    patientDetails: PatientDetails;
};

const ReviewDetailsPatientVerifyStage = ({
    onSubmit,
    patientDetails,
}: ReviewDetailsPatientVerifyStageProps): React.JSX.Element => {
    const pageHeader = 'Patient details';
    useTitle({ pageTitle: pageHeader });

    return (
        <div className="patient-results-paragraph">
            <BackButton />

            <h1>{pageHeader}</h1>

            <PatientVerifyForm patientDetails={patientDetails} onSubmit={onSubmit} />
        </div>
    );
};

export default ReviewDetailsPatientVerifyStage;
