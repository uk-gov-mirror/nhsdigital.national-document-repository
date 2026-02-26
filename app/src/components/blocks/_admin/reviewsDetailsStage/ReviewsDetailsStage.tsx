import { Button, ErrorSummary, Fieldset, Radios } from 'nhsuk-react-components';
import { Dispatch, JSX, SetStateAction, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import useConfig from '../../../../helpers/hooks/useConfig';
import useRole from '../../../../helpers/hooks/useRole';
import useTitle from '../../../../helpers/hooks/useTitle';
import { getConfigForDocType } from '../../../../helpers/utils/documentType';
import { getFormattedDateTimeFromString } from '../../../../helpers/utils/formatDate';
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
import { navigateUrlParam, routeChildren, routes } from '../../../../types/generic/routes';
import {
    ReviewUploadDocument,
    UploadDocumentType,
} from '../../../../types/pages/UploadDocumentsPage/types';
import BackButton from '../../../generic/backButton/BackButton';
import PatientSummary, { PatientInfo } from '../../../generic/patientSummary/PatientSummary';
import { RecordLayout } from '../../../generic/recordCard/RecordCard';
import { RecordLoader, RecordLoaderProps } from '../../../generic/recordLoader/RecordLoader';
import Spinner from '../../../generic/spinner/Spinner';
import { useForm } from 'react-hook-form';
import { AxiosError } from 'axios';
import { errorToParams } from '../../../../helpers/utils/errorToParams';
import waitForSeconds from '../../../../helpers/utils/waitForSeconds';
import { NHS_NUMBER_UNKNOWN } from '../../../../helpers/constants/numbers';
import { CreatedByCard } from '../../../generic/createdBy/createdBy';
import DocumentUploadLloydGeorgePreview from '../../_documentManagement/documentUploadLloydGeorgePreview/DocumentUploadLloydGeorgePreview';

export type ReviewsDetailsStageProps = {
    reviewData: ReviewDetails;
    loadReviewData: () => Promise<void>;
    setDownloadStage: Dispatch<SetStateAction<DOWNLOAD_STAGE>>;
    downloadStage: DOWNLOAD_STAGE;
    uploadDocuments: ReviewUploadDocument[];
};

type YesNoOption = 'yes' | 'no' | '';
type FormData = {
    acceptDocument: YesNoOption;
};

const ReviewsDetailsStage = ({
    reviewData,
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
    const [showError, setShowError] = useState(false);
    const errorSummaryRef = useRef<HTMLDivElement>(null);
    const fetchingPatientDetailsRef = useRef(false);
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
        reviewConfig.canBeUpdated && reviewConfig.canBeDiscarded
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

    const downloadAction = (e: React.MouseEvent<HTMLElement>): void => {
        e.preventDefault();
        for (const doc of uploadDocuments) {
            const anchor = document.createElement('a');
            const url = URL.createObjectURL(doc.blob!);
            anchor.href = url;
            anchor.download = doc.file.name;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        }
    };

    const recordDetailsProps: RecordLoaderProps = {
        downloadStage,
        childrenIfFailiure: <p>Failure: failed to load documents</p>,
        fileName:
            !reviewConfig.multifileReview && reviewData.files && reviewData.files.length === 1
                ? reviewData.files[0].fileName
                : '',
        downloadAction,
    };

    const onYesSelectionSuccess = (): void => {
        if (!reviewId) {
            return;
        }

        if (
            !reviewConfig.canBeDiscarded ||
            (uploadDocuments.length === 1 && !reviewConfig.multifileReview)
        ) {
            navigateUrlParam(routeChildren.ADMIN_REVIEW_UPLOAD, { reviewId }, navigate);
            return;
        }

        if (reviewConfig.multifileReview && uploadDocuments.length === 1) {
            navigateUrlParam(routeChildren.ADMIN_REVIEW_ADD_MORE_CHOICE, { reviewId }, navigate);
            return;
        }

        navigateUrlParam(routeChildren.ADMIN_REVIEW_ASSESS_FILES, { reviewId }, navigate);
    };

    useEffect(() => {
        setisLoadingPatientDetails(true);
        setDownloadStage(DOWNLOAD_STAGE.INITIAL);
        setShowError(false);

        if (!setPatientDetails || !reviewData) {
            setisLoadingPatientDetails(false);
            return;
        }
        if (reviewData.nhsNumber === NHS_NUMBER_UNKNOWN) {
            setisLoadingPatientDetails(false);
            return;
        }

        const getPatientDetails = async (): Promise<void> => {
            try {
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
            } catch (error) {
                const err = error as AxiosError;
                if (err.response?.status === 403) {
                    navigate(routes.SESSION_EXPIRED);
                } else {
                    navigate(routes.SERVER_ERROR + errorToParams(err));
                }
            }
        };

        if (!fetchingPatientDetailsRef.current) {
            fetchingPatientDetailsRef.current = true;
            getPatientDetails();
        }
    }, [reviewId]);

    useEffect(() => {
        const loadData = async (): Promise<void> => {
            let retryCount = 0;
            const maxRetries = 10;
            const retryDelayMs = 3;

            while (retryCount < maxRetries) {
                try {
                    await loadReviewData();
                    if (reviewData.nhsNumber === NHS_NUMBER_UNKNOWN) {
                        navigateUrlParam(
                            routeChildren.ADMIN_REVIEW_SEARCH_PATIENT,
                            { reviewId: reviewId! },
                            navigate,
                            { replace: true },
                        );
                        return;
                    }
                    break;
                } catch (e) {
                    retryCount += 1;
                    if (retryCount < maxRetries) {
                        await waitForSeconds(retryDelayMs);
                    } else {
                        const error = e as AxiosError;
                        if (error.response?.status === 403) {
                            navigate(routes.SESSION_EXPIRED);
                            return;
                        }

                        navigate(routes.SERVER_ERROR + errorToParams(error));
                    }
                }
            }
        };

        if (!isFetchingReviewDetailsRef.current) {
            isFetchingReviewDetailsRef.current = true;
            loadData();
        }
    }, [patientDetails, setPatientDetails]);

    const { register, handleSubmit } = useForm<FormData>({
        reValidateMode: 'onSubmit',
    });
    const { ref: radioRef, ...radioProps } = register('acceptDocument', {
        required: 'Select an option',
    });

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

    const submit = (data: FormData): void => {
        if (!reviewId) {
            return;
        }

        const config = getConfigForDocType(reviewData.snomedCode);
        if (config.multifileZipped && reviewData.files) {
            const zipDocument = reviewData.files.find((d) =>
                d.fileName.toLowerCase().endsWith('.zip'),
            );
            if (zipDocument === undefined) {
                // eslint-disable-next-line no-console
                console.error('Multifile zipped upload required but no zip file found');
            }
        }

        if (!data.acceptDocument) {
            setShowError(true);
            return;
        }

        if (data.acceptDocument === 'yes') {
            onYesSelectionSuccess();
        } else if (data.acceptDocument === 'no') {
            navigateUrlParam(routeChildren.ADMIN_REVIEW_SEARCH_PATIENT, { reviewId }, navigate);
        }
    };

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

            <p>
                Check the patient details in the document shown matches these patient demographics:
            </p>

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
                        heading={reviewConfig.content.reviewDocumentTitle as string}
                        fullScreenHandler={null}
                        detailsElement={<RecordLoader {...recordDetailsProps} />}
                        isFullScreen={session.isFullscreen || false}
                        recordLinks={recordLinksToShow}
                        setStage={(): void => {}}
                        showMenu={false}
                    >
                        <DocumentUploadLloydGeorgePreview
                            documents={uploadDocuments.filter(
                                (f) =>
                                    f.type === UploadDocumentType.REVIEW &&
                                    f.file.name.endsWith('.pdf') &&
                                    f.blob,
                            )}
                            setMergedPdfBlob={(): void => {}}
                            documentConfig={reviewConfig}
                            isReview={true}
                        >
                            <CreatedByCard
                                odsCode={reviewData.uploader}
                                dateUploaded={getFormattedDateTimeFromString(
                                    reviewData.dateUploaded,
                                )}
                                cssClass="pt-1"
                            />
                        </DocumentUploadLloydGeorgePreview>
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

            <form onSubmit={handleSubmit(submit, () => setShowError(true))}>
                <Fieldset className="mt-4">
                    <Fieldset.Legend isPageHeading>
                        Do you want to accept this document?
                    </Fieldset.Legend>
                    <Radios id="accept-document" error={showError ? 'Select an option' : ''}>
                        <Radios.Radio value="yes" {...radioProps} inputRef={radioRef}>
                            Yes, I want to accept this document. All or some of the details match
                            the demographics shown.
                        </Radios.Radio>
                        <Radios.Radio
                            value="no"
                            {...radioProps}
                            inputRef={radioRef}
                            data-testid="reject-record-option"
                        >
                            No, I don't want to accept this document. None of the details match the
                            demographics shown.
                        </Radios.Radio>
                    </Radios>
                    <Button className="mt-4" type="submit" data-testid="continue-btn">
                        Continue
                    </Button>
                </Fieldset>
            </form>
        </>
    );
};

export default ReviewsDetailsStage;
