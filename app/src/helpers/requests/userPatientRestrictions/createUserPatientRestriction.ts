import axios, { AxiosError } from 'axios';
import { AuthHeaders } from '../../../types/blocks/authHeaders';
import { endpoints } from '../../../types/generic/endpoints';

type CreateUserPatientRestrictionArgs = {
    smartcardId: string;
    nhsNumber: string;
    baseAPIUrl: string;
    baseAPIHeaders: AuthHeaders;
};

const postUserPatientRestriction = async ({
    smartcardId,
    nhsNumber,
    baseAPIUrl,
    baseAPIHeaders,
}: CreateUserPatientRestrictionArgs): Promise<void> => {
    try {
        const url = baseAPIUrl + endpoints.USER_PATIENT_RESTRICTIONS;
        await axios.post(
            url,
            {
                smartcardId,
                nhsNumber,
            },
            {
                headers: {
                    ...baseAPIHeaders,
                },
                params: {
                    patientId: nhsNumber,
                },
            },
        );
    } catch (e) {
        const error = e as AxiosError;
        throw error;
    }
};

export default postUserPatientRestriction;
