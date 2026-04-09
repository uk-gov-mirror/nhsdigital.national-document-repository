import axios from 'axios';
import { Mocked } from 'vitest';
import { endpoints } from '../../../types/generic/endpoints';
import deleteUserPatientRestriction from './deleteUserPatientRestriction';

vi.mock('axios');

const mockedAxios = axios as Mocked<typeof axios>;
const args = {
    restrictionId: '123',
    nhsNumber: '9876543210',
    baseUrl: 'http://example.com/api',
    baseAPIHeaders: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
};

describe('deleteUserPatientRestriction', () => {
    it('should call patch with expected params', async () => {
        const mockPatch = vi.fn().mockResolvedValue({});
        mockedAxios.patch.mockImplementation(mockPatch);

        await deleteUserPatientRestriction(args);

        expect(mockPatch).toHaveBeenCalledWith(
            `${args.baseUrl}${endpoints.USER_PATIENT_RESTRICTIONS}/${args.restrictionId}`,
            {},
            {
                headers: {
                    ...args.baseAPIHeaders,
                },
                params: { patientId: args.nhsNumber },
            },
        );
    });

    it('should throw an error if the request fails', async () => {
        const mockError = new Error('Network error');
        vi.mocked(axios.patch).mockRejectedValue(mockError);

        await expect(deleteUserPatientRestriction(args)).rejects.toThrow('Network error');
    });
});
