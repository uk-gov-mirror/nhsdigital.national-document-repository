import { AxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
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
    ExistingDocument,
    LocationParams,
    LocationState,
    UploadDocument,
} from '../../types/pages/UploadDocumentsPage/types';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../helpers/utils/documentType';
import { buildMockUploadSession } from '../../helpers/test/testBuilders';
import { reduceDocumentsForUpload } from '../../helpers/utils/documentUpload';
import DocumentUploadIndex from '../../components/blocks/_documentUpload/documentUploadIndex/DocumentUploadIndex';

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
    const [journey, setJourney] = useState<JourneyType>(getJourney());
    const config = useConfig();
    const interval = useRef<number>(0);
    const filesErrorPageRef = useRef(false);
    const [documentType, setDocumentType] = useState<DOCUMENT_TYPE>(DOCUMENT_TYPE.LLOYD_GEORGE);
    const [documentConfig, setDocumentConfig] = useState(getConfigForDocType(documentType));

    const UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS = 5000;
    const MAX_POLLING_TIME = 600000;

    useEffect(() => {
        const journeyParam = getJourney();
        if (journeyParam === 'update') {
            if (!location.state?.existingDocuments?.[0]?.blob) {
                // No existing documents found for update journey
                navigate(routes.SERVER_ERROR);
                return;
            }

            updateExistingDocuments(location.state?.existingDocuments ?? []);
        }
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
        const docWithError =
            documents.length === 1 &&
            documents.find((d) => d.state === DOCUMENT_UPLOAD_STATE.ERROR);
        const allFinished =
            documents.length > 0 &&
            documents.every(
                (d) =>
                    d.state === DOCUMENT_UPLOAD_STATE.SUCCEEDED ||
                    d.state === DOCUMENT_UPLOAD_STATE.ERROR,
            );

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
        setDocumentConfig(getConfigForDocType(documentType));
    }, [documentType]);

    useEffect(() => {
        return (): void => {
            window.clearInterval(intervalTimer);
        };
    }, [intervalTimer]);

    const updateExistingDocuments = (existingDocuments: ExistingDocument[]): void => {
        const newDocuments: Array<UploadDocument> =
            existingDocuments?.map(
                (doc) =>
                    ({
                        id: doc.documentId,
                        file: new File([doc.blob!], doc.fileName!, { type: 'application/pdf' }),
                        state: DOCUMENT_UPLOAD_STATE.SELECTED,
                        docType: doc.docType,
                        progress: 0,
                        versionId: doc.versionId,
                    }) as UploadDocument,
            ) ?? [];

        setExistingDocuments(newDocuments);
    };

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
            void uploadSingleLloydGeorgeDocument(document, uploadSession);
        });
    };

    const confirmFiles = async (): Promise<void> => {
        let reducedDocuments = [...existingDocuments, ...documents];
        const existingId = existingDocuments[0]?.id;

        reducedDocuments = await reduceDocumentsForUpload(
            reducedDocuments,
            documentConfig,
            mergedPdfBlob!,
            patientDetails!,
            existingId ? existingDocuments[0]?.versionId! : '1',
        );

        setDocuments(reducedDocuments);

        navigate.withParams(routeChildren.DOCUMENT_UPLOAD_UPLOADING);
    };

    const startUpload = async (): Promise<void> => {
        try {
            const uploadSession: UploadSession = isLocal
                ? buildMockUploadSession(documents)
                : await uploadDocuments({
                      nhsNumber,
                      documents: documents,
                      baseUrl,
                      baseHeaders,
                      documentReferenceId: existingDocuments[0]?.id,
                  });

            setUploadSession(uploadSession);
            const uploadingDocuments = markDocumentsAsUploading(documents, uploadSession);
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
            <DocumentUploadIndex
                setDocumentType={setDocumentType}
                setJourney={setJourney}
                updateExistingDocuments={updateExistingDocuments}
            />
        ) : (
            <DocumentSelectStage
                documents={documents}
                setDocuments={setDocuments}
                documentType={documentType}
                filesErrorRef={filesErrorPageRef}
                documentConfig={documentConfig}
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
                            documentConfig={documentConfig}
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
                            documentConfig={documentConfig}
                            confirmFiles={confirmFiles}
                        />
                    }
                />
                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_UPLOAD_REMOVE_ALL) + '/*'}
                    element={
                        <DocumentUploadRemoveFilesStage
                            documents={documents}
                            setDocuments={setDocuments}
                            documentType={documentType}
                        />
                    }
                />
                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_UPLOAD_CONFIRMATION) + '/*'}
                    element={
                        <DocumentUploadConfirmStage
                            documents={documents}
                            documentConfig={documentConfig}
                            confirmFiles={confirmFiles}
                        />
                    }
                />
                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_UPLOAD_UPLOADING) + '/*'}
                    element={
                        <DocumentUploadingStage
                            documents={documents}
                            startUpload={startUpload}
                            documentConfig={documentConfig}
                        />
                    }
                />
                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_UPLOAD_COMPLETED) + '/*'}
                    element={
                        <DocumentUploadCompleteStage
                            documents={documents}
                            documentConfig={documentConfig}
                        />
                    }
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
