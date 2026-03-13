import { JSX } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getConfigForDocType } from '../../../../helpers/utils/documentType';
import { getFormattedDateTimeFromString } from '../../../../helpers/utils/formatDate';
import { DOWNLOAD_STAGE } from '../../../../types/generic/downloadStage';
import { PatientDetails } from '../../../../types/generic/patientDetails';
import { ReviewDetails } from '../../../../types/generic/reviews';
import {
    getToWithUrlParams,
    navigateUrlParam,
    routeChildren,
    routes,
} from '../../../../types/generic/routes';
import { ReviewUploadDocument } from '../../../../types/pages/UploadDocumentsPage/types';
import BackButton from '../../../generic/backButton/BackButton';
import { CreatedByCard } from '../../../generic/createdBy/createdBy';
import PatientSearchForm from '../../../generic/patientSearchForm/PatientSearchForm';
import { RecordLayout } from '../../../generic/recordCard/RecordCard';
import { RecordLoader, RecordLoaderProps } from '../../../generic/recordLoader/RecordLoader';
import DocumentUploadLloydGeorgePreview from '../../_documentManagement/documentUploadLloydGeorgePreview/DocumentUploadLloydGeorgePreview';

export const incorrectFormatMessage =
    "Enter a valid patient NHS number. If you keep getting this message, select 'I don't know the NHS number'.";

interface ReviewDetailsPatientSearchPageProps {
    reviewData: ReviewDetails | null;
    uploadDocuments: ReviewUploadDocument[];
    setNewPatientDetails: React.Dispatch<React.SetStateAction<PatientDetails | undefined>>;
}

const ReviewDetailsPatientSearchStage = ({
    reviewData,
    uploadDocuments,
    setNewPatientDetails,
}: ReviewDetailsPatientSearchPageProps): JSX.Element => {
    const navigate = useNavigate();
    const { reviewId } = useParams<{ reviewId: string }>();

    if (!reviewData) {
        navigate(routes.REVIEWS);
        return <></>;
    }

    const reviewConfig = getConfigForDocType(reviewData.snomedCode);

    const handleSuccess = (patientDetails: PatientDetails): void => {
        setNewPatientDetails(patientDetails);
        navigateUrlParam(
            routeChildren.REVIEW_DONT_KNOW_NHS_NUMBER_PATIENT_VERIFY,
            { reviewId: reviewId! },
            navigate,
        );
    };

    const downloadAction = (e: React.MouseEvent<HTMLElement>): void => {
        e.preventDefault();
        for (const doc of uploadDocuments ?? []) {
            const anchor = document.createElement('a');
            const url = URL.createObjectURL(doc.blob!);
            anchor.href = url;
            anchor.download = doc.file.name;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        }
    };

    const recordDetailsProps: RecordLoaderProps = {
        downloadStage: DOWNLOAD_STAGE.SUCCEEDED,
        childrenIfFailiure: <p>Failure: failed to load documents</p>,
        fileName:
            !reviewConfig.multifileReview && reviewData.files?.length === 1
                ? reviewData.files[0].fileName
                : '',
        downloadAction,
    };

    const files = uploadDocuments?.filter((f) => f.file?.name.endsWith('.pdf'));

    return (
        <>
            <BackButton backLinkText="Go back" dataTestid="back-button" />

            <PatientSearchForm
                title="Search for the correct patient"
                subtitle="Enter the NHS number to find the correct patient demographics for this document."
                onSuccess={handleSuccess}
                secondaryActionText="I don't know the NHS number"
                onSecondaryActionClicked={(): void => {
                    const to = getToWithUrlParams(routeChildren.REVIEW_DONT_KNOW_NHS_NUMBER, {
                        reviewId: reviewId!,
                    });
                    navigate(to);
                }}
            />

            <RecordLayout
                heading={reviewConfig.content.viewDocumentTitle as string}
                fullScreenHandler={null}
                detailsElement={<RecordLoader {...recordDetailsProps} />}
                isFullScreen={false}
                setStage={(): void => {}}
                showMenu={false}
            >
                <DocumentUploadLloydGeorgePreview
                    documents={files || []}
                    setMergedPdfBlob={(): void => {}}
                    documentConfig={reviewConfig}
                    isReview={true}
                >
                    <CreatedByCard
                        odsCode={reviewData.uploader}
                        dateUploaded={getFormattedDateTimeFromString(reviewData.dateUploaded)}
                        cssClass="pt-1"
                    />
                </DocumentUploadLloydGeorgePreview>
            </RecordLayout>
        </>
    );
};

export default ReviewDetailsPatientSearchStage;
