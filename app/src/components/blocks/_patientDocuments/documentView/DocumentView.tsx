import { BackLink, Button, Card, ChevronLeftIcon } from 'nhsuk-react-components';
import type { MouseEvent } from 'react';
import { useEffect } from 'react';
import { createSearchParams, NavigateOptions, To, useNavigate } from 'react-router-dom';
import useConfig from '../../../../helpers/hooks/useConfig';
import usePatient from '../../../../helpers/hooks/usePatient';
import useRole from '../../../../helpers/hooks/useRole';
import useTitle from '../../../../helpers/hooks/useTitle';
import {
    DOCUMENT_TYPE,
    getConfigForDocTypeGeneric,
    LGContentKeys,
} from '../../../../helpers/utils/documentType';
import { getFormattedDate } from '../../../../helpers/utils/formatDate';
import { useSessionContext } from '../../../../providers/sessionProvider/SessionProvider';
import {
    ACTION_LINK_KEY,
    AddAction,
    getLloydGeorgeRecordLinks,
    getRecordActionLinksAllowedForRole,
    LGRecordActionLink,
    ReassignAction,
    VersionHistoryAction,
} from '../../../../types/blocks/lloydGeorgeActions';
import { REPOSITORY_ROLE } from '../../../../types/generic/authRole';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { DocumentReference } from '../../../../types/pages/documentSearchResultsPage/types';
import LinkButton from '../../../generic/linkButton/LinkButton';
import PatientSummary, { PatientInfo } from '../../../generic/patientSummary/PatientSummary';
import RecordCard from '../../../generic/recordCard/RecordCard';
import Spinner from '../../../generic/spinner/Spinner';

export enum DOCUMENT_VIEW_STATE {
    DOCUMENT = 'DOCUMENT',
    VERSION_HISTORY = 'VERSION_HISTORY',
}

type Props = {
    documentReference: DocumentReference | null;
    removeDocument?: () => void;
    viewState?: DOCUMENT_VIEW_STATE;
    isActiveVersion?: boolean;
};

