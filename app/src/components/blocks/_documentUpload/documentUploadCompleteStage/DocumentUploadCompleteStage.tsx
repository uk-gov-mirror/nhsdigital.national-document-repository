import { routes } from '../../../../types/generic/routes';
import { Link, useNavigate } from 'react-router-dom';
import useTitle from '../../../../helpers/hooks/useTitle';
import usePatient from '../../../../helpers/hooks/usePatient';
import { formatNhsNumber } from '../../../../helpers/utils/formatNhsNumber';
import { getFormattedDateFromString } from '../../../../helpers/utils/formatDate';
import { getFormattedPatientFullName } from '../../../../helpers/utils/formatPatientFullName';
import {
    DOCUMENT_UPLOAD_STATE,
    UploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';
import { useEffect, useState } from 'react';
import { allDocsHaveState } from '../../../../helpers/utils/uploadDocumentHelpers';
import { getJourney } from '../../../../helpers/utils/urlManipulations';
import { DOCUMENT_TYPE_CONFIG } from '../../../../helpers/utils/documentType';
import { Button, ChevronLeftIcon, ChevronRightIcon } from 'nhsuk-react-components';

type Props = {
    documents: UploadDocument[];
    documentConfig: DOCUMENT_TYPE_CONFIG;
};

const DocumentUploadCompleteStage = ({ documents, documentConfig }: Props): React.JSX.Element => {
    const navigate = useNavigate();
    const patientDetails = usePatient();
    const nhsNumber: string = patientDetails?.nhsNumber ?? '';
    const formattedNhsNumber = formatNhsNumber(nhsNumber);
    const dob: string = getFormattedDateFromString(patientDetails?.birthDate);
    const patientName = getFormattedPatientFullName(patientDetails);
    const journey = getJourney();
    const [showFiles, setShowFiles] = useState(false);

    const failedDocuments = documents.filter((doc) => doc.state === DOCUMENT_UPLOAD_STATE.FAILED);

    const pageTitle = failedDocuments.length > 0 ? 'Upload partially complete' : 'Upload complete';
    useTitle({ pageTitle });

    const docsAreInFinishedState = () =>
        allDocsHaveState(documents, [
            DOCUMENT_UPLOAD_STATE.SUCCEEDED,
            DOCUMENT_UPLOAD_STATE.FAILED,
        ]);

    useEffect(() => {
        if (!docsAreInFinishedState() || patientDetails === null) {
            navigate(routes.HOME);
        }
    }, [navigate, documents, patientDetails]);

    if (!docsAreInFinishedState() || patientDetails === null) {
        return <></>;
    }

    return (
        <div className="document-upload-complete-stage" data-testid="upload-complete-page">
            <div className="nhsuk-panel" data-testid="upload-complete-card">
                <h1 data-testid="page-title" className="nhsuk-panel__title">
                    {pageTitle}
                </h1>
                <br />
                <div className="nhsuk-panel__body">
                    <strong data-testid="patient-name">Patient name: {patientName}</strong>
                    <br />
                    <span data-testid="nhs-number">NHS number: {formattedNhsNumber}</span>
                    <br />
                    <span data-testid="dob">Date of birth: {dob}</span>
                </div>
            </div>

            {failedDocuments.length > 0 && (
                <div className="govuk-accordion mb-8 govuk-frontend-supported">
                    <h3>Some of your files failed to upload</h3>
                    <button
                        className="toggle-button govuk-accordion__section-button"
                        onClick={() => setShowFiles(!showFiles)}
                        data-testid="accordion-toggle-button"
                        aria-expanded={showFiles}
                        aria-controls="failed-files-list"
                    >
                        <span className="govuk-accordion__section-toggle">
                            <span className="accordion-toggle govuk-accordion__section-toggle-focus">
                                {showFiles ? (
                                    <>
                                        <ChevronLeftIcon className="accordion-toggle-icon" />
                                        <span>Hide files</span>
                                    </>
                                ) : (
                                    <>
                                        <ChevronRightIcon className="accordion-toggle-icon" />
                                        <span>View files</span>
                                    </>
                                )}
                            </span>
                        </span>
                    </button>
                    {showFiles && (
                        <div id="failed-files-list" aria-hidden={!showFiles}>
                            {failedDocuments.map((doc) => (
                                <div key={doc.id}>
                                    <span>{doc.file.name}</span>
                                    <br />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <h3>What happens next</h3>

            {journey === 'update' && patientDetails.canManageRecord && (
                <p>
                    You can now view the updated {documentConfig.displayName} for this patient in
                    this service by{' '}
                    <Link
                        to=""
                        onClick={(e): void => {
                            e.preventDefault();
                            navigate(routes.SEARCH_PATIENT, { replace: true });
                        }}
                        data-testid="search-patient-link"
                    >
                        searching using their NHS number
                    </Link>
                    {'.'}
                </p>
            )}

            {patientDetails.canManageRecord === false && (
                <p>
                    You are not the data controller for this patient so you cannot view the files
                    you have uploaded in this service.
                </p>
            )}

            <p>
                If you think you've made a mistake, contact the Patient Record Management team at{' '}
                <a href="mailto:england.prmteam@nhs.net">england.prmteam@nhs.net</a>.
            </p>

            {documentConfig.content.uploadFilesExtraParagraph && (
                <p>{documentConfig.content.uploadFilesExtraParagraph}</p>
            )}

            <p>
                For information on destroying your paper records and removing the digital files from
                your system, read the article{' '}
                <Link
                    to="https://future.nhs.uk/DigitalPC/view?objectId=185217477"
                    data-testid="digitisation-link"
                >
                    Digitisation of Lloyd George records
                </Link>
                {'.'}
            </p>

            <Button
                data-testid="home-btn"
                type="button"
                onClick={(): void => {
                    navigate(routes.HOME, { replace: true });
                }}
            >
                Go to home
            </Button>
        </div>
    );
};

export default DocumentUploadCompleteStage;
