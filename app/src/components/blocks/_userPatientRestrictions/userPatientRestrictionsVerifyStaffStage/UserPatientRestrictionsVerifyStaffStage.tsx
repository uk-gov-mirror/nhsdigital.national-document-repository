import { Button } from 'nhsuk-react-components';
import useTitle from '../../../../helpers/hooks/useTitle';
import BackButton from '../../../generic/backButton/BackButton';
import { UserInformation } from '../../../../types/generic/userPatientRestriction';
import { useNavigate } from 'react-router-dom';
import { routeChildren } from '../../../../types/generic/routes';
import StaffMemberDetails from '../../../generic/staffMemberDetails/StaffMemberDetails';

type Props = {
    userInformation: UserInformation;
};

const UserPatientRestrictionsVerifyStaffStage = ({ userInformation }: Props): React.JSX.Element => {
    const navigate = useNavigate();
    const pageTitle = 'NHS smartcard details';
    useTitle({ pageTitle });

    return (
        <>
            <BackButton />

            <h1>{pageTitle}</h1>

            <StaffMemberDetails userInformation={userInformation} />

            <p>
                This page displays the current data recorded in the Care Identity Service for this
                staff member.
            </p>

            <Button
                data-testid="confirm-staff-details-button"
                id="confirm-staff-details-button"
                onClick={(): void => {
                    navigate(routeChildren.USER_PATIENT_RESTRICTIONS_ADD_CONFIRM);
                }}
            >
                Confirm NHS smartcard details and continue
            </Button>
        </>
    );
};

export default UserPatientRestrictionsVerifyStaffStage;
