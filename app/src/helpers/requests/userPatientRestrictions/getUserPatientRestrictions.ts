import axios, { AxiosError } from 'axios';
import { AuthHeaders } from '../../../types/blocks/authHeaders';
import { UserPatientRestriction } from '../../../types/generic/userPatientRestriction';
import { endpoints } from '../../../types/generic/endpoints';

export type GetUserPatientRestrictionsArgs = {
    nhsNumber?: string;
    smartcardNumber?: string;
    baseAPIUrl: string;
    baseAPIHeaders: AuthHeaders;
    limit?: number;
    pageToken?: string;
};

export type GetUserPatientRestrictionsResponse = {
    restrictions: UserPatientRestriction[];
    nextPageToken?: string;
};

const getUserPatientRestrictions = async ({
    nhsNumber,
    smartcardNumber,
    baseAPIUrl,
    baseAPIHeaders,
    limit = 10,
    pageToken,
}: GetUserPatientRestrictionsArgs): Promise<GetUserPatientRestrictionsResponse> => {
    try {
        const url = baseAPIUrl + endpoints.USER_PATIENT_RESTRICTIONS;
        const { data } = await axios.get<GetUserPatientRestrictionsResponse>(url, {
            headers: baseAPIHeaders,
            params: {
                nhsNumber,
                smartcardId: smartcardNumber,
                limit,
                nextPageToken: pageToken,
            },
        });

        return data;
    } catch (e) {
        const error = e as AxiosError;
        throw error;
    }
};

export default getUserPatientRestrictions;
