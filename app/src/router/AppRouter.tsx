import { BrowserRouter as Router, Outlet, Route, Routes as Switch } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { route, ROUTE_TYPE, routeChildren, routes } from '../types/generic/routes';
import StartPage from '../pages/startPage/StartPage';
import AuthCallbackPage from '../pages/authCallbackPage/AuthCallbackPage';
import NotFoundPage from '../pages/notFoundPage/NotFoundPage';
import AuthErrorPage from '../pages/authErrorPage/AuthErrorPage';
import UnauthorisedPage from '../pages/unauthorisedPage/UnauthorisedPage';
import LogoutPage from '../pages/logoutPage/LogoutPage';
import PatientSearchPage from '../pages/patientSearchPage/PatientSearchPage';
import PatientResultPage from '../pages/patientResultPage/PatientResultPage';
import PatientDocumentSearchResultsPage from '../pages/documentSearchResultsPage/DocumentSearchResultsPage';
import LloydGeorgeRecordPage from '../pages/lloydGeorgeRecordPage/LloydGeorgeRecordPage';
import AuthGuard from './guards/authGuard/AuthGuard';
import PatientGuard from './guards/patientGuard/PatientGuard';
import { REPOSITORY_ROLE } from '../types/generic/authRole';
import RoleGuard from './guards/roleGuard/RoleGuard';
import HomePage from '../pages/homePage/HomePage';
import UnauthorisedLoginPage from '../pages/unauthorisedLoginPage/UnauthorisedLoginPage';
import FeedbackPage from '../pages/feedbackPage/FeedbackPage';
import ServerErrorPage from '../pages/serverErrorPage/ServerErrorPage';
import PrivacyPage from '../pages/privacyPage/PrivacyPage';
import SessionExpiredErrorPage from '../pages/sessionExpiredErrorPage/SessionExpiredErrorPage';
import FeedbackConfirmationPage from '../pages/feedbackConfirmationPage/FeedbackConfirmationPage';
import ReportDownloadPage from '../pages/reportDownloadPage/ReportDownloadPage';
import NonAuthGuard from './guards/notAuthGuard/NonAuthGuard';
import PatientAccessAuditPage from '../pages/patientAccessAuditPage/PatientAccessAuditPage';
import MockLoginPage from '../pages/mockLoginPage/MockLoginPage';
import DocumentUploadPage from '../pages/documentUploadPage/DocumentUploadPage';
import ReviewsPage from '../pages/ReviewsPage/ReviewsPage';
import DownloadCompletePage from '../pages/downloadCompletePage/DownloadCompletePage';
import CookiePolicyPage from '../pages/cookiePolicyPage/CookiePolicyPage';
import DocumentCorrectPage from '../pages/documentCorrectPage/DocumentCorrectPage';
import { AdminPage } from '../pages/adminPage/AdminPage';
import UserPatientRestrictionsPage from '../pages/userPatientRestrictionsPage/UserPatientRestrictionsPage';
import DocumentVersionRestorePage from '../pages/documentVersionPage/DocumentVersionRestorePage';
import GenericErrorPage from '../pages/genericErrorPage/GenericErrorPage';

const {
    START,
    HOME,
    AUTH_CALLBACK,
    NOT_FOUND,
    UNAUTHORISED,
    UNAUTHORISED_LOGIN,
    AUTH_ERROR,
    SERVER_ERROR,
    GENERIC_ERROR,
    SESSION_EXPIRED,
    FEEDBACK,
    FEEDBACK_CONFIRMATION,
    LOGOUT,
    SEARCH_PATIENT,
    VERIFY_PATIENT,
    PRIVACY_POLICY,
    LLOYD_GEORGE,
    LLOYD_GEORGE_WILDCARD,
    PATIENT_DOCUMENTS,
    PATIENT_DOCUMENTS_WILDCARD,
    REPORT_DOWNLOAD,
    REPORT_DOWNLOAD_WILDCARD,
    PATIENT_ACCESS_AUDIT,
    PATIENT_ACCESS_AUDIT_WILDCARD,
    MOCK_LOGIN,
    DOCUMENT_UPLOAD,
    DOCUMENT_UPLOAD_WILDCARD,
    ADMIN_ROUTE,
    REVIEWS,
    REVIEWS_WILDCARD,
    DOWNLOAD_COMPLETE,
    COOKIES_POLICY,
    COOKIES_POLICY_WILDCARD,
    DOCUMENT_VERSION_HISTORY,
    DOCUMENT_VERSION_HISTORY_WILDCARD,
    DOCUMENT_REASSIGN_PAGES,
    DOCUMENT_REASSIGN_PAGES_WILDCARD,
    USER_PATIENT_RESTRICTIONS,
    USER_PATIENT_RESTRICTIONS_WILDCARD,
} = routes;

