import React, { Dispatch, JSX, SetStateAction } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { navigateUrlParam, routeChildren } from '../../../../types/generic/routes';
import { ReviewDetails } from '../../../../types/generic/reviews';
import {
    ReviewUploadDocument,
    UploadDocumentType,
} from '../../../../types/pages/UploadDocumentsPage/types';
import Spinner from '../../../generic/spinner/Spinner';
import DocumentUploadRemoveFilesStage from '../../_documentManagement/documentUploadRemoveFilesStage/DocumentUploadRemoveFilesStage';
import BackButton from '../../../generic/backButton/BackButton';

type ReviewDetailsDocumentRemoveAllStageProps = {
    reviewData: ReviewDetails | null;
    documents: ReviewUploadDocument[];
    setDocuments: Dispatch<SetStateAction<ReviewUploadDocument[]>>;
};

const ReviewDetailsDocumentRemoveAllStage = ({
    reviewData,
    documents,
    setDocuments,
}: ReviewDetailsDocumentRemoveAllStageProps): JSX.Element => {
    const navigate = useNavigate();
    const { reviewId } = useParams<{ reviewId: string }>();

    if (!reviewData) {
        return <Spinner status={'Loading'} />;
    }

    const handleContinue = (): void => {
        setDocuments(documents.filter((doc) => doc.type === UploadDocumentType.REVIEW));

        navigateUrlParam(
            routeChildren.ADMIN_REVIEW_UPLOAD_ADDITIONAL_FILES,
            { reviewId: reviewId || '' },
            navigate,
        );
    };

    return (
        <>
            <BackButton backLinkText="Go back" dataTestid="back-button" />

            <DocumentUploadRemoveFilesStage
                documentType={reviewData.snomedCode}
                documents={[]}
                setDocuments={setDocuments}
                onSuccess={handleContinue}
            />
        </>
    );
};

export default ReviewDetailsDocumentRemoveAllStage;
