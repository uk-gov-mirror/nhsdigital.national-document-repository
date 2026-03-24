import { JSX, useEffect } from 'react';
import { routeChildren, routes } from '../../types/generic/routes';
import useConfig from '../../helpers/hooks/useConfig';
import { Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import UserPatientRestrictionsIndex from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsIndex/UserPatientRestrictionsIndex';
import { getLastURLPath } from '../../helpers/utils/urlManipulations';
import UserPatientRestrictionsListStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsListStage/UserPatientRestrictionsListStage';
import UserPatientRestrictionsViewStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsViewStage/UserPatientRestrictionsViewStage';
import UserPatientRestrictionsAddStage from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsAddStage/UserPatientRestrictionsAddStage';

const UserPatientRestrictionsPage = (): JSX.Element => {
    const config = useConfig();
    const navigate = useNavigate();

    useEffect(() => {
        if (!config.featureFlags.userRestrictionEnabled) {
            navigate(routes.HOME, { replace: true });
        }
    }, [config.featureFlags.userRestrictionEnabled, navigate]);

    if (!config.featureFlags.userRestrictionEnabled) {
        return <></>;
    }

    return (
        <>
            <Routes>
                <Route index element={<UserPatientRestrictionsIndex />} />

                <Route
                    path={getLastURLPath(routeChildren.USER_PATIENT_RESTRICTIONS_LIST)}
                    element={<UserPatientRestrictionsListStage />}
                />

                <Route
                    path={getLastURLPath(routeChildren.USER_PATIENT_RESTRICTIONS_VIEW)}
                    element={<UserPatientRestrictionsViewStage />}
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
