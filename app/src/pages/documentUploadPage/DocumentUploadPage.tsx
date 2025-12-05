import { AxiosError } from 'axios';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import DocumentSelectFileErrorsPage from '../../components/blocks/_documentUpload/documentSelectFileErrorsPage/DocumentSelectFileErrorsPage';
import DocumentSelectOrderStage from '../../components/blocks/_documentUpload/documentSelectOrderStage/DocumentSelectOrderStage';
import DocumentSelectStage from '../../components/blocks/_documentUpload/documentSelectStage/DocumentSelectStage';
import DocumentUploadCompleteStage from '../../components/blocks/_documentUpload/documentUploadCompleteStage/DocumentUploadCompleteStage';
import DocumentUploadConfirmStage from '../../components/blocks/_documentUpload/documentUploadConfirmStage/DocumentUploadConfirmStage';
import DocumentUploadInfectedStage from '../../components/blocks/_documentUpload/documentUploadInfectedStage/DocumentUploadInfectedStage';
import DocumentUploadingStage from '../../components/blocks/_documentUpload/documentUploadingStage/DocumentUploadingStage';
import DocumentUploadRemoveFilesStage from '../../components/blocks/_documentUpload/documentUploadRemoveFilesStage/DocumentUploadRemoveFilesStage';
import useBaseAPIHeaders from '../../helpers/hooks/useBaseAPIHeaders';
import useBaseAPIUrl from '../../helpers/hooks/useBaseAPIUrl';
import useConfig from '../../helpers/hooks/useConfig';
import usePatient from '../../helpers/hooks/usePatient';
import uploadDocuments, {
    generateFileName,
    getDocumentStatus,
    uploadDocumentToS3,
} from '../../helpers/requests/uploadDocuments';
import { errorCodeToParams, errorToParams } from '../../helpers/utils/errorToParams';
import { isLocal, isMock } from '../../helpers/utils/isLocal';
import {
    markDocumentsAsUploading,
    setSingleDocument,
} from '../../helpers/utils/uploadDocumentHelpers';
import {
    getJourney,
    getLastURLPath,
    JourneyType,
    useEnhancedNavigate,
} from '../../helpers/utils/urlManipulations';
import { routeChildren, routes } from '../../types/generic/routes';
import { DocumentStatusResult, UploadSession } from '../../types/generic/uploadResult';
import {
    DOCUMENT_STATUS,
    DOCUMENT_UPLOAD_STATE,
    UploadDocument,
} from '../../types/pages/UploadDocumentsPage/types';
import documentTypesConfig from '../../config/documentTypesConfig.json';
import { Card } from 'nhsuk-react-components';
import { ReactComponent as RightCircleIcon } from '../../styles/right-chevron-circle.svg';
import PatientSummary from '../../components/generic/patientSummary/PatientSummary';
import { DOCUMENT_TYPE } from '../../helpers/utils/documentType';

type LocationState = {
    journey?: JourneyType;
    existingDocuments?: [
        {
            docType: DOCUMENT_TYPE | null;
            blob: Blob | null;
            fileName: string | null;
            documentId?: string | null;
            versionId: string;
        },
    ];
};

type LocationParams<T> = {
    pathname: string;
    state: T | undefined;
    search: string;
    hash: string;
    key: string;
};

