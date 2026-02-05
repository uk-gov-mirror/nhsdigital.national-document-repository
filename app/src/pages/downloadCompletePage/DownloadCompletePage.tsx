import React from 'react';
import { Button } from 'nhsuk-react-components';
import useTitle from '../../helpers/hooks/useTitle';
import { useNavigate } from 'react-router-dom';
import { routes } from '../../types/generic/routes';
import usePatient from '../../helpers/hooks/usePatient';
import { formatNhsNumber } from '../../helpers/utils/formatNhsNumber';
import { getFormattedDateFromString } from '../../helpers/utils/formatDate';
import { getFormattedPatientFullName } from '../../helpers/utils/formatPatientFullName';

const DownloadCompletePage = (): React.JSX.Element => {
    const navigate = useNavigate();
    const patient = usePatient();

    const pageHeader = 'Download complete';
    useTitle({ pageTitle: pageHeader });

    if (!patient) {
        navigate(routes.HOME);
        return <></>;
    }

    return (
        <div className="document_download-complete">
            <div className="nhsuk-panel" data-testid="download-complete-card">
                <h1 data-testid="page-title" className="nhsuk-panel__title">
                    Download complete
                </h1>
                <br />
                <div className="nhsuk-panel__body">
                    <strong data-testid="patient-name">
                        Patient name: {getFormattedPatientFullName(patient)}
                    </strong>
                    <br />
                    <span data-testid="nhs-number">
                        NHS number: {formatNhsNumber(patient.nhsNumber)}
                    </span>
                    <br />
                    <span data-testid="dob">
                        Date of birth: {getFormattedDateFromString(patient.birthDate)}
                    </span>
                </div>
            </div>

            <h2 className="nhsuk-heading-l">Your responsibilities with this record</h2>
            <p>
                Everyone in a health and care organisation is responsible for managing records
                appropriately. It is important all general practice staff understand their
                responsibilities for creating, maintaining, and disposing of records appropriately.
            </p>

            <h3 className="nhsuk-heading-m">Follow the Record Management Code of Practice</h3>
            <p>
                The{' '}
                <a href="https://transform.england.nhs.uk/information-governance/guidance/records-management-code">
                    Record Management Code of Practice
                </a>{' '}
                provides a framework for consistent and effective records management, based on
                established standards.
            </p>

            <Button
                data-testid="go-to-home-button"
                onClick={(): void => {
                    navigate(routes.HOME);
                }}
            >
                Go to home
            </Button>
        </div>
    );
};

export default DownloadCompletePage;