type Routes = {
    [key in routes]: route;
};

export const childRoutes = [
    {
        route: routeChildren.LLOYD_GEORGE_DOWNLOAD,
        parent: LLOYD_GEORGE,
    },
    {
        route: routeChildren.LLOYD_GEORGE_DOWNLOAD_SELECT,
        parent: LLOYD_GEORGE,
    },
    {
        route: routeChildren.LLOYD_GEORGE_DOWNLOAD_COMPLETE,
        parent: LLOYD_GEORGE,
    },
    {
        route: routeChildren.LLOYD_GEORGE_DOWNLOAD_IN_PROGRESS,
        parent: LLOYD_GEORGE,
    },
    {
        route: routeChildren.LLOYD_GEORGE_DELETE,
        parent: LLOYD_GEORGE,
    },
    {
        route: routeChildren.LLOYD_GEORGE_DELETE_CONFIRMATION,
        parent: LLOYD_GEORGE,
    },
    {
        route: routeChildren.LLOYD_GEORGE_DELETE_COMPLETE,
        parent: LLOYD_GEORGE,
    },
    {
        route: routeChildren.DOCUMENT_VIEW,
        parent: PATIENT_DOCUMENTS,
    },
    {
        route: routeChildren.DOCUMENT_DELETE,
        parent: PATIENT_DOCUMENTS,
    },
    {
        route: routeChildren.DOCUMENT_DELETE_CONFIRMATION,
        parent: PATIENT_DOCUMENTS,
    },
    {
        route: routeChildren.DOCUMENT_DELETE_COMPLETE,
        parent: PATIENT_DOCUMENTS,
    },
    {
        route: routeChildren.DOCUMENT_VERSION_RESTORE_CONFIRM,
        parent: DOCUMENT_VERSION_HISTORY,
    },
    {
        route: routeChildren.DOCUMENT_VERSION_RESTORE_UPLOADING,
        parent: DOCUMENT_VERSION_HISTORY,
    },
    {
        route: routeChildren.DOCUMENT_VERSION_RESTORE_COMPLETE,
        parent: DOCUMENT_VERSION_HISTORY,
    },
    {
        route: routeChildren.REPORT_DOWNLOAD_COMPLETE,
        parent: REPORT_DOWNLOAD,
    },
    {
        route: routeChildren.PATIENT_ACCESS_AUDIT_DECEASED,
        parent: PATIENT_ACCESS_AUDIT,
    },
    {
        route: routeChildren.DOCUMENT_UPLOAD_SELECT_FILES,
        parent: DOCUMENT_UPLOAD,
    },
    {
        route: routeChildren.DOCUMENT_UPLOAD_SELECT_ORDER,
        parent: DOCUMENT_UPLOAD,
    },
    {
        route: routeChildren.DOCUMENT_UPLOAD_REMOVE_ALL,
        parent: DOCUMENT_UPLOAD,
    },
    {
        route: routeChildren.DOCUMENT_UPLOAD_CONFIRMATION,
        parent: DOCUMENT_UPLOAD,
    },
    {
        route: routeChildren.DOCUMENT_UPLOAD_UPLOADING,
        parent: DOCUMENT_UPLOAD,
    },
    {
        route: routeChildren.DOCUMENT_UPLOAD_COMPLETED,
        parent: DOCUMENT_UPLOAD,
    },
    {
        route: routeChildren.DOCUMENT_UPLOAD_INFECTED,
        parent: DOCUMENT_UPLOAD,
    },
    {
        route: routeChildren.DOCUMENT_UPLOAD_FILE_ERRORS,
        parent: DOCUMENT_UPLOAD,
    },
    {
        route: routeChildren.REVIEW_DETAIL,
        parent: REVIEWS,
    },
    {
        route: routeChildren.REVIEW_SEARCH_PATIENT,
        parent: REVIEWS,
    },
    {
        route: routeChildren.REVIEW_ASSESS_FILES,
        parent: REVIEWS,
    },
    {
        route: routeChildren.REVIEW_COMPLETE,
        parent: REVIEWS,
    },
    {
        route: routeChildren.REVIEW_COMPLETE_PATIENT_MATCH,
        parent: REVIEWS,
    },
    {
        route: routeChildren.REVIEW_DONT_KNOW_NHS_NUMBER,
        parent: REVIEWS,
    },
    {
        route: routeChildren.REVIEW_DONT_KNOW_NHS_NUMBER_PATIENT_VERIFY,
        parent: REVIEWS,
    },
    {
        route: routeChildren.REVIEW_COMPLETE_PATIENT_UNKNOWN,
        parent: REVIEWS,
    },
    {
        route: routeChildren.REVIEW_COMPLETE_NO_FILES_CHOICE,
        parent: REVIEWS,
    },
    {
        route: routeChildren.REVIEW_NO_FILES_CHOICE,
        parent: REVIEWS,
    },
    {
        route: routeChildren.REVIEW_ADD_MORE_CHOICE,
        parent: REVIEWS,
    },
    {
        route: routeChildren.REVIEW_CHOOSE_WHICH_FILES,
        parent: REVIEWS,
    },
    {
        route: routeChildren.REVIEW_DOWNLOAD_CHOICE,
        parent: REVIEWS,
    },
    {
        route: routeChildren.REVIEW_UPLOAD_ADDITIONAL_FILES,
        parent: REVIEWS,
    },
    {
        route: routeChildren.REVIEW_REMOVE_ALL,
        parent: REVIEWS,
    },
    {
        route: routeChildren.REVIEW_UPLOAD_FILE_ORDER,
        parent: REVIEWS,
    },
    {
        route: routeChildren.REVIEW_UPLOAD,
        parent: REVIEWS,
    },
    {
        route: routeChildren.REVIEW_FILE_ERRORS,
        parent: REVIEWS,
    },
    {
        route: routeChildren.COOKIES_POLICY_UPDATED,
        parent: COOKIES_POLICY,
    },
    {
        route: routeChildren.DOCUMENT_REASSIGN_SELECT_PAGES,
        parent: DOCUMENT_REASSIGN_PAGES,
    },
    {
        route: routeChildren.DOCUMENT_REASSIGN_CONFIRM_REMOVED_PAGES,
        parent: DOCUMENT_REASSIGN_PAGES,
    },
    {
        route: routeChildren.DOCUMENT_REASSIGN_SEARCH_PATIENT,
        parent: DOCUMENT_REASSIGN_PAGES,
    },
    {
        route: routeChildren.DOCUMENT_REASSIGN_VERIFY_PATIENT_DETAILS,
        parent: DOCUMENT_REASSIGN_PAGES,
    },
    {
        route: routeChildren.DOCUMENT_REASSIGN_UPLOADING,
        parent: DOCUMENT_REASSIGN_PAGES,
    },
    {
        route: routeChildren.DOCUMENT_REASSIGN_COMPLETE,
        parent: DOCUMENT_REASSIGN_PAGES,
    },
    {
        route: routeChildren.USER_PATIENT_RESTRICTIONS_LIST,
        parent: USER_PATIENT_RESTRICTIONS,
    },
    {
        route: routeChildren.USER_PATIENT_RESTRICTIONS_VERIFY_PATIENT,
        parent: USER_PATIENT_RESTRICTIONS,
    },
    {
        route: routeChildren.USER_PATIENT_RESTRICTIONS_VIEW,
        parent: USER_PATIENT_RESTRICTIONS,
    },
    {
        route: routeChildren.USER_PATIENT_RESTRICTIONS_REMOVE_CONFIRM,
        parent: USER_PATIENT_RESTRICTIONS,
    },
    {
        route: routeChildren.USER_PATIENT_RESTRICTIONS_ACTION_COMPLETE,
        parent: USER_PATIENT_RESTRICTIONS,
    },
    {
        route: routeChildren.USER_PATIENT_RESTRICTIONS_SEARCH_PATIENT,
        parent: USER_PATIENT_RESTRICTIONS,
    },
    {
        route: routeChildren.USER_PATIENT_RESTRICTIONS_EXISTING_RESTRICTIONS,
        parent: USER_PATIENT_RESTRICTIONS,
    },
    {
        route: routeChildren.USER_PATIENT_RESTRICTIONS_SEARCH_STAFF,
        parent: USER_PATIENT_RESTRICTIONS,
    },
    {
        route: routeChildren.USER_PATIENT_RESTRICTIONS_VERIFY_STAFF,
        parent: USER_PATIENT_RESTRICTIONS,
    },
    {
        route: routeChildren.USER_PATIENT_RESTRICTIONS_ADD_CONFIRM,
        parent: USER_PATIENT_RESTRICTIONS,
    },
];