const DocumentUploadPage = (): React.JSX.Element => {
    const patientDetails = usePatient();
    const nhsNumber: string = patientDetails?.nhsNumber ?? '';
    const baseUrl = useBaseAPIUrl();
    const location: LocationParams<LocationState> = useLocation();
    const baseHeaders = useBaseAPIHeaders();
    const [documents, setDocuments] = useState<Array<UploadDocument>>([]);
    const [existingDocuments, setExistingDocuments] = useState<Array<UploadDocument>>([]);
    const [uploadSession, setUploadSession] = useState<UploadSession | null>(null);
    const completeRef = useRef(false);
    const virusReference = useRef(false);
    const navigate = useEnhancedNavigate();
    const [intervalTimer, setIntervalTimer] = useState(0);
    const [mergedPdfBlob, setMergedPdfBlob] = useState<Blob>();
    const [journey] = useState<JourneyType>(getJourney());
    const config = useConfig();
    const interval = useRef<number>(0);
    const filesErrorPageRef = useRef(false);
    const [documentType, setDocumentType] = useState<DOCUMENT_TYPE>(DOCUMENT_TYPE.LLOYD_GEORGE);

    const UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS = 5000;
    const MAX_POLLING_TIME = 120000;

    useEffect(() => {
        const journeyParam = getJourney();
        if (journeyParam === 'update' && !location.state?.existingDocuments?.[0]?.blob) {
            // No existing documents found for update journey
            navigate(routes.SERVER_ERROR);
            return;
        }

        const newDocuments: Array<UploadDocument> =
            location.state?.existingDocuments?.map(
                (doc) =>
                    ({
                        id: doc.documentId,
                        file: new File([doc.blob!], doc.fileName!, { type: 'application/pdf' }),
                        state: DOCUMENT_UPLOAD_STATE.SELECTED,
                        docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                        progress: 0,
                        versionId: doc.versionId,
                    }) as UploadDocument,
            ) ?? [];

        setExistingDocuments(newDocuments);
    }, []);

    useEffect(() => {
        const journeyParam = getJourney();

        if (journeyParam === 'update' && journey !== journeyParam) {
            globalThis.clearInterval(intervalTimer);
            navigate(routes.SERVER_ERROR);
            return;
        }

        if (interval.current * UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS > MAX_POLLING_TIME) {
            window.clearInterval(intervalTimer);
            navigate(routes.SERVER_ERROR);
            return;
        }

        const hasVirus = documents.some((d) => d.state === DOCUMENT_UPLOAD_STATE.INFECTED);
        const docWithError = documents.find((d) => d.state === DOCUMENT_UPLOAD_STATE.ERROR);
        const allFinished =
            documents.length > 0 &&
            documents.every((d) => d.state === DOCUMENT_UPLOAD_STATE.SUCCEEDED);

        if (hasVirus && !virusReference.current) {
            virusReference.current = true;
            window.clearInterval(intervalTimer);
            navigate(routeChildren.DOCUMENT_UPLOAD_INFECTED);
        } else if (docWithError) {
            const errorParams = docWithError.error ? errorCodeToParams(docWithError.error) : '';
            navigate(routes.SERVER_ERROR + errorParams);
        } else if (allFinished && !completeRef.current) {
            completeRef.current = true;
            window.clearInterval(intervalTimer);
            navigate.withParams(routeChildren.DOCUMENT_UPLOAD_COMPLETED);
        }
    }, [
        baseHeaders,
        baseUrl,
        documents,
        navigate,
        nhsNumber,
        setDocuments,
        uploadSession,
        intervalTimer,
    ]);

    useEffect(() => {
        return (): void => {
            window.clearInterval(intervalTimer);
        };
    }, [intervalTimer]);

    const uploadSingleLloydGeorgeDocument = async (
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
            window.clearInterval(intervalTimer);
            markDocumentAsFailed(document);

            const error = e as AxiosError;
            navigate(routes.SERVER_ERROR + errorToParams(error));
        }
    };

    const markDocumentAsFailed = (document: UploadDocument): void => {
        setSingleDocument(setDocuments, {
            id: document.id,
            state: DOCUMENT_UPLOAD_STATE.ERROR,
            progress: 0,
        });
    };

    const uploadAllDocuments = (
        uploadDocuments: Array<UploadDocument>,
        uploadSession: UploadSession,
    ): void => {
        uploadDocuments.forEach((document) => {
            if (document.docType === DOCUMENT_TYPE.LLOYD_GEORGE) {
                void uploadSingleLloydGeorgeDocument(document, uploadSession);
            }
        });
    };

    const getMockUploadSession = (documents: UploadDocument[]): UploadSession => {
        const session: UploadSession = {};
        documents.forEach((doc) => {
            session[doc.id] = {
                url: 'https://dusafgdswgfew4-staging-bulk-store.s3.eu-west-2.amazonaws.com/user_upload/9730153817/91b73c0f-b5b0-49f1-acbe-b0a5752dc3df?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAXYSUA44V5SE2IC6U%2F20251028%2Feu-west-2%2Fs3%2Faws4_request&X-Amz-Date=20251028T162320Z&X-Amz-Expires=1800&X-Amz-SignedHeaders=host&X-Amz-Security-Token=FwoGZXIvYXdzEBoaDCqX56UT2MdBQk7ztCLIAWXO7781OXoLLc3gJN9UQcAZlaoEhwJl5FQfKuJvn32DAPwYhbS80rb0JGIYmF8rIqj7TKbNOfaw4t%2Bq5NUO%2FEDQLxRbSpl8%2B078%2Ba9d2pY5XbPH3u6D0nW9mzNVREwg1%2Bt02HnWp9YLdREyDO4is9Fj5P3SQRh6DydzLx3in%2BZzzwVK8prxGG%2BBYRn5cQVOKcQCtAR7NMhHhTz9GeFQxU6X5YNalZdZdRJoFmdkxkpdoFeoIozs2Kg6plZhnqbWpFIrV3GvmYTDKPfbg8gGMi2c6f%2F9IJpIscXn0RfQZYA8lr02VHjBtez0LgzKcGVXYsE666uclkspOgBxpgo%3D&X-Amz-Signature=fdf6e3d7522ab4fe80156510d1318c430d4a44170fb98924cdc231117b5eafb8',
            } as any;
        });

        return session;
    };

    const startUpload = async (): Promise<void> => {
        try {
            let reducedDocuments = [...existingDocuments, ...documents];
            const existingId = existingDocuments[0]?.id;

            if (
                reducedDocuments.some((doc) => doc.docType === DOCUMENT_TYPE.LLOYD_GEORGE) &&
                mergedPdfBlob
            ) {
                reducedDocuments = reducedDocuments.filter(
                    (doc) => doc.docType !== DOCUMENT_TYPE.LLOYD_GEORGE,
                );

                const filename = generateFileName(patientDetails);
                reducedDocuments.push({
                    id: uuidv4(),
                    file: new File([mergedPdfBlob], filename, { type: 'application/pdf' }),
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    progress: 0,
                    docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                    attempts: 0,
                    versionId: existingId ? existingDocuments[0]?.versionId : '1',
                });
            }

            const uploadSession: UploadSession = isLocal
                ? getMockUploadSession(reducedDocuments)
                : await uploadDocuments({
                      nhsNumber,
                      documents: reducedDocuments,
                      baseUrl,
                      baseHeaders,
                      documentReferenceId: existingId,
                  });

            setUploadSession(uploadSession);
            const uploadingDocuments = markDocumentsAsUploading(reducedDocuments, uploadSession);
            setDocuments(uploadingDocuments);

            if (!isLocal) {
                uploadAllDocuments(uploadingDocuments, uploadSession);
            }

            const updateStateInterval = startIntervalTimer(uploadingDocuments);
            setIntervalTimer(updateStateInterval);
        } catch (e) {
            const error = e as AxiosError;
            if (error.response?.status === 403) {
                navigate(routes.SESSION_EXPIRED);
            } else if (isMock(error)) {
                setDocuments((prevState) =>
                    prevState.map((doc) => ({
                        ...doc,
                        state: DOCUMENT_UPLOAD_STATE.SUCCEEDED,
                    })),
                );
                window.clearInterval(intervalTimer);
                navigate.withParams(routeChildren.DOCUMENT_UPLOAD_COMPLETED);
            } else {
                navigate(routes.SERVER_ERROR + errorToParams(error));
            }
        }
    };

    const handleDocStatusResult = (documentStatusResult: DocumentStatusResult): void => {
        setDocuments((previousState) =>
            previousState.map((doc) => {
                const docStatus = documentStatusResult[doc.ref!];

                const updatedDoc = {
                    ...doc,
                };

                switch (docStatus?.status) {
                    case DOCUMENT_STATUS.FINAL:
                        updatedDoc.state = DOCUMENT_UPLOAD_STATE.SUCCEEDED;
                        break;

                    case DOCUMENT_STATUS.INFECTED:
                        updatedDoc.state = DOCUMENT_UPLOAD_STATE.INFECTED;
                        break;

                    case DOCUMENT_STATUS.NOT_FOUND:
                    case DOCUMENT_STATUS.CANCELLED:
                        updatedDoc.state = DOCUMENT_UPLOAD_STATE.ERROR;
                        updatedDoc.errorCode = docStatus.error_code;
                        break;
                }

                return updatedDoc;
            }),
        );
    };

    const startIntervalTimer = (uploadDocuments: Array<UploadDocument>): number => {
        return window.setInterval(async () => {
            interval.current = interval.current + 1;
            if (isLocal) {
                const updatedDocuments = uploadDocuments.map((doc) => {
                    const min = (doc.progress ?? 0) + 40;
                    const max = 70;
                    doc.progress = Math.random() * (min + max - (min + 1)) + min;
                    doc.progress = doc.progress > 100 ? 100 : doc.progress;
                    if (doc.progress < 100) {
                        doc.state = DOCUMENT_UPLOAD_STATE.UPLOADING;
                    } else if (doc.state !== DOCUMENT_UPLOAD_STATE.SCANNING) {
                        doc.state = DOCUMENT_UPLOAD_STATE.SCANNING;
                    } else {
                        const hasVirusFile = documents.filter(
                            (d) => d.file.name.toLocaleLowerCase() === 'virus.pdf',
                        );
                        const hasFailedFile = documents.filter(
                            (d) => d.file.name.toLocaleLowerCase() === 'virus-failed.pdf',
                        );
                        hasVirusFile.length > 0
                            ? (doc.state = DOCUMENT_UPLOAD_STATE.INFECTED)
                            : hasFailedFile.length > 0
                              ? (doc.state = DOCUMENT_UPLOAD_STATE.FAILED)
                              : (doc.state = DOCUMENT_UPLOAD_STATE.SUCCEEDED);
                    }

                    return doc;
                });
                setDocuments(updatedDocuments);
            } else {
                try {
                    const documentStatusResult = await getDocumentStatus({
                        documents: uploadDocuments,
                        baseUrl,
                        baseHeaders,
                        nhsNumber,
                    });

                    handleDocStatusResult(documentStatusResult);
                } catch (e) {
                    const error = e as AxiosError;
                    navigate(routes.SERVER_ERROR + errorToParams(error));
                }
            }
        }, UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS);
    };

    if (
        !config.featureFlags.uploadLambdaEnabled ||
        !config.featureFlags.uploadLloydGeorgeWorkflowEnabled ||
        (!config.featureFlags.uploadDocumentIteration2Enabled && journey === 'update')
    ) {
        navigate(routes.HOME);
        return <></>;
    }

    const getIndexElement = (): React.JSX.Element => {
        return config.featureFlags.uploadDocumentIteration3Enabled ? (
            <DocumentUploadIndex setDocumentType={setDocumentType} />
        ) : (
            <DocumentSelectStage
                documents={documents}
                setDocuments={setDocuments}
                documentType={documentType}
                filesErrorRef={filesErrorPageRef}
            />
        );
    };

    return (
        <div>
            <Routes>
                <Route index element={getIndexElement()} />
                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_UPLOAD_SELECT_FILES) + '/*'}
                    element={
                        <DocumentSelectStage
                            documents={documents}
                            setDocuments={setDocuments}
                            documentType={documentType}
                            filesErrorRef={filesErrorPageRef}
                        />
                    }
                />
                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_UPLOAD_SELECT_ORDER) + '/*'}
                    element={
                        <DocumentSelectOrderStage
                            documents={documents}
                            setDocuments={setDocuments}
                            setMergedPdfBlob={setMergedPdfBlob}
                            existingDocuments={existingDocuments}
                        />
                    }
                />
                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_UPLOAD_REMOVE_ALL) + '/*'}
                    element={
                        <DocumentUploadRemoveFilesStage
                            documents={documents}
                            setDocuments={setDocuments}
                            documentType={DOCUMENT_TYPE.LLOYD_GEORGE}
                        />
                    }
                />
                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_UPLOAD_CONFIRMATION) + '/*'}
                    element={<DocumentUploadConfirmStage documents={documents} />}
                />
                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_UPLOAD_UPLOADING) + '/*'}
                    element={
                        <DocumentUploadingStage documents={documents} startUpload={startUpload} />
                    }
                />
                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_UPLOAD_COMPLETED) + '/*'}
                    element={<DocumentUploadCompleteStage documents={documents} />}
                />
                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_UPLOAD_INFECTED) + '/*'}
                    element={<DocumentUploadInfectedStage />}
                />
                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_UPLOAD_FILE_ERRORS) + '/*'}
                    element={<DocumentSelectFileErrorsPage documents={documents} />}
                />
            </Routes>

            <Outlet />
        </div>
    );
};

