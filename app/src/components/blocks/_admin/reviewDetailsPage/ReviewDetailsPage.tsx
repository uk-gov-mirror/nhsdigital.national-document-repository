import { Button, ErrorSummary, Fieldset, Radios } from 'nhsuk-react-components';
import { JSX, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useRole from '../../../../helpers/hooks/useRole';
import useTitle from '../../../../helpers/hooks/useTitle';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../../../helpers/utils/documentType';
import { setFullScreen } from '../../../../helpers/utils/fullscreen';
import { getPdfObjectUrl } from '../../../../helpers/utils/getPdfObjectUrl';
import { isLocal } from '../../../../helpers/utils/isLocal';
import { usePatientDetailsContext } from '../../../../providers/patientProvider/PatientProvider';
import { useSessionContext } from '../../../../providers/sessionProvider/SessionProvider';
import { getUserRecordActionLinks } from '../../../../types/blocks/lloydGeorgeActions';
import { LG_RECORD_STAGE } from '../../../../types/blocks/lloydGeorgeStages';
import { DOWNLOAD_STAGE } from '../../../../types/generic/downloadStage';
import { ReviewDetails } from '../../../../types/generic/reviews';
import { navigateUrlParam, routeChildren } from '../../../../types/generic/routes';
import BackButton from '../../../generic/backButton/BackButton';
import PatientSummary, { PatientInfo } from '../../../generic/patientSummary/PatientSummary';
import RecordCard from '../../../generic/recordCard/RecordCard';
import { RecordLoader, RecordLoaderProps } from '../../../generic/recordLoader/RecordLoader';
import Spinner from '../../../generic/spinner/Spinner';

// Mock data for now - will be replaced with actual API call
const mockReviewData = new ReviewDetails(
    '1',
    '16521000000101' as DOCUMENT_TYPE,
    '29 May 2025',
    'Y12345',
    '2024-01-15',
    'Missing metadata',
    '/dev/testFile.pdf',
); // Mock PDF URL for development

// Mock patient data for local development
const mockPatientData = buildPatientDetails({
    givenName: ['Kevin'],
    familyName: 'Calvin',
    nhsNumber: '9691914948',
    birthDate: '2002-06-03',
    postalCode: 'AB12 3CD',
});

export type ReviewsDetailsPageProps = {
    reviewSnoMed: DOCUMENT_TYPE;
};

type YesNoOption = 'yes' | 'no' | '';

const ReviewsDetailsPage = ({ reviewSnoMed }: ReviewsDetailsPageProps): JSX.Element => {
    useTitle({ pageTitle: 'Admin - Review Details' });
    const { reviewId } = useParams<{ reviewId: string }>();
    const [isLoadingPatientDetails, setisLoadingPatientDetails] = useState(true);
    const [isLoadingReviewDetails, setisLoadingReviewDetails] = useState(true);

    const [reviewData, setReviewData] = useState<ReviewDetails | null>(null);
    const [patientDetails, setPatientDetails] = usePatientDetailsContext();
    const [session] = useSessionContext();
    const [downloadStage, setDownloadStage] = useState(DOWNLOAD_STAGE.INITIAL);
    const [pdfObjectUrl, setPdfObjectUrl] = useState<string>('');
    const [acceptDocument, setAcceptDocument] = useState<YesNoOption>('');
    const [showError, setShowError] = useState(false);
    const errorSummaryRef = useRef<HTMLDivElement>(null);

    const reviewConfig = getConfigForDocType(reviewSnoMed);

    const navigate = useNavigate();
    const role = useRole();

    const hasRecordInStorage = downloadStage === DOWNLOAD_STAGE.SUCCEEDED;
    const helpandGuidanceLink =
        'https://digital.nhs.uk/services/access-and-store-digital-patient-documents/help-and-guidance';

    let recordLinksToShow = getUserRecordActionLinks({ role, hasRecordInStorage }).map((link) => {
        link.onClick = (): void => {
            setFullScreen();
        };

        return link;
    });

    const recordDetailsProps: RecordLoaderProps = {
        downloadStage,
        lastUpdated: reviewData?.lastUpdated || '',
        childrenIfFailiure: <>Failure</>,
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
        // Simulate API call and set patient data for local development
        const timer = setTimeout(() => {
            if (isLocal) {
                setPatientDetails(mockPatientData);
            }
            // TODO: fetch review data from API and setReviewData PRMP-827
            setisLoadingPatientDetails(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [reviewId, setPatientDetails]);

    useEffect(() => {
        // Simulate API call to fetch review details
        const timer = setTimeout(() => {
            if (isLocal) {
                setReviewData(mockReviewData);
            }
            setisLoadingReviewDetails(false);
            getPdfObjectUrl(reviewData?.documentUrl || '', setPdfObjectUrl, setDownloadStage);
            setDownloadStage(DOWNLOAD_STAGE.SUCCEEDED);
        }, 500);
        return () => clearTimeout(timer);
    }, [patientDetails]);

    const backButton = <BackButton backLinkText="Go back" dataTestid="back-button" />;

    if (isLoadingPatientDetails) {
        return (
            <>
                {backButton}
                <Spinner status="Loading patient details..." />
            </>
        );
    }
    if (isLoadingReviewDetails) {
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

            {session.isFullscreen ? (
                <RecordCard
                    heading={getConfigForDocType(reviewSnoMed).displayName}
                    fullScreenHandler={setFullScreen}
                    detailsElement={<RecordLoader {...recordDetailsProps} />}
                    isFullScreen={session.isFullscreen!}
                    pdfObjectUrl={hasRecordInStorage ? pdfObjectUrl : ''}
                />
            ) : (
                <div className="lloydgeorge_record-stage_flex">
                    <div
                        className={`lloydgeorge_record-stage_flex-row lloydgeorge_record-stage_flex-row${menuClass}`}
                    >
                        <RecordCard
                            heading={getConfigForDocType(reviewSnoMed).displayName}
                            fullScreenHandler={setFullScreen}
                            detailsElement={<RecordLoader {...recordDetailsProps} />}
                            isFullScreen={session.isFullscreen || false}
                            pdfObjectUrl={hasRecordInStorage ? pdfObjectUrl : ''}
                            recordLinks={recordLinksToShow}
                            setStage={(): LG_RECORD_STAGE => {
                                return LG_RECORD_STAGE.DOWNLOAD_ALL;
                            }}
                            showMenu={false}
                        />
                    </div>
                </div>
            )}

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
                            // Search for correct patient
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

export default ReviewsDetailsPage;
