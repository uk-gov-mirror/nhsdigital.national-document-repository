import { Button, TextInput } from 'nhsuk-react-components';
import useTitle from '../../../helpers/hooks/useTitle';
import { NHS_NUMBER_PATTERN } from '../../../helpers/constants/regex';
import { FieldValues, useForm } from 'react-hook-form';
import {
    handlePatientSearchError,
    handleSearch,
    HandleSearchArgs,
    PATIENT_SEARCH_STATES,
} from '../../../helpers/utils/handlePatientSearch';
import { useState } from 'react';
import { PatientDetails } from '../../../types/generic/patientDetails';
import { Link, useNavigate } from 'react-router-dom';
import useBaseAPIHeaders from '../../../helpers/hooks/useBaseAPIHeaders';
import useConfig from '../../../helpers/hooks/useConfig';
import useBaseAPIUrl from '../../../helpers/hooks/useBaseAPIUrl';
import ServiceError from '../../layout/serviceErrorBox/ServiceErrorBox';
import ErrorBox from '../../layout/errorBox/ErrorBox';
import { InputRef } from '../../../types/generic/inputRef';
import SpinnerButton from '../spinnerButton/SpinnerButton';
import PatientSummary, { PatientInfo } from '../patientSummary/PatientSummary';
import { AxiosError } from 'axios';

type Props = {
    title: string;
    subtitle?: string;
    inputLabel?: string;
    buttonText?: string;
    displayPatientDetails?: boolean;
    onSuccess: (patientDetails: PatientDetails) => void;
    onError?: (error: AxiosError) => void;
    secondaryActionText?: string;
    onSecondaryActionClicked?: () => void;
};

type FormData = {
    nhsNumber: string;
};

export const incorrectFormatMessage = "Enter patient's 10 digit NHS number";

const PatientSearchForm = ({
    title,
    subtitle,
    inputLabel,
    buttonText = 'Continue',
    displayPatientDetails = false,
    onSuccess,
    onError,
    secondaryActionText,
    onSecondaryActionClicked,
}: Props): React.JSX.Element => {
    const navigate = useNavigate();
    const baseUrl = useBaseAPIUrl();
    const baseHeaders = useBaseAPIHeaders();
    const config = useConfig();
    const [submissionState, setSubmissionState] = useState<PATIENT_SEARCH_STATES>(
        PATIENT_SEARCH_STATES.IDLE,
    );
    const [statusCode, setStatusCode] = useState<null | number>(null);
    const [inputError, setInputError] = useState<null | string>(null);

    useTitle({ pageTitle: title });

    const { register, handleSubmit } = useForm<FormData>({
        reValidateMode: 'onSubmit',
    });

    const nhsNumberValidationMessage =
        incorrectFormatMessage +
        (secondaryActionText
            ? `. If you keep getting this message, select '${secondaryActionText}'.`
            : '');

    const { ref: nhsNumberRef, ...searchProps } = register('nhsNumber', {
        required: nhsNumberValidationMessage,
        pattern: {
            value: NHS_NUMBER_PATTERN,
            message: nhsNumberValidationMessage,
        },
    });

    const handleValidSubmit = async (data: FormData): Promise<void> => {
        setSubmissionState(PATIENT_SEARCH_STATES.SEARCHING);
        setInputError(null);
        setStatusCode(null);

        const args: HandleSearchArgs = {
            nhsNumber: data.nhsNumber,
            setSearchingState: setSubmissionState,
            handleSuccess,
            baseUrl,
            baseHeaders,
            mockLocal: config.mockLocal,
        };

        const result = await handleSearch(args);
        if (result) {
            const [errorCode, statusCode, error] = result;
            if (error) {
                if (onError) {
                    onError(error);
                }

                if (errorCode) {
                    setInputError(errorCode ?? 'Sorry, patient data not found.');
                } else {
                    handlePatientSearchError(statusCode, navigate, setFailedSubmitState, error);
                }

                setFailedSubmitState(statusCode);
            }
        }
    };

    const handleFormError = (fields: FieldValues): void => {
        const errorMessages = Object.entries(fields).map(
            ([_, v]: [string, { message: string }]) => v.message,
        );
        setInputError(errorMessages[0]);
    };

    const handleSuccess = (patientDetails: PatientDetails): void => {
        setSubmissionState(PATIENT_SEARCH_STATES.SUCCEEDED);
        onSuccess(patientDetails);
    };

    const setFailedSubmitState = (statusCode: number | null): void => {
        setStatusCode(statusCode);
        setSubmissionState(PATIENT_SEARCH_STATES.FAILED);
    };

    const isError = (): boolean => (statusCode && statusCode >= 500) || !inputError;

    return (
        <>
            {(submissionState === PATIENT_SEARCH_STATES.FAILED ||
                inputError === nhsNumberValidationMessage) && (
                <>
                    {isError() ? (
                        <ServiceError />
                    ) : (
                        <ErrorBox
                            messageTitle={'There is a problem'}
                            messageLinkBody={inputError!}
                            errorInputLink={'#nhs-number-input'}
                            errorBoxSummaryId={'error-box-summary'}
                        />
                    )}
                </>
            )}

            <h1>{title}</h1>

            {displayPatientDetails && (
                <PatientSummary>
                    <PatientSummary.Child item={PatientInfo.FULL_NAME} />
                    <PatientSummary.Child item={PatientInfo.NHS_NUMBER} />
                    <PatientSummary.Child item={PatientInfo.BIRTH_DATE} />
                </PatientSummary>
            )}

            {subtitle && <p>{subtitle}</p>}

            <form onSubmit={handleSubmit(handleValidSubmit, handleFormError)}>
                <TextInput
                    id="nhs-number-input"
                    data-testid="nhs-number-input"
                    className="nhsuk-input--width-10"
                    label={inputLabel || 'A 10-digit number, for example, 960 191 4948'}
                    hint={inputLabel && 'A 10-digit number, for example, 960 191 4948'}
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
                    <Button type="submit" id="search-submit" data-testid="search-submit-btn">
                        {buttonText}
                    </Button>
                )}
            </form>
            {secondaryActionText && (
                <p className="nhsuk-body-s">
                    <Link
                        to="#"
                        onClick={(e): void => {
                            e.preventDefault();
                            onSecondaryActionClicked!();
                        }}
                    >
                        {secondaryActionText}
                    </Link>
                </p>
            )}
        </>
    );
};

export default PatientSearchForm;
