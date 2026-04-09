import axios from 'axios';
import { Mocked } from 'vitest';
import getUserInformation from './getUserInformation';
import { endpoints } from '../../../types/generic/endpoints';

vi.mock('axios');

const mockedAxios = axios as Mocked<typeof axios>;

describe('getUserInformation', () => {
    it('should return user information when the request is successful', async () => {
        const mockUserInformation = {
            smartcardId: '123456789012',
            firstName: 'John',
            lastName: 'Smith',
        };

        const mockGet = vi.fn();
        mockedAxios.get.mockImplementation(mockGet);
        mockGet.mockResolvedValue({ data: mockUserInformation });

        const result = await getUserInformation({
            smartcardId: '123456789012',
            baseAPIUrl: 'http://example.com/api',
            baseAPIHeaders: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
        });

        expect(result).toEqual(mockUserInformation);
        expect(mockGet).toHaveBeenCalledWith(
            expect.stringContaining(endpoints.USER_PATIENT_RESTRICTIONS_SEARCH_USER),
            expect.objectContaining({
                params: { identifier: '123456789012' },
            }),
        );
    });
});
