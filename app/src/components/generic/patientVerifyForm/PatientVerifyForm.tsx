import { Button, WarningCallout } from 'nhsuk-react-components';
import useRole from '../../../helpers/hooks/useRole';
import { REPOSITORY_ROLE } from '../../../types/generic/authRole';
import { PatientDetails } from '../../../types/generic/patientDetails';
import PatientSummary from '../patientSummary/PatientSummary';
import { useForm } from 'react-hook-form';

type Props = {
    patientDetails: PatientDetails;
    onSubmit: () => void;
};

const PatientVerifyForm = ({ patientDetails, onSubmit }: Props): React.JSX.Element => {
    const { handleSubmit } = useForm();
    const role = useRole();

    const userIsPCSE = role === REPOSITORY_ROLE.PCSE;
    const showDeceasedWarning = patientDetails?.deceased && !userIsPCSE;
    const showWarning =
        patientDetails?.superseded || patientDetails?.restricted || showDeceasedWarning;

    return (
        <>
            {showWarning && (
                <WarningCallout>
                    <WarningCallout.Label headingLevel="h2">
                        {showDeceasedWarning
                            ? 'This record is for a deceased patient'
                            : 'Information'}
                    </WarningCallout.Label>
                    {patientDetails.superseded && (
                        <p>The NHS number for this patient has changed.</p>
                    )}
                    {patientDetails.restricted && (
                        <p>
                            Certain details about this patient cannot be displayed without the
                            necessary access.
                        </p>
                    )}
                    {showDeceasedWarning && (
                        <p>
                            Access to the records of deceased patients is regulated under the Access
                            to Health Records Act. You will need to give a reason why you need to
                            access this record. For more information, read the article{' '}
                            <a
                                href="https://transform.england.nhs.uk/information-governance/guidance/access-to-the-health-and-care-records-of-deceased-people/"
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Access to the health and care records of deceased people - this link will open in a new tab"
                            >
                                Access to the health and care records of deceased people
                            </a>
                            .
                        </p>
                    )}
                </WarningCallout>
            )}

            <PatientSummary patientDetailsOverride={patientDetails} showDeceasedTag={userIsPCSE} />

            <form onSubmit={handleSubmit(onSubmit)} className="patient-results-form">
                <p id="gp-message">
                    This page displays the current data recorded in the Personal Demographics
                    Service for this patient.
                </p>
                <Button
                    type="submit"
                    id="verify-submit"
                    className="nhsuk-u-margin-top-6"
                    data-testid="confirm-patient-details-btn"
                >
                    Confirm patient details and continue
                </Button>
            </form>
        </>
    );
};

export default PatientVerifyForm;
