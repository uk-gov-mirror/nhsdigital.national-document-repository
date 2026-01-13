import { Button, ErrorSummary, Fieldset, Radios } from 'nhsuk-react-components';
import { Dispatch, JSX, SetStateAction, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import useConfig from '../../../../helpers/hooks/useConfig';
import useRole from '../../../../helpers/hooks/useRole';
import useTitle from '../../../../helpers/hooks/useTitle';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../../../helpers/utils/documentType';
import { getFormattedDateFromString } from '../../../../helpers/utils/formatDate';
import { setFullScreen } from '../../../../helpers/utils/fullscreen';
import { handleSearch as handlePatientSearch } from '../../../../helpers/utils/handlePatientSearch';
import { usePatientDetailsContext } from '../../../../providers/patientProvider/PatientProvider';
import { useSessionContext } from '../../../../providers/sessionProvider/SessionProvider';
import {
    getRecordActionLinksAllowedForRole,
    getUserRecordActionLinks,
    LGRecordActionLink,
} from '../../../../types/blocks/lloydGeorgeActions';
import { DOWNLOAD_STAGE } from '../../../../types/generic/downloadStage';
import { ReviewDetails } from '../../../../types/generic/reviews';
import { navigateUrlParam, routeChildren } from '../../../../types/generic/routes';
import {
    ReviewUploadDocument,
    UploadDocumentType,
} from '../../../../types/pages/UploadDocumentsPage/types';
import BackButton from '../../../generic/backButton/BackButton';
import PatientSummary, { PatientInfo } from '../../../generic/patientSummary/PatientSummary';
import { RecordLayout } from '../../../generic/recordCard/RecordCard';
import { RecordLoader, RecordLoaderProps } from '../../../generic/recordLoader/RecordLoader';
import Spinner from '../../../generic/spinner/Spinner';
import DocumentUploadLloydGeorgePreview from '../../_documentUpload/documentUploadLloydGeorgePreview/DocumentUploadLloydGeorgePreview';

export type ReviewsDetailsStageProps = {
    setReviewData?: Dispatch<SetStateAction<ReviewDetails | null>>;
    reviewData: ReviewDetails;
    loadReviewData: () => Promise<void>;
    setDownloadStage: Dispatch<SetStateAction<DOWNLOAD_STAGE>>;
    downloadStage: DOWNLOAD_STAGE;
    uploadDocuments: ReviewUploadDocument[];
};

type YesNoOption = 'yes' | 'no' | '';

const ReviewsDetailsStage = ({
    reviewData,
    setReviewData,
    loadReviewData,
    setDownloadStage,
    downloadStage,
    uploadDocuments,
}: ReviewsDetailsStageProps): JSX.Element => {
    useTitle({ pageTitle: 'Admin - Review Details' });
    const { reviewId } = useParams<{ reviewId: string }>();
    const [isLoadingPatientDetails, setisLoadingPatientDetails] = useState(true);

    const [patientDetails, setPatientDetails] = usePatientDetailsContext();
    const [session] = useSessionContext();
    const [acceptDocument, setAcceptDocument] = useState<YesNoOption>('');
    const [showError, setShowError] = useState(false);
    const errorSummaryRef = useRef<HTMLDivElement>(null);
    const isFetchingReviewDetailsRef = useRef(false);

    const baseUrl = useBaseAPIUrl();
    const baseHeaders = useBaseAPIHeaders();
    const config = useConfig();
    const reviewConfig = getConfigForDocType(reviewData.snomedCode);
    const navigate = useNavigate();
    const role = useRole();

    const hasRecordInStorage = downloadStage === DOWNLOAD_STAGE.SUCCEEDED;
    const helpandGuidanceLink =
        'https://digital.nhs.uk/services/access-and-store-digital-patient-documents/help-and-guidance';

    let actionLinks: LGRecordActionLink[] =
        reviewData.snomedCode === DOCUMENT_TYPE.LLOYD_GEORGE
            ? getUserRecordActionLinks({ role, hasRecordInStorage })
            : [];

    let recordLinksToShow = getRecordActionLinksAllowedForRole({
        role,
        hasRecordInStorage,
        inputLinks: actionLinks,
    }).map((link) => {
        link.onClick = (): void => {
            setFullScreen();
        };

        return link;
    });

    const recordDetailsProps: RecordLoaderProps = {
        downloadStage,
        lastUpdated: getFormattedDateFromString(reviewData.lastUpdated),
        childrenIfFailiure: <p>Failure: failed to load documents</p>,
    };

    const onYesSelectionSuccess = (): void => {
        if (!reviewId) {
            return;
        }

        if (reviewConfig.canBeDiscarded === false && reviewConfig.canBeUpdated === false) {
            navigateUrlParam(routeChildren.ADMIN_REVIEW_UPLOAD, { reviewId }, navigate);
            return;
        }

        navigateUrlParam(routeChildren.ADMIN_REVIEW_ASSESS_FILES, { reviewId }, navigate);
    };

    useEffect(() => {
        setisLoadingPatientDetails(true);
        setDownloadStage(DOWNLOAD_STAGE.INITIAL);
        setAcceptDocument('');
        setShowError(false);

        if (!setPatientDetails || !reviewData) {
            setisLoadingPatientDetails(false);
            return;
        }
        const getPatientDetails = async (): Promise<void> => {
            if (!isFetchingReviewDetailsRef.current) {
                isFetchingReviewDetailsRef.current = true;

                await handlePatientSearch({
                    nhsNumber: reviewData.nhsNumber,
                    setSearchingState: () => {},
                    handleSuccess: (patientDetails) => {
                        setPatientDetails(patientDetails);
                    },
                    baseUrl,
                    baseHeaders,
                    userIsGPAdmin: role === 'GP_ADMIN',
                    userIsGPClinical: role === 'GP_CLINICAL',
                    mockLocal: config.mockLocal,
                    featureFlags: config.featureFlags,
                });
                setisLoadingPatientDetails(false);
            }
        };
        getPatientDetails();
    }, [reviewId]);

    useEffect(() => {
        const loadData = async (): Promise<void> => {
            let retryCount = 0;
            const maxRetries = 3;
            const retryDelayMs = 100;

            while (retryCount < maxRetries) {
                try {
                    await loadReviewData();
                    break;
                } catch {
                    retryCount += 1;
                    if (retryCount < maxRetries) {
                        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
                    }
                }
            }
        };
        loadData();
    }, [patientDetails, setPatientDetails]);

    const backButton = <BackButton backLinkText="Go back" dataTestid="back-button" />;

    if (isLoadingPatientDetails || !patientDetails) {
        return (
            <>
                {backButton}
                <Spinner status="Loading patient details..." />
            </>
        );
    }
    if (downloadStage === DOWNLOAD_STAGE.PENDING) {
        return (
            <>
                {backButton}
                <Spinner status="Loading review details..." />
            </>
        );
    }
    const menuClass = '--menu';
    if (!reviewData) {
        navigate(routeChildren.ADMIN_REVIEW);
        return <></>;
    }

    return (
        <>
            {backButton}

            {showError && (
                <ErrorSummary
                    ref={errorSummaryRef}
                    aria-labelledby="error-summary-title"
                    role="alert"
                    tabIndex={-1}
                >
                    <ErrorSummary.Title id="error-summary-title">
                        There is a problem
                    </ErrorSummary.Title>
                    <ErrorSummary.Body>
                        <ErrorSummary.List>
                            <ErrorSummary.Item href="#accept-document">
                                You need to select an option
                            </ErrorSummary.Item>
                        </ErrorSummary.List>
                    </ErrorSummary.Body>
                </ErrorSummary>
            )}

            <h1>Check this document is for the correct patient</h1>

            <p>Check the patient details in this document match these patient demographics:</p>

            <div className="nhsuk-inset-text">
                <PatientSummary>
                    <PatientSummary.Child item={PatientInfo.FULL_NAME} />
                    <PatientSummary.Child item={PatientInfo.NHS_NUMBER} />
                    <PatientSummary.Child item={PatientInfo.BIRTH_DATE} />
                </PatientSummary>
            </div>

            <div className="lloydgeorge_record-stage_flex">
                <div
                    className={`lloydgeorge_record-stage_flex-row lloydgeorge_record-stage_flex-row${menuClass}`}
                >
                    {uploadDocuments?.length === 0 && (
                        <p>{`No documents to preview, ${uploadDocuments.length}`}</p>
                    )}
                    <RecordLayout
                        heading={reviewConfig.displayName}
                        fullScreenHandler={setFullScreen}
                        detailsElement={<RecordLoader {...recordDetailsProps} />}
                        isFullScreen={session.isFullscreen || false}
                        recordLinks={recordLinksToShow}
                        setStage={(): void => {}}
                        showMenu={false}
                    >
                        <DocumentUploadLloydGeorgePreview
                            documents={uploadDocuments.filter(
                                (f) => f.type === UploadDocumentType.REVIEW,
                            )}
                            setMergedPdfBlob={(): void => {}}
                            documentConfig={reviewConfig}
                            isReview={true}
                        />
                    </RecordLayout>
                </div>
            </div>

            <section aria-labelledby="accepting-document" className="pb-6 accepting-document pt-6">
                <h2 id="accepting-document">Accepting this document</h2>
                <p>Accept the document if any pages match the demographics shown.</p>

                <h3>If some pages don’t match the demographics:</h3>
                <ul>
                    <li>you should still accept the record</li>
                    <li>
                        see <a href={helpandGuidanceLink}>help and guidance</a> for information on
                        correcting documents after you’ve accepted them
                    </li>
                </ul>

                <h3>If no pages match the demographics:</h3>
                <ul>
                    <li>select ‘No, I don’t want to accept this record’</li>
                    <li>
                        You’ll go to a page where you can search for the correct patient
                        demographics for this document
                    </li>
                </ul>
            </section>

            <Fieldset className="mt-4">
                <Fieldset.Legend isPageHeading>
                    Do you want to accept this document?
                </Fieldset.Legend>
                <Radios
                    name="accept-document"
                    id="accept-document"
                    error={showError ? 'Select an option' : ''}
                >
                    <Radios.Radio
                        id="accept-yes"
                        value="yes"
                        onChange={(e): void => {
                            setAcceptDocument(e.currentTarget.value as YesNoOption);
                        }}
                    >
                        Yes, the details match and I want to accept this document
                    </Radios.Radio>
                    <Radios.Radio
                        id="accept-no"
                        value="no"
                        onChange={(e): void => {
                            setAcceptDocument(e.currentTarget.value as YesNoOption);
                        }}
                    >
                        No, I don't want to accept this document. None of the details match the
                        demographics shown
                    </Radios.Radio>
                </Radios>
                <Button
                    className="mt-4"
                    onClick={(): void => {
                        setShowError(false);
                        if (!acceptDocument) {
                            setShowError(true);
                            setTimeout(() => {
                                errorSummaryRef.current?.focus();
                            }, 0);
                            return;
                        }
                        if (!reviewId) {
                            return;
                        }
                        if (acceptDocument === 'yes') {
                            onYesSelectionSuccess();
                        } else if (acceptDocument === 'no') {
                            navigateUrlParam(
                                routeChildren.ADMIN_REVIEW_SEARCH_PATIENT,
                                { reviewId },
                                navigate,
                            );
                        }
                    }}
                >
                    Continue
                </Button>
            </Fieldset>
        </>
    );
};

export default ReviewsDetailsStage;