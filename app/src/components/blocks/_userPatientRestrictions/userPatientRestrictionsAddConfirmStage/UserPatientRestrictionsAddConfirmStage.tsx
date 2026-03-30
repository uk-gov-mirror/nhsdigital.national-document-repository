import { Link, useNavigate } from 'react-router-dom';
import useTitle from '../../../../helpers/hooks/useTitle';
import { UserInformation } from '../../../../types/generic/userPatientRestriction';
import BackButton from '../../../generic/backButton/BackButton';
import PatientSummary from '../../../generic/patientSummary/PatientSummary';
import StaffMemberDetails from '../../../generic/staffMemberDetails/StaffMemberDetails';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { Button } from 'nhsuk-react-components';
import postUserPatientRestriction from '../../../../helpers/requests/userPatientRestrictions/createUserPatientRestriction';
import usePatient from '../../../../helpers/hooks/usePatient';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import { AxiosError } from 'axios';
import { isMock } from '../../../../helpers/utils/isLocal';
import { errorToParams } from '../../../../helpers/utils/errorToParams';
import { useState } from 'react';
import SpinnerButton from '../../../generic/spinnerButton/SpinnerButton';

type Props = {
    userInformation: UserInformation;
};

const UserPatientRestrictionsAddConfirmStage = ({ userInformation }: Props): React.JSX.Element => {
    const navigate = useNavigate();
    const patient = usePatient();
    const baseAPIUrl = useBaseAPIUrl();
    const baseAPIHeaders = useBaseAPIHeaders();

    const pageTitle = 'Check the details of the restriction';
    useTitle({ pageTitle });

    const [creatingRestriction, setCreatingRestriction] = useState(false);

    const addRestriction = async (): Promise<void> => {
        setCreatingRestriction(true);

        try {
            await postUserPatientRestriction({
                nhsNumber: patient!.nhsNumber,
                smartcardId: userInformation.smartcardId,
                baseAPIUrl,
                baseAPIHeaders,
            });

            handleSuccess();
        } catch (e) {
            const error = e as AxiosError;
            if (isMock(error)) {
                handleSuccess();
            } else if (error.response?.status === 403) {
                navigate(routes.SESSION_EXPIRED);
            } else {
                navigate(routes.SERVER_ERROR + errorToParams(error));
            }
        }
    };

    const handleSuccess = (): void => {
        navigate(routeChildren.USER_PATIENT_RESTRICTIONS_ACTION_COMPLETE);
    };

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

            {creatingRestriction ? (
                <SpinnerButton id="creating-restriction-spinner" status="Processing..." />
            ) : (
                <div className="action-button-group">
                    <Button data-testid="continue-button" onClick={addRestriction}>
                        Continue to add this restriction
                    </Button>
                    <Link className="ml-4" to={routeChildren.USER_PATIENT_RESTRICTIONS_ADD_CANCEL}>
                        Cancel without adding a restriction
                    </Link>
                </div>
            )}
        </>
    );
};

export default UserPatientRestrictionsAddConfirmStage;
