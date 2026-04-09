import React from 'react';
import { Button } from 'nhsuk-react-components';
import { Link, useNavigate } from 'react-router-dom';
import { routeChildren, routes } from '../../../../types/generic/routes';
import useTitle from '../../../../helpers/hooks/useTitle';
import usePatient from '../../../../helpers/hooks/usePatient';
import { formatNhsNumber } from '../../../../helpers/utils/formatNhsNumber';
import { getFormattedDateFromString } from '../../../../helpers/utils/formatDate';
import { getFormattedPatientFullName } from '../../../../helpers/utils/formatPatientFullName';
import {
    getDocumentTypeLabel,
    getConfigForDocTypeGeneric,
    LGContentKeys,
} from '../../../../helpers/utils/documentType';
import { DocumentReference } from '../../../../types/pages/documentSearchResultsPage/types';

type RestoreVersionCompletePageProps = {
    resetState: () => void;
    documentReference: DocumentReference | null;
};

const DocumentVersionRestoreCompleteStage = ({
    resetState,
    documentReference,
}: RestoreVersionCompletePageProps): React.JSX.Element => {
    const navigate = useNavigate();
    const patient = usePatient();

    const pageHeader = 'Version restored';
    useTitle({ pageTitle: pageHeader });

    const docTypeLabel = documentReference
        ? getDocumentTypeLabel(documentReference.documentSnomedCodeType)
        : 'scanned paper notes';
    const docConfig = documentReference
        ? getConfigForDocTypeGeneric(documentReference.documentSnomedCodeType)
        : null;
    const versionLabel =
        docConfig?.content.getValueFormatString<string, LGContentKeys>(
            'versionHistoryCompleteLabel',
            { version: Number(documentReference?.version) + 1 },
        ) ?? `${docTypeLabel} V${Number(documentReference?.version) + 1}`;

    if (!patient) {
        navigate(routes.HOME);
        return <></>;
    }

    return (
        <div>
            <div
                className="nhsuk-panel nhsuk-panel--confirmation"
                data-testid="restore-complete-panel"
            >
                <h1 className="nhsuk-panel__title" data-testid="page-title">
                    {pageHeader}
                </h1>
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

            <p data-testid="restore-version-description">
                This restored version will appear as '{versionLabel}' in this patient&apos;s record.
            </p>

            <h2 className="nhsuk-heading-l">What happens next</h2>
            <p>
                If you think you&apos;ve made a mistake, you can{' '}
                <Link
                    to={routeChildren.DOCUMENT_VERSION_HISTORY}
                    data-testid="version-history-link"
                    onClick={(e: React.MouseEvent<HTMLAnchorElement>): void => {
                        e.preventDefault();
                        resetState();
                        navigate(routeChildren.DOCUMENT_VERSION_HISTORY);
                    }}
                >
                    go to version history
                </Link>{' '}
                to restore back to a previous version.
            </p>

            <Button
                data-testid="go-to-records-button"
                onClick={(): void => {
                    resetState();
                    navigate(routes.PATIENT_DOCUMENTS);
                }}
            >
                Go to Lloyd George records
            </Button>
        </div>
    );
};

export default DocumentVersionRestoreCompleteStage;
