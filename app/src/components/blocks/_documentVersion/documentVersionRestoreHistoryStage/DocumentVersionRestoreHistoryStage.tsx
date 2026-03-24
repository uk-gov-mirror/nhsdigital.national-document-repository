import { AxiosError } from 'axios';
import { Button } from 'nhsuk-react-components';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import usePatient from '../../../../helpers/hooks/usePatient';
import useTitle from '../../../../helpers/hooks/useTitle';
import getDocument, { GetDocumentResponse } from '../../../../helpers/requests/getDocument';
import getDocumentSearchResults from '../../../../helpers/requests/getDocumentSearchResults';
import { getDocumentVersionHistoryResponse } from '../../../../helpers/requests/getDocumentVersionHistory';
import {
    DOCUMENT_TYPE,
    getConfigForDocTypeGeneric,
    getDocumentTypeLabel,
    LGContentKeys,
} from '../../../../helpers/utils/documentType';
import { errorToParams } from '../../../../helpers/utils/errorToParams';
import {
    getAuthorValue,
    getCreatedDate,
    getDocumentReferenceFromFhir,
    getVersionId,
} from '../../../../helpers/utils/fhirUtil';
import { getFormatDateWithAtTime } from '../../../../helpers/utils/formatDate';
import { getObjectUrl } from '../../../../helpers/utils/getPdfObjectUrl';
import { isLocal } from '../../../../helpers/utils/isLocal';
import { Bundle } from '../../../../types/fhirR4/bundle';
import { FhirDocumentReference } from '../../../../types/fhirR4/documentReference';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { DocumentReference } from '../../../../types/pages/documentSearchResultsPage/types';
import BackButton from '../../../generic/backButton/BackButton';
import { CreatedByText } from '../../../generic/createdBy/createdBy';
import Spinner from '../../../generic/spinner/Spinner';
import Timeline, { TimelineStatus } from '../../../generic/timeline/Timeline';

type DocumentVersionRestoreHistoryPageProps = {
    documentReference: DocumentReference | null;
    setDocumentReferenceToRestore: (docRef: DocumentReference) => void;
    setDocumentReference: (docRef: DocumentReference) => void;
    setLatestVersion: (version: string) => void;
};

