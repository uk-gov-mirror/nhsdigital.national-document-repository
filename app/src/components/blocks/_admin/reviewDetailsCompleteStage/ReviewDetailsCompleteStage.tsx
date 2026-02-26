import { Button } from 'nhsuk-react-components';
import { useNavigate } from 'react-router-dom';
import useTitle from '../../../../helpers/hooks/useTitle';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { CompleteState } from '../../../../pages/adminRoutesPage/AdminRoutesPage';
import { JSX, useEffect, useRef, useState } from 'react';
import { formatNhsNumber } from '../../../../helpers/utils/formatNhsNumber';
import { getFormattedDateFromString } from '../../../../helpers/utils/formatDate';
import { getFormattedPatientFullName } from '../../../../helpers/utils/formatPatientFullName';
import { usePatientDetailsContext } from '../../../../providers/patientProvider/PatientProvider';
import { ReviewDetails } from '../../../../types/generic/reviews';
import { UploadDocument } from '../../../../types/pages/UploadDocumentsPage/types';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import { DocumentReviewStatus } from '../../../../types/blocks/documentReview';
import Spinner from '../../../generic/spinner/Spinner';
import patchReview, {
    PatchDocumentReviewRequestDto,
} from '../../../../helpers/requests/patchReviews';
import { PatientDetails } from '../../../../types/generic/patientDetails';
import { AxiosError } from 'axios';
import { errorToParams } from '../../../../helpers/utils/errorToParams';

type ReviewDetailsCompleteStageProps = {
    completeState: CompleteState;
    reviewData: ReviewDetails | null;
    reviewUploadDocuments: UploadDocument[];
    newPatientDetails?: PatientDetails;
};

