import { Dispatch, JSX, SetStateAction, useState } from 'react';
import { Button, WarningCallout } from 'nhsuk-react-components';
import useTitle from '../../../../helpers/hooks/useTitle';
import BackButton from '../../../generic/backButton/BackButton';
import PatientSummary from '../../../generic/patientSummary/PatientSummary';
import { useForm } from 'react-hook-form';
import usePatient from '../../../../helpers/hooks/usePatient';
import useRole from '../../../../helpers/hooks/useRole';
import { REPOSITORY_ROLE } from '../../../../types/generic/authRole';
import ErrorBox from '../../../layout/errorBox/ErrorBox';
import { PatientDetails } from '../../../../types/generic/patientDetails';

type PatientVerifyPageProps = {
    onSubmit: (setInputError: Dispatch<SetStateAction<string>>) => void;
    reviewPatientDetails?: PatientDetails;
};

const PatientVerifyPage = ({
    onSubmit,
    reviewPatientDetails,
}: PatientVerifyPageProps): JSX.Element => {
    const role = useRole();
    let patientDetails = usePatient();
    if (reviewPatientDetails) {
        patientDetails = reviewPatientDetails;
    }
    const userIsPCSE = role === REPOSITORY_ROLE.PCSE;
    const [inputError, setInputError] = useState('');
    const { handleSubmit } = useForm();

    const showDeceasedWarning = patientDetails?.deceased && !userIsPCSE;
    const showWarning =
        patientDetails?.superseded || patientDetails?.restricted || showDeceasedWarning;
    const pageHeader = 'Patient details';
    useTitle({ pageTitle: pageHeader });

    return (
        <div className="patient-results-paragraph">
            <BackButton />
            {inputError && (
                <ErrorBox
                    messageTitle={'There is a problem'}
                    messageLinkBody={inputError}
                    errorInputLink={'#patient-status'}
                    errorBoxSummaryId={'error-box-summary'}
                />
            )}
            <h1>{pageHeader}</h1>

            {showWarning && (
                <WarningCallout>
                    <WarningCallout.Label headingLevel="h2">
                        {showDeceasedWarning
                            ? 'This record is for a deceased patient'
                            : 'Information'}
                    </WarningCallout.Label>
                    {patientDetails?.superseded && (
                        <p>The NHS number for this patient has changed.</p>
                    )}
                    {patientDetails?.restricted && (
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

            <PatientSummary showDeceasedTag={userIsPCSE} reviewPatientDetails={patientDetails} />

            <form
                onSubmit={handleSubmit(() => onSubmit(setInputError))}
                className="patient-results-form"
            >
                <p id="gp-message">
                    This page displays the current data recorded in the Personal Demographics
                    Service for this patient.
                </p>
                <Button type="submit" id="verify-submit" className="nhsuk-u-margin-top-6">
                    Confirm patient details and continue
                </Button>
            </form>
        </div>
    );
};

export default PatientVerifyPage;
