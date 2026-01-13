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

    MOCK_LOGIN = 'Auth/MockLogin',

    ADMIN_ROUTE = '/admin',
    ADMIN_ROUTE_WILDCARD = '/admin/*',
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

    DOCUMENT_VIEW = '/patient/documents/view',
    DOCUMENT_DELETE = '/patient/documents/delete',
    DOCUMENT_DELETE_CONFIRMATION = '/patient/documents/delete/confirmation',
    DOCUMENT_DELETE_COMPLETE = '/patient/documents/delete/complete',

    ADMIN_REVIEW = '/admin/reviews',
    ADMIN_REVIEW_DETAIL = '/admin/reviews/:reviewId',
    ADMIN_REVIEW_SEARCH_PATIENT = '/admin/reviews/:reviewId/search-patient',
    ADMIN_REVIEW_ASSESS_FILES = '/admin/reviews/:reviewId/assess',
    ADMIN_REVIEW_COMPLETE = '/admin/reviews/:reviewId/complete',
    ADMIN_REVIEW_COMPLETE_PATIENT_MATCH = '/admin/reviews/:reviewId/complete/patient-matched',
    ADMIN_REVIEW_DONT_KNOW_NHS_NUMBER = '/admin/reviews/:reviewId/dont-know-nhs-number',
    ADMIN_REVIEW_DONT_KNOW_NHS_NUMBER_PATIENT_VERIFY = '/admin/reviews/:reviewId/dont-know-nhs-number/patient/verify',
    ADMIN_REVIEW_COMPLETE_PATIENT_UNKNOWN = '/admin/reviews/:reviewId/complete/patient-unknown',
    ADMIN_REVIEW_COMPLETE_NO_FILES_CHOICE = '/admin/reviews/:reviewId/complete/no-files-choice',

    ADMIN_REVIEW_NO_FILES_CHOICE = '/admin/reviews/:reviewId/no-files-choice',
    ADMIN_REVIEW_ADD_MORE_CHOICE = '/admin/reviews/:reviewId/add-more-choice',
    ADMIN_REVIEW_CHOOSE_WHICH_FILES = '/admin/reviews/:reviewId/files',
    ADMIN_REVIEW_DOWNLOAD_CHOICE = '/admin/reviews/:reviewId/download-choice',
    ADMIN_REVIEW_UPLOAD_ADDITIONAL_FILES = '/admin/reviews/:reviewId/upload-additional-files',
    ADMIN_REVIEW_UPLOAD_FILE_ORDER = '/admin/reviews/:reviewId/upload-file-order',
    ADMIN_REVIEW_UPLOAD = '/admin/reviews/:reviewId/upload',

    REVIEWS = 'reviews/*',
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
