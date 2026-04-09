import { endpoints } from '../../../types/generic/endpoints';
import getUserPatientRestrictions from './getUserPatientRestrictions';

vi.mock('axios', () => ({
    default: {
        get: mockAxiosGet,
    },
}));
const mockAxiosGet = vi.hoisted(() => vi.fn());

const baseAPIUrl = 'https://example.com/api';
const baseAPIHeaders = {
    Authorization: 'Bearer token',
    'Content-Type': 'application/json',
};

describe('getUserPatientRestrictions', () => {
    beforeEach(() => {
        mockAxiosGet.mockClear();
    });

    it('should fetch patient restrictions successfully', async () => {
        const mockData = [
            { id: 1, type: 'Restriction A' },
            { id: 2, type: 'Restriction B' },
        ];

        mockAxiosGet.mockResolvedValueOnce({ data: mockData });

        const result = await getUserPatientRestrictions({
            nhsNumber: '1234567890',
            smartcardNumber: '9876543210',
            baseAPIUrl,
            baseAPIHeaders,
        });

        expect(mockAxiosGet).toHaveBeenCalledWith(
            `${baseAPIUrl}${endpoints.USER_PATIENT_RESTRICTIONS}`,
            {
                headers: baseAPIHeaders,
                params: {
                    nhsNumber: '1234567890',
                    smartcardId: '9876543210',
                    limit: 10,
                },
            },
        );
        expect(result).toEqual(mockData);
    });

    it('should handle errors when fetching patient restrictions', async () => {
        const mockError = new Error('Network error');
        mockAxiosGet.mockRejectedValueOnce(mockError);

        await expect(
            getUserPatientRestrictions({
                nhsNumber: '1234567890',
                smartcardNumber: '9876543210',
                baseAPIUrl,
                baseAPIHeaders,
            }),
        ).rejects.toThrow('Network error');
    });
});
