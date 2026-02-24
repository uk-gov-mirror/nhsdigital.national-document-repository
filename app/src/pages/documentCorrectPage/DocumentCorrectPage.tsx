import { Outlet, Route, Routes } from 'react-router-dom';
import DocumentSelectPagesStage from '../../components/blocks/_documentManagement/documentSelectPagesStage/DocumentSelectPagesStage';
import { routeChildren } from '../../types/generic/routes';
import { getLastURLPath } from '../../helpers/utils/urlManipulations';

const DocumentCorrectPage = (): React.JSX.Element => {
    return (
        <>
            <Routes>
                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_REASSIGN_SELECT_PAGES) + '/*'}
                    element={<DocumentSelectPagesStage />}
                />
            </Routes>

            <Outlet />
        </>
    );
};

export default DocumentCorrectPage;
