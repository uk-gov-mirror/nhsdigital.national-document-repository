import axios from 'axios';
import { Mocked } from 'vitest';
import postUserPatientRestriction from './createUserPatientRestriction';
import { endpoints } from '../../../types/generic/endpoints';

vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

describe('createUserPatientRestriction', () => {
    it('should make expected API call', async () => {
        const mockPost = vi.fn();
        mockedAxios.post.mockImplementation(mockPost);

        const args = {
            smartcardId: '123',
            nhsNumber: '9876543210',
            baseAPIUrl: 'http://example.com/api',
            baseAPIHeaders: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
        };

        await postUserPatientRestriction(args);

        expect(mockPost).toHaveBeenCalledWith(
            `${args.baseAPIUrl}${endpoints.USER_PATIENT_RESTRICTIONS}`,
            {
                smartcardId: args.smartcardId,
                nhsNumber: args.nhsNumber,
            },
            {
                headers: {
                    ...args.baseAPIHeaders,
                },
                params: {
                    patientId: args.nhsNumber,
                },
            },
        );
    });
});
