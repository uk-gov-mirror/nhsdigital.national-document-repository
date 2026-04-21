import { render, screen } from '@testing-library/react';
import UserPatientRestrictionsPage from './UserPatientRestrictionsPage';
import { afterEach, describe, expect, it, Mock, vi } from 'vitest';
import { routeChildren } from '../../types/generic/routes';
import * as ReactRouter from 'react-router-dom';
import { createMemoryHistory, MemoryHistory } from 'history';
import usePatient from '../../helpers/hooks/usePatient';
import { buildPatientDetails } from '../../helpers/test/testBuilders';
import useUserPatientRestrictionsPage, {
    UserPatientRestrictionsJourneyState,
    UseUserPatientRestrictionsPageReturn,
} from './useUserPatientRestrictionsPageHook';
import { UserPatientRestrictionsSubRoute } from '../../types/generic/userPatientRestriction';

vi.mock('../../styles/right-chevron-circle.svg', () => ({
    ReactComponent: (): string => 'svg',
}));
vi.mock('../../helpers/hooks/useTitle');
vi.mock('../../helpers/hooks/usePatient');
vi.mock('./useUserPatientRestrictionsPageHook');

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        useLocation: (): Mock => mockLocation as Mock,
    };
});

const mockUsePatient = usePatient as Mock;
const mockNavigate = vi.fn();
let mockLocation = {};
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

const pageHookResult: UseUserPatientRestrictionsPageReturn = {
    subRoute: null,
    setSubRoute: (): void => {},
    restrictionToRemove: null,
    confirmVerifyPatientDetails: (): void => {},
    onRemoveRestriction: (): void => {},
    setExistingRestrictions: (): void => {},
    existingRestrictions: [],
    setUserInformation: (): void => {},
    userInformation: null,
    journeyState: UserPatientRestrictionsJourneyState.INITIAL,
    setJourneyState: (): void => {},
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
        it('renders user patient restrictions index stage', () => {
            renderPage();

            expect(
                screen.getByRole('heading', {
                    name: 'Restrict staff from accessing patient records',
                }),
            ).toBeInTheDocument();
        });
    });

    describe('invalid state handling', () => {
        it('sets sub route to add when on search patient route and sub route is null', () => {
            const setSubRouteMock = vi.fn();
            mockUseUserPatientRestrictionsPage.mockReturnValueOnce({
                ...pageHookResult,
                subRoute: null,
                setSubRoute: setSubRouteMock,
            });

            mockLocation = {
                pathname: routeChildren.USER_PATIENT_RESTRICTIONS_SEARCH_PATIENT,
            };

            renderPage();

            expect(setSubRouteMock).toHaveBeenCalledWith(UserPatientRestrictionsSubRoute.ADD);
        });

        it('sets sub route to add when on search staff route and sub route is null', () => {
            const setSubRouteMock = vi.fn();
            mockUseUserPatientRestrictionsPage.mockReturnValueOnce({
                ...pageHookResult,
                subRoute: null,
                setSubRoute: setSubRouteMock,
            });

            mockLocation = {
                pathname: routeChildren.USER_PATIENT_RESTRICTIONS_SEARCH_STAFF,
            };

            renderPage();

            expect(setSubRouteMock).toHaveBeenCalledWith(UserPatientRestrictionsSubRoute.ADD);
        });
    });
});
