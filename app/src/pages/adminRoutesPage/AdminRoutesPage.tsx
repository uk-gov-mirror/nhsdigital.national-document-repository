import { JSX } from 'react';
import { Routes, Route } from 'react-router';
import { AdminPage } from '../adminPage/AdminPage';
import { routeChildren } from '../../types/generic/routes';
import { getLastURLPath } from '../../helpers/utils/urlManipulations';

export const AdminRoutesPage = (): JSX.Element => {
    return (
        <Routes>
            <Route path={getLastURLPath(routeChildren.ADMIN_REVIEW)} element={<></>} />
            <Route path="*" element={<AdminPage />} />
        </Routes>
    );
};
