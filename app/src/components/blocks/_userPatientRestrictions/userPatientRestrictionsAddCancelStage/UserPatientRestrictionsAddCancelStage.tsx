import { Button } from 'nhsuk-react-components';
import useTitle from '../../../../helpers/hooks/useTitle';
import BackButton from '../../../generic/backButton/BackButton';
import PatientSummary from '../../../generic/patientSummary/PatientSummary';
import { useNavigate, Link } from 'react-router-dom';
import { routes } from '../../../../types/generic/routes';

const UserPatientRestrictionsCancelAddStage = (): React.JSX.Element => {
    const navigate = useNavigate();
    const pageTitle = 'Are you sure you want to cancel adding this restriction?';
    useTitle({ pageTitle });

    return (
        <>
            <BackButton />

            <h1>{pageTitle}</h1>

            <PatientSummary oneLine />

            <p>If you cancel, a restriction will not be added to this patient's record.</p>

            <div className="action-button-group">
                <Button
                    data-testid="confirm-cancel-button"
                    onClick={(): void => {
                        navigate(routes.USER_PATIENT_RESTRICTIONS);
                    }}
                >
                    Continue to cancel
                </Button>
                <Link
                    data-testid="go-back-link"
                    className="ml-4"
                    to=""
                    onClick={(e): void => {
                        e.preventDefault();
                        navigate(-1);
                    }}
                >
                    Go back to add the restriction
                </Link>
            </div>
        </>
    );
};

export default UserPatientRestrictionsCancelAddStage;
