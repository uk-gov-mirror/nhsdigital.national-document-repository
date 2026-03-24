import { render, screen } from '@testing-library/react';
import UserPatientRestrictionsPage from './UserPatientRestrictionsPage';
import { afterEach, describe, expect, it, Mock, vi } from 'vitest';
import { routes } from '../../types/generic/routes';
import * as ReactRouter from 'react-router-dom';
import { createMemoryHistory, MemoryHistory } from 'history';
import usePatient from '../../helpers/hooks/usePatient';
import { buildPatientDetails } from '../../helpers/test/testBuilders';
import useUserPatientRestrictionsPage from './useUserPatientRestrictionsPage';

vi.mock('../../styles/right-chevron-circle.svg', () => ({
    ReactComponent: (): string => 'svg',
}));
vi.mock('../../helpers/hooks/useTitle');
vi.mock('../../helpers/hooks/useConfig');
vi.mock('../../helpers/hooks/usePatient');
vi.mock('./useUserPatientRestrictionsPage');

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});

const mockUsePatient = usePatient as Mock;
const mockNavigate = vi.fn();
const mockUseUserPatientRestrictionsPage = useUserPatientRestrictionsPage as Mock;

const renderPage = (): void => {
    const history: MemoryHistory = createMemoryHistory({
        initialEntries: ['/user-patient-restrictions'],
        initialIndex: 0,
    });

    render(
        <ReactRouter.Router location={history.location} navigator={history}>
            <ReactRouter.Routes>
                <ReactRouter.Route
                    path="/user-patient-restrictions/*"
                    element={<UserPatientRestrictionsPage />}
                />
            </ReactRouter.Routes>
        </ReactRouter.Router>,
    );
};

const pageHookResult = {
    isEnabled: true,
    subRoute: null,
    setSubRoute: (): void => {},
    restrictionToRemove: null,
    confirmVerifyPatientDetails: (): void => {},
    onRemoveRestriction: (): void => {},
};

describe('UserRestrictionsPage', () => {
    beforeEach(() => {
        mockUsePatient.mockReturnValue(buildPatientDetails());
        mockUseUserPatientRestrictionsPage.mockReturnValue(pageHookResult);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders user patient restrictions index stage, feature flag enabled', () => {
            mockUseUserPatientRestrictionsPage.mockReturnValueOnce({
                ...pageHookResult,
                isEnabled: true,
            });

            renderPage();

            expect(
                screen.getByRole('heading', {
                    name: 'Restrict staff from accessing patient records',
                }),
            ).toBeInTheDocument();
        });

        it('navigates to home when feature flag is disabled', () => {
            mockUseUserPatientRestrictionsPage.mockReturnValueOnce({
                ...pageHookResult,
                isEnabled: false,
            });

            renderPage();

            expect(mockNavigate).toHaveBeenCalledWith(routes.HOME, { replace: true });
        });
    });
});
