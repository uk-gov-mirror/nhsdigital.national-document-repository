import axios, { AxiosError } from 'axios';
import { AuthHeaders } from '../../../types/blocks/authHeaders';
import { endpoints } from '../../../types/generic/endpoints';

type DeleteUserPatientRestrictionArgs = {
    restrictionId: string;
    nhsNumber: string;
    baseUrl: string;
    baseAPIHeaders: AuthHeaders;
};

const deleteUserPatientRestriction = async ({
    restrictionId,
    nhsNumber,
    baseUrl,
    baseAPIHeaders,
}: DeleteUserPatientRestrictionArgs): Promise<void> => {
    try {
        const url = baseUrl + endpoints.USER_PATIENT_RESTRICTIONS + `/${restrictionId}`;
        await axios.patch(
            url,
            {},
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

export default deleteUserPatientRestriction;