const DocumentVersionRestoreHistoryStage = ({
    documentReference,
    setDocumentReferenceToRestore,
    setDocumentReference,
    setLatestVersion,
}: Readonly<DocumentVersionRestoreHistoryPageProps>): React.JSX.Element => {
    const navigate = useNavigate();
    const baseUrl = useBaseAPIUrl();
    const baseHeaders = useBaseAPIHeaders();
    const versionHistoryRef = useRef(false);
    const patientDetails = usePatient();
    const nhsNumber = patientDetails?.nhsNumber ?? '';
    const [loading, setLoading] = useState(true);
    const [versionHistory, setVersionHistory] = useState<Bundle<FhirDocumentReference> | null>(
        null,
    );

    const docTypeLabel = documentReference
        ? getDocumentTypeLabel(documentReference.documentSnomedCodeType)
        : '';
    const docConfig = documentReference
        ? getConfigForDocTypeGeneric(documentReference.documentSnomedCodeType)
        : null;
    const pageHeader =
        docConfig?.content.getValue<string, LGContentKeys>('versionHistoryHeader') ||
        `Version history for ${docTypeLabel}`;
    useTitle({ pageTitle: pageHeader });

    useEffect(() => {
        if (!versionHistoryRef.current) {
            versionHistoryRef.current = true;
            const fetchVersionHistory = async (): Promise<void> => {
                try {
                    const searchResults = await getDocumentSearchResults({
                        nhsNumber,
                        baseUrl,
                        baseHeaders,
                        docType:
                            documentReference?.documentSnomedCodeType ?? DOCUMENT_TYPE.LLOYD_GEORGE,
                        limit: 1,
                    });

                    setDocumentReference(searchResults[0]);
                    const latestDocRefId = searchResults[0]?.id;
                    setLatestVersion(searchResults[0]?.version ?? '');

                    if (!latestDocRefId) {
                        setLoading(false);
                        navigate(routes.SERVER_ERROR);
                        return;
                    }

                    const response = await getDocumentVersionHistoryResponse({
                        nhsNumber,
                        baseUrl,
                        baseHeaders,
                        documentReferenceId: latestDocRefId,
                    });

                    setVersionHistory(response);
                    setLoading(false);
                } catch (e) {
                    const error = e as AxiosError;
                    setLoading(false);
                    if (error.response?.status === 403) {
                        navigate(routes.SESSION_EXPIRED);
                    } else if (error.response?.status && error.response?.status >= 500) {
                        navigate(routes.SERVER_ERROR + errorToParams(error));
                    }

                    navigate(routes.SERVER_ERROR);
                }
            };
            void fetchVersionHistory();
        }
    }, []);

    const loadDocument = async (
        documentId: string,
        version?: string,
        baseRef?: DocumentReference,
    ): Promise<DocumentReference | undefined> => {
        try {
            const documentResponse = await getDocument({
                nhsNumber: patientDetails!.nhsNumber,
                baseUrl,
                baseHeaders,
                documentId,
                version,
            });

            const docRef = await handleViewDocSuccess(documentResponse, baseRef);
            return docRef;
        } catch (e) {
            if (isLocal) {
                const docRef = await handleViewDocSuccess(
                    {
                        url: '/dev/testFile.pdf',
                        contentType: 'application/pdf',
                    },
                    baseRef,
                );
                return docRef;
            }
            const error = e as AxiosError;
            if (error.response?.status === 403) {
                navigate(routes.SESSION_EXPIRED);
            } else if (error.response?.status === 404) {
                await handleViewDocSuccess({ url: '', contentType: '' }, baseRef);
            } else {
                navigate(routes.SERVER_ERROR + errorToParams(error));
            }
        }
    };

    const handleViewDocSuccess = async (
        documentResponse: GetDocumentResponse,
        baseRef?: DocumentReference,
    ): Promise<DocumentReference> => {
        const ref = baseRef ?? documentReference!;
        return {
            ...ref,
            url: documentResponse.url ? await getObjectUrl(documentResponse.url) : null,
            isPdf: documentResponse.contentType === 'application/pdf',
        };
    };

    const handleViewVersion = async (
        e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
        doc: FhirDocumentReference,
        isActiveVersion?: boolean,
    ): Promise<void> => {
        e.preventDefault();
        setLoading(true);
        try {
            const documentRef = getDocumentReferenceFromFhir(doc);
            let documentRefId = documentRef.id;
            if (documentRef.id.includes('~')) {
                documentRefId = documentRef.id.split('~')[1];
            }

            const docRef = await loadDocument(documentRefId, documentRef.version, documentRef);

            setDocumentReferenceToRestore(docRef!);

            navigate(routeChildren.DOCUMENT_VIEW_VERSION_HISTORY, {
                state: { isActiveVersion },
            });
        } catch (e) {
            const error = e as AxiosError;
            setLoading(false);
            if (error.response?.status === 403) {
                navigate(routes.SESSION_EXPIRED);
            } else if (error.response?.status && error.response?.status >= 500) {
                navigate(routes.SERVER_ERROR + errorToParams(error));
            }

            navigate(routes.SERVER_ERROR);
        }
    };

    if (loading) {
        return <Spinner status="Loading version history" />;
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
                    const maxVersion = versionHistory.entry?.sort(
                        (a, b) =>
                            Number(getVersionId(b.resource)) - Number(getVersionId(a.resource)),
                    )[0];

                    if (!maxVersion) {
                        return <></>;
                    }

                    const isActiveVersion = entry.resource.id === maxVersion.resource.id;
                    const status = isActiveVersion
                        ? TimelineStatus.Active
                        : TimelineStatus.Inactive;
                    const isLastItem = index === sortedEntries.length - 1;
                    const doc = entry.resource;
                    const version = getVersionId(doc);
                    const heading =
                        docConfig?.content.getValueFormatString<string, LGContentKeys>(
                            'versionHistoryTimelineHeader',
                            { version },
                        ) || `${docTypeLabel}: version ${version}`;

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

                            {isActiveVersion && (
                                <Timeline.Description className="nhsuk-u-font-size-19 py-2">
                                    This is the current version shown in this patient's record
                                </Timeline.Description>
                            )}

                            <CreatedByText
                                cssClass="nhsapp-timeline__description nhsuk-u-font-size-19 py-3"
                                odsCode={getAuthorValue(doc)}
                                dateUploaded={getFormatDateWithAtTime(getCreatedDate(doc))}
                            />

                            {isActiveVersion ? (
                                <Link
                                    to="#"
                                    state={isActiveVersion}
                                    data-testid={`view-version-${version}`}
                                    className=" nhsuk-link nhsuk-link--no-visited-state"
                                    onClick={(
                                        e: React.MouseEvent<HTMLAnchorElement>,
                                    ): Promise<void> => handleViewVersion(e, doc, true)}
                                >
                                    View
                                </Link>
                            ) : (
                                <div className="pt-3 align-baseline">
                                    <Button
                                        data-testid={`view-version-${version}`}
                                        className="nhsuk-u-margin-right-3 nhsuk-link--no-visited-state"
                                        onClick={(
                                            e: React.MouseEvent<HTMLButtonElement>,
                                        ): Promise<void> => handleViewVersion(e, doc, false)}
                                    >
                                        View
                                    </Button>
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

export default DocumentVersionRestoreHistoryStage;
