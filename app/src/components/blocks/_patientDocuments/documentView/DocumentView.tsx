import { routeChildren, routes } from '../../../../types/generic/routes';
import useTitle from '../../../../helpers/hooks/useTitle';
import { useSessionContext } from '../../../../providers/sessionProvider/SessionProvider';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../../../helpers/utils/documentType';
import { getFormattedDate } from '../../../../helpers/utils/formatDate';
import { DocumentReference } from '../../../../types/pages/documentSearchResultsPage/types';
import {
    getRecordActionLinksAllowedForRole,
    LGRecordActionLink,
    lloydGeorgeRecordLinks,
    RECORD_ACTION,
} from '../../../../types/blocks/lloydGeorgeActions';
import { createSearchParams, NavigateOptions, To, useNavigate } from 'react-router-dom';
import { REPOSITORY_ROLE } from '../../../../types/generic/authRole';
import RecordCard from '../../../generic/recordCard/RecordCard';
import PatientSummary, { PatientInfo } from '../../../generic/patientSummary/PatientSummary';
import RecordMenuCard from '../../../generic/recordMenuCard/RecordMenuCard';
import { Button, ChevronLeftIcon } from 'nhsuk-react-components';
import BackButton from '../../../generic/backButton/BackButton';
import usePatient from '../../../../helpers/hooks/usePatient';
import { useEffect } from 'react';
import useRole from '../../../../helpers/hooks/useRole';
import LinkButton from '../../../generic/linkButton/LinkButton';

type Props = {
    documentReference: DocumentReference | null;
    removeDocument: () => void;
};

const DocumentView = ({
    documentReference,
    removeDocument,
}: Readonly<Props>): React.JSX.Element => {
    const [session, setUserSession] = useSessionContext();
    const role = useRole();
    const navigate = useNavigate();
    const showMenu = role === REPOSITORY_ROLE.GP_ADMIN && !session.isFullscreen;
    const patientDetails = usePatient();
    const documentConfig = getConfigForDocType(
        documentReference?.documentSnomedCodeType ?? DOCUMENT_TYPE.LLOYD_GEORGE,
    );

    const pageHeader = 'Lloyd George records';
    useTitle({ pageTitle: pageHeader });

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
    }, [session, setUserSession]);

    if (!documentReference) {
        navigate(routes.PATIENT_DOCUMENTS);
        return <></>;
    }

    const details = (): React.JSX.Element => {
        return (
            <div className="document_record-details">
                <div className="document_record-details_details">
                    <div className="document_record-details_details--last-updated mt-3">
                        Filename: {documentReference.fileName}
                    </div>
                    <div className="document_record-details_details--last-updated mt-3">
                        Last updated: {getFormattedDate(new Date(documentReference.created))}
                    </div>
                </div>
            </div>
        );
    };

    const downloadClicked = (): void => {
        if (documentReference.url) {
            const estimatedDownloadDuration = 
                Math.floor(documentReference.fileSize / 5000000 * 1000); // Estimate 5MB/s download speed
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
        removeDocument();
    };

    const getCardLinks = (): Array<LGRecordActionLink> => {
        if (session.isFullscreen) {
            return [];
        }

        const links = getRecordActionLinksAllowedForRole({
            role,
            hasRecordInStorage: true,
            inputLinks: lloydGeorgeRecordLinks,
        });

        return links.map((link) => {
            return {
                ...link,
                href:
                    link.type === RECORD_ACTION.DELETE ? routeChildren.DOCUMENT_DELETE : undefined,
                onClick: link.type === RECORD_ACTION.DOWNLOAD ? downloadClicked : removeClicked,
            };
        });
    };

    const getPdfObjectUrl = (): string => {
        if (documentReference.contentType !== 'application/pdf') {
            return '';
        }

        return documentReference.url ? documentReference.url : 'loading';
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

    const getRecordCard = (): React.JSX.Element => {
        const card = (
            <RecordCard
                heading={documentConfig.content.viewDocumentTitle as string}
                fullScreenHandler={enableFullscreen}
                detailsElement={details()}
                isFullScreen={session.isFullscreen!}
                recordLinks={getCardLinks()}
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

    const canAddFiles =
        documentConfig.canBeUpdated &&
        documentReference.url &&
        !patientDetails?.deceased &&
        (role === REPOSITORY_ROLE.GP_ADMIN || role === REPOSITORY_ROLE.GP_CLINICAL);

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
                            href='#'
                            onClick={(): void => {
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
                            <BackButton
                                dataTestid="go-back-button"
                                toLocation={routes.PATIENT_DOCUMENTS}
                                backLinkText="Go back"
                            />
                            <h1>{pageHeader}</h1>
                        </>
                    )}

                    <PatientSummary showDeceasedTag oneLine={session.isFullscreen}>
                        <PatientSummary.Child item={PatientInfo.FULL_NAME} />
                        <PatientSummary.Child item={PatientInfo.NHS_NUMBER} />
                        <PatientSummary.Child item={PatientInfo.BIRTH_DATE} />
                    </PatientSummary>

                    {session.isFullscreen && (
                        <RecordMenuCard
                            recordLinks={getCardLinks()}
                            setStage={(): void => {}}
                            showMenu={showMenu}
                        />
                    )}

                    {!session.isFullscreen && canAddFiles && (
                        <>
                            <h2 className="title">Add Files</h2>
                            <p>You can add more files to this patient's record.</p>
                            <Button onClick={handleAddFilesClick} data-testid="add-files-btn">
                                Add Files
                            </Button>
                        </>
                    )}
                </div>

                {documentReference.url ? (
                    getRecordCard()
                ) : (
                    <p>
                        This document is currently being uploaded, please try again in a few
                        minutes.
                    </p>
                )}
            </div>
        </div>
    );
};

export default DocumentView;
