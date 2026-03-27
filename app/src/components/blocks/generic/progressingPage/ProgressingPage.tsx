import { Table, WarningCallout } from 'nhsuk-react-components';
import useTitle from '../../../../helpers/hooks/useTitle';
import {
    DOCUMENT_UPLOAD_STATE,
    UploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { routeChildren, routes } from '../../../../types/generic/routes';
import {
    allDocsHaveState,
    markDocumentsAsUploading,
    setSingleDocument,
} from '../../../../helpers/utils/uploadDocumentHelpers';
import {
    AllContentKeys,
    DOCUMENT_TYPE_CONFIG,
    DOCUMENT_TYPE_CONFIG_GENERIC,
    LGContentKeys,
} from '../../../../helpers/utils/documentType';
import { errorCodeToParams, errorToParams } from '../../../../helpers/utils/errorToParams';
import {
    MAX_POLLING_TIME,
    UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS,
} from '../../../../helpers/constants/network';
import { getUploadSession, startIntervalTimer } from '../../../../helpers/utils/documentUpload';
import { uploadDocumentToS3 } from '../../../../helpers/requests/uploadDocuments';
import { isLocal } from '../../../../helpers/utils/isLocal';
import { UploadSession } from '../../../../types/generic/uploadResult';
import { AxiosError } from 'axios';
import { PatientDetails } from '../../../../types/generic/patientDetails';
import { AuthHeaders } from '../../../../types/blocks/authHeaders';
import Spinner from '../../../generic/spinner/Spinner';

type JourneyTypes = 'upload' | 'update' | 'restore';

type ProgressingJourneyType<T extends AllContentKeys> = {
    journey: JourneyTypes;
    pageTitle: (documentConfig: DOCUMENT_TYPE_CONFIG_GENERIC<T>) => string | undefined;
    warningCalloutAdditionalText?: (
        documentConfig: DOCUMENT_TYPE_CONFIG_GENERIC<T>,
    ) => string | undefined;
    tableHeadProgressText: string;
    actionText?: string;
    progressAriaLabel?: string;
    outputAriaLabel?: string;
    progressOutputText?: string;
};

const progressingPageJourneys: ProgressingJourneyType<AllContentKeys>[] = [
    {
        journey: 'upload',
        warningCalloutAdditionalText: (
            documentConfig: DOCUMENT_TYPE_CONFIG_GENERIC<AllContentKeys>,
        ) =>
            documentConfig.stitched
                ? `Your files will be combined into one document when the upload is complete.`
                : undefined,
        pageTitle: () => 'Your documents are uploading',
        tableHeadProgressText: 'Upload progress',
    },
    {
        journey: 'update',
        warningCalloutAdditionalText: (
            documentConfig: DOCUMENT_TYPE_CONFIG_GENERIC<AllContentKeys>,
        ) =>
            documentConfig.stitched
                ? `Your files will be added to the existing ${documentConfig.displayName} when the upload is complete.`
                : undefined,
        pageTitle: () => 'Uploading additional files',
        tableHeadProgressText: 'Upload progress',
    },
    {
        journey: 'restore',
        pageTitle: (docConfig: DOCUMENT_TYPE_CONFIG_GENERIC<LGContentKeys>) =>
            docConfig.content.getValue('restoreProgressingPageTitle'),
        tableHeadProgressText: 'Restore progress',
        progressAriaLabel: 'Restoring',
        outputAriaLabel: 'restoring status',
        progressOutputText: 'restored',
    },
];

export type ProgressingPageProps = {
    documents: UploadDocument[];
    setDocuments: Dispatch<SetStateAction<UploadDocument[]>>;
    documentConfig: DOCUMENT_TYPE_CONFIG;
    journey: JourneyTypes;
    patientDetails: PatientDetails;
    baseUrl: string;
    baseHeaders: AuthHeaders;
    documentReferenceId?: string;
    prepareDocuments: () => Promise<void>;
    onAllFinished: () => void;
    /** Defaults to navigating to DOCUMENT_UPLOAD_INFECTED */
    onInfected?: () => void;
    /** Defaults to navigating to SERVER_ERROR with error params */
    onFailedDocument?: (document: UploadDocument) => void;
    /** Defaults to navigating to SESSION_EXPIRED */
    onSessionExpired?: () => void;
    /** Defaults to navigating to SERVER_ERROR with error params */
    onUploadError?: (error: AxiosError) => void;
    /** Defaults to navigating to SERVER_ERROR */
    onPollingTimeout?: () => void;
};

const ProgressingPage = ({
    documents,
    setDocuments,
    documentConfig,
    journey,
    patientDetails,
    baseUrl,
    baseHeaders,
    documentReferenceId,
    prepareDocuments,
    onInfected,
    onFailedDocument,
    onAllFinished,
    onSessionExpired,
    onUploadError,
    onPollingTimeout,
}: Readonly<ProgressingPageProps>): React.JSX.Element => {
    const journeyData = progressingPageJourneys.find((j) => j.journey === journey)!;
    const pageHeader = journeyData.pageTitle(documentConfig)!;

    useTitle({ pageTitle: pageHeader });
    const navigate = useNavigate();
    const uploadStartedRef = useRef<boolean>(false);
    const virusHandledRef = useRef(false);
    const completeHandledRef = useRef(false);
    const preparingDocsRef = useRef(false);
    const documentsRef = useRef<UploadDocument[]>([]);

    const [interval, setInterval] = useState<number>(0);
    const [intervalTimer, setIntervalTimer] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(!!prepareDocuments);

    const clearIntervalTimer = (): void => {
        if (intervalTimer) {
            globalThis.clearInterval(intervalTimer);
        }
    };

    const handleSessionExpired = (): void => {
        if (onSessionExpired) {
            onSessionExpired();
        } else {
            navigate(routes.SESSION_EXPIRED);
        }
    };

    const handleUploadError = (error: AxiosError): void => {
        if (onUploadError) {
            onUploadError(error);
        } else {
            navigate(routes.SERVER_ERROR + errorToParams(error));
        }
    };

    const handlePollingTimeout = (): void => {
        clearIntervalTimer();
        if (onPollingTimeout) {
            onPollingTimeout();
        } else {
            navigate(routes.SERVER_ERROR);
        }
    };

    const handleVirus = (): void => {
        virusHandledRef.current = true;
        clearIntervalTimer();
        if (onInfected) {
            onInfected();
        } else {
            navigate(routeChildren.DOCUMENT_UPLOAD_INFECTED);
        }
    };

    const handleFailedDocument = (doc: UploadDocument): void => {
        if (onFailedDocument) {
            onFailedDocument(doc);
        } else {
            const errorParams = doc.error ? errorCodeToParams(doc.error) : '';
            navigate(routes.SERVER_ERROR + errorParams);
        }
    };

    const handleAllFinished = (): void => {
        completeHandledRef.current = true;
        clearIntervalTimer();
        if (onAllFinished) {
            onAllFinished();
        } else {
            navigate(routes.HOME);
        }
    };

    const uploadSingleDocument = async (
        document: UploadDocument,
        uploadSession: UploadSession,
    ): Promise<void> => {
        try {
            await uploadDocumentToS3({
                document,
                uploadSession,
                setDocuments,
            });
        } catch (e) {
            clearIntervalTimer();
            setSingleDocument(setDocuments, {
                id: document.id,
                state: DOCUMENT_UPLOAD_STATE.ERROR,
                progress: 0,
            });

            const error = e as AxiosError;
            if (error.response?.status === 403) {
                handleSessionExpired();
                return;
            }
            handleUploadError(error);
        }
    };

    const startUpload = async (): Promise<void> => {
        try {
            const uploadSession: UploadSession = await getUploadSession(
                true,
                patientDetails.nhsNumber,
                baseUrl,
                baseHeaders,
                documentReferenceId,
                documents,
                setDocuments,
            );

            const uploadingDocuments = markDocumentsAsUploading(documents, uploadSession);
            setDocuments(uploadingDocuments);

            if (!isLocal) {
                uploadingDocuments.forEach((doc) => {
                    void uploadSingleDocument(doc, uploadSession);
                });
            }

            const timer = startIntervalTimer(
                uploadingDocuments,
                setInterval,
                documentsRef.current,
                setDocuments,
                true,
                patientDetails.nhsNumber,
                baseUrl,
                baseHeaders,
                UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS,
            );
            setIntervalTimer(timer);
        } catch (e) {
            const error = e as AxiosError;
            if (error.response?.status === 403) {
                handleSessionExpired();
                return;
            }
            handleUploadError(error);
        }
    };

    useEffect(() => {
        if (prepareDocuments && !preparingDocsRef.current) {
            preparingDocsRef.current = true;
            setIsLoading(true);
            prepareDocuments().finally((): void => {
                setIsLoading(false);
            });
        }
    }, []);

    useEffect(() => {
        documentsRef.current = documents;
    }, [documents]);

    useEffect(() => {
        if (isLoading) return;
        if (!uploadStartedRef.current) {
            if (!allDocsHaveState(documents, [DOCUMENT_UPLOAD_STATE.SELECTED])) {
                navigate(routes.HOME);
                return;
            }

            uploadStartedRef.current = true;
            startUpload();
        }
    }, [isLoading]);

    useEffect(() => {
        if (interval * UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS > MAX_POLLING_TIME) {
            handlePollingTimeout();
            return;
        }

        if (!uploadStartedRef.current) return;

        const hasVirus = documents.some((d) => d.state === DOCUMENT_UPLOAD_STATE.INFECTED);
        const docWithError = documents.find((d) => d.state === DOCUMENT_UPLOAD_STATE.ERROR);
        const allFinished =
            documents.length > 0 &&
            documents.every((d) => d.state === DOCUMENT_UPLOAD_STATE.SUCCEEDED);

        if (hasVirus && !virusHandledRef.current) {
            handleVirus();
        } else if (docWithError) {
            handleFailedDocument(docWithError);
        } else if (allFinished && !completeHandledRef.current) {
            handleAllFinished();
        }
    }, [documents, interval]);

    useEffect(() => {
        return (): void => {
            globalThis.clearInterval(intervalTimer);
        };
    }, [intervalTimer]);

    if (isLoading) {
        return <Spinner status="preparing upload" />;
    }

    if (
        !uploadStartedRef.current &&
        !allDocsHaveState(documents, [DOCUMENT_UPLOAD_STATE.SELECTED])
    ) {
        return <></>;
    }

    let hasCalloutText = journeyData.warningCalloutAdditionalText?.(documentConfig) !== undefined;

    return (
        <>
            <h1 data-testid="arf-upload-uploading-stage-header">{pageHeader}</h1>
            <WarningCallout id="upload-stage-warning">
                <WarningCallout.Label headingLevel="h2">Stay on this page</WarningCallout.Label>
                <p>
                    Do not close or navigate away from this page until the upload is complete.{' '}
                    {hasCalloutText && (
                        <span>{journeyData.warningCalloutAdditionalText!(documentConfig)}</span>
                    )}
                </p>
            </WarningCallout>
            <Table
                responsive
                caption="Your documents are uploading"
                captionProps={{
                    className: 'nhsuk-u-visually-hidden',
                }}
            >
                <Table.Head>
                    <Table.Row>
                        <Table.Cell width="63%">Filename</Table.Cell>
                        <Table.Cell>{journeyData.tableHeadProgressText}</Table.Cell>
                    </Table.Row>
                </Table.Head>
                <Table.Body>
                    {documents.map((document) => (
                        <Table.Row key={document.id}>
                            <Table.Cell>{document.file.name}</Table.Cell>
                            <Table.Cell className="table-cell-uploading-cell-wide">
                                <progress
                                    aria-label={`${journeyData.progressAriaLabel ?? 'Uploading'} ${document.file.name}`}
                                    max="100"
                                    value={document.progress}
                                    className={`${document.progress === 100 ? 'complete' : ''}`}
                                ></progress>
                                <output
                                    className="ml-4"
                                    aria-label={`${document.file.name} ${journeyData.outputAriaLabel ?? 'upload status'}`}
                                >
                                    {`${Math.round(document.progress!)}% ${journeyData.progressOutputText ?? 'uploaded'}`}
                                </output>
                            </Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table>
            {documents.some((d) => d.state === DOCUMENT_UPLOAD_STATE.SCANNING) && (
                <div id="virus-scan-status">
                    <div className="nhsuk-inset-text">
                        <span className="nhsuk-u-visually-hidden">Information: </span>
                        <p>Virus scan in progress...</p>
                    </div>
                </div>
            )}
        </>
    );
};

export default ProgressingPage;
