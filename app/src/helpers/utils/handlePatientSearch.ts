import { AxiosError } from 'axios';
import { Dispatch, SetStateAction } from 'react';
import { LocalFlags } from '../../providers/configProvider/ConfigProvider';
import { AuthHeaders } from '../../types/blocks/authHeaders';
import { FeatureFlags } from '../../types/generic/featureFlags';
import { PatientDetails } from '../../types/generic/patientDetails';
import { routes } from '../../types/generic/routes';
import getPatientDetails from '../requests/getPatientDetails';
import { buildPatientDetails } from '../test/testBuilders';
import errorCodes from './errorCodes';
import { errorToParams } from './errorToParams';
import { isMock } from './isLocal';

export enum PATIENT_SEARCH_STATES {
    IDLE = 'IDLE',
    SEARCHING = 'SEARCHING',
    SUCCEEDED = 'SUCCEEDED',
    FAILED = 'FAILED',
}

export type HandleSearchArgs = {
    nhsNumber: string;
    setSearchingState: Dispatch<SetStateAction<PATIENT_SEARCH_STATES>>;
    handleSuccess: (patientDetails: PatientDetails) => void;
    baseUrl: string;
    baseHeaders: AuthHeaders;
    userIsGPAdmin: boolean;
    userIsGPClinical: boolean;
    mockLocal: LocalFlags;
    featureFlags: FeatureFlags;
};

type handleSearchReturnType = [
    ErrorMessage: string | null,
    statusCode: number | null,
    error?: AxiosError,
];

export const handleSearch = async ({
    nhsNumber,
    setSearchingState,
    handleSuccess,
    baseUrl,
    baseHeaders,
    userIsGPAdmin,
    userIsGPClinical,
    mockLocal,
    featureFlags,
}: HandleSearchArgs): Promise<handleSearchReturnType | undefined> => {
    setSearchingState(PATIENT_SEARCH_STATES.SEARCHING);

    const cleanedNhsNumber = nhsNumber.replaceAll(/[-\s]/gi, '');

    try {
        const patientDetails = await getPatientDetails({
            nhsNumber: cleanedNhsNumber,
            baseUrl,
            baseHeaders,
        });

        if (!patientDetails.active && !patientDetails.deceased) {
            if (
                userIsGPClinical ||
                (userIsGPAdmin &&
                    (!featureFlags.uploadArfWorkflowEnabled || !featureFlags.uploadLambdaEnabled))
            ) {
                return [errorCodes['SP_4003'], 404, undefined];
            }
        }

        handleSuccess(patientDetails);
    } catch (e) {
        const error = e as AxiosError;

        if (isMock(error)) {
            handleSuccess(
                buildPatientDetails({
                    nhsNumber,
                    active: mockLocal.patientIsActive,
                    deceased: mockLocal.patientIsDeceased,
                }),
            );
            return;
        }
        let errorCode: string | null = null;
        let statusCode: number | null = null;
        if (error.response?.status === 400) {
            errorCode = 'Enter a valid patient NHS number.';
            statusCode = 400;
        } else if (error.response?.status === 403) {
            statusCode = 403;
        } else if (error.response?.status === 404) {
            errorCode = errorCodes['SP_4003'];
            statusCode = 404;
        }
        return [errorCode, statusCode, error];
    }
};

export const handlePatientSearchError = (
    statusCode: number | null,
    navigate: (to: string) => void,
    setFailedSubmitState: (statusCode: number | null) => void,
    error?: AxiosError,
): void => {
    if (error) {
        if (statusCode === 403) {
            navigate(routes.SESSION_EXPIRED);
        } else {
            navigate(routes.SERVER_ERROR + errorToParams(error));
        }
    }
    setFailedSubmitState(error!.response?.status ?? null);
};
