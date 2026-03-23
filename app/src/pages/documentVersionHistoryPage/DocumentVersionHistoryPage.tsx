import { Button } from 'nhsuk-react-components';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackButton from '../../components/generic/backButton/BackButton';
import { CreatedByText } from '../../components/generic/createdBy/createdBy';
import Spinner from '../../components/generic/spinner/Spinner';
import Timeline, { TimelineStatus } from '../../components/generic/timeline/Timeline';
import useBaseAPIHeaders from '../../helpers/hooks/useBaseAPIHeaders';
import useBaseAPIUrl from '../../helpers/hooks/useBaseAPIUrl';
import usePatient from '../../helpers/hooks/usePatient';
import useTitle from '../../helpers/hooks/useTitle';
import { getDocumentVersionHistoryResponse } from '../../helpers/requests/getDocumentVersionHistory';
import { getDocumentTypeLabel } from '../../helpers/utils/documentType';
import { getAuthorValue, getCreatedDate, getVersionId } from '../../helpers/utils/fhirUtil';
import { getFormatDateWithAtTime } from '../../helpers/utils/formatDate';
import { Bundle } from '../../types/fhirR4/bundle';
import { FhirDocumentReference } from '../../types/fhirR4/documentReference';
import { routes } from '../../types/generic/routes';
import { DocumentReference } from '../../types/pages/documentSearchResultsPage/types';

type DocumentVersionHistoryPageProps = {
    documentReference: DocumentReference | null;
};

const DocumentVersionHistoryPage = ({
    documentReference,
}: DocumentVersionHistoryPageProps): React.JSX.Element => {
    const navigate = useNavigate();
    const baseUrl = useBaseAPIUrl();
    const baseHeaders = useBaseAPIHeaders();
    const versionHistoryRef = useRef(false);
    const patientDetails = usePatient();
    const nhsNumber = patientDetails?.nhsNumber ?? '';

    const docTypeLabel = documentReference
        ? getDocumentTypeLabel(documentReference.documentSnomedCodeType)
        : '';
    const pageHeader = `Version history for ${docTypeLabel.toLowerCase()}`;
    useTitle({ pageTitle: pageHeader });

    const [loading, setLoading] = useState(true);
    const [versionHistory, setVersionHistory] = useState<Bundle<FhirDocumentReference> | null>(
        null,
    );

    useEffect(() => {
        if (!documentReference) {
            navigate(routes.PATIENT_DOCUMENTS);
            return;
        }

        const fetchVersionHistory = async (): Promise<void> => {
            if (!versionHistoryRef.current) {
                versionHistoryRef.current = true;
                try {
                    const response = await getDocumentVersionHistoryResponse({
                        nhsNumber,
                        baseUrl,
                        baseHeaders,
                        documentReferenceId: documentReference.id,
                    });
                    setVersionHistory(response);
                } catch {
                    navigate(routes.PATIENT_DOCUMENTS);
                } finally {
                    setLoading(false);
                }
            }
        };
        void fetchVersionHistory();
    }, [documentReference, nhsNumber, baseUrl, baseHeaders, navigate]);

    if (loading) {
        return <Spinner status="Loading version history" />;
    }

    if (!documentReference) {
        navigate(routes.PATIENT_DOCUMENTS);
        return <></>;
    }

    const renderVersionHistoryTimeline = (): React.JSX.Element => {
        if (!versionHistory?.entry || versionHistory.entry.length === 0) {
            return <p>No version history available for this document.</p>;
        }

        const sortedEntries = [...versionHistory.entry].sort(
            (a, b) => Number(getVersionId(b.resource)) - Number(getVersionId(a.resource)),
        );

        return (
            <Timeline>
                {sortedEntries.map((entry, index) => {
                    const isCurrentVersion = index === 0;
                    const status = isCurrentVersion
                        ? TimelineStatus.Active
                        : TimelineStatus.Inactive;
                    const isLastItem = index === versionHistory.entry!.length - 1;
                    const doc = entry.resource;
                    const version = getVersionId(doc);
                    const heading = `${docTypeLabel}: version ${version}`;

                    return (
                        <Timeline.Item
                            key={version}
                            status={status}
                            className={`${isLastItem ? '' : 'pb-9'}`}
                        >
                            <Timeline.Heading
                                status={TimelineStatus.Active}
                                className="nhsuk-heading-m"
                            >
                                {heading}
                            </Timeline.Heading>

                            {isCurrentVersion && (
                                <Timeline.Description className="nhsuk-u-font-size-19 py-2">
                                    This is the current version shown in this patient's record
                                </Timeline.Description>
                            )}

                            <CreatedByText
                                cssClass="nhsapp-timeline__description nhsuk-u-font-size-19 py-3"
                                odsCode={getAuthorValue(doc)}
                                dateUploaded={getFormatDateWithAtTime(getCreatedDate(doc))}
                            />

                            {isCurrentVersion ? (
                                <Link
                                    to="#"
                                    data-testid={`view-version-${version}`}
                                    className=" nhsuk-link nhsuk-link--no-visited-state"
                                >
                                    View
                                </Link>
                            ) : (
                                <div className="pt-3 align-baseline">
                                    <Button
                                        data-testid={`view-version-${version}`}
                                        className="nhsuk-u-margin-right-3 nhsuk-link--no-visited-state"
                                    >
                                        View
                                    </Button>
                                    <Link
                                        to="#"
                                        data-testid={`restore-version-${version}`}
                                        className="nhsuk-link nhsuk-link--no-visited-state"
                                    >
                                        Restore version
                                    </Link>
                                </div>
                            )}
                        </Timeline.Item>
                    );
                })}
            </Timeline>
        );
    };

    return (
        <div>
            <BackButton dataTestid="go-back-button" />

            <h1>{pageHeader}</h1>

            {renderVersionHistoryTimeline()}
        </div>
    );
};

export default DocumentVersionHistoryPage;
