import { AxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import DocumentSelectFileErrorsPage from '../../components/blocks/_documentManagement/documentSelectFileErrorsPage/DocumentSelectFileErrorsPage';
import DocumentSelectOrderStage from '../../components/blocks/_documentManagement/documentSelectOrderStage/DocumentSelectOrderStage';
import DocumentSelectStage from '../../components/blocks/_documentManagement/documentSelectStage/DocumentSelectStage';
import DocumentUploadCompleteStage from '../../components/blocks/_documentManagement/documentUploadCompleteStage/DocumentUploadCompleteStage';
import DocumentUploadConfirmStage from '../../components/blocks/_documentManagement/documentUploadConfirmStage/DocumentUploadConfirmStage';
import DocumentUploadInfectedStage from '../../components/blocks/_documentManagement/documentUploadInfectedStage/DocumentUploadInfectedStage';
import DocumentUploadingStage from '../../components/blocks/_documentManagement/documentUploadingStage/DocumentUploadingStage';
import DocumentUploadRemoveFilesStage from '../../components/blocks/_documentManagement/documentUploadRemoveFilesStage/DocumentUploadRemoveFilesStage';
import useBaseAPIHeaders from '../../helpers/hooks/useBaseAPIHeaders';
import useBaseAPIUrl from '../../helpers/hooks/useBaseAPIUrl';
import usePatient from '../../helpers/hooks/usePatient';
import { errorToParams } from '../../helpers/utils/errorToParams';
import { isLocal, isMock } from '../../helpers/utils/isLocal';
import {
    markDocumentsAsUploading,
    uploadSingleDocument,
} from '../../helpers/utils/uploadDocumentHelpers';
import {
    getJourney,
    getLastURLPath,
    JourneyType,
    useEnhancedNavigate,
} from '../../helpers/utils/urlManipulations';
import { routeChildren, routes } from '../../types/generic/routes';
import { UploadSession } from '../../types/generic/uploadResult';
import {
    DOCUMENT_UPLOAD_STATE,
    ExistingDocument,
    DocumentUploadLocationState,
    UploadDocument,
} from '../../types/pages/UploadDocumentsPage/types';
import {
    DOCUMENT_TYPE,
    DOCUMENT_TYPE_CONFIG,
    getConfigForDocType,
} from '../../helpers/utils/documentType';
import {
    getUploadSession,
    goToNextDocType,
    goToPreviousDocType,
    handleDocumentStatusUpdates,
    reduceDocumentsForUpload,
    startIntervalTimer,
} from '../../helpers/utils/documentUpload';
import { UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS } from '../../helpers/constants/network';
import DocumentUploadIndex from '../../components/blocks/_documentManagement/documentUploadIndex/DocumentUploadIndex';
import { LocationParams } from '../../types/generic/location';

const DocumentUploadPage = (): React.JSX.Element => {
    const patientDetails = usePatient();
    const nhsNumber: string = patientDetails?.nhsNumber ?? '';
    const baseUrl = useBaseAPIUrl();
    const location: LocationParams<DocumentUploadLocationState> = useLocation();
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
    const [interval, setInterval] = useState(0);
    const filesErrorPageRef = useRef(false);
    const [documentType, setDocumentType] = useState<DOCUMENT_TYPE>(DOCUMENT_TYPE.LLOYD_GEORGE);
    const [documentConfig, setDocumentConfig] = useState<DOCUMENT_TYPE_CONFIG>(
        getConfigForDocType(DOCUMENT_TYPE.LLOYD_GEORGE),
    );
    const [showSkipLink, setShowSkipLink] = useState<boolean | undefined>(undefined);
    const [documentTypeList, setDocumentTypeList] = useState<DOCUMENT_TYPE[]>([]);

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
        }
    }, [getJourney, navigate]);

    useEffect(() => {
        if (!virusReference.current && !completeRef.current) {
            handleDocumentStatusUpdates(
                navigate,
                intervalTimer,
                interval,
                documents,
                virusReference,
                completeRef,
                () => navigate.withParams(routeChildren.DOCUMENT_UPLOAD_COMPLETED),
            );
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
        interval,
        virusReference,
        completeRef,
    ]);

    useEffect(() => {
        const docConfig = getConfigForDocType(documentType);
        setDocumentConfig(docConfig);
        if (showSkipLink === undefined && docConfig.associatedSnomed) {
            setShowSkipLink(true);
            setDocumentTypeList([docConfig.snomedCode, docConfig.associatedSnomed]);
        }
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

    const uploadAllDocuments = (
        uploadDocuments: Array<UploadDocument>,
        uploadSession: UploadSession,
    ): void => {
        uploadDocuments.forEach((document) => {
            void uploadSingleDocument(document, uploadSession, setDocuments);
        });
    };

    const confirmFiles = async (): Promise<void> => {
        const reducedDocuments: UploadDocument[] = [];
        const existingId = existingDocuments[0]?.id;

        let currentDocTypeDocuments = await reduceDocumentsForUpload(
            [
                ...existingDocuments.filter((doc) => doc.docType === documentType),
                ...documents.filter((doc) => doc.docType === documentType),
            ],
            documentConfig,
            mergedPdfBlob!,
            patientDetails!,
            existingId ? existingDocuments[0]?.versionId! : '1',
        );
        reducedDocuments.push(...currentDocTypeDocuments);

        if (documentConfig.associatedSnomed) {
            const associatedDocuments = await reduceDocumentsForUpload(
                [
                    ...existingDocuments.filter(
                        (doc) => doc.docType === documentConfig.associatedSnomed,
                    ),
                    ...documents.filter((doc) => doc.docType === documentConfig.associatedSnomed),
                ],
                getConfigForDocType(documentConfig.associatedSnomed),
                mergedPdfBlob!,
                patientDetails!,
                existingId ? existingDocuments[0]?.versionId! : '1',
            );
            reducedDocuments.push(...associatedDocuments);
        }

        setDocuments(reducedDocuments);

        navigate.withParams(routeChildren.DOCUMENT_UPLOAD_UPLOADING);
    };

    const startUpload = async (): Promise<void> => {
        try {
            const uploadSession: UploadSession = await getUploadSession(
                patientDetails!.canManageRecord!,
                patientDetails!.nhsNumber,
                baseUrl,
                baseHeaders,
                existingDocuments[0]?.id,
                documents,
                setDocuments,
            );

            setUploadSession(uploadSession);
            const uploadingDocuments = markDocumentsAsUploading(documents, uploadSession);
            setDocuments(uploadingDocuments);

            if (!isLocal) {
                uploadAllDocuments(uploadingDocuments, uploadSession);
            }

            const updateStateInterval = startIntervalTimer(
                uploadingDocuments.filter((d) => d.state !== DOCUMENT_UPLOAD_STATE.ERROR),
                setInterval,
                documents,
                setDocuments,
                patientDetails!.canManageRecord!,
                patientDetails!.nhsNumber,
                baseUrl,
                baseHeaders,
                UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS,
            );
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

    const getWarningBoxText = (): string => {
        let text = 'Do not close or navigate away from this page until the upload is complete. ';
        if (journey === 'update') {
            text += `Your files will be added to the existing ${documentConfig.displayName} when the upload is complete.`;
        } else if (documentConfig.stitched) {
            text += 'Your files will be combined into one document when the upload is complete.';
        }

        return text;
    };

    const hasNextDocType = documentTypeList.indexOf(documentType) < documentTypeList.length - 1;
    const hasPreviousDocType = documentTypeList.indexOf(documentType) > 0;

    return (
        <div>
            <Routes>
                <Route
                    index
                    element={
                        <DocumentUploadIndex
                            setDocumentType={setDocumentType}
                            setJourney={setJourney}
                            updateExistingDocuments={updateExistingDocuments}
                        />
                    }
                />
                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_UPLOAD_SELECT_FILES) + '/*'}
                    element={
                        <DocumentSelectStage
                            documents={documents.filter((doc) => doc.docType === documentType)}
                            setDocuments={setDocuments}
                            documentType={documentType}
                            filesErrorRef={filesErrorPageRef}
                            documentConfig={documentConfig}
                            goToNextDocType={
                                hasNextDocType
                                    ? (): void =>
                                          goToNextDocType(
                                              documentTypeList,
                                              documentType,
                                              setShowSkipLink,
                                              setDocumentType,
                                              documents,
                                          )
                                    : undefined
                            }
                            goToPreviousDocType={
                                hasPreviousDocType
                                    ? (): void =>
                                          goToPreviousDocType(
                                              documentTypeList,
                                              documentType,
                                              setShowSkipLink,
                                              setDocumentType,
                                          )
                                    : undefined
                            }
                            showSkiplink={showSkipLink}
                        />
                    }
                />
                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_UPLOAD_SELECT_ORDER) + '/*'}
                    element={
                        <DocumentSelectOrderStage
                            documents={documents.filter((doc) => doc.docType === documentType)}
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
                            mergedPdfBlob={mergedPdfBlob}
                            setDocuments={setDocuments}
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
                            title={
                                journey === 'update'
                                    ? 'Uploading additional files'
                                    : 'Your documents are uploading'
                            }
                            warningBoxText={getWarningBoxText()}
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
