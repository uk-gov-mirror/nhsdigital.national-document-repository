import { Dispatch, JSX, SetStateAction, useEffect, useState } from 'react';
import { Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import ReviewDetailsAddMoreChoiceStage from '../../components/blocks/_reviews/reviewDetailsAddMoreChoiceStage/ReviewDetailsAddMoreChoiceStage';
import ReviewDetailsAssessmentStage from '../../components/blocks/_reviews/reviewDetailsAssessmentStage/ReviewDetailsAssessmentStage';
import ReviewDetailsCompleteStage from '../../components/blocks/_reviews/reviewDetailsCompleteStage/ReviewDetailsCompleteStage';
import ReviewDetailsDocumentSelectOrderStage from '../../components/blocks/_reviews/reviewDetailsDocumentSelectOrderStage/ReviewDetailsDocumentSelectOrderStage';
import ReviewDetailsDocumentSelectStage from '../../components/blocks/_reviews/reviewDetailsDocumentSelectStage/ReviewDetailsDocumentSelectStage';
import ReviewDetailsDocumentUploadingStage from '../../components/blocks/_reviews/reviewDetailsDocumentUploadingStage/ReviewDetailsDocumentUploadingStage';
import ReviewDetailsDocumentRemoveAllStage from '../../components/blocks/_reviews/reviewDetailsDocumentRemoveAllStage/ReviewDetailsDocumentRemoveAllStage';
import ReviewDetailsDontKnowNHSNumberStage from '../../components/blocks/_reviews/reviewDetailsDontKnowNHSNumberStage/ReviewDetailsDontKnowNHSNumberStage';
import ReviewDetailsDownloadChoiceStage from '../../components/blocks/_reviews/reviewDetailsDownloadChoiceStage/ReviewDetailsDownloadChoiceStage';
import ReviewDetailsFileSelectStage from '../../components/blocks/_reviews/reviewDetailsFileSelectStage/ReviewDetailsFileSelectStage';
import ReviewDetailsNoFilesChoiceStage from '../../components/blocks/_reviews/reviewDetailsNoFilesChoiceStage/ReviewDetailsNoFilesChoiceStage';
import ReviewsDetailsStage from '../../components/blocks/_reviews/reviewsDetailsStage/ReviewsDetailsStage';
import ReviewDetailsPatientSearchStage from '../../components/blocks/_reviews/reviewDetailsPatientSearchStage/ReviewDetailsPatientSearchStage';
import ReviewsPageIndex from '../../components/blocks/_reviews/reviewsPageIndex/ReviewsPageIndex';
import PatientVerifyPage from '../../components/blocks/generic/patientVerifyPage/PatientVerifyPage';
import DocumentSelectFileErrorsPage from '../../components/blocks/_documentManagement/documentSelectFileErrorsPage/DocumentSelectFileErrorsPage';
import useConfig from '../../helpers/hooks/useConfig';
import { routeChildren, routes } from '../../types/generic/routes';
import { ReviewDetails } from '../../types/generic/reviews';
import { ReviewUploadDocument } from '../../types/pages/UploadDocumentsPage/types';
import { getReviewData } from '../../helpers/requests/getReviews';
import useBaseAPIUrl from '../../helpers/hooks/useBaseAPIUrl';
import useBaseAPIHeaders from '../../helpers/hooks/useBaseAPIHeaders';
import { DOWNLOAD_STAGE } from '../../types/generic/downloadStage';
import { PatientDetails } from '../../types/generic/patientDetails';
import { sortDocumentsForReview } from '../../helpers/utils/sortReviewDocs';
import PatientGuard from '../../router/guards/patientGuard/PatientGuard';
import { getChildPath } from '../../helpers/utils/urlManipulations';
import ReviewDataGuard from '../../router/guards/reviewDataGuard/ReviewDataGuard';
import ReviewDetailsDontKnowNHSNumberConfirmStage from '../../components/blocks/_admin/reviewDetailsDontKnowNHSNumberConfirmStage/ReviewDetailsDontKnowNHSNumberConfirmStage';
import getReviewNavigationFormat from '../../helpers/getReviewNavigationFormat';

export enum CompleteState {
    PATIENT_UNKNOWN = 'PATIENT_UNKNOWN',
    PATIENT_MATCHED = 'PATIENT_MATCHED',
    NO_FILES_CHOICE = 'NO_FILES_CHOICE',
    REVIEW_COMPLETE = 'REVIEW_COMPLETE',
}

const ReviewsPage = (): JSX.Element => {
    const config = useConfig();
    const navigate = useNavigate();
    const baseUrl = useBaseAPIUrl();
    const baseHeaders = useBaseAPIHeaders();
    const [hasExistingRecordInStorage, setHasExistingRecordInStorage] = useState(false);
    // for upload at start of journey presumed all files including existing ones in case of LG.
    const [uploadDocuments, setUploadDocuments] = useState<ReviewUploadDocument[]>([]);
    // additional files added by user
    const [additionalFiles, setAdditionalFiles] = useState<ReviewUploadDocument[]>([]);
    const [existingUploadDocuments, setExistingUploadDocuments] = useState<ReviewUploadDocument[]>(
        [],
    );
    const [downloadStage, setDownloadStage] = useState<DOWNLOAD_STAGE>(DOWNLOAD_STAGE.INITIAL);
    const [reviewData, setReviewData] = useState<ReviewDetails | null>(null);
    const [newPatientDetails, setNewPatientDetails] = useState<PatientDetails | undefined>();

    useEffect(() => {
        const newUploadDocuments = sortDocumentsForReview(uploadDocuments, additionalFiles);
        setUploadDocuments(newUploadDocuments);
    }, [additionalFiles]);

    if (!config.featureFlags?.uploadDocumentIteration3Enabled) {
        navigate(routes.HOME);
        return <></>;
    }

    const patientVerifyOnSubmit = (setInputError: Dispatch<SetStateAction<string>>): void => {
        navigate(
            routeChildren.REVIEW_COMPLETE_PATIENT_MATCH.replaceAll(
                ':reviewId',
                getReviewNavigationFormat(reviewData!.id, reviewData!.version),
            ),
        );
    };

    const loadData = async (): Promise<void> => {
        if (!reviewData) {
            return;
        }
        setDownloadStage(DOWNLOAD_STAGE.PENDING);

        const result = await getReviewData({
            baseUrl,
            baseHeaders,
            reviewData,
        });

        setHasExistingRecordInStorage(result.hasExistingRecordInStorage);
        if (result.aborted) {
            return;
        }

        setUploadDocuments(result.uploadDocuments);
        setAdditionalFiles(result.additionalFiles);
        setExistingUploadDocuments(result.existingUploadDocuments);
        setDownloadStage(DOWNLOAD_STAGE.SUCCEEDED);
    };

    return (
        <Routes>
            <Route
                element={
                    <PatientGuard navigationPath={routes.REVIEWS}>
                        <ReviewDataGuard reviewData={reviewData}>
                            <Outlet />
                        </ReviewDataGuard>
                    </PatientGuard>
                }
            >
                <Route
                    path={getChildPath(routes.REVIEWS, routeChildren.REVIEW_COMPLETE_PATIENT_MATCH)}
                    element={
                        <ReviewDetailsCompleteStage
                            completeState={CompleteState.PATIENT_MATCHED}
                            reviewData={reviewData}
                            reviewUploadDocuments={uploadDocuments}
                            newPatientDetails={newPatientDetails}
                        />
                    }
                />
                <Route
                    path={getChildPath(
                        routes.REVIEWS,
                        routeChildren.REVIEW_COMPLETE_PATIENT_UNKNOWN,
                    )}
                    element={
                        <ReviewDetailsCompleteStage
                            completeState={CompleteState.PATIENT_UNKNOWN}
                            reviewData={reviewData}
                            reviewUploadDocuments={uploadDocuments}
                        />
                    }
                />
                <Route
                    path={getChildPath(
                        routes.REVIEWS,
                        routeChildren.REVIEW_COMPLETE_NO_FILES_CHOICE,
                    )}
                    element={
                        <ReviewDetailsCompleteStage
                            completeState={CompleteState.NO_FILES_CHOICE}
                            reviewData={reviewData}
                            reviewUploadDocuments={uploadDocuments}
                        />
                    }
                />
                <Route
                    path={getChildPath(routes.REVIEWS, routeChildren.REVIEW_COMPLETE)}
                    element={
                        <ReviewDetailsCompleteStage
                            completeState={CompleteState.REVIEW_COMPLETE}
                            reviewData={reviewData}
                            reviewUploadDocuments={uploadDocuments}
                        />
                    }
                />
                <Route
                    path={getChildPath(routes.REVIEWS, routeChildren.REVIEW_UPLOAD)}
                    element={
                        <ReviewDetailsDocumentUploadingStage
                            reviewData={reviewData}
                            documents={uploadDocuments}
                            setDocuments={setUploadDocuments}
                            existingId={existingUploadDocuments[0]?.id}
                        />
                    }
                />
                <Route
                    path={getChildPath(routes.REVIEWS, routeChildren.REVIEW_REMOVE_ALL)}
                    element={
                        <ReviewDetailsDocumentRemoveAllStage
                            reviewData={reviewData}
                            documents={additionalFiles}
                            setDocuments={setAdditionalFiles}
                        />
                    }
                />
                <Route
                    path={getChildPath(routes.REVIEWS, routeChildren.REVIEW_UPLOAD_FILE_ORDER)}
                    element={
                        <ReviewDetailsDocumentSelectOrderStage
                            reviewData={reviewData}
                            documents={additionalFiles}
                            existingDocuments={existingUploadDocuments}
                            setDocuments={setAdditionalFiles}
                        />
                    }
                />
                <Route
                    path={getChildPath(
                        routes.REVIEWS,
                        routeChildren.REVIEW_UPLOAD_ADDITIONAL_FILES,
                    )}
                    element={
                        <ReviewDetailsDocumentSelectStage
                            reviewData={reviewData}
                            documents={additionalFiles}
                            setDocuments={setAdditionalFiles}
                        />
                    }
                />
                <Route
                    path={getChildPath(routes.REVIEWS, routeChildren.REVIEW_FILE_ERRORS)}
                    element={<DocumentSelectFileErrorsPage documents={additionalFiles} />}
                />
                <Route
                    path={getChildPath(routes.REVIEWS, routeChildren.REVIEW_ADD_MORE_CHOICE)}
                    element={<ReviewDetailsAddMoreChoiceStage reviewData={reviewData} />}
                />
                <Route
                    path={getChildPath(routes.REVIEWS, routeChildren.REVIEW_DOWNLOAD_CHOICE)}
                    element={
                        <ReviewDetailsDownloadChoiceStage
                            reviewData={reviewData}
                            documents={uploadDocuments}
                        />
                    }
                />
                <Route
                    path={getChildPath(routes.REVIEWS, routeChildren.REVIEW_CHOOSE_WHICH_FILES)}
                    element={
                        <ReviewDetailsFileSelectStage
                            reviewData={reviewData}
                            uploadDocuments={uploadDocuments}
                            setUploadDocuments={setUploadDocuments}
                        />
                    }
                />
                <Route
                    path={getChildPath(routes.REVIEWS, routeChildren.REVIEW_NO_FILES_CHOICE)}
                    element={<ReviewDetailsNoFilesChoiceStage reviewData={reviewData} />}
                />
                <Route
                    path={getChildPath(
                        routes.REVIEWS,
                        routeChildren.REVIEW_DONT_KNOW_NHS_NUMBER_PATIENT_VERIFY,
                    )}
                    element={
                        <PatientVerifyPage
                            onSubmit={patientVerifyOnSubmit}
                            reviewPatientDetails={newPatientDetails}
                        />
                    }
                />
                <Route
                    path={getChildPath(
                        routes.REVIEWS,
                        routeChildren.REVIEW_DONT_KNOW_NHS_NUMBER_CONFIRM,
                    )}
                    element={<ReviewDetailsDontKnowNHSNumberConfirmStage />}
                />
                <Route
                    path={getChildPath(routes.REVIEWS, routeChildren.REVIEW_DONT_KNOW_NHS_NUMBER)}
                    element={
                        <ReviewDetailsDontKnowNHSNumberStage
                            reviewData={reviewData}
                            documents={uploadDocuments}
                        />
                    }
                />
                <Route
                    path={getChildPath(routes.REVIEWS, routeChildren.REVIEW_ASSESS_FILES)}
                    element={
                        <ReviewDetailsAssessmentStage
                            reviewData={reviewData}
                            setReviewData={setReviewData}
                            uploadDocuments={uploadDocuments}
                            downloadStage={downloadStage}
                            setDownloadStage={setDownloadStage}
                            hasExistingRecordInStorage={hasExistingRecordInStorage}
                        />
                    }
                />
            </Route>
            {/* </Route> */}
            <Route
                path={getChildPath(routes.REVIEWS, routeChildren.REVIEW_SEARCH_PATIENT)}
                element={
                    <ReviewDetailsPatientSearchStage
                        reviewData={reviewData}
                        uploadDocuments={uploadDocuments}
                        setNewPatientDetails={setNewPatientDetails}
                    />
                }
            />
            <Route
                path={getChildPath(routes.REVIEWS, routeChildren.REVIEW_DETAIL)}
                element={
                    <ReviewsDetailsStage
                        loadReviewData={loadData}
                        reviewData={reviewData}
                        downloadStage={downloadStage}
                        setDownloadStage={setDownloadStage}
                        uploadDocuments={uploadDocuments}
                    />
                }
            />
            <Route index element={<ReviewsPageIndex setReviewData={setReviewData} />} />
            <Route path="*" element={<div>Page not found</div>} />
        </Routes>
    );
};

export default ReviewsPage;
