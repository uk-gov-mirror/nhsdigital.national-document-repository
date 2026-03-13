import { Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import DocumentSelectPagesStage from '../../components/blocks/_documentManagement/documentSelectPagesStage/DocumentSelectPagesStage';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { DocumentReference } from '../../types/pages/documentSearchResultsPage/types';
import { routeChildren, routes } from '../../types/generic/routes';
import { DocumentCorrectLocationState } from '../../types/pages/documentCorrect/types';
import { LocationParams } from '../../types/generic/location';
import { DOCUMENT_TYPE_CONFIG, getConfigForDocType } from '../../helpers/utils/documentType';
import { getLastURLPath } from '../../helpers/utils/urlManipulations';
import { AxiosError } from 'axios';
import { errorToParams } from '../../helpers/utils/errorToParams';
import DocumentRemovePagesConfirmStage from '../../components/blocks/_documentManagement/documentRemovePagesConfirmStage/DocumentRemovePagesConfirmStage';
import DocumentReassignSearchPatientStage from '../../components/blocks/_documentManagement/documentReassignSearchPatientStage/DocumentReassignSearchPatientStage';
import { PatientDetails } from '../../types/generic/patientDetails';
import DocumentReassignVerifyPatientDetailsStage from '../../components/blocks/_documentManagement/documentReassignVerifyPatientStage/DocumentReassignVerifyPatientStage';
import DocumentUploadingStage from '../../components/blocks/_documentManagement/documentUploadingStage/DocumentUploadingStage';
import { DOCUMENT_UPLOAD_STATE, UploadDocument } from '../../types/pages/UploadDocumentsPage/types';
import { v4 as uuid } from 'uuid';
import {
    getUploadSession,
    handleDocumentStatusUpdates,
    startIntervalTimer,
} from '../../helpers/utils/documentUpload';
import useBaseAPIHeaders from '../../helpers/hooks/useBaseAPIHeaders';
import useBaseAPIUrl from '../../helpers/hooks/useBaseAPIUrl';
import { UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS } from '../../helpers/constants/network';
import { isLocal } from '../../helpers/utils/isLocal';
import {
    markDocumentsAsUploading,
    uploadSingleDocument,
} from '../../helpers/utils/uploadDocumentHelpers';
import { extractPdfBlobUsingSelectedPages } from '../../helpers/utils/documentManagement/pageNumbers';
import { generateStitchedFileName } from '../../helpers/requests/uploadDocuments';
import usePatient from '../../helpers/hooks/usePatient';
import DocumentReassignCompleteStage from '../../components/blocks/_documentManagement/documentReassignCompleteStage/DocumentReassignCompleteStage';
import DocumentReassignDownloadStage from '../../components/blocks/_documentManagement/documentReassignDownloadStage/DocumentReassignDownloadStage';
import DocumentReassignDownloadCheckStage from '../../components/blocks/_documentManagement/documentReassignDownloadCheckStage/DocumentReassignDownloadCheckStage';

const DocumentCorrectPage = (): React.JSX.Element => {
    const location: LocationParams<DocumentCorrectLocationState> = useLocation();
    const currentPatient = usePatient();
    const [documentReference, setDocumentReference] = useState<DocumentReference | null>(null);
    const [documentConfig, setDocumentConfig] = useState<DOCUMENT_TYPE_CONFIG | null>(null);
    const [pagesToRemove, setPagesToRemove] = useState<number[][]>([]);
    const [baseDocumentBlob, setBaseDocumentBlob] = useState<Blob | null>(null);
    const [reassignedPagesBlob, setReassignedPagesBlob] = useState<Blob | null>(null);
    const [patientForReassign, setPatientForReassign] = useState<PatientDetails | null>(null);
    const [reviewDocuments, setReviewDocuments] = useState<UploadDocument[]>([]);
    const [updatedDocuments, setUpdatedDocuments] = useState<UploadDocument[]>([]);
    const [interval, setInterval] = useState(0);
    const [intervalTimer, setIntervalTimer] = useState(0);
    const virusReference = useRef(false);
    const completeRef = useRef(false);
    const uploadReviewInProgress = useRef(false);
    const uploadUpdatedDocInProgress = useRef(false);

    const getDocumentRef = useRef(false);
    const navigate = useNavigate();
    const baseUrl = useBaseAPIUrl();
    const baseHeaders = useBaseAPIHeaders();

    useEffect(() => {
        if (getDocumentRef.current) {
            return;
        }

        getDocumentRef.current = true;
        const docRef = location.state?.documentReference;
        if (!docRef) {
            navigate(routes.SERVER_ERROR);
            return;
        }

        setDocumentReference(docRef);
        setDocumentConfig(getConfigForDocType(docRef.documentSnomedCodeType));

        loadDocument(docRef);
    }, []);

    useEffect(() => {
        if (!virusReference.current && !completeRef.current) {
            if (uploadReviewInProgress.current) {
                handleDocumentStatusUpdates(
                    navigate,
                    intervalTimer,
                    interval,
                    reviewDocuments,
                    virusReference,
                    completeRef,
                    uploadReviewFinished,
                );
            }

            if (uploadUpdatedDocInProgress.current) {
                handleDocumentStatusUpdates(
                    navigate,
                    intervalTimer,
                    interval,
                    updatedDocuments,
                    virusReference,
                    completeRef,
                    () => navigate(routeChildren.DOCUMENT_REASSIGN_COMPLETE),
                );
            }
        }
    }, [
        navigate,
        intervalTimer,
        interval,
        reviewDocuments,
        updatedDocuments,
        virusReference,
        completeRef,
        uploadUpdatedDocInProgress,
        uploadReviewInProgress,
    ]);

    const loadDocument = async (docRef: DocumentReference): Promise<void> => {
        try {
            const response = await fetch(docRef.url!);
            const blob = await response.blob();
            setBaseDocumentBlob(blob);
        } catch (e) {
            const error = e as AxiosError;
            navigate(routes.SERVER_ERROR + errorToParams(error));
        }
    };

    const getUploadDocument = (
        blob: Blob,
        fileName: string,
        versionId?: string,
    ): UploadDocument => ({
        file: new File([blob], fileName, { type: 'application/pdf' }),
        state: DOCUMENT_UPLOAD_STATE.SELECTED,
        id: uuid(),
        docType: documentReference!.documentSnomedCodeType,
        versionId: versionId,
    });

    const onConfirmPatientDetails = (): void => {
        const documents = [getUploadDocument(reassignedPagesBlob!, 'reassigned_pages.pdf')];
        setReviewDocuments(documents);

        uploadReviewInProgress.current = true;
        navigate(routeChildren.DOCUMENT_REASSIGN_UPLOADING);
    };

    const startUpload = async (
        isForUpload: boolean,
        nhsNumber: string,
        documents: UploadDocument[],
        setDocuments: Dispatch<SetStateAction<UploadDocument[]>>,
        existingDocumentId?: string,
    ): Promise<void> => {
        try {
            const uploadSession = await getUploadSession(
                isForUpload,
                nhsNumber,
                baseUrl,
                baseHeaders,
                existingDocumentId,
                documents,
                setDocuments,
            );

            const uploadingDocuments = markDocumentsAsUploading(documents, uploadSession);
            setDocuments(uploadingDocuments);

            if (!isLocal) {
                void uploadSingleDocument(documents[0], uploadSession, setDocuments);
            }

            const updateStateInterval = startIntervalTimer(
                uploadingDocuments,
                setInterval,
                documents,
                setDocuments,
                isForUpload,
                nhsNumber,
                baseUrl,
                baseHeaders,
                UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS,
            );
            setIntervalTimer(updateStateInterval);
        } catch (e) {
            const error = e as AxiosError;
            navigate(routes.SERVER_ERROR + errorToParams(error));
        }
    };

    const uploadReviewFinished = async (): Promise<void> => {
        globalThis.clearInterval(intervalTimer);
        setInterval(0);
        setIntervalTimer(0);
        virusReference.current = false;
        completeRef.current = false;
        uploadReviewInProgress.current = false;
        uploadUpdatedDocInProgress.current = true;
        const updatedDocumentBlob = await extractPdfBlobUsingSelectedPages(
            baseDocumentBlob!,
            pagesToRemove,
            false,
        );
        const updatedDocuments = [
            getUploadDocument(
                updatedDocumentBlob,
                generateStitchedFileName(currentPatient, documentConfig!),
                documentReference!.version,
            ),
        ];
        setUpdatedDocuments(updatedDocuments);

        await startUpload(
            true,
            currentPatient!.nhsNumber,
            updatedDocuments,
            setUpdatedDocuments,
            documentReference!.id,
        );
    };

    if (!documentReference || !documentConfig || !baseDocumentBlob) {
        return <></>;
    }

    return (
        <>
            <Routes>
                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_REASSIGN_SELECT_PAGES) + '/*'}
                    element={
                        <DocumentSelectPagesStage
                            baseDocumentBlob={baseDocumentBlob}
                            documentConfig={documentConfig}
                            pagesToRemove={pagesToRemove}
                            setPagesToRemove={setPagesToRemove}
                        />
                    }
                />

                <Route
                    path={
                        getLastURLPath(routeChildren.DOCUMENT_REASSIGN_CONFIRM_REMOVED_PAGES) + '/*'
                    }
                    element={
                        <DocumentRemovePagesConfirmStage
                            documentReference={documentReference}
                            baseDocumentBlob={baseDocumentBlob}
                            pagesToRemove={pagesToRemove}
                            reassignedPagesBlob={reassignedPagesBlob}
                            setReassignedPagesBlob={setReassignedPagesBlob}
                        />
                    }
                />

                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_REASSIGN_SEARCH_PATIENT) + '/*'}
                    element={
                        <DocumentReassignSearchPatientStage
                            reassignedPagesBlob={reassignedPagesBlob!}
                            setPatientForReassign={setPatientForReassign}
                        />
                    }
                />

                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_REASSIGN_DOWNLOAD_PAGES) + '/*'}
                    element={
                        <DocumentReassignDownloadStage reassignedPagesBlob={reassignedPagesBlob!} />
                    }
                />

                <Route
                    path={
                        getLastURLPath(routeChildren.DOCUMENT_REASSIGN_DOWNLOAD_PAGES_CHECK) + '/*'
                    }
                    element={
                        <DocumentReassignDownloadCheckStage removePages={uploadReviewFinished} />
                    }
                />

                <Route
                    path={
                        getLastURLPath(routeChildren.DOCUMENT_REASSIGN_VERIFY_PATIENT_DETAILS) +
                        '/*'
                    }
                    element={
                        <DocumentReassignVerifyPatientDetailsStage
                            patientDetails={patientForReassign}
                            onConfirmPatientDetails={onConfirmPatientDetails}
                        />
                    }
                />

                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_REASSIGN_UPLOADING) + '/*'}
                    element={
                        <DocumentUploadingStage
                            documents={reviewDocuments}
                            startUpload={async (): Promise<void> => {
                                if (uploadReviewInProgress.current) {
                                    void startUpload(
                                        false,
                                        patientForReassign!.nhsNumber,
                                        reviewDocuments,
                                        setReviewDocuments,
                                    );
                                }
                            }}
                            title="Your documents are uploading"
                            warningBoxText={
                                'Do not close or navigate away from this page until the upload is complete.'
                            }
                        />
                    }
                />

                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_REASSIGN_COMPLETE) + '/*'}
                    element={
                        <DocumentReassignCompleteStage
                            matched={!!patientForReassign}
                            docConfig={documentConfig}
                        />
                    }
                />
            </Routes>

            <Outlet />
        </>
    );
};

export default DocumentCorrectPage;
