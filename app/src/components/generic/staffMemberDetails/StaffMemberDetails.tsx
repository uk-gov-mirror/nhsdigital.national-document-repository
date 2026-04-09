import { SummaryList } from 'nhsuk-react-components';
import { UserInformation } from '../../../types/generic/userPatientRestriction';

type Props = {
    userInformation: UserInformation;
};

const StaffMemberDetails = ({ userInformation }: Props): React.JSX.Element => {
    return (
        <SummaryList>
            <SummaryList.Row>
                <SummaryList.Key>NHS smartcard number</SummaryList.Key>
                <SummaryList.Value data-testid="smartcard-id" id="smartcard-id">
                    {userInformation.smartcardId}
                </SummaryList.Value>
            </SummaryList.Row>
            <SummaryList.Row>
                <SummaryList.Key>Staff member</SummaryList.Key>
                <SummaryList.Value data-testid="staff-member" id="staff-member">
                    {userInformation.firstName} {userInformation.lastName}
                </SummaryList.Value>
            </SummaryList.Row>
        </SummaryList>
    );
};

export default StaffMemberDetails;