const DocumentView = ({
    documentReference,
    removeDocument,
    viewState,
    isActiveVersion,
}: Readonly<Props>): React.JSX.Element => {
    const [session, setUserSession] = useSessionContext();
    const role = useRole();
    const navigate = useNavigate();
    const showMenu = role === REPOSITORY_ROLE.GP_ADMIN && !session.isFullscreen;
    const patientDetails = usePatient();
    const config = useConfig();
    const documentConfig = getConfigForDocTypeGeneric(
        documentReference?.documentSnomedCodeType ?? DOCUMENT_TYPE.LLOYD_GEORGE,
    );

    const pageHeader = 'Lloyd George records';
    useTitle({ pageTitle: pageHeader });

    const getPdfObjectUrl = (): string => {
        if (documentReference?.contentType !== 'application/pdf') {
            return '';
        }

        return documentReference.url ? documentReference.url : 'loading';
    };

    // Handle fullscreen changes from browser events
    useEffect(() => {
        const handleFullscreenChange = (): void => {
            const isCurrentlyFullscreen = document.fullscreenElement !== null;
            // Only update if the state has actually changed to avoid unnecessary re-renders
            if (session.isFullscreen !== isCurrentlyFullscreen) {
                setUserSession({
                    ...session,
                    isFullscreen: isCurrentlyFullscreen,
                });
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [session, setUserSession, documentReference, getPdfObjectUrl]);

    if (!documentReference) {
        navigate(routes.PATIENT_DOCUMENTS);
        return <></>;
    }

    const details = (): React.JSX.Element => {
        return (
            <div className="document_record-details">
                <div className="document_record-details_details">
                    {!documentReference.isPdf && (
                        <div
                            className="document_record-details_details--last-updated mt-3"
                            data-testid="document-file-name"
                        >
                            File name: {documentReference.fileName}
                        </div>
                    )}
                    <div className="document_record-details_details--last-updated mt-3">
                        Created by practice: {documentReference.author} on{' '}
                        {getFormattedDate(new Date(documentReference.created))}
                    </div>
                </div>
            </div>
        );
    };

    const downloadClicked = (): void => {
        if (documentReference.url) {
            const estimatedDownloadDuration = Math.floor(
                (documentReference.fileSize / 5000000) * 1000,
            ); // Estimate 5MB/s download speed
            const anchor = document.createElement('a');
            anchor.href = documentReference.url;
            anchor.download = documentReference.fileName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();

            setTimeout(() => {
                navigate(routes.DOWNLOAD_COMPLETE);
            }, estimatedDownloadDuration);
        }
    };

    const removeClicked = (): void => {
        disableFullscreen();
        if (removeDocument) {
            removeDocument();
        }
    };

    const getLinks = (): Array<LGRecordActionLink> => {
        if (session.isFullscreen || viewState === DOCUMENT_VIEW_STATE.VERSION_HISTORY) {
            return [];
        }

        const canAddFiles =
            documentConfig.canBeUpdated &&
            documentReference.url &&
            !patientDetails?.deceased &&
            (role === REPOSITORY_ROLE.GP_ADMIN || role === REPOSITORY_ROLE.GP_CLINICAL);

        const inputLinks = getLloydGeorgeRecordLinks([
            {
                key: ACTION_LINK_KEY.DOWNLOAD,
                onClick: downloadClicked,
            },
            {
                key: ACTION_LINK_KEY.DELETE,
                onClick: removeClicked,
            },
        ]);

        if (canAddFiles) {
            inputLinks.push(
                AddAction(
                    documentConfig.content.getValue<string>('addFilesLinkLabel')!,
                    handleAddFilesClick,
                ),
            );

            if (config.featureFlags.documentCorrectEnabled) {
                const label = documentConfig.content.getValue<string>('reassignPagesLinkLabel')!;
                inputLinks.push(ReassignAction(label, handleReassignPagesClick));
            }

            if (config.featureFlags.versionHistoryEnabled) {
                const versionHistoryLabel = documentConfig.content.getValue<string, LGContentKeys>(
                    'versionHistoryLinkLabel',
                )!;
                const vhDescription = documentConfig.content.getValue<string, LGContentKeys>(
                    'versionHistoryLinkDescription',
                )!;
                inputLinks.push(
                    VersionHistoryAction(
                        versionHistoryLabel,
                        vhDescription,
                        handleVersionHistoryClick,
                    ),
                );
            }
        }

        const links = getRecordActionLinksAllowedForRole({
            role,
            hasRecordInStorage: true,
            inputLinks,
        });

        return links.sort((a, b) => a.index - b.index);
    };

    const enableFullscreen = (): void => {
        if (document.fullscreenEnabled) {
            document.documentElement.requestFullscreen?.();
        }
    };

    const disableFullscreen = (): void => {
        if (document.fullscreenElement !== null) {
            document.exitFullscreen?.();
        }
    };

    const handleAddFilesClick = async (): Promise<void> => {
        if (!patientDetails?.nhsNumber) {
            navigate(routes.SERVER_ERROR);
            return;
        }

        const fileName = documentReference.fileName;
        const documentId = documentReference.id;
        const versionId = documentReference.version;

        const response = await fetch(documentReference.url!);
        const blob = await response.blob();

        const to: To = {
            pathname: routeChildren.DOCUMENT_UPLOAD_SELECT_FILES,
            search: createSearchParams({ journey: 'update' }).toString(),
        };
        const options: NavigateOptions = {
            state: {
                journey: 'update',
                existingDocuments: [{ fileName, blob, documentId, versionId }],
            },
        };
        navigate(to, options);
    };

    const handleVersionHistoryClick = (): void => {
        const to: To = {
            pathname: routeChildren.DOCUMENT_VERSION_HISTORY,
        };

        const options: NavigateOptions = {
            state: {
                documentReference,
            },
        };

        setTimeout(() => {
            navigate(to, options);
        }, 0);
    };

    const handleReassignPagesClick = (): void => {
        const to: To = {
            pathname: routeChildren.DOCUMENT_REASSIGN_SELECT_PAGES,
        };
        const options: NavigateOptions = {
            state: {
                documentReference,
            },
        };
        // Defer navigation to next tick to ensure React state is settled
        setTimeout(() => {
            navigate(to, options);
        }, 0);
    };

    const handleRestoreVersionClick = (): void => {
        navigate(routeChildren.DOCUMENT_VERSION_RESTORE_CONFIRM, {
            replace: true,
            state: {
                documentReference,
            },
        });
    };

    const getRecordCard = (): React.JSX.Element => {
        const heading = documentConfig.content.getValueFormatString<string>('viewDocumentTitle', {
            version: documentReference.version,
        })!;

        const card = (
            <RecordCard
                heading={heading}
                fullScreenHandler={enableFullscreen}
                detailsElement={details()}
                isFullScreen={session.isFullscreen!}
                linksElement={recordCardLinks()}
                pdfObjectUrl={getPdfObjectUrl()}
                showMenu={showMenu}
            />
        );

        return session.isFullscreen ? (
            card
        ) : (
            <div className="document_record-stage_flex">
                <div
                    data-testid="record-card-container"
                    className={`document_record-stage_flex-row document_record-stage_flex-row${showMenu ? '--menu' : '--upload'}`}
                >
                    {card}
                </div>
            </div>
        );
    };

    const recordCardLinks = (): React.JSX.Element => {
        return (
            <Card.Group className="card-links" data-testid="record-menu-card">
                {getLinks().map((link) => (
                    <Card.GroupItem key={link.key} width="one-half">
                        <Card clickable cardType="primary">
                            <Card.Content>
                                <Card.Heading className="nhsuk-heading-m">
                                    <Card.Link
                                        data-testid={link.key}
                                        href="#"
                                        onClick={link.onClick}
                                    >
                                        {link.label}
                                    </Card.Link>
                                </Card.Heading>

                                {link.description && (
                                    <Card.Description>{link.description}</Card.Description>
                                )}
                            </Card.Content>
                        </Card>
                    </Card.GroupItem>
                ))}
            </Card.Group>
        );
    };

    return (
        <div className="document_record-stage">
            {session.isFullscreen && (
                <div className="header">
                    <div className="header-items">
                        <Button
                            reverse
                            data-testid="back-link"
                            className="exit-fullscreen-button"
                            onClick={disableFullscreen}
                        >
                            <ChevronLeftIcon className="mr-2" />
                            Exit full screen
                        </Button>
                        <h1 className="title">{pageHeader}</h1>
                        <LinkButton
                            data-testid="sign-out-link"
                            className="sign-out-link"
                            href="#"
                            onClick={(e): void => {
                                e.preventDefault();
                                disableFullscreen();
                                navigate(routes.LOGOUT);
                            }}
                        >
                            Sign out
                        </LinkButton>
                    </div>
                </div>
            )}

            <div className="main-content">
                <div className="top-info">
                    {!session.isFullscreen && (
                        <>
                            <BackLink
                                data-testid="go-back-button"
                                onClick={(
                                    e: MouseEvent<HTMLAnchorElement>,
                                ): Promise<void> | void => {
                                    e.preventDefault();
                                    if (viewState === DOCUMENT_VIEW_STATE.VERSION_HISTORY) {
                                        navigate(-1);
                                        return;
                                    }
                                    navigate(routes.PATIENT_DOCUMENTS);
                                }}
                            >
                                Go back
                            </BackLink>
                            <h1>{pageHeader}</h1>
                        </>
                    )}

                    <PatientSummary showDeceasedTag oneLine={session.isFullscreen}>
                        <PatientSummary.Child item={PatientInfo.FULL_NAME} />
                        <PatientSummary.Child item={PatientInfo.NHS_NUMBER} />
                        <PatientSummary.Child item={PatientInfo.BIRTH_DATE} />
                    </PatientSummary>

                    {/* PRMP-1584 hide this button */}
                    {viewState === DOCUMENT_VIEW_STATE.VERSION_HISTORY && !isActiveVersion && (
                        <Button
                            data-testid="view-restore-version-button"
                            onClick={handleRestoreVersionClick}
                        >
                            Restore version
                        </Button>
                    )}

                    {session.isFullscreen && showMenu && recordCardLinks()}
                </div>

                {documentReference.url ? getRecordCard() : <Spinner status="Loading document" />}
            </div>
        </div>
    );
};

export default DocumentView;
