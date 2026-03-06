import { ReactElement, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReviewDetails } from '../../../../types/generic/reviews';
import { routeChildren } from '../../../../types/generic/routes';
import {
    SetUploadDocuments,
    UploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';
import Spinner from '../../../generic/spinner/Spinner';
import DocumentSelectOrderStage from '../../_documentManagement/documentSelectOrderStage/DocumentSelectOrderStage';
import { getConfigForDocType } from '../../../../helpers/utils/documentType';
import getReviewNavigationFormat from '../../../../helpers/getReviewNavigationFormat';

type Props = {
    reviewData: ReviewDetails | null;
    documents: UploadDocument[];
    existingDocuments: UploadDocument[];
    setDocuments: SetUploadDocuments;
};

const ReviewDetailsDocumentSelectOrderStage = ({
    reviewData,
    documents,
    setDocuments,
    existingDocuments,
}: Props): ReactElement => {
    const [documentsInitialised, setDocumentsInitialised] = useState(false);
    const navigate = useNavigate();

    const reviewKey = reviewData
        ? getReviewNavigationFormat(reviewData.id, reviewData.version)
        : '';

    useEffect(() => {
        setDocumentsInitialised(false);
    }, [reviewKey]);

    useEffect(() => {
        if (!documentsInitialised && documents.length > 0) {
            setDocumentsInitialised(true);
        }
    }, [documents.length, documentsInitialised]);

    const onSuccess = (): void => {
        const updatedDocs = [...existingDocuments, ...documents].sort(
            (a, b) => a.position! - b.position!,
        );
        setDocuments(updatedDocs);
        navigate(
            routeChildren.REVIEW_UPLOAD.replaceAll(
                ':reviewId',
                reviewData ? getReviewNavigationFormat(reviewData.id, reviewData.version) : '',
            ),
        );
    };

    if (reviewData?.files === null || !documentsInitialised || !reviewData?.snomedCode) {
        return <Spinner status={'Loading'} />;
    }

    return (
        <DocumentSelectOrderStage
            documents={documents}
            setDocuments={setDocuments}
            setMergedPdfBlob={(): void => {}}
            existingDocuments={existingDocuments}
            documentConfig={getConfigForDocType(reviewData.snomedCode)}
            confirmFiles={(): void => {}}
            onSuccess={onSuccess}
            isReview={true}
            reviewData={reviewData}
        />
    );
};

export default ReviewDetailsDocumentSelectOrderStage;