export const routeMap: Routes = {
    // Public routes
    [START]: {
        page:
            import.meta.env.VITE_ENVIRONMENT === 'development' ? (
                <NonAuthGuard redirectRoute={routes.HOME}>
                    <StartPage />
                </NonAuthGuard>
            ) : (
                <StartPage />
            ),
        type: ROUTE_TYPE.PUBLIC,
    },
    [AUTH_CALLBACK]: {
        page: <AuthCallbackPage />,
        type: ROUTE_TYPE.PUBLIC,
    },
    [NOT_FOUND]: {
        page: <NotFoundPage />,
        type: ROUTE_TYPE.PUBLIC,
    },
    [AUTH_ERROR]: {
        page: <AuthErrorPage />,
        type: ROUTE_TYPE.PUBLIC,
    },
    [UNAUTHORISED]: {
        page: <UnauthorisedPage />,
        type: ROUTE_TYPE.PUBLIC,
    },
    [UNAUTHORISED_LOGIN]: {
        page: <UnauthorisedLoginPage />,
        type: ROUTE_TYPE.PUBLIC,
    },
    [SERVER_ERROR]: {
        page: <ServerErrorPage />,
        type: ROUTE_TYPE.PUBLIC,
    },
    [GENERIC_ERROR]: {
        page: <GenericErrorPage />,
        type: ROUTE_TYPE.PUBLIC,
    },
    [SESSION_EXPIRED]: {
        page: <SessionExpiredErrorPage />,
        type: ROUTE_TYPE.PUBLIC,
    },
    [PRIVACY_POLICY]: {
        page: <PrivacyPage />,
        type: ROUTE_TYPE.PUBLIC,
    },
    [MOCK_LOGIN]: {
        page: <MockLoginPage />,
        type: ROUTE_TYPE.PUBLIC,
    },

    // Auth guard routes
    [LOGOUT]: {
        page: <LogoutPage />,
        type: ROUTE_TYPE.PRIVATE,
    },
    [HOME]: {
        page: <HomePage />,
        type: ROUTE_TYPE.PRIVATE,
    },
    [SEARCH_PATIENT]: {
        page: <PatientSearchPage />,
        type: ROUTE_TYPE.PRIVATE,
    },
    [FEEDBACK]: {
        page: <FeedbackPage />,
        type: ROUTE_TYPE.PRIVATE,
    },
    [FEEDBACK_CONFIRMATION]: {
        page: <FeedbackConfirmationPage />,
        type: ROUTE_TYPE.PRIVATE,
    },
    [REPORT_DOWNLOAD]: {
        page: <ReportDownloadPage />,
        type: ROUTE_TYPE.PRIVATE,
    },
    [REPORT_DOWNLOAD_WILDCARD]: {
        page: <ReportDownloadPage />,
        type: ROUTE_TYPE.PRIVATE,
    },
    [ADMIN_ROUTE]: {
        page: <AdminPage />,
        type: ROUTE_TYPE.PRIVATE,
    },
    [REVIEWS]: {
        page: <ReviewsPage />,
        type: ROUTE_TYPE.PRIVATE,
    },
    [REVIEWS_WILDCARD]: {
        page: <ReviewsPage />,
        type: ROUTE_TYPE.PRIVATE,
    },

    // Patient guard routes
    [VERIFY_PATIENT]: {
        page: <PatientResultPage />,
        type: ROUTE_TYPE.PATIENT,
    },
    [LLOYD_GEORGE]: {
        page: <LloydGeorgeRecordPage />,
        type: ROUTE_TYPE.PATIENT,
        unauthorized: [REPOSITORY_ROLE.PCSE],
    },
    [LLOYD_GEORGE_WILDCARD]: {
        page: <LloydGeorgeRecordPage />,
        type: ROUTE_TYPE.PATIENT,
        unauthorized: [REPOSITORY_ROLE.PCSE],
    },
    [PATIENT_DOCUMENTS]: {
        page: <PatientDocumentSearchResultsPage />,
        type: ROUTE_TYPE.PATIENT,
    },
    [PATIENT_DOCUMENTS_WILDCARD]: {
        page: <PatientDocumentSearchResultsPage />,
        type: ROUTE_TYPE.PATIENT,
    },
    [PATIENT_ACCESS_AUDIT]: {
        page: <PatientAccessAuditPage />,
        type: ROUTE_TYPE.PATIENT,
    },
    [PATIENT_ACCESS_AUDIT_WILDCARD]: {
        page: <PatientAccessAuditPage />,
        type: ROUTE_TYPE.PATIENT,
    },
    [DOCUMENT_VERSION_HISTORY]: {
        page: <DocumentVersionRestorePage />,
        type: ROUTE_TYPE.PATIENT,
    },
    [DOCUMENT_VERSION_HISTORY_WILDCARD]: {
        page: <DocumentVersionRestorePage />,
        type: ROUTE_TYPE.PATIENT,
    },
    [DOCUMENT_UPLOAD]: {
        page: <DocumentUploadPage />,
        type: ROUTE_TYPE.PATIENT,
    },
    [DOCUMENT_UPLOAD_WILDCARD]: {
        page: <DocumentUploadPage />,
        type: ROUTE_TYPE.PATIENT,
    },
    [DOWNLOAD_COMPLETE]: {
        page: <DownloadCompletePage />,
        type: ROUTE_TYPE.PATIENT,
    },
    [COOKIES_POLICY]: {
        page: <CookiePolicyPage />,
        type: ROUTE_TYPE.PUBLIC,
    },
    [COOKIES_POLICY_WILDCARD]: {
        page: <CookiePolicyPage />,
        type: ROUTE_TYPE.PUBLIC,
    },
    [DOCUMENT_REASSIGN_PAGES]: {
        page: <DocumentCorrectPage />,
        type: ROUTE_TYPE.PATIENT,
    },
    [DOCUMENT_REASSIGN_PAGES_WILDCARD]: {
        page: <DocumentCorrectPage />,
        type: ROUTE_TYPE.PATIENT,
    },
    [USER_PATIENT_RESTRICTIONS]: {
        page: <UserPatientRestrictionsPage />,
        type: ROUTE_TYPE.PRIVATE,
    },
    [USER_PATIENT_RESTRICTIONS_WILDCARD]: {
        page: <UserPatientRestrictionsPage />,
        type: ROUTE_TYPE.PRIVATE,
    },
};