export default DocumentUploadPage;

type DocumentUploadIndexProps = {
    setDocumentType: Dispatch<SetStateAction<DOCUMENT_TYPE>>;
};
const DocumentUploadIndex = ({ setDocumentType }: DocumentUploadIndexProps): React.JSX.Element => {
    const navigate = useNavigate();

    const documentTypeSelected = (documentType: DOCUMENT_TYPE): void => {
        setDocumentType(documentType);
        navigate(routeChildren.DOCUMENT_UPLOAD_SELECT_FILES);
    };

    return (
        <>
            <h1 data-testid="page-title">Choose a document type to upload</h1>

            <PatientSummary oneLine />

            <Card.Group>
                {documentTypesConfig.map((documentConfig) => (
                    <Card.GroupItem width="one-half" key={documentConfig.snomed_code}>
                        <Card clickable cardType="primary">
                            <Card.Content>
                                <Card.Heading className="nhsuk-heading-m">
                                    <Card.Link
                                        data-testid={`upload-${documentConfig.snomed_code}-link`}
                                        onClick={(): void =>
                                            documentTypeSelected(
                                                documentConfig.snomed_code as DOCUMENT_TYPE,
                                            )
                                        }
                                    >
                                        {documentConfig.content.upload_title}
                                    </Card.Link>
                                </Card.Heading>
                                <Card.Description>
                                    {documentConfig.content.upload_description}
                                </Card.Description>
                                <RightCircleIcon />
                            </Card.Content>
                        </Card>
                    </Card.GroupItem>
                ))}
            </Card.Group>
        </>
    );
};
