import { Mock } from 'vitest';
import { decodeJwtToken } from '../utils/jwtDecoder';
import { renderHook } from '@testing-library/react';
import useSmartcardNumber from './useSmartcardNumber';
import { SessionContext } from '../../providers/sessionProvider/SessionProvider';
import { REPOSITORY_ROLE } from '../../types/generic/authRole';

vi.mock('../utils/jwtDecoder');
vi.mock('../../providers/sessionProvider/SessionProvider', () => ({
    useSessionContext: (): SessionContext => [
        {
            auth: {
                authorisation_token: 'test-token',
                role: REPOSITORY_ROLE.GP_ADMIN,
            },
            isLoggedIn: false,
        },
        (): void => {},
    ],
}));

const mockDecodeJwtToken = decodeJwtToken as Mock;

describe('useSmartcardNumber', () => {
    it('returns the NHS user ID from the decoded JWT token', () => {
        mockDecodeJwtToken.mockReturnValueOnce({ nhs_user_id: 'test-user-id' });

        const { result } = renderHook(() => useSmartcardNumber());

        expect(result.current).toBe('test-user-id');
    });

    it('returns null if the token cannot be decoded', () => {
        mockDecodeJwtToken.mockReturnValueOnce(null);

        const { result } = renderHook(() => useSmartcardNumber());

        expect(result.current).toBeNull();
    });
});
