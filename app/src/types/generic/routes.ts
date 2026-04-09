import { To } from 'react-router-dom';
import { REPOSITORY_ROLE } from './authRole';

export enum routes {
    START = '/',
    HOME = '/home',
    AUTH_CALLBACK = '/auth-callback',
    NOT_FOUND = '/*',
    UNAUTHORISED = '/unauthorised',
    AUTH_ERROR = '/auth-error',
    UNAUTHORISED_LOGIN = '/unauthorised-login',
    SERVER_ERROR = '/server-error',
    GENERIC_ERROR = '/error',
    SESSION_EXPIRED = '/session-expired',
    PRIVACY_POLICY = '/privacy-policy',
    LOGOUT = '/logout',
    FEEDBACK = '/feedback',
    SEARCH_PATIENT = '/patient/search',
    VERIFY_PATIENT = '/patient/verify',
    LLOYD_GEORGE = '/patient/lloyd-george-record',
    LLOYD_GEORGE_WILDCARD = '/patient/lloyd-george-record/*',
    PATIENT_DOCUMENTS = '/patient/documents',
    PATIENT_DOCUMENTS_WILDCARD = '/patient/documents/*',
    FEEDBACK_CONFIRMATION = '/feedback/confirmation',
    REPORT_DOWNLOAD = '/create-report',
    REPORT_DOWNLOAD_WILDCARD = '/create-report/*',
    PATIENT_ACCESS_AUDIT = '/patient/access-audit',
    PATIENT_ACCESS_AUDIT_WILDCARD = '/patient/access-audit/*',
    DOCUMENT_UPLOAD = '/patient/document-upload',
    DOCUMENT_UPLOAD_WILDCARD = '/patient/document-upload/*',
    DOCUMENT_REASSIGN_PAGES = '/patient/document-reassign-pages',
    DOCUMENT_REASSIGN_PAGES_WILDCARD = '/patient/document-reassign-pages/*',

    DOCUMENT_VERSION_HISTORY = '/patient/documents/version-history',
    DOCUMENT_VERSION_HISTORY_WILDCARD = '/patient/documents/version-history/*',

    MOCK_LOGIN = 'Auth/MockLogin',

    ADMIN_ROUTE = '/admin',

    REVIEWS = '/reviews',
    REVIEWS_WILDCARD = '/reviews/*',

    DOWNLOAD_COMPLETE = '/download-complete',

    COOKIES_POLICY = '/cookies-policy',
    COOKIES_POLICY_WILDCARD = '/cookies-policy/*',

    USER_PATIENT_RESTRICTIONS = '/user-patient-restrictions',
    USER_PATIENT_RESTRICTIONS_WILDCARD = '/user-patient-restrictions/*',
}

export enum routeChildren {
    LLOYD_GEORGE_DOWNLOAD = '/patient/lloyd-george-record/download',
    LLOYD_GEORGE_DOWNLOAD_SELECT = '/patient/lloyd-george-record/download/select',
    LLOYD_GEORGE_DOWNLOAD_IN_PROGRESS = '/patient/lloyd-george-record/download/in-progress',
    LLOYD_GEORGE_DOWNLOAD_COMPLETE = '/patient/lloyd-george-record/download/complete',
    LLOYD_GEORGE_DELETE = '/patient/lloyd-george-record/delete',
    LLOYD_GEORGE_DELETE_CONFIRMATION = '/patient/lloyd-george-record/delete/confirmation',
    LLOYD_GEORGE_DELETE_COMPLETE = '/patient/lloyd-george-record/delete/complete',
    REPORT_DOWNLOAD_COMPLETE = '/create-report/complete',
    PATIENT_ACCESS_AUDIT_DECEASED = '/patient/access-audit/deceased',

    DOCUMENT_UPLOAD_SELECT_FILES = '/patient/document-upload/select-files',
    DOCUMENT_UPLOAD_SELECT_ORDER = '/patient/document-upload/select-order',
    DOCUMENT_UPLOAD_REMOVE_ALL = '/patient/document-upload/remove-all',
    DOCUMENT_UPLOAD_CONFIRMATION = '/patient/document-upload/confirmation',
    DOCUMENT_UPLOAD_UPLOADING = '/patient/document-upload/in-progress',
    DOCUMENT_UPLOAD_COMPLETED = '/patient/document-upload/completed',
    DOCUMENT_UPLOAD_INFECTED = '/patient/document-upload/infected',
    DOCUMENT_UPLOAD_FILE_ERRORS = '/patient/document-upload/file-errors',

    DOCUMENT_REASSIGN_SELECT_PAGES = '/patient/document-reassign-pages/select-pages',
    DOCUMENT_REASSIGN_CONFIRM_REMOVED_PAGES = '/patient/document-reassign-pages/confirm-removed-pages',
    DOCUMENT_REASSIGN_SEARCH_PATIENT = '/patient/document-reassign-pages/search-patient',
    DOCUMENT_REASSIGN_VERIFY_PATIENT_DETAILS = '/patient/document-reassign-pages/verify-patient',
    DOCUMENT_REASSIGN_DOWNLOAD_PAGES = '/patient/document-reassign-pages/download-pages',
    DOCUMENT_REASSIGN_DOWNLOAD_PAGES_CHECK = '/patient/document-reassign-pages/check-download',
    DOCUMENT_REASSIGN_UPLOADING = '/patient/document-reassign-pages/uploading',
    DOCUMENT_REASSIGN_COMPLETE = '/patient/document-reassign-pages/complete',

