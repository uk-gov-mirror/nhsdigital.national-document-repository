import { Button } from 'nhsuk-react-components';
import { Link, useNavigate } from 'react-router-dom';
import useTitle from '../../../../helpers/hooks/useTitle';
import { DOCUMENT_TYPE_CONFIG } from '../../../../helpers/utils/documentType';
import usePatient from '../../../../helpers/hooks/usePatient';
import { getFormattedPatientFullName } from '../../../../helpers/utils/formatPatientFullName';
import { formatNhsNumber } from '../../../../helpers/utils/formatNhsNumber';
import { getFormattedDateFromString } from '../../../../helpers/utils/formatDate';
import { routes } from '../../../../types/generic/routes';

type Props = {
    matched: boolean;
    docConfig: DOCUMENT_TYPE_CONFIG;
};

const DocumentReassignCompleteStage = ({ matched, docConfig }: Props): React.JSX.Element => {
    const navigate = useNavigate();
    const patient = usePatient();

    useTitle({ pageTitle: 'Reassign complete' });

    return (
        <div className="document-upload-complete-stage" data-testid="upload-complete-page">
            <div className="nhsuk-panel" data-testid="upload-complete-card">
                <h1 data-testid="page-title" className="nhsuk-panel__title">
                    {matched
                        ? 'These pages have been matched to the correct patient'
                        : `These pages have been removed from the ${docConfig.displayName} of:`}
                </h1>
                <br />
                <div className="nhsuk-panel__body">
                    {matched ? (
                        <p>
                            These pages have been matched to the patient whose NHS number you
                            entered.
                        </p>
                    ) : (
                        <>
                            <strong data-testid="patient-name">
                                Patient name: {getFormattedPatientFullName(patient)}
                            </strong>
                            <br />
                            <span data-testid="nhs-number">
                                NHS number: {formatNhsNumber(patient!.nhsNumber)}
                            </span>
                            <br />
                            <span data-testid="dob">
                                Date of birth: {getFormattedDateFromString(patient!.birthDate)}
                            </span>
                        </>
                    )}
                </div>
            </div>

            <h3>What happens next</h3>

            {matched ? (
                <p>
                    If this patient is registered at your practice, these pages will appear as a
                    document on your <Link to={routes.REVIEWS}>list of documents to review</Link>.
                </p>
            ) : (
                <p>
                    Print and send these pages to Primary Care Support England following their{' '}
                    <a
                        href="https://pcse.england.nhs.uk/services/medical-records/moving-medical-records"
                        className="nhsuk-link"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="process for record transfers - opens in a new tab"
                    >
                        process for record transfers
                    </a>
                    .
                </p>
            )}

            <p>
                If you think you've made a mistake, contact the Patient Record Management team at{' '}
                <a id="mail" href="mailto:england.prmteam@nhs.net">
                    england.prmteam@nhs.net
                </a>
                .
            </p>

            <Button
                data-testid="finish-btn"
                type="button"
                onClick={(): void => {
                    navigate(routes.SEARCH_PATIENT, { replace: true });
                }}
            >
                Finish and search for another patient
            </Button>
        </div>
    );
};

export default DocumentReassignCompleteStage;
