import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { SearchResult } from '../../types/generic/searchResult';
import DocumentSearchResults from '../../components/blocks/_patientDocuments/documentSearchResults/DocumentSearchResults';
import { Link, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { routeChildren, routes } from '../../types/generic/routes';
import {
    DocumentReference,
    SUBMISSION_STATE,
} from '../../types/pages/documentSearchResultsPage/types';
import ServiceError from '../../components/layout/serviceErrorBox/ServiceErrorBox';
import DocumentSearchResultsOptions from '../../components/blocks/_patientDocuments/documentSearchResultsOptions/DocumentSearchResultsOptions';
import axios, { AxiosError } from 'axios';
import getDocumentSearchResults from '../../helpers/requests/getDocumentSearchResults';
import useBaseAPIHeaders from '../../helpers/hooks/useBaseAPIHeaders';
import usePatient from '../../helpers/hooks/usePatient';
import useBaseAPIUrl from '../../helpers/hooks/useBaseAPIUrl';
import ErrorBox from '../../components/layout/errorBox/ErrorBox';
import { errorToParams } from '../../helpers/utils/errorToParams';
import useTitle from '../../helpers/hooks/useTitle';
import { getLastURLPath, useEnhancedNavigate } from '../../helpers/utils/urlManipulations';
import PatientSummary, {
    PatientInfo,
} from '../../components/generic/patientSummary/PatientSummary';
import { isMock } from '../../helpers/utils/isLocal';
import useConfig from '../../helpers/hooks/useConfig';
import { buildSearchResult } from '../../helpers/test/testBuilders';
import { useSessionContext } from '../../providers/sessionProvider/SessionProvider';
import { REPOSITORY_ROLE } from '../../types/generic/authRole';
import DocumentView from '../../components/blocks/_patientDocuments/documentView/DocumentView';
import getDocument, { GetDocumentResponse } from '../../helpers/requests/getDocument';
import { DOCUMENT_TYPE } from '../../helpers/utils/documentType';
import BackButton from '../../components/generic/backButton/BackButton';
import ProgressBar from '../../components/generic/progressBar/ProgressBar';
import DeleteSubmitStage from '../../components/blocks/_delete/deleteSubmitStage/DeleteSubmitStage';
import { Button, WarningCallout } from 'nhsuk-react-components';
import getReviews from '../../helpers/requests/getReviews';

const DocumentSearchResultsPage = (): React.JSX.Element => {
    const patientDetails = usePatient();

    const nhsNumber: string = patientDetails?.nhsNumber ?? '';
    const [searchResults, setSearchResults] = useState<Array<SearchResult>>([]);
    const [submissionState, setSubmissionState] = useState(SUBMISSION_STATE.INITIAL);
    const [downloadState, setDownloadState] = useState(SUBMISSION_STATE.INITIAL);
    const [documentReference, setDocumentReference] = useState<DocumentReference | null>(null);
    const navigate = useNavigate();
    const baseUrl = useBaseAPIUrl();
    const baseHeaders = useBaseAPIHeaders();
    const config = useConfig();
    const mounted = useRef(false);
    const activeSearchResult = useRef<SearchResult | null>(null);
    const hasReviews = useRef(false);

    useEffect(() => {
        const onPageLoad = async (): Promise<void> => {
            setSubmissionState(SUBMISSION_STATE.PENDING);

            try {
                const results = await getDocumentSearchResults({
                    nhsNumber,
                    baseUrl,
                    baseHeaders,
                });

                if (config.featureFlags.uploadDocumentIteration3Enabled) {
                    const { count } = await getReviews(baseUrl, baseHeaders, nhsNumber, '', 1);
                    hasReviews.current = count > 0;
                }

                setSearchResults(results ?? []);
                setSubmissionState(SUBMISSION_STATE.SUCCEEDED);
            } catch (e) {
                const error = e as AxiosError;
                if (isMock(error)) {
                    if (config.mockLocal.recordUploaded) {
                        setSearchResults([
                            buildSearchResult({
                                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                                fileName: 'Scanned paper notes.pdf',
                            }),
                            buildSearchResult({
                                documentSnomedCodeType: DOCUMENT_TYPE.EHR,
                                fileName: 'Electronic health record.pdf',
                            }),
                            buildSearchResult({
                                documentSnomedCodeType: DOCUMENT_TYPE.EHR_ATTACHMENTS,
                                fileName: 'EHR Attachments.zip',
                                contentType: 'application/zip',
                            }),
                            buildSearchResult({
                                documentSnomedCodeType: DOCUMENT_TYPE.LETTERS_AND_DOCS,
                                fileName: 'Later letter.pdf',
                                contentType: 'application/pdf',
                            }),
                            buildSearchResult({
                                documentSnomedCodeType: DOCUMENT_TYPE.LETTERS_AND_DOCS,
                                fileName: 'Later letter 2.docx',
                                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            }),
                        ]);
                        setSubmissionState(SUBMISSION_STATE.SUCCEEDED);
                    } else {
                        setSearchResults([]);
                        setSubmissionState(SUBMISSION_STATE.SUCCEEDED);
                    }
                } else if (error.response?.status === 403) {
                    navigate(routes.SESSION_EXPIRED);
                } else if (error.response?.status && error.response?.status >= 500) {
                    navigate(routes.SERVER_ERROR + errorToParams(error));
                } else {
                    setSubmissionState(SUBMISSION_STATE.FAILED);
                }
            }
        };
        if (!mounted.current) {
            mounted.current = true;
            void onPageLoad();
        }
    }, [nhsNumber, navigate, baseUrl, baseHeaders, config]);

    const onViewDocument = (documentItem: SearchResult): void => {
        activeSearchResult.current = documentItem;
        setDocumentReference({
            isPdf: documentItem.contentType === 'application/pdf',
            ...documentItem,
        });
        navigate(routeChildren.DOCUMENT_VIEW);

        void loadDocument(documentItem.id);
    };

    const loadDocument = async (documentId: string): Promise<void> => {
        try {
            const documentResponse = await getDocument({
                nhsNumber: patientDetails!.nhsNumber,
                baseUrl,
                baseHeaders,
                documentId,
            });

            await handleViewDocSuccess(documentResponse);
        } catch (e) {
            const error = e as AxiosError;
            if (isMock(error)) {
                await handleViewDocSuccess({
                    url: '/dev/testFile.pdf',
                    contentType: activeSearchResult.current?.contentType || 'application/pdf',
                });
            } else if (error.response?.status === 403) {
                navigate(routes.SESSION_EXPIRED);
            } else if (error.response?.status === 404) {
                await handleViewDocSuccess({
                    url: '',
                    contentType: '',
                });
            } else {
                navigate(routes.SERVER_ERROR + errorToParams(error));
            }
        }
    };

    const handleViewDocSuccess = async (documentResponse: GetDocumentResponse): Promise<void> => {
        setDocumentReference({
            url: documentResponse.url ? await getObjectUrl(documentResponse.url) : null,
            isPdf: documentResponse.contentType === 'application/pdf',
            ...activeSearchResult.current,
        } as DocumentReference);
    };

    const getObjectUrl = async (cloudFrontUrl: string): Promise<string> => {
        const { data } = await axios.get(cloudFrontUrl, {
            responseType: 'blob',
        });

        return URL.createObjectURL(data);
    };

    const removeDocument = (): void => {
        navigate(routeChildren.DOCUMENT_DELETE);
    };

    return (
        <>
            <div>
                <Routes>
                    <Route
                        index
                        element={
                            <DocumentSearchResultsPageIndex
                                submissionState={submissionState}
                                nhsNumber={nhsNumber}
                                downloadState={downloadState}
                                setDownloadState={setDownloadState}
                                searchResults={searchResults}
                                onViewDocument={onViewDocument}
                                hasReviews={hasReviews.current}
                            />
                        }
                    />
                    <Route
                        path={getLastURLPath(routeChildren.DOCUMENT_VIEW) + '/*'}
                        element={
                            <DocumentView
                                documentReference={documentReference}
                                removeDocument={removeDocument}
                            />
                        }
                    />
                    <Route
                        path={getLastURLPath(routeChildren.DOCUMENT_DELETE) + '/*'}
                        element={
                            <DeleteSubmitStage
                                document={documentReference ?? undefined}
                                docType={documentReference ? undefined : DOCUMENT_TYPE.ALL}
                                resetDocState={(): void => {
                                    mounted.current = false;
                                }}
                            />
                        }
                    />
                </Routes>

                <Outlet />
            </div>
        </>
    );
};

type SearchResultsProps = {
    submissionState: SUBMISSION_STATE;
    searchResults: SearchResult[];
    nhsNumber: string;
    onViewDocument: (document: SearchResult) => void;
    downloadState: SUBMISSION_STATE;
    setDownloadState: Dispatch<SetStateAction<SUBMISSION_STATE>>;
    role?: REPOSITORY_ROLE;
};
const SearchResults = ({
    submissionState,
    searchResults,
    nhsNumber,
    onViewDocument,
    downloadState,
    setDownloadState,
    role,
}: SearchResultsProps): React.JSX.Element => {
    if (
        submissionState === SUBMISSION_STATE.INITIAL ||
        submissionState === SUBMISSION_STATE.PENDING
    ) {
        return <ProgressBar status="Loading..." className="loading-bar" />;
    }

    if (searchResults.length && nhsNumber) {
        return (
            <>
                <DocumentSearchResults
                    searchResults={searchResults}
                    onViewDocument={onViewDocument}
                />

                {role === REPOSITORY_ROLE.PCSE && (
                    <DocumentSearchResultsOptions
                        nhsNumber={nhsNumber}
                        downloadState={downloadState}
                        updateDownloadState={setDownloadState}
                    />
                )}
            </>
        );
    }

    return (
        <p>
            <strong id="no-files-message">
                There are no documents available for this patient.
            </strong>
        </p>
    );
};

type PageIndexArgs = {
    submissionState: SUBMISSION_STATE;
    downloadState: SUBMISSION_STATE;
    setDownloadState: Dispatch<SetStateAction<SUBMISSION_STATE>>;
    searchResults: SearchResult[];
    nhsNumber: string;
    onViewDocument: (document: SearchResult) => void;
    hasReviews: boolean;
};
const DocumentSearchResultsPageIndex = ({
    submissionState,
    downloadState,
    searchResults,
    nhsNumber,
    setDownloadState,
    onViewDocument,
    hasReviews,
}: PageIndexArgs): React.JSX.Element => {
    const [session] = useSessionContext();
    const patientDetails = usePatient();
    const navigate = useEnhancedNavigate();
    const config = useConfig();

    const role = session.auth?.role;

    const canViewFiles =
        session.auth?.role === REPOSITORY_ROLE.GP_ADMIN ||
        session.auth?.role === REPOSITORY_ROLE.GP_CLINICAL;

    const pageHeader = canViewFiles ? 'Lloyd George records' : 'Manage Lloyd George records';
    useTitle({ pageTitle: pageHeader });

    if (!session.auth) {
        navigate(routes.UNAUTHORISED);
        return <></>;
    }

    const uploadClicked = (): void => {
        navigate(routes.DOCUMENT_UPLOAD);
    };

    const canUpload =
        config.featureFlags.uploadDocumentIteration3Enabled &&
        !patientDetails?.deceased &&
        (role === REPOSITORY_ROLE.GP_ADMIN || role === REPOSITORY_ROLE.GP_CLINICAL) &&
        submissionState !== SUBMISSION_STATE.INITIAL &&
        submissionState !== SUBMISSION_STATE.PENDING;

    return (
        <>
            <BackButton
                dataTestid="go-back-button"
                toLocation={
                    patientDetails?.deceased && role !== REPOSITORY_ROLE.PCSE
                        ? routeChildren.PATIENT_ACCESS_AUDIT_DECEASED
                        : routes.VERIFY_PATIENT
                }
                backLinkText="Go back"
            />

            <h1 id="records-page-title" data-testid="page-title">
                {pageHeader}
            </h1>

            {(submissionState === SUBMISSION_STATE.FAILED ||
                downloadState === SUBMISSION_STATE.FAILED) && <ServiceError />}

            <PatientSummary showDeceasedTag>
                <PatientSummary.Child item={PatientInfo.FULL_NAME} />
                <PatientSummary.Child item={PatientInfo.NHS_NUMBER} />
                <PatientSummary.Child item={PatientInfo.BIRTH_DATE} />
            </PatientSummary>

            {hasReviews && config.featureFlags.uploadDocumentIteration3Enabled && (
                <WarningCallout data-testid="review-notification">
                    <WarningCallout.Label>Important</WarningCallout.Label>
                    <p>
                        This patient has documents waiting to be reviewed. Go to{' '}
                        <Link
                            data-testid="review-link"
                            to={routeChildren.ADMIN_REVIEW}
                            aria-label="Link to Review search page"
                        >
                            documents to review
                        </Link>{' '}
                        to view and accept them into this patient's record.
                    </p>
                </WarningCallout>
            )}

            {canUpload && (
                <Button
                    type="button"
                    id="upload-button"
                    data-testid="upload-button"
                    onClick={uploadClicked}
                >
                    Upload documents for this patient
                </Button>
            )}

            <SearchResults
                submissionState={submissionState}
                searchResults={searchResults}
                nhsNumber={nhsNumber}
                onViewDocument={onViewDocument}
                downloadState={downloadState}
                setDownloadState={setDownloadState}
                role={role}
            />

            {downloadState === SUBMISSION_STATE.FAILED && (
                <ErrorBox
                    messageTitle={'There is a problem with the documents'}
                    messageBody={'An error has occurred while preparing your download'}
                    errorBoxSummaryId={'error-box-summary'}
                />
            )}
        </>
    );
};

export default DocumentSearchResultsPage;