    DOCUMENT_VERSION_HISTORY = '/patient/documents/version-history',
    DOCUMENT_VIEW_VERSION_HISTORY = '/patient/documents/version-history/view',
    DOCUMENT_VERSION_RESTORE_CONFIRM = '/patient/documents/version-history/restore-confirm',
    DOCUMENT_VERSION_RESTORE_UPLOADING = '/patient/documents/version-history/restore-uploading',
    DOCUMENT_VERSION_RESTORE_COMPLETE = '/patient/documents/version-history/restore-complete',

    DOCUMENT_VIEW = '/patient/documents/view',
    DOCUMENT_DELETE = '/patient/documents/delete',
    DOCUMENT_DELETE_CONFIRMATION = '/patient/documents/delete/confirmation',
    DOCUMENT_DELETE_COMPLETE = '/patient/documents/delete/complete',

    REVIEW_DETAIL = '/reviews/:reviewId/detail',
    REVIEW_SEARCH_PATIENT = '/reviews/:reviewId/search-patient',
    REVIEW_ASSESS_FILES = '/reviews/:reviewId/assess',
    REVIEW_COMPLETE = '/reviews/:reviewId/complete',
    REVIEW_COMPLETE_PATIENT_MATCH = '/reviews/:reviewId/complete-patient-matched',
    REVIEW_DONT_KNOW_NHS_NUMBER = '/reviews/:reviewId/dont-know-nhs-number',
    REVIEW_DONT_KNOW_NHS_NUMBER_CONFIRM = '/reviews/:reviewId/dont-know-nhs-number-confirm',
    REVIEW_DONT_KNOW_NHS_NUMBER_PATIENT_VERIFY = '/reviews/:reviewId/dont-know-nhs-number/patient/verify',
    REVIEW_COMPLETE_PATIENT_UNKNOWN = '/reviews/:reviewId/complete-patient-unknown',
    REVIEW_COMPLETE_NO_FILES_CHOICE = '/reviews/:reviewId/complete-no-files-choice',

    REVIEW_NO_FILES_CHOICE = '/reviews/:reviewId/no-files-choice',
    REVIEW_ADD_MORE_CHOICE = '/reviews/:reviewId/add-more-choice',
    REVIEW_CHOOSE_WHICH_FILES = '/reviews/:reviewId/files',
    REVIEW_DOWNLOAD_CHOICE = '/reviews/:reviewId/download-choice',
    REVIEW_UPLOAD_ADDITIONAL_FILES = '/reviews/:reviewId/upload-additional-files',
    REVIEW_REMOVE_ALL = '/reviews/:reviewId/remove-all',
    REVIEW_UPLOAD_FILE_ORDER = '/reviews/:reviewId/upload-file-order',
    REVIEW_UPLOAD = '/reviews/:reviewId/upload',
    REVIEW_FILE_ERRORS = '/reviews/:reviewId/file-errors',

    COOKIES_POLICY_UPDATED = '/cookies-policy/confirmation',

    USER_PATIENT_RESTRICTIONS_ADD_CONFIRM = '/user-patient-restrictions/add-confirm',
    USER_PATIENT_RESTRICTIONS_VIEW = '/user-patient-restrictions/view',
    USER_PATIENT_RESTRICTIONS_LIST = '/user-patient-restrictions/list',
    USER_PATIENT_RESTRICTIONS_SEARCH_PATIENT = '/user-patient-restrictions/search-patient',
    USER_PATIENT_RESTRICTIONS_VERIFY_PATIENT = '/user-patient-restrictions/verify-patient',
    USER_PATIENT_RESTRICTIONS_EXISTING_RESTRICTIONS = '/user-patient-restrictions/existing-restrictions',
    USER_PATIENT_RESTRICTIONS_SEARCH_STAFF = '/user-patient-restrictions/search-staff',
    USER_PATIENT_RESTRICTIONS_VERIFY_STAFF = '/user-patient-restrictions/verify-staff',
    USER_PATIENT_RESTRICTIONS_REMOVE_CONFIRM = '/user-patient-restrictions/remove-confirm',
    USER_PATIENT_RESTRICTIONS_ADD_CANCEL = '/user-patient-restrictions/add-cancel',
    USER_PATIENT_RESTRICTIONS_ACTION_COMPLETE = '/user-patient-restrictions/action-complete',
}

export const navigateUrlParam = (
    path: routeChildren | routes,
    params: Record<string, string>,
    navigate: (path: string, options?: { replace: boolean }) => void,
    navigateOptions?: { replace: boolean },
): void => {
    let updatedPath: string = path;
    Object.keys(params).forEach((key) => {
        updatedPath = updatedPath.replace(`:${key}`, params[key]);
    });
    navigate(updatedPath, navigateOptions);
};

export const getToWithUrlParams = (
    path: routeChildren | routes,
    params: Record<string, string>,
): To => {
    let updatedPath: string = path;
    Object.keys(params).forEach((key) => {
        updatedPath = updatedPath.replace(`:${key}`, params[key]);
    });
    return updatedPath;
};

export enum ROUTE_TYPE {
    // No guard
    PUBLIC = 0,
    // Auth route guard
    PRIVATE = 1,
    // All route guards
    PATIENT = 2,
}

export type route = {
    page: React.JSX.Element;
    type: ROUTE_TYPE;
    unauthorized?: Array<REPOSITORY_ROLE>;
    children?: React.ReactNode;
};
