import { Dispatch, JSX, SetStateAction, useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import ReviewDetailsAddMoreChoiceStage from '../../components/blocks/_admin/reviewDetailsAddMoreChoiceStage/ReviewDetailsAddMoreChoiceStage';
import ReviewDetailsAssessmentStage from '../../components/blocks/_admin/reviewDetailsAssessmentStage/ReviewDetailsAssessmentStage';
import ReviewDetailsCompleteStage from '../../components/blocks/_admin/reviewDetailsCompleteStage/ReviewDetailsCompleteStage';
import ReviewDetailsDocumentSelectOrderStage from '../../components/blocks/_admin/reviewDetailsDocumentSelectOrderStage/ReviewDetailsDocumentSelectOrderStage';
import ReviewDetailsDocumentSelectStage from '../../components/blocks/_admin/reviewDetailsDocumentSelectStage/ReviewDetailsDocumentSelectStage';
import ReviewDetailsDocumentUploadingStage from '../../components/blocks/_admin/reviewDetailsDocumentUploadingStage/ReviewDetailsDocumentUploadingStage';
import ReviewDetailsDontKnowNHSNumberStage from '../../components/blocks/_admin/reviewDetailsDontKnowNHSNumberStage/ReviewDetailsDontKnowNHSNumberStage';
import ReviewDetailsDownloadChoiceStage from '../../components/blocks/_admin/reviewDetailsDownloadChoiceStage/ReviewDetailsDownloadChoiceStage';
import ReviewDetailsFileSelectStage from '../../components/blocks/_admin/reviewDetailsFileSelectStage/ReviewDetailsFileSelectStage';
import ReviewDetailsNoFilesChoiceStage from '../../components/blocks/_admin/reviewDetailsNoFilesChoiceStage/ReviewDetailsNoFilesChoiceStage';
import ReviewsDetailsStage from '../../components/blocks/_admin/reviewsDetailsStage/ReviewsDetailsStage';
import ReviewDetailsPatientSearchStage from '../../components/blocks/_admin/reviewDetailsPatientSearchStage/ReviewDetailsPatientSearchStage';
import { ReviewsPage } from '../../components/blocks/_admin/reviewsPage/ReviewsPage';
import PatientVerifyPage from '../../components/blocks/generic/patientVerifyPage/PatientVerifyPage';
import useConfig from '../../helpers/hooks/useConfig';
import usePatient from '../../helpers/hooks/usePatient';
import { getLastURLPath } from '../../helpers/utils/urlManipulations';
import { routeChildren, routes } from '../../types/generic/routes';
import { AdminPage } from '../adminPage/AdminPage';
import { ReviewDetails } from '../../types/generic/reviews';
import Spinner from '../../components/generic/spinner/Spinner';
import { ReviewUploadDocument } from '../../types/pages/UploadDocumentsPage/types';
import { getReviewData } from '../../helpers/requests/getReviews';
import useBaseAPIUrl from '../../helpers/hooks/useBaseAPIUrl';
import useBaseAPIHeaders from '../../helpers/hooks/useBaseAPIHeaders';
import { DOWNLOAD_STAGE } from '../../types/generic/downloadStage';
import { PatientDetails } from '../../types/generic/patientDetails';

export enum CompleteState {
    PATIENT_UNKNOWN = 'PATIENT_UNKNOWN',
    PATIENT_MATCHED = 'PATIENT_MATCHED',
    NO_FILES_CHOICE = 'NO_FILES_CHOICE',
    REVIEW_COMPLETE = 'REVIEW_COMPLETE',
}

const AdminRoutesPage = (): JSX.Element => {
    const config = useConfig();
    const navigate = useNavigate();
    const patientDetails = usePatient();
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
        let addedFiles = additionalFiles.filter((f) => f.type === undefined);
        for (const addedFile of addedFiles) {
            if (uploadDocuments.some((d) => d.file.name === addedFile.file.name)) {
                addedFiles = addedFiles.filter((f) => f.file.name !== addedFile.file.name);
            }
        }
        const newUploadDocuments = [...uploadDocuments, ...addedFiles];
        setUploadDocuments(newUploadDocuments);
    }, [additionalFiles]);

    if (!config.featureFlags?.uploadDocumentIteration3Enabled) {
        navigate(routes.HOME);
        return <></>;
    }

    const patientVerifyOnSubmit = (setInputError: Dispatch<SetStateAction<string>>): void => {
        if (patientDetails?.deceased) {
            navigate(routeChildren.PATIENT_ACCESS_AUDIT_DECEASED);
            return;
        }

        if (patientDetails?.active) {
            navigate(routeChildren.ADMIN_REVIEW_COMPLETE_PATIENT_MATCH);
            return;
        }

        navigate(routeChildren.ADMIN_REVIEW_SEARCH_PATIENT);
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
            {/* Complete Stages */}
            <Route
                path="reviews/:reviewId/complete/patient-matched"
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
                path="reviews/:reviewId/complete/patient-unknown"
                element={
                    <ReviewDetailsCompleteStage
                        completeState={CompleteState.PATIENT_UNKNOWN}
                        reviewData={reviewData}
                        reviewUploadDocuments={uploadDocuments}
                    />
                }
            />
            <Route
                path="reviews/:reviewId/complete/no-files-choice"
                element={
                    <ReviewDetailsCompleteStage
                        completeState={CompleteState.NO_FILES_CHOICE}
                        reviewData={reviewData}
                        reviewUploadDocuments={uploadDocuments}
                    />
                }
            />
            <Route
                path="reviews/:reviewId/complete"
                element={
                    <ReviewDetailsCompleteStage
                        completeState={CompleteState.REVIEW_COMPLETE}
                        reviewData={reviewData}
                        reviewUploadDocuments={uploadDocuments}
                    />
                }
            />
            {/* Journey Pages  */}
            <Route
                path="reviews/:reviewId/upload"
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
                path="reviews/:reviewId/upload-file-order"
                element={
                    <ReviewDetailsDocumentSelectOrderStage
                        reviewData={reviewData}
                        documents={additionalFiles}
                        existingDocuments={existingUploadDocuments}
                        setDocuments={setUploadDocuments}
                    />
                }
            />
            <Route
                path="reviews/:reviewId/upload-additional-files"
                element={
                    <ReviewDetailsDocumentSelectStage
                        reviewData={reviewData}
                        documents={additionalFiles}
                        setDocuments={setAdditionalFiles}
                    />
                }
            />
            <Route
                path="reviews/:reviewId/add-more-choice"
                element={<ReviewDetailsAddMoreChoiceStage reviewData={reviewData} />}
            />
            <Route
                path="reviews/:reviewId/download-choice"
                element={
                    <ReviewDetailsDownloadChoiceStage
                        reviewData={reviewData}
                        documents={uploadDocuments}
                    />
                }
            />
            <Route
                path="reviews/:reviewId/files"
                element={
                    <ReviewDetailsFileSelectStage
                        reviewData={reviewData}
                        uploadDocuments={uploadDocuments}
                        setUploadDocuments={setUploadDocuments}
                    />
                }
            />
            <Route
                path="reviews/:reviewId/no-files-choice"
                element={<ReviewDetailsNoFilesChoiceStage reviewData={reviewData} />}
            />
            <Route
                path="reviews/:reviewId/dont-know-nhs-number/patient/verify"
                element={
                    <PatientVerifyPage
                        onSubmit={patientVerifyOnSubmit}
                        reviewPatientDetails={newPatientDetails}
                        backLinkOverride={routeChildren.ADMIN_REVIEW_SEARCH_PATIENT.replaceAll(
                            ':reviewId',
                            reviewData ? `${reviewData.id}.${reviewData.version}` : '',
                        )}
                    />
                }
            />
            <Route
                path="reviews/:reviewId/dont-know-nhs-number"
                element={
                    <ReviewDetailsDontKnowNHSNumberStage
                        reviewData={reviewData}
                        documents={uploadDocuments}
                    />
                }
            />
            <Route
                path="reviews/:reviewId/search-patient"
                element={
                    <ReviewDetailsPatientSearchStage
                        reviewData={reviewData}
                        setNewPatientDetails={setNewPatientDetails}
                    />
                }
            />
            {/* inital path */}
            <Route path="reviews/:reviewId/review-files" element={<></>} />
            <Route
                path="reviews/:reviewId/assess"
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
            <Route
                path="reviews/:reviewId"
                element={
                    reviewData ? (
                        <ReviewsDetailsStage
                            loadReviewData={loadData}
                            reviewData={reviewData}
                            downloadStage={downloadStage}
                            setDownloadStage={setDownloadStage}
                            uploadDocuments={uploadDocuments}
                        />
                    ) : (
                        <div>
                            <Spinner status={'loading'} />
                        </div>
                    )
                }
            />
            <Route
                path={getLastURLPath(routeChildren.ADMIN_REVIEW)}
                element={<ReviewsPage setReviewData={setReviewData} />}
            />
            <Route path="*" element={<AdminPage />} />
        </Routes>
    );
};

export default AdminRoutesPage;
