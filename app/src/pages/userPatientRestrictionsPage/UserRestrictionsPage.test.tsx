import { render, RenderResult, screen, waitFor } from '@testing-library/react';
import UserPatientRestrictionsPage from './UserPatientRestrictionsPage';
import { afterEach, describe, expect, it, Mock, vi } from 'vitest';
import { routes } from '../../types/generic/routes';
import useConfig from '../../helpers/hooks/useConfig';
import { defaultFeatureFlags } from '../../types/generic/featureFlags';
import * as ReactRouter from 'react-router-dom';
import { createMemoryHistory } from 'history';

vi.mock('../../helpers/hooks/useTitle');
vi.mock('../../styles/right-chevron-circle.svg', () => ({
    ReactComponent: (): string => 'svg',
}));
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});
vi.mock('../../helpers/hooks/useConfig');
const mockUseConfig = useConfig as Mock;
const mockNavigate = vi.fn();

const renderWithFlag = async (userRestrictionEnabled = true): Promise<RenderResult> => {
    mockUseConfig.mockReturnValue({
        featureFlags: { ...defaultFeatureFlags, userRestrictionEnabled },
    });

    const history = createMemoryHistory({
        initialEntries: ['/user-patient-restrictions'],
        initialIndex: 0,
    });

    return render(
        <ReactRouter.Router location={history.location} navigator={history}>
            <ReactRouter.Routes>
                <ReactRouter.Route
                    path="/user-patient-restrictions"
                    element={<UserPatientRestrictionsPage />}
                />
            </ReactRouter.Routes>
        </ReactRouter.Router>,
    );
};

describe('UserRestrictionsPage', (): void => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', (): void => {
        it('renders user patient restrictions index stage, feature flag enabled', (): void => {
            renderWithFlag();
            expect(
                screen.getByRole('heading', {
                    name: 'Restrict staff from accessing patient records',
                }),
            ).toBeInTheDocument();
        });

        it('does not render user patient restrictions index stage, feature flag disabled', (): void => {
            renderWithFlag(false);
            expect(
                screen.queryByRole('heading', {
                    name: 'Restrict staff from accessing patient records',
                }),
            ).not.toBeInTheDocument();
        });
    });

    describe('Navigation', (): void => {
        it('navigates to not found when feature flag is disabled', async (): Promise<void> => {
            renderWithFlag(false);
            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.HOME, { replace: true });
            });
        });
    });
});
