import { Button } from 'nhsuk-react-components';
import useTitle from '../../../../helpers/hooks/useTitle';
import { UserPatientRestrictionsSubRoute } from '../../../../types/generic/userPatientRestriction';
import BackButton from '../../../generic/backButton/BackButton';
import PatientSummary, { PatientInfo } from '../../../generic/patientSummary/PatientSummary';

type Props = {
    route: UserPatientRestrictionsSubRoute;
    confirmClicked: () => void;
};

const UserPatientRestrictionsVerifyPatientStage = ({
    route,
    confirmClicked,
}: Props): React.JSX.Element => {
    const pageTitle =
        route === UserPatientRestrictionsSubRoute.ADD
            ? 'Patient details'
            : 'Verify patient details to view restrictions';
    useTitle({ pageTitle });

    return (
        <>
            <BackButton />

            <h1>{pageTitle}</h1>

            <PatientSummary>
                <PatientSummary.Child item={PatientInfo.NHS_NUMBER} />
                <PatientSummary.Child item={PatientInfo.FAMILY_NAME} />
                <PatientSummary.Child item={PatientInfo.GIVEN_NAME} />
                {route === UserPatientRestrictionsSubRoute.ADD && (
                    <>
                        <PatientSummary.Child item={PatientInfo.BIRTH_DATE} />
                        <PatientSummary.Child item={PatientInfo.POSTAL_CODE} />
                    </>
                )}
            </PatientSummary>

            <p>
                This page displays the current data recorded in the Personal Demographics Service
                for this patient.
            </p>

            <Button data-testid="confirm-patient-details" onClick={confirmClicked}>
                Confirm patient details and continue
            </Button>
        </>
    );
};

export default UserPatientRestrictionsVerifyPatientStage;
