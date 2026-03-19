import { JSX, useEffect } from 'react';
import { routes } from '../../types/generic/routes';
import useConfig from '../../helpers/hooks/useConfig';
import { Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import UserPatientRestrictionsIndex from '../../components/blocks/_userPatientRestrictions/userPatientRestrictionsIndex/UserPatientRestrictionsIndex';

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
            </Routes>

            <Outlet />
        </>
    );
};

export default UserPatientRestrictionsPage;