const ReviewDetailsCompleteStage = ({
    completeState,
    reviewData,
    reviewUploadDocuments,
    newPatientDetails,
}: ReviewDetailsCompleteStageProps): JSX.Element => {
    const navigate = useNavigate();
    const [patientDetails, setPatientDetails] = usePatientDetailsContext();
    const patchRefCalled = useRef(false);
    const baseUrl = useBaseAPIUrl();
    const baseHeaders = useBaseAPIHeaders();
    const [loading, setLoading] = useState(false);

    useTitle({ pageTitle: 'Review complete' });

    const getReviewStatus = (completeState: CompleteState): DocumentReviewStatus => {
        if (completeState === CompleteState.PATIENT_MATCHED) {
            return DocumentReviewStatus.REASSIGNED;
        }
        if (completeState === CompleteState.PATIENT_UNKNOWN) {
            return DocumentReviewStatus.REASSIGNED_PATIENT_UNKNOWN;
        }
        if (completeState === CompleteState.NO_FILES_CHOICE) {
            return DocumentReviewStatus.REJECTED;
        }
        return DocumentReviewStatus.APPROVED;
    };

    const patchReviewStatus = async (): Promise<void> => {
        try {
            setLoading(true);
            if (!reviewData || reviewUploadDocuments.length === 0) {
                setLoading(false);
                return;
            }
            const status = getReviewStatus(completeState);
            const req: PatchDocumentReviewRequestDto = {
                reviewStatus: status,
                documentReferenceId:
                    status === DocumentReviewStatus.APPROVED
                        ? reviewUploadDocuments[0].ref
                        : undefined,
            };
            if (newPatientDetails) {
                req.nhsNumber = newPatientDetails.nhsNumber;
            }
            await patchReview(
                baseUrl,
                baseHeaders,
                reviewData.id,
                reviewData.version,
                reviewData.nhsNumber,
                req,
            );
            setLoading(false);
        } catch (e) {
            const error = e as AxiosError;
            if (error.response?.status === 403) {
                navigate(routes.SESSION_EXPIRED);
            } else {
                navigate(routes.SERVER_ERROR + errorToParams(error));
            }
        }
    };

    useEffect(() => {
        if (patchRefCalled.current) {
            return;
        }
        patchRefCalled.current = true;

        patchReviewStatus();
    }, []);

    const OnComplete = (): void => {
        setPatientDetails(null);
        navigate(routeChildren.ADMIN_REVIEW, { replace: true });
    };

    const getDefaultPrmEmailSupportMessage = (): JSX.Element => {
        return (
            <>
                <p>
                    This document has been matched to the patient whose NHS number you entered. If
                    this patient is registered at your practice, you will see this document on the
                    list of documents to review again.
                </p>
                <p>
                    If you think you've made a mistake, contact the Patient Record Management team
                    at <a href="mailto:england.prmteam@nhs.net">england.prmteam@nhs.net</a>.
                </p>
            </>
        );
    };

    const getPanelTitle = (): string => {
        if (completeState === CompleteState.PATIENT_MATCHED) {
            return 'This document has been matched to the correct patient';
        }
        if (completeState === CompleteState.PATIENT_UNKNOWN) {
            return 'Review complete';
        }
        if (completeState === CompleteState.NO_FILES_CHOICE) {
            return 'Review complete';
        }
        if (completeState === CompleteState.REVIEW_COMPLETE) {
            return 'Upload complete';
        }
        return '';
    };

    const getPanelBody = (): JSX.Element => {
        if (completeState === CompleteState.PATIENT_UNKNOWN) {
            return (
                <p>
                    You've completed the review of this document. It has been removed from your list
                    of documents to review.
                </p>
            );
        }

        if (completeState === CompleteState.NO_FILES_CHOICE && patientDetails) {
            const formattedNhsNumber = formatNhsNumber(patientDetails.nhsNumber);
            const dob = getFormattedDateFromString(patientDetails.birthDate);
            const patientName = getFormattedPatientFullName(patientDetails);

            return (
                <>
                    <p>
                        You've completed the review of this document. It has been removed from your
                        list of documents to review.
                    </p>
                    <br />
                    <div>
                        <strong data-testid="patient-name">Patient name: {patientName}</strong>
                        <br />
                        <span data-testid="nhs-number">NHS number: {formattedNhsNumber}</span>
                        <br />
                        <span data-testid="dob">Date of birth: {dob}</span>
                    </div>
                </>
            );
        }

        if (completeState === CompleteState.REVIEW_COMPLETE && patientDetails) {
            const formattedNhsNumber = formatNhsNumber(patientDetails.nhsNumber);
            const dob = getFormattedDateFromString(patientDetails.birthDate);
            const patientName = getFormattedPatientFullName(patientDetails);

            return (
                <div className="mt-p pt-9">
                    <strong data-testid="patient-name">Patient name: {patientName}</strong>
                    <br />
                    <span data-testid="nhs-number">NHS number: {formattedNhsNumber}</span>
                    <br />
                    <span data-testid="dob">Date of birth: {dob}</span>
                </div>
            );
        }
        return <></>;
    };

    const getBody = (): JSX.Element => {
        if (completeState === CompleteState.PATIENT_MATCHED) {
            return <>{getDefaultPrmEmailSupportMessage()}</>;
        }
        if (completeState === CompleteState.PATIENT_UNKNOWN) {
            return (
                <>
                    <p>
                        Print and send this document to Primary Care Support England following their{' '}
                        <a
                            href="https://pcse.england.nhs.uk/services/medical-records/moving-medical-records"
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid="process-link"
                        >
                            process for record transfers
                        </a>
                        .
                    </p>

                    {getDefaultPrmEmailSupportMessage()}
                </>
            );
        }
        if (completeState === CompleteState.NO_FILES_CHOICE) {
            return <>{getDefaultPrmEmailSupportMessage()}</>;
        }
        if (completeState === CompleteState.REVIEW_COMPLETE) {
            return (
                <>
                    <p className="nhsuk-u-font-weight-bold nhsuk-u-font-size-22">
                        <strong>
                            You have completed the review of this document. It has been removed from
                            your list of documents to review.
                        </strong>
                    </p>
                    <h2>What to do next</h2>
                    <ol>
                        <li>
                            You'll find this document in the patient's record within this service,
                            which you can access by{' '}
                            <a href={routes.SEARCH_PATIENT}>searching using their NHS number</a>.
                        </li>
                        <li>
                            Follow your usual process for managing a new patient record. For
                            example, storing and summarising on the clinical system and logging any
                            SNOMED codes.
                        </li>
                        <li>
                            When you've done this, you can remove any digital copies of these files
                            from your computer.
                        </li>
                    </ol>
                    {getDefaultPrmEmailSupportMessage()}
                </>
            );
        }
        return <></>;
    };

    if (loading) {
        return <Spinner status={'Loading'} />;
    }

    return (
        <div className="review-complete" data-testid="review-complete-page">
            <div
                className="nhsuk-panel nhsuk-panel--confirmation"
                data-testid="review-complete-card"
            >
                <h1 className="nhsuk-panel__title">{getPanelTitle()}</h1>
                <div className="nhsuk-panel__body">{getPanelBody()}</div>
            </div>

            {completeState !== CompleteState.REVIEW_COMPLETE && <h2>What happens next</h2>}

            {getBody()}

            <Button data-testid="review-another-btn" type="button" onClick={OnComplete}>
                Go to documents to review
            </Button>
        </div>
    );
};

export default ReviewDetailsCompleteStage;
