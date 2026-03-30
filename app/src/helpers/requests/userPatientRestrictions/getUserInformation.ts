import axios, { AxiosError } from 'axios';
import { UserInformation } from '../../../types/generic/userPatientRestriction';
import { AuthHeaders } from '../../../types/blocks/authHeaders';
import { endpoints } from '../../../types/generic/endpoints';

export type GetUserInformationArgs = {
    smartcardId: string;
    baseAPIUrl: string;
    baseAPIHeaders: AuthHeaders;
};

const getUserInformation = async ({
    smartcardId,
    baseAPIUrl,
    baseAPIHeaders,
}: GetUserInformationArgs): Promise<UserInformation> => {
    try {
        const url = baseAPIUrl + endpoints.USER_PATIENT_RESTRICTIONS_SEARCH_USER;
        const { data } = await axios.get<UserInformation>(url, {
            headers: {
                ...baseAPIHeaders,
            },
            params: {
                identifier: smartcardId,
            },
        });

        return data;
    } catch (e) {
        const error = e as AxiosError;
        throw error;
    }
};

export default getUserInformation;
