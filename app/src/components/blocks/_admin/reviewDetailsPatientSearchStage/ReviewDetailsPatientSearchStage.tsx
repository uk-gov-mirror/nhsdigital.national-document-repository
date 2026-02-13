import { Button, TextInput } from 'nhsuk-react-components';
import { JSX, useState } from 'react';
import { FieldValues, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { NHS_NUMBER_PATTERN } from '../../../../helpers/constants/regex';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import useConfig from '../../../../helpers/hooks/useConfig';
import {
    HandleSearchArgs,
    PATIENT_SEARCH_STATES,
    handlePatientSearchError,
    handleSearch,
} from '../../../../helpers/utils/handlePatientSearch';
import { InputRef } from '../../../../types/generic/inputRef';
import { PatientDetails } from '../../../../types/generic/patientDetails';
import { ReviewDetails } from '../../../../types/generic/reviews';
import {
    getToWithUrlParams,
    navigateUrlParam,
    routeChildren,
} from '../../../../types/generic/routes';
import BackButton from '../../../generic/backButton/BackButton';
import SpinnerButton from '../../../generic/spinnerButton/SpinnerButton';
import ErrorBox from '../../../layout/errorBox/ErrorBox';
import ServiceError from '../../../layout/serviceErrorBox/ServiceErrorBox';
import DocumentUploadLloydGeorgePreview from '../../_documentUpload/documentUploadLloydGeorgePreview/DocumentUploadLloydGeorgePreview';
import { RecordLayout } from '../../../generic/recordCard/RecordCard';
import { RecordLoader, RecordLoaderProps } from '../../../generic/recordLoader/RecordLoader';
import { getConfigForDocType } from '../../../../helpers/utils/documentType';
import { DOWNLOAD_STAGE } from '../../../../types/generic/downloadStage';
import { ReviewUploadDocument } from '../../../../types/pages/UploadDocumentsPage/types';
import { getFormattedDateTimeFromString } from '../../../../helpers/utils/formatDate';
import { CreatedByCard } from '../../../generic/createdBy/createdBy';

export const incorrectFormatMessage = "Enter patient's 10 digit NHS number";

interface ReviewDetailsPatientSearchPageProps {
    reviewData: ReviewDetails | null;
    uploadDocuments: ReviewUploadDocument[];
    setNewPatientDetails: React.Dispatch<React.SetStateAction<PatientDetails | undefined>>;
}

const ReviewDetailsPatientSearchStage = ({
    reviewData,
    uploadDocuments,
    setNewPatientDetails,
}: ReviewDetailsPatientSearchPageProps): JSX.Element => {
    const navigate = useNavigate();
    const { reviewId } = useParams<{ reviewId: string }>();
    const [submissionState, setSubmissionState] = useState<PATIENT_SEARCH_STATES>(
        PATIENT_SEARCH_STATES.IDLE,
    );
    const [statusCode, setStatusCode] = useState<null | number>(null);
    const [inputError, setInputError] = useState<null | string>(null);
    const { register, handleSubmit } = useForm({
        reValidateMode: 'onSubmit',
    });
    const config = useConfig();
    const baseUrl = useBaseAPIUrl();
    const baseHeaders = useBaseAPIHeaders();

    if (!reviewData) {
        navigate(routeChildren.ADMIN_REVIEW);
        return <></>;
    }

    const reviewConfig = getConfigForDocType(reviewData.snomedCode);

    const { ref: nhsNumberRef, ...searchProps } = register('nhsNumber', {
        required: incorrectFormatMessage,
        pattern: {
            value: NHS_NUMBER_PATTERN,
            message: incorrectFormatMessage,
        },
    });
    const isError = (statusCode && statusCode >= 500) || !inputError;

    const handleSuccess = (patientDetails: PatientDetails): void => {
        setNewPatientDetails(patientDetails);
        setSubmissionState(PATIENT_SEARCH_STATES.SUCCEEDED);
        navigateUrlParam(
            routeChildren.ADMIN_REVIEW_DONT_KNOW_NHS_NUMBER_PATIENT_VERIFY,
            { reviewId: reviewId! },
            navigate,
        );
    };

    const setFailedSubmitState = (statusCode: number | null): void => {
        setStatusCode(statusCode);
        setSubmissionState(PATIENT_SEARCH_STATES.FAILED);
    };

    const handleValidSubmit = async (data: FieldValues): Promise<void> => {
        setSubmissionState(PATIENT_SEARCH_STATES.SEARCHING);
        setInputError(null);
        setStatusCode(null);

        const args: HandleSearchArgs = {
            nhsNumber: data.nhsNumber,
            setSearchingState: setSubmissionState,
            handleSuccess,
            baseUrl,
            baseHeaders,
            userIsGPAdmin: false,
            userIsGPClinical: false,
            mockLocal: config.mockLocal,
            featureFlags: config.featureFlags,
        };

        const result = await handleSearch(args);
        if (result) {
            const [errorCode, statusCode, error] = result;
            if (error) {
                if (errorCode) {
                    setInputError(errorCode ?? 'Sorry, patient data not found.');
                } else {
                    handlePatientSearchError(statusCode, navigate, setFailedSubmitState, error);
                }

                setFailedSubmitState(statusCode);
            }
        }
    };

    const downloadAction = (e: React.MouseEvent<HTMLElement>): void => {
        e.preventDefault();
        for (const doc of uploadDocuments ?? []) {
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
        downloadStage: DOWNLOAD_STAGE.SUCCEEDED,
        childrenIfFailiure: <p>Failure: failed to load documents</p>,
        fileName:
            !reviewConfig.multifileReview && reviewData.files?.length === 1
                ? reviewData.files[0].fileName
                : '',
        downloadAction,
    };

    const handleFormError = (fields: FieldValues): void => {
        const errorMessages = Object.entries(fields).map(
            ([k, v]: [string, { message: string }]) => v.message,
        );
        setInputError(errorMessages[0]);
    };

    const files = uploadDocuments?.filter((f) => f.file && f.file.name.endsWith('.pdf'));

    return (
        <>
            <BackButton backLinkText="Go back" dataTestid="back-button" />

            {(submissionState === PATIENT_SEARCH_STATES.FAILED ||
                inputError === incorrectFormatMessage) && (
                <>
                    {isError ? (
                        <ServiceError />
                    ) : (
                        <ErrorBox
                            messageTitle={'There is a problem'}
                            messageLinkBody={inputError}
                            errorInputLink={'#nhs-number-input'}
                            errorBoxSummaryId={'error-box-summary'}
                        />
                    )}
                </>
            )}

            <h1>Search for the correct patient</h1>

            <p>Enter the NHS number to find the correct patient demographics for this document.</p>

            <form onSubmit={handleSubmit(handleValidSubmit, handleFormError)}>
                <TextInput
                    id="nhs-number-input"
                    data-testid="nhs-number-input"
                    className="nhsuk-input--width-10"
                    label="A 10-digit number, for example, 960 191 4948"
                    type="text"
                    {...searchProps}
                    error={
                        submissionState !== PATIENT_SEARCH_STATES.SEARCHING && inputError
                            ? inputError
                            : false
                    }
                    name="nhsNumber"
                    inputRef={nhsNumberRef as InputRef}
                    readOnly={
                        submissionState === PATIENT_SEARCH_STATES.SUCCEEDED ||
                        submissionState === PATIENT_SEARCH_STATES.SEARCHING
                    }
                    autoComplete="off"
                />

                {submissionState === PATIENT_SEARCH_STATES.SEARCHING ? (
                    <SpinnerButton
                        id="patient-search-spinner"
                        status="Searching..."
                        disabled={true}
                    />
                ) : (
                    <Button type="submit" id="continue-button" data-testid="continue-button">
                        Continue
                    </Button>
                )}
            </form>
            <p className="nhsuk-body-s">
                <Link
                    to={getToWithUrlParams(routeChildren.ADMIN_REVIEW_DONT_KNOW_NHS_NUMBER, {
                        reviewId: reviewId!,
                    })}
                >
                    I don't know the NHS number
                </Link>
            </p>

            <RecordLayout
                heading={reviewConfig.content.viewDocumentTitle as string}
                fullScreenHandler={null}
                detailsElement={<RecordLoader {...recordDetailsProps} />}
                isFullScreen={false}
                setStage={(): void => {}}
                showMenu={false}
            >
                <DocumentUploadLloydGeorgePreview
                    documents={files || []}
                    setMergedPdfBlob={(): void => {}}
                    documentConfig={reviewConfig}
                    isReview={true}
                >
                    <CreatedByCard
                        odsCode={reviewData.uploader}
                        dateUploaded={getFormattedDateTimeFromString(reviewData.dateUploaded)}
                        cssClass="pt-1"
                    />
                </DocumentUploadLloydGeorgePreview>
            </RecordLayout>
        </>
    );
};

export default ReviewDetailsPatientSearchStage;
