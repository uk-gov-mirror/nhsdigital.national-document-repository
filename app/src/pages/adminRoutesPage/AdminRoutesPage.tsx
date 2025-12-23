import { Dispatch, JSX, SetStateAction, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import ReviewDetailsAddMoreChoicePage from '../../components/blocks/_admin/reviewDetailsAddMoreChoicePage/ReviewDetailsAddMoreChoicePage';
import ReviewDetailsAssessmentPage from '../../components/blocks/_admin/reviewDetailsAssessmentPage/ReviewDetailsAssessmentPage';
import ReviewDetailsCompletePage from '../../components/blocks/_admin/reviewDetailsCompletePage/ReviewDetailsCompletePage';
import ReviewDetailsDocumentSelectOrderStage from '../../components/blocks/_admin/reviewDetailsDocumentSelectOrderStage/ReviewDetailsDocumentSelectOrderStage';
import ReviewDetailsDocumentSelectStage from '../../components/blocks/_admin/reviewDetailsDocumentSelectStage/ReviewDetailsDocumentSelectStage';
import ReviewDetailsDocumentUploadingStage from '../../components/blocks/_admin/reviewDetailsDocumentUploadingStage/ReviewDetailsDocumentUploadingStage';
import ReviewDetailsDontKnowNHSNumberPage from '../../components/blocks/_admin/reviewDetailsDontKnowNHSNumberPage/ReviewDetailsDontKnowNHSNumberPage';
import ReviewDetailsDownloadChoice from '../../components/blocks/_admin/reviewDetailsDownloadChoice/ReviewDetailsDownloadChoice';
import ReviewDetailsFileSelectPage from '../../components/blocks/_admin/reviewDetailsFileSelectPage/ReviewDetailsFileSelectPage';
import ReviewDetailsNoFilesChoicePage from '../../components/blocks/_admin/reviewDetailsNoFilesChoicePage/ReviewDetailsNoFilesChoicePage';
import ReviewsDetailsPage from '../../components/blocks/_admin/reviewDetailsPage/ReviewDetailsPage';
import ReviewDetailsPatientSearchPage from '../../components/blocks/_admin/reviewDetailsPatientSearchPage/ReviewDetailsPatientSearchPage';
import { ReviewsPage } from '../../components/blocks/_admin/reviewsPage/ReviewsPage';
import PatientVerifyPage from '../../components/blocks/generic/patientVerifyPage/PatientVerifyPage';
import useConfig from '../../helpers/hooks/useConfig';
import usePatient from '../../helpers/hooks/usePatient';
import useRole from '../../helpers/hooks/useRole';
import { getLastURLPath } from '../../helpers/utils/urlManipulations';
import { REPOSITORY_ROLE } from '../../types/generic/authRole';
import { routeChildren, routes } from '../../types/generic/routes';
import { AdminPage } from '../adminPage/AdminPage';
import { DOCUMENT_TYPE } from '../../helpers/utils/documentType';

export enum CompleteState {
    PATIENT_UNKNOWN = 'PATIENT_UNKNOWN',
    PATIENT_MATCHED = 'PATIENT_MATCHED',
    NO_FILES_CHOICE = 'NO_FILES_CHOICE',
    REVIEW_COMPLETE = 'REVIEW_COMPLETE',
}

const AdminRoutesPage = (): JSX.Element => {
    const config = useConfig();
    const navigate = useNavigate();
    const [reviewSnoMed, setSnoMed] = useState<DOCUMENT_TYPE | undefined>(undefined);
    const role = useRole();
    const patientDetails = usePatient();

    if (!config.featureFlags?.uploadDocumentIteration3Enabled) {
        navigate(routes.HOME);
        return <></>;
    }

    const patientVerifyOnSubmit = (setInputError: Dispatch<SetStateAction<string>>): void => {
        //TODO Review this logic
        if (role === REPOSITORY_ROLE.PCSE) {
            // Make PDS and Dynamo document store search request to download documents from patient
            navigate(routes.HOME);
        } else {
            // Make PDS patient search request to upload documents to patient
            if (patientDetails?.deceased) {
                // navigate(routeChildren.PATIENT_ACCESS_AUDIT_DECEASED); // TODO: what to do if deceased?
                return;
            }

            if (patientDetails?.active) {
                navigate(routeChildren.ADMIN_REVIEW_COMPLETE_PATIENT_UNKNOWN);
                return;
            }

            navigate(routeChildren.ADMIN_REVIEW_SEARCH_PATIENT);
        }
    };

    return (
        <Routes>
            {/* Complete Stages */}
            <Route
                path="reviews/:reviewId/complete/patient-matched"
                element={
                    <ReviewDetailsCompletePage
                        completeState={CompleteState.PATIENT_MATCHED}
                        reviewSnoMed={reviewSnoMed!}
                    />
                }
            />
            <Route
                path="reviews/:reviewId/complete/patient-unknown"
                element={
                    <ReviewDetailsCompletePage
                        completeState={CompleteState.PATIENT_UNKNOWN}
                        reviewSnoMed={reviewSnoMed!}
                    />
                }
            />
            <Route
                path="reviews/:reviewId/complete/no-files-choice"
                element={
                    <ReviewDetailsCompletePage
                        completeState={CompleteState.NO_FILES_CHOICE}
                        reviewSnoMed={reviewSnoMed!}
                    />
                }
            />
            <Route
                path="reviews/:reviewId/complete"
                element={
                    <ReviewDetailsCompletePage
                        completeState={CompleteState.REVIEW_COMPLETE}
                        reviewSnoMed={reviewSnoMed!}
                    />
                }
            />
            {/* Journey Pages  */}
            <Route
                path="reviews/:reviewId/upload"
                element={<ReviewDetailsDocumentUploadingStage reviewSnoMed={reviewSnoMed} />}
            />
            <Route
                path="reviews/:reviewId/upload-file-order"
                element={<ReviewDetailsDocumentSelectOrderStage reviewSnoMed={reviewSnoMed} />}
            />
            <Route
                path="reviews/:reviewId/upload-additional-files"
                element={<ReviewDetailsDocumentSelectStage reviewSnoMed={reviewSnoMed} />}
            />
            <Route
                path="reviews/:reviewId/add-more-choice"
                element={<ReviewDetailsAddMoreChoicePage reviewSnoMed={reviewSnoMed!} />}
            />
            <Route
                path="reviews/:reviewId/download-choice"
                element={<ReviewDetailsDownloadChoice reviewSnoMed={reviewSnoMed!} />}
            />
            <Route
                path="reviews/:reviewId/files"
                element={<ReviewDetailsFileSelectPage reviewSnoMed={reviewSnoMed!} />}
            />
            <Route
                path="reviews/:reviewId/no-files-choice"
                element={<ReviewDetailsNoFilesChoicePage reviewSnoMed={reviewSnoMed!} />}
            />
            <Route
                path="reviews/:reviewId/dont-know-nhs-number/patient/verify"
                element={<PatientVerifyPage onSubmit={patientVerifyOnSubmit} />}
            />
            <Route
                path="reviews/:reviewId/dont-know-nhs-number"
                element={<ReviewDetailsDontKnowNHSNumberPage reviewSnoMed={reviewSnoMed!} />}
            />
            <Route
                path="reviews/:reviewId/search-patient"
                element={<ReviewDetailsPatientSearchPage reviewSnoMed={reviewSnoMed!} />}
            />
            {/* inital path */}
            <Route path="reviews/:reviewId/review-files" element={<></>} />
            <Route
                path="reviews/:reviewId/assess"
                element={<ReviewDetailsAssessmentPage reviewSnoMed={reviewSnoMed!} />}
            />
            <Route
                path="reviews/:reviewId"
                element={<ReviewsDetailsPage reviewSnoMed={reviewSnoMed!} />}
            />
            <Route path={getLastURLPath(routeChildren.ADMIN_REVIEW)} element={<ReviewsPage />} />
            <Route path="*" element={<AdminPage />} />
        </Routes>
    );
};

export default AdminRoutesPage;
