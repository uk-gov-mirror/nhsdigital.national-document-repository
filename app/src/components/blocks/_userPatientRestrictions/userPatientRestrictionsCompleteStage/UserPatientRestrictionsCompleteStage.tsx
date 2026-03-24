import { useNavigate } from 'react-router-dom';
import useTitle from '../../../../helpers/hooks/useTitle';
import { UserPatientRestrictionsSubRoute } from '../../../../types/generic/userPatientRestriction';
import usePatient from '../../../../helpers/hooks/usePatient';
import { getFormattedPatientFullName } from '../../../../helpers/utils/formatPatientFullName';
import { formatNhsNumber } from '../../../../helpers/utils/formatNhsNumber';
import { getFormattedDateFromString } from '../../../../helpers/utils/formatDate';
import { Button } from 'nhsuk-react-components';
import { routes } from '../../../../types/generic/routes';

type Props = {
    route: UserPatientRestrictionsSubRoute;
};

const UserPatientRestrictionsCompleteStage = ({ route }: Props): React.JSX.Element => {
    const navigate = useNavigate();
    const patientDetails = usePatient();

    const pageTitle =
        route === UserPatientRestrictionsSubRoute.ADD
            ? 'A restriction has been added to this patient record:'
            : 'A restriction on accessing this patient record has been removed:';
    useTitle({ pageTitle });

    return (
        <>
            <div className="nhsuk-panel" data-testid="action-complete-card">
                <h1 data-testid="page-title" className="nhsuk-panel__title">
                    {pageTitle}
                </h1>
                <br />
                <div className="nhsuk-panel__body">
                    <strong data-testid="patient-name">
                        Patient name: {getFormattedPatientFullName(patientDetails)}
                    </strong>
                    <br />
                    <span data-testid="nhs-number">
                        NHS number: {formatNhsNumber(patientDetails!.nhsNumber)}
                    </span>
                    <br />
                    <span data-testid="dob">
                        Date of birth: {getFormattedDateFromString(patientDetails!.birthDate)}
                    </span>
                </div>
            </div>

            {route === UserPatientRestrictionsSubRoute.ADD ? (
                <p data-testid="restriction-added-message">
                    When you add a restriction, it will stay with this patient's record until it's
                    removed. If the patient moves practice, the new practice will see the name and
                    NHS smartcard number of the staff member you've restricted.
                </p>
            ) : (
                <p data-testid="restriction-removed-message">
                    The staff member can now access this patient's record.
                </p>
            )}

            <h3>What happens next</h3>
            <p>You can add, view and make changes to restrictions by going to the admin hub.</p>

            <Button
                data-testid="view-restrictions-button"
                onClick={(): void => {
                    navigate(routes.USER_PATIENT_RESTRICTIONS);
                }}
            >
                Go to view restrictions
            </Button>
        </>
    );
};

export default UserPatientRestrictionsCompleteStage;
