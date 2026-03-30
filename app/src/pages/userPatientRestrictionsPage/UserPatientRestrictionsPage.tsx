import { routeChildren, routes } from '../../types/generic/routes';
import { Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import UserPatientRestrictionsIndex from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsIndex/UserPatientRestrictionsIndex';
import { getLastURLPath } from '../../helpers/utils/urlManipulations';
import UserPatientRestrictionsListStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsListStage/UserPatientRestrictionsListStage';
import UserPatientRestrictionsViewStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsViewStage/UserPatientRestrictionsViewStage';
import UserPatientRestrictionsRemoveConfirmStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsRemoveConfirmStage/UserPatientRestrictionsRemoveConfirmStage';
import UserPatientRestrictionsVerifyPatientStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsVerifyPatientStage/UserPatientRestrictionsVerifyPatientStage';
import UserPatientRestrictionsCompleteStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsCompleteStage/UserPatientRestrictionsCompleteStage';
import useUserPatientRestrictionsPage from './useUserPatientRestrictionsPageHook';
import { useEffect } from 'react';
import UserPatientRestrictionsSearchPatientStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsSearchPatientStage/UserPatientRestrictionsSearchPatientStage';
import UserPatientRestrictionsExistingStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsExistingStage/UserPatientRestrictionsExistingStage';
import UserPatientRestrictionsSearchStaffStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsSearchStaffStage/UserPatientRestrictionsSearchStaffStage';
import UserPatientRestrictionsVerifyStaffStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsVerifyStaffStage/UserPatientRestrictionsVerifyStaffStage';
import UserPatientRestrictionsAddConfirmStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsAddConfirmStage/UserPatientRestrictionsAddConfirmStage';
import UserPatientRestrictionsAddCancelStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsAddCancelStage/UserPatientRestrictionsAddCancelStage';
import PatientGuard from '../../router/guards/patientGuard/PatientGuard';
import NotFoundPage from '../notFoundPage/NotFoundPage';

const UserPatientRestrictionsPage = (): React.JSX.Element => {
    const {
        isEnabled,
        subRoute,
        setSubRoute,
        restrictionToRemove,
        confirmVerifyPatientDetails,
        onRemoveRestriction,
        existingRestrictions,
        setExistingRestrictions,
        userInformation,
        setUserInformation,
        journeyState,
        setJourneyState,
    } = useUserPatientRestrictionsPage();

    const navigate = useNavigate();

    useEffect(() => {
        if (!isEnabled) {
            navigate(routes.HOME, { replace: true });
        }
    }, [isEnabled, navigate]);

    if (!isEnabled) {
        return <></>;
    }

    return (
        <>
            <Routes>
                {/* routes that don't need patient context */}
                <Route path="*" element={<NotFoundPage />} />
                <Route index element={<UserPatientRestrictionsIndex setSubRoute={setSubRoute} />} />

                <Route
                    path={getLastURLPath(routeChildren.USER_PATIENT_RESTRICTIONS_LIST)}
                    element={
                        <UserPatientRestrictionsListStage
                            setSubRoute={setSubRoute}
                            setJourneyState={setJourneyState}
                        />
                    }
                />

                <Route
                    path={getLastURLPath(routeChildren.USER_PATIENT_RESTRICTIONS_SEARCH_PATIENT)}
                    element={<UserPatientRestrictionsSearchPatientStage />}
                />
                {/* routes that don't need patient context */}

                {/* routes that need patient context */}
                <Route
                    element={
                        <PatientGuard navigationPath={routes.USER_PATIENT_RESTRICTIONS}>
                            <Outlet />
                        </PatientGuard>
                    }
                >
                    <Route
                        path={getLastURLPath(
                            routeChildren.USER_PATIENT_RESTRICTIONS_VERIFY_PATIENT,
                        )}
                        element={
                            <UserPatientRestrictionsVerifyPatientStage
                                confirmClicked={confirmVerifyPatientDetails}
                                route={subRoute!}
                            />
                        }
                    />

                    <Route
                        path={getLastURLPath(routeChildren.USER_PATIENT_RESTRICTIONS_VIEW)}
                        element={
                            <UserPatientRestrictionsViewStage
                                setSubRoute={setSubRoute}
                                onRemoveRestriction={onRemoveRestriction}
                            />
                        }
                    />

                    <Route
                        path={getLastURLPath(
                            routeChildren.USER_PATIENT_RESTRICTIONS_REMOVE_CONFIRM,
                        )}
                        element={
                            <UserPatientRestrictionsRemoveConfirmStage
                                restriction={restrictionToRemove!}
                                journeyState={journeyState}
                                setJourneyState={setJourneyState}
                            />
                        }
                    />

                    <Route
                        path={getLastURLPath(
                            routeChildren.USER_PATIENT_RESTRICTIONS_ACTION_COMPLETE,
                        )}
                        element={
                            <UserPatientRestrictionsCompleteStage
                                route={subRoute!}
                                journeyState={journeyState}
                            />
                        }
                    />

                    <Route
                        path={getLastURLPath(
                            routeChildren.USER_PATIENT_RESTRICTIONS_EXISTING_RESTRICTIONS,
                        )}
                        element={
                            <UserPatientRestrictionsExistingStage
                                existingRestrictions={existingRestrictions}
                                setExistingRestrictions={setExistingRestrictions}
                            />
                        }
                    />

                    <Route
                        path={getLastURLPath(routeChildren.USER_PATIENT_RESTRICTIONS_SEARCH_STAFF)}
                        element={
                            <UserPatientRestrictionsSearchStaffStage
                                existingRestrictions={existingRestrictions}
                                setUserInformation={setUserInformation}
                            />
                        }
                    />

                    <Route
                        path={getLastURLPath(routeChildren.USER_PATIENT_RESTRICTIONS_VERIFY_STAFF)}
                        element={
                            <UserPatientRestrictionsVerifyStaffStage
                                userInformation={userInformation!}
                                setJourneyState={setJourneyState}
                            />
                        }
                    />

                    <Route
                        path={getLastURLPath(routeChildren.USER_PATIENT_RESTRICTIONS_ADD_CONFIRM)}
                        element={
                            <UserPatientRestrictionsAddConfirmStage
                                userInformation={userInformation!}
                                journeyState={journeyState}
                                setJourneyState={setJourneyState}
                            />
                        }
                    />

                    <Route
                        path={getLastURLPath(routeChildren.USER_PATIENT_RESTRICTIONS_ADD_CANCEL)}
                        element={<UserPatientRestrictionsAddCancelStage />}
                    />
                </Route>
                {/* routes that need patient context */}
            </Routes>

            <Outlet />
        </>
    );
};

export default UserPatientRestrictionsPage;
