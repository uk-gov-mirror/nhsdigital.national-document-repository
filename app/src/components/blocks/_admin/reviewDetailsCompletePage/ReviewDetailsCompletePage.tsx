import { Button } from 'nhsuk-react-components';
import { useNavigate } from 'react-router-dom';
import useTitle from '../../../../helpers/hooks/useTitle';
import { routeChildren } from '../../../../types/generic/routes';
import { CompleteState } from '../../../../pages/adminRoutesPage/AdminRoutesPage';
import { JSX } from 'react';
import { formatNhsNumber } from '../../../../helpers/utils/formatNhsNumber';
import { getFormattedDateFromString } from '../../../../helpers/utils/formatDate';
import { getFormattedPatientFullName } from '../../../../helpers/utils/formatPatientFullName';
import { usePatientDetailsContext } from '../../../../providers/patientProvider/PatientProvider';

type Props = {
    completeState: CompleteState;
    reviewSnoMed: string;
};

const ReviewDetailsCompletePage = ({ completeState, reviewSnoMed }: Props): JSX.Element => {
    const navigate = useNavigate();
    const [patientDetails, setPatientDetails] = usePatientDetailsContext();

    useTitle({ pageTitle: 'Review complete' });

    const OnComplete = (): void => {
        setPatientDetails(null);
        navigate(routeChildren.ADMIN_REVIEW, { replace: true });
    };

    const getDefaultPrmEmailSupportMessage = (): JSX.Element => {
        return (
            <p>
                If you think you've made a mistake, contact the Patient Record Management team at{' '}
                <a href="mailto:england.prmteam@nhs.net">england.prmteam@nhs.net</a>.
            </p>
        );
    };

    const getPanelTitle = (): string => {
        if (completeState === CompleteState.PATIENT_MATCHED) {
            return 'This document has been matched to the correct patient';
        }
        if (completeState === CompleteState.PATIENT_UNKNOWN) {
            return 'Review complete';
        }
        if (completeState === CompleteState.NO_FILES_CHOICE) {
            return 'Review complete';
        }
        if (completeState === CompleteState.REVIEW_COMPLETE) {
            return 'Review complete';
        }
        return '';
    };

    const getPanelBody = (): JSX.Element => {
        if (completeState === CompleteState.PATIENT_MATCHED) {
            return (
                <p>
                    This document has been matched to the patient whose NHS number you entered. If
                    this patient is registered at your practice, you will see this document on the
                    list of documents to review again.
                </p>
            );
        }
        if (completeState === CompleteState.PATIENT_UNKNOWN) {
            return (
                <p>
                    You've completed the review of this document. It has been removed from your list
                    of documents to review.
                </p>
            );
        }
        if (completeState === CompleteState.NO_FILES_CHOICE && patientDetails) {
            const formattedNhsNumber = formatNhsNumber(patientDetails.nhsNumber);
            const dob = getFormattedDateFromString(patientDetails.birthDate);
            const patientName = getFormattedPatientFullName(patientDetails);

            return (
                <>
                    <p>
                        You've completed the review of this document. It has been removed from your
                        list of documents to review.
                    </p>
                    <br />
                    <div>
                        <strong data-testid="patient-name">Patient name: {patientName}</strong>
                        <br />
                        <span data-testid="nhs-number">NHS number: {formattedNhsNumber}</span>
                        <br />
                        <span data-testid="dob">Date of birth: {dob}</span>
                    </div>
                </>
            );
        }
        if (completeState === CompleteState.REVIEW_COMPLETE && patientDetails) {
            const formattedNhsNumber = formatNhsNumber(patientDetails.nhsNumber);
            const dob = getFormattedDateFromString(patientDetails.birthDate);
            const patientName = getFormattedPatientFullName(patientDetails);

            return (
                <>
                    <p>
                        You've completed the review of this document. It has been removed from your
                        list of documents to review.
                    </p>
                    <br />
                    <div>
                        <strong data-testid="patient-name">Patient name: {patientName}</strong>
                        <br />
                        <span data-testid="nhs-number">NHS number: {formattedNhsNumber}</span>
                        <br />
                        <span data-testid="dob">Date of birth: {dob}</span>
                    </div>
                </>
            );
        }
        return <></>;
    };

    const getBody = (): JSX.Element => {
        if (completeState === CompleteState.PATIENT_MATCHED) {
            return <>{getDefaultPrmEmailSupportMessage()}</>;
        }
        if (completeState === CompleteState.PATIENT_UNKNOWN) {
            return (
                <>
                    <p>
                        Print and send this document to Primary Care Support England following their{' '}
                        <a
                            href="https://pcse.england.nhs.uk/services/medical-records/moving-medical-records"
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid="process-link"
                        >
                            process for record transfers
                        </a>
                        .
                    </p>

                    {getDefaultPrmEmailSupportMessage()}
                </>
            );
        }
        if (completeState === CompleteState.NO_FILES_CHOICE) {
            return <>{getDefaultPrmEmailSupportMessage()}</>;
        }
        if (completeState === CompleteState.REVIEW_COMPLETE) {
            return (
                <>
                    <h2>Files added for this patient</h2>
                    <p>LloydGeorgerecords.zip</p>
                    <h2>What happens next</h2>
                    {getDefaultPrmEmailSupportMessage()}
                </>
            );
        }
        return <></>;
    };

    return (
        <div className="review-complete" data-testid="review-complete-page">
            <div
                className="nhsuk-panel nhsuk-panel--confirmation"
                data-testid="review-complete-card"
            >
                <h1 className="nhsuk-panel__title">{getPanelTitle()}</h1>
                <div className="nhsuk-panel__body">{getPanelBody()}</div>
            </div>

            {completeState !== CompleteState.REVIEW_COMPLETE && <h2>What happens next</h2>}

            {getBody()}

            <Button data-testid="review-another-btn" type="button" onClick={OnComplete}>
                Review another document
            </Button>
        </div>
    );
};

export default ReviewDetailsCompletePage;
