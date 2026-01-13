import { AxiosError } from 'axios';
import { JSX, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
    MAX_POLLING_TIME,
    UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS,
} from '../../../../helpers/constants/network';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import usePatient from '../../../../helpers/hooks/usePatient';
import uploadDocuments, {
    generateStitchedFileName,
    getDocumentStatus,
    uploadDocumentToS3,
} from '../../../../helpers/requests/uploadDocuments';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../../../helpers/utils/documentType';
import { errorCodeToParams, errorToParams } from '../../../../helpers/utils/errorToParams';
import { isLocal, isMock } from '../../../../helpers/utils/isLocal';
import { mergePdfsFromUploadDocuments } from '../../../../helpers/utils/mergePdfs';
import {
    markDocumentsAsUploading,
    setSingleDocument,
} from '../../../../helpers/utils/uploadDocumentHelpers';
import { useEnhancedNavigate } from '../../../../helpers/utils/urlManipulations';
import { ReviewDetails } from '../../../../types/generic/reviews';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { DocumentStatusResult, UploadSession } from '../../../../types/generic/uploadResult';
import {
    DOCUMENT_STATUS,
    DOCUMENT_UPLOAD_STATE,
    ReviewUploadDocument,
    UploadDocument,
    UploadDocumentType,
} from '../../../../types/pages/UploadDocumentsPage/types';
import Spinner from '../../../generic/spinner/Spinner';
import DocumentUploadingStage from '../../_documentUpload/documentUploadingStage/DocumentUploadingStage';

type Props = {
    reviewData: ReviewDetails | null;
    documents: ReviewUploadDocument[];
    setDocuments: React.Dispatch<React.SetStateAction<UploadDocument[]>>;
    existingId: string | undefined;
};

