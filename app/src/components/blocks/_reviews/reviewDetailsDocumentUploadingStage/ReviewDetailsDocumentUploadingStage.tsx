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
import {
    generateStitchedFileName,
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
import { UploadSession } from '../../../../types/generic/uploadResult';
import {
    DOCUMENT_UPLOAD_STATE,
    ReviewUploadDocument,
    UploadDocument,
    UploadDocumentType,
} from '../../../../types/pages/UploadDocumentsPage/types';
import Spinner from '../../../generic/spinner/Spinner';
import { getUploadSession, startIntervalTimer } from '../../../../helpers/utils/documentUpload';
import DocumentUploadingStage from '../../_documentManagement/documentUploadingStage/DocumentUploadingStage';
import getReviewNavigationFormat from '../../../../helpers/getReviewNavigationFormat';

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
    const baseUrl = useBaseAPIUrl();
    const baseHeaders = useBaseAPIHeaders();
    const navigate = useEnhancedNavigate();
    const completeRef = useRef(false);
    const virusReference = useRef(false);
    const [interval, setInterval] = useState<number>(0);
    const [intervalTimer, setIntervalTimer] = useState<number>(0);
    const documentsRef = useRef<UploadDocument[]>(documents);

    const [hasNormalisedOnEntry, setHasNormalisedOnEntry] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const hasNormalisedOnEntryRef = useRef(false);
    const preparingDocsRef = useRef(false);

    const clearIntervalTimer = (): void => {
        if (intervalTimer) {
            globalThis.clearInterval(intervalTimer);
        }
    };

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
        const prepareFiles = async (): Promise<void> => {
            setIsLoading(true);
            try {
                if (!reviewData) {
                    return;
                }
                const config = getConfigForDocType(reviewData.snomedCode!);
                if (config.stitched) {
                    const existing = documents.find((f) => f.type === UploadDocumentType.EXISTING);
                    const filename = generateStitchedFileName(
                        patientDetails,
                        getConfigForDocType(reviewData.snomedCode!),
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
                        versionId: existing?.versionId,
                    };
                    setDocuments([lgDocument]);
                    documents = [lgDocument];
                }
                if (config.multifileZipped) {
                    const zipDocument = documents.find((d) =>
                        d.file.name.toLowerCase().endsWith('.zip'),
                    );
                    if (zipDocument === undefined) {
                        // eslint-disable-next-line no-console
                        console.error('Multifile zipped upload required but no zip file found');
                    }
                }
            } finally {
                setIsLoading(false);
            }
        };

        if (!preparingDocsRef.current) {
            preparingDocsRef.current = true;
            prepareFiles();
        }
    }, []);

    useEffect(() => {
        documentsRef.current = documents;
    }, [documents]);

    useEffect(() => {
        if (interval * UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS > MAX_POLLING_TIME) {
            clearIntervalTimer();
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
            clearIntervalTimer();
            navigate(routeChildren.DOCUMENT_UPLOAD_INFECTED);
        } else if (docWithError) {
            const errorParams = docWithError.error ? errorCodeToParams(docWithError.error) : '';
            navigate(routes.SERVER_ERROR + errorParams);
        } else if (allFinished && !completeRef.current) {
            completeRef.current = true;
            clearIntervalTimer();
            navigate.withParams(
                routeChildren.REVIEW_COMPLETE.replace(
                    ':reviewId',
                    getReviewNavigationFormat(reviewData!.id, reviewData!.version),
                ),
            );
        }
    }, [baseHeaders, baseUrl, documents, navigate, nhsNumber, setDocuments, interval]);

    useEffect(() => {
        return (): void => {
            globalThis.clearInterval(intervalTimer);
        };
    }, [intervalTimer]);

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
            markDocumentAsFailed(document);

            const error = e as AxiosError;
            if (error.response?.status === 403) {
                navigate(routes.SESSION_EXPIRED);
                return;
            }

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
            void uploadSingleDocument(document, uploadSession);
        });
    };

    const startUpload = async (): Promise<void> => {
        try {
            const uploadSession: UploadSession = await getUploadSession(
                patientDetails!,
                baseUrl,
                baseHeaders,
                existingId,
                documents,
                setDocuments,
            );

            const uploadingDocuments = markDocumentsAsUploading(documents, uploadSession);
            setDocuments(uploadingDocuments);
            setIsLoading(false);

            if (!isLocal) {
                uploadAllDocuments(uploadingDocuments, uploadSession);
            }

            const updateStateInterval = startIntervalTimer(
                uploadingDocuments,
                setInterval,
                documents,
                setDocuments,
                patientDetails!,
                baseUrl,
                baseHeaders,
                UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS,
            );
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
                clearIntervalTimer();
                navigate.withParams(
                    routeChildren.REVIEW_COMPLETE.replace(
                        ':reviewId',
                        getReviewNavigationFormat(reviewData!.id, reviewData!.version),
                    ),
                );
            } else {
                navigate(routes.SERVER_ERROR + errorToParams(error));
            }
        }
    };

    if (!hasNormalisedOnEntry) {
        return <Spinner status={'Loading'} />;
    }

    return (
        <>
            {isLoading && <Spinner status={'Preparing documents'} />}
            {!isLoading && reviewData && (
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
