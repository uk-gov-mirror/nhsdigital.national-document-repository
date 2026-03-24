import { routeChildren, routes } from '../../types/generic/routes';
import { Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import UserPatientRestrictionsIndex from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsIndex/UserPatientRestrictionsIndex';
import { getLastURLPath } from '../../helpers/utils/urlManipulations';
import UserPatientRestrictionsListStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsListStage/UserPatientRestrictionsListStage';
import UserPatientRestrictionsViewStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsViewStage/UserPatientRestrictionsViewStage';
import UserPatientRestrictionsAddStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsAddStage/UserPatientRestrictionsAddStage';
import UserPatientRestrictionsRemoveConfirmStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsRemoveConfirmStage/UserPatientRestrictionsRemoveConfirmStage';
import UserPatientRestrictionsVerifyPatientStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsVerifyPatientStage/UserPatientRestrictionsVerifyPatientStage';
import UserPatientRestrictionsCompleteStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsCompleteStage/UserPatientRestrictionsCompleteStage';
import useUserPatientRestrictionsPage from './useUserPatientRestrictionsPage';
import { useEffect } from 'react';

const UserPatientRestrictionsPage = (): React.JSX.Element => {
    const {
        isEnabled,
        subRoute,
        setSubRoute,
        restrictionToRemove,
        confirmVerifyPatientDetails,
        onRemoveRestriction,
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
                <Route index element={<UserPatientRestrictionsIndex />} />

                <Route
                    path={getLastURLPath(routeChildren.USER_PATIENT_RESTRICTIONS_LIST)}
                    element={<UserPatientRestrictionsListStage setSubRoute={setSubRoute} />}
                />

                <Route
                    path={getLastURLPath(routeChildren.USER_PATIENT_RESTRICTIONS_VERIFY_PATIENT)}
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
                    path={getLastURLPath(routeChildren.USER_PATIENT_RESTRICTIONS_REMOVE_CONFIRM)}
                    element={
                        <UserPatientRestrictionsRemoveConfirmStage
                            restriction={restrictionToRemove!}
                        />
                    }
                />

                <Route
                    path={getLastURLPath(routeChildren.USER_PATIENT_RESTRICTIONS_REMOVE_COMPLETE)}
                    element={<UserPatientRestrictionsCompleteStage route={subRoute!} />}
                />

                <Route
                    path={getLastURLPath(routeChildren.USER_PATIENT_RESTRICTIONS_ADD)}
                    element={<UserPatientRestrictionsAddStage />}
                />
            </Routes>

            <Outlet />
        </>
    );
};

export default UserPatientRestrictionsPage;
