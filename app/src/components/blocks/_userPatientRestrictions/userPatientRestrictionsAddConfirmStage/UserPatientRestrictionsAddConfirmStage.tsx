import { Link } from 'react-router-dom';
import useTitle from '../../../../helpers/hooks/useTitle';
import { UserInformation } from '../../../../types/generic/userPatientRestriction';
import BackButton from '../../../generic/backButton/BackButton';
import PatientSummary from '../../../generic/patientSummary/PatientSummary';
import StaffMemberDetails from '../../../generic/staffMemberDetails/StaffMemberDetails';
import { routeChildren } from '../../../../types/generic/routes';
import { Button } from 'nhsuk-react-components';

type Props = {
    userInformation: UserInformation;
};

const UserPatientRestrictionsAddConfirmStage = ({ userInformation }: Props): React.JSX.Element => {
    const pageTitle = 'Check the details of the restriction';
    useTitle({ pageTitle });

    const addRestriction = (): void => {};

    return (
        <>
            <BackButton />

            <h1>{pageTitle}</h1>

            <h3>You are adding a restriction to this patient record:</h3>
            <PatientSummary oneLine />

            <p>
                When you add a restriction, it will stay with this patient's record until it is
                removed. If the patient moves practice, the new practice will see the name and NHS
                smartcard number of the staff member you've restricted.
            </p>

            <StaffMemberDetails userInformation={userInformation} />

            <div className="action-button-group">
                <Button data-testid="continue-button" onClick={addRestriction}>
                    Continue to add this restriction
                </Button>
                <Link className="ml-4" to={routeChildren.USER_PATIENT_RESTRICTIONS_ADD_CANCEL}>
                    Cancel without adding a restriction
                </Link>
            </div>
        </>
    );
};

export default UserPatientRestrictionsAddConfirmStage;