const createRoutesFromType = (routeType: ROUTE_TYPE): Array<React.JSX.Element> =>
    Object.entries(routeMap).reduce(
        (acc, [path, route]) =>
            route.type === routeType
                ? [...acc, <Route key={path} path={path} element={route.page} />]
                : acc,
        [] as Array<React.JSX.Element>,
    );

const AppRoutes = (): React.JSX.Element => {
    const publicRoutes = createRoutesFromType(ROUTE_TYPE.PUBLIC);
    const privateRoutes = createRoutesFromType(ROUTE_TYPE.PRIVATE);
    const patientRoutes = createRoutesFromType(ROUTE_TYPE.PATIENT);

    return (
        <Switch>
            {publicRoutes}
            <Route
                element={
                    <RoleGuard>
                        <AuthGuard>
                            <Outlet />
                        </AuthGuard>
                    </RoleGuard>
                }
            >
                {privateRoutes}
                <Route
                    element={
                        <PatientGuard>
                            <Outlet />
                        </PatientGuard>
                    }
                >
                    {patientRoutes}
                </Route>
            </Route>
        </Switch>
    );
};

const AppRouter = (): React.JSX.Element => {
    return (
        <Router>
            <Layout>
                <AppRoutes />
            </Layout>
        </Router>
    );
};

export default AppRouter;
