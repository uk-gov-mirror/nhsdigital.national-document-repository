import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, Mock, vi } from 'vitest';
import { routeChildren } from '../../types/generic/routes';
import useUserPatientRestrictionsPage from './useUserPatientRestrictionsPageHook';
import { UserPatientRestrictionsSubRoute } from '../../types/generic/userPatientRestriction';
import useConfig from '../../helpers/hooks/useConfig';
import { buildUserRestrictions } from '../../helpers/test/testBuilders';

vi.mock('../../helpers/hooks/useConfig');

const mockNavigate = vi.fn();
const mockUseConfig = useConfig as Mock;

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});

describe('useUserPatientRestrictionsPage', () => {
    beforeEach(() => {
        mockUseConfig.mockReturnValue({
            featureFlags: {
                userRestrictionEnabled: true,
            },
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('feature flag', () => {
        it('sets isEnabled to false when feature flag is disabled', () => {
            mockUseConfig.mockReturnValueOnce({
                featureFlags: {
                    userRestrictionEnabled: false,
                },
            });
            const { result } = renderHook(() => useUserPatientRestrictionsPage());

            expect(result.current.isEnabled).toBe(false);
        });

        it('sets isEnabled to true when feature flag is enabled', () => {
            const { result } = renderHook(() => useUserPatientRestrictionsPage());

            expect(result.current.isEnabled).toBe(true);
        });
    });

    describe('confirmVerifyPatientDetails', () => {
        it('navigates to view page when subRoute is VIEW', async () => {
            const { result, rerender } = renderHook(() => useUserPatientRestrictionsPage());

            result.current.setSubRoute(UserPatientRestrictionsSubRoute.VIEW);

            rerender();

            result.current.confirmVerifyPatientDetails();

            expect(mockNavigate).toHaveBeenCalledWith(routeChildren.USER_PATIENT_RESTRICTIONS_VIEW);
        });

        it('navigates to existing restrictions page when subRoute is ADD', async () => {
            const { result, rerender } = renderHook(() => useUserPatientRestrictionsPage());

            result.current.setSubRoute(UserPatientRestrictionsSubRoute.ADD);

            rerender();

            result.current.confirmVerifyPatientDetails();

            expect(mockNavigate).toHaveBeenCalledWith(
                routeChildren.USER_PATIENT_RESTRICTIONS_EXISTING_RESTRICTIONS,
            );
        });

        it('does not navigate when subRoute is not VIEW or ADD', async () => {
            const { result, rerender } = renderHook(() => useUserPatientRestrictionsPage());

            result.current.setSubRoute(UserPatientRestrictionsSubRoute.REMOVE);

            rerender();

            result.current.confirmVerifyPatientDetails();

            expect(mockNavigate).not.toHaveBeenCalled();
        });
    });

    describe('onRemoveRestriction', () => {
        it('sets the restriction to remove and navigates to remove confirm', async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            const { result, rerender } = renderHook(() => useUserPatientRestrictionsPage());

            result.current.onRemoveRestriction(buildUserRestrictions()[0]);

            rerender();

            expect(result.current.restrictionToRemove).toEqual(buildUserRestrictions()[0]);
            expect(result.current.subRoute).toBe(UserPatientRestrictionsSubRoute.REMOVE);

            vi.advanceTimersByTime(10);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    routeChildren.USER_PATIENT_RESTRICTIONS_REMOVE_CONFIRM,
                );
            });

            vi.useRealTimers();
        });
    });
});
