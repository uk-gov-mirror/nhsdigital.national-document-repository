import { JSX } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { ReviewsPage } from '../../components/blocks/_admin/reviewsPage/ReviewsPage';
import useConfig from '../../helpers/hooks/useConfig';
import { getLastURLPath } from '../../helpers/utils/urlManipulations';
import { routeChildren, routes } from '../../types/generic/routes';
import { AdminPage } from '../adminPage/AdminPage';

export const AdminRoutesPage = (): JSX.Element => {
    const config = useConfig();
    const navigate = useNavigate();

    if (!config.featureFlags?.uploadDocumentIteration3Enabled) {
        navigate(routes.HOME);
        return <></>;
    }

    return (
        <Routes>
            <Route path={getLastURLPath(routeChildren.ADMIN_REVIEW)} element={<ReviewsPage />} />
            <Route path="*" element={<AdminPage />} />
        </Routes>
    );
};

export default AdminRoutesPage;