const ReviewDetailsDocumentUploadingStage = ({
    reviewData,
    documents,
    setDocuments,
    existingId,
}: Props): JSX.Element => {
    const patientDetails = usePatient();
    const nhsNumber: string = patientDetails?.nhsNumber ?? '';
    const [intervalTimer, setIntervalTimer] = useState(0);
    const baseUrl = useBaseAPIUrl();
    const baseHeaders = useBaseAPIHeaders();
    const navigate = useEnhancedNavigate();
    const completeRef = useRef(false);
    const virusReference = useRef(false);
    const interval = useRef<number>(0);

    const [hasNormalisedOnEntry, setHasNormalisedOnEntry] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const hasNormalisedOnEntryRef = useRef(false);
    useEffect(() => {
        if (hasNormalisedOnEntryRef.current) {
            return;
        }
        hasNormalisedOnEntryRef.current = true;

        setDocuments((prev) => {
            const needsUpdate = prev.some((d) => d.state !== DOCUMENT_UPLOAD_STATE.SELECTED);
            if (!needsUpdate) {
                return prev;
            }
            return prev.map((d) => ({
                ...d,
                state: DOCUMENT_UPLOAD_STATE.SELECTED,
            }));
        });

        setHasNormalisedOnEntry(true);
    }, [setDocuments]);

    useEffect(() => {
        setIsLoading(true);
        const prepareFiles = async (): Promise<void> => {
            try {
                const stitched = getConfigForDocType(reviewData?.snomedCode!).stitched;
                if (stitched) {
                    const existing = documents.find((f) => f.type === UploadDocumentType.EXISTING);
                    if (!existing) {
                        return;
                    }
                    const filename = generateStitchedFileName(
                        patientDetails,
                        getConfigForDocType(reviewData?.snomedCode!),
                    );
                    const fileBlob = await mergePdfsFromUploadDocuments(
                        documents,
                        (): void => {},
                        (): void => {},
                    );
                    const lgDocument: ReviewUploadDocument = {
                        id: uuidv4(),
                        file: new File([fileBlob!], filename, { type: 'application/pdf' }),
                        state: DOCUMENT_UPLOAD_STATE.SELECTED,
                        progress: 0,
                        docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                        attempts: 0,
                        type: UploadDocumentType.REVIEW,
                        blob: fileBlob,
                        versionId: existing.versionId,
                    };
                    setDocuments([lgDocument]);
                    documents = [lgDocument];
                }
            } finally {
                setIsLoading(false);
            }
        };
        prepareFiles();
    }, []);

    useEffect(() => {
        if (interval.current * UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS > MAX_POLLING_TIME) {
            globalThis.clearInterval(intervalTimer);
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
            globalThis.clearInterval(intervalTimer);
            navigate(routeChildren.DOCUMENT_UPLOAD_INFECTED);
        } else if (docWithError) {
            const errorParams = docWithError.error ? errorCodeToParams(docWithError.error) : '';
            navigate(routes.SERVER_ERROR + errorParams);
        } else if (allFinished && !completeRef.current) {
            completeRef.current = true;
            globalThis.clearInterval(intervalTimer);
            navigate.withParams(
                routeChildren.ADMIN_REVIEW_COMPLETE.replace(
                    ':reviewId',
                    `${reviewData!.id}.${reviewData!.version}`,
                ),
            );
        }
    }, [baseHeaders, baseUrl, documents, navigate, nhsNumber, setDocuments, intervalTimer]);

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
            globalThis.clearInterval(intervalTimer);
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

    const startUpload = async (): Promise<void> => {
        try {
            setIsLoading(false);
            const uploadSession: UploadSession = isLocal
                ? getMockUploadSession(documents)
                : await uploadDocuments({
                      nhsNumber,
                      documents: documents,
                      baseUrl,
                      baseHeaders,
                      documentReferenceId: existingId,
                  });
            const uploadingDocuments = markDocumentsAsUploading(documents, uploadSession);
            setDocuments(uploadingDocuments);

            if (!isLocal) {
                uploadAllDocuments(uploadingDocuments, uploadSession);
            }

            const updateStateInterval = startIntervalTimer(uploadingDocuments);
            setIntervalTimer(updateStateInterval);
        } catch (e) {
            setIsLoading(false);
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
                globalThis.clearInterval(intervalTimer);
                navigate.withParams(
                    routeChildren.ADMIN_REVIEW_COMPLETE.replace(
                        ':reviewId',
                        `${reviewData!.id}.${reviewData!.version}`,
                    ),
                );
            } else {
                navigate(routes.SERVER_ERROR + errorToParams(error));
            }
        }
    };

    const startIntervalTimer = (uploadDocuments: Array<UploadDocument>): number => {
        const startIntervalTimerIsLocal = (): void => {
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
                    if (hasVirusFile.length > 0) {
                        doc.state = DOCUMENT_UPLOAD_STATE.INFECTED;
                    } else if (hasFailedFile.length > 0) {
                        doc.state = DOCUMENT_UPLOAD_STATE.FAILED;
                    } else {
                        doc.state = DOCUMENT_UPLOAD_STATE.SUCCEEDED;
                    }
                }

                return doc;
            });
            setDocuments(updatedDocuments);
        };

        return window.setInterval(async () => {
            interval.current = interval.current + 1;
            if (isLocal) {
                startIntervalTimerIsLocal();
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

    const getMockUploadSession = (documents: ReviewUploadDocument[]): UploadSession => {
        const session: UploadSession = {};
        documents.forEach((doc) => {
            session[doc.id] = {
                url: 'https://example.com/',
            } as any;
        });

        return session;
    };

    if (!hasNormalisedOnEntry) {
        return <Spinner status={'Loading'} />;
    }

    return (
        <>
            {isLoading && <Spinner status={'Preparing documents'} />}
            {!isLoading && (
                <DocumentUploadingStage
                    documents={documents}
                    startUpload={startUpload}
                    documentConfig={getConfigForDocType(reviewData?.snomedCode!)}
                />
            )}
        </>
    );
};

export default ReviewDetailsDocumentUploadingStage;
