import { Button } from 'nhsuk-react-components';
import React, { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getConfigForDocType } from '../../../../helpers/utils/documentType';
import '../../../../helpers/utils/string-extensions';
import { ReviewDetails } from '../../../../types/generic/reviews';
import { navigateUrlParam, routeChildren } from '../../../../types/generic/routes';
import {
    DOCUMENT_UPLOAD_STATE,
    ReviewUploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';
import BackButton from '../../../generic/backButton/BackButton';
import Spinner from '../../../generic/spinner/Spinner';

type ReviewDetailsDownloadChoiceProps = {
    reviewData: ReviewDetails | null;
    documents: ReviewUploadDocument[];
};

const ReviewDetailsDownloadChoiceStage: React.FC<ReviewDetailsDownloadChoiceProps> = ({
    reviewData,
    documents,
}) => {
    const navigate = useNavigate();
    const { reviewId } = useParams<{ reviewId: string }>();

    const unselectedFiles = documents.filter(
        (doc) => doc.state === DOCUMENT_UPLOAD_STATE.UNSELECTED,
    );

    useEffect(() => {
        if (!unselectedFiles.length) {
            if (reviewId) {
                const path = routeChildren.ADMIN_REVIEW_CHOOSE_WHICH_FILES.replace(
                    ':reviewId',
                    reviewId,
                );
                navigate(path, { replace: true });
            }
        }
    }, [unselectedFiles, reviewId, navigate]);

    if (!reviewData) {
        return <Spinner status={'Loading'} />;
    }

    const reviewTypeLabel = getConfigForDocType(reviewData.snomedCode).displayName;

    const handleContinue = (): void => {
        if (!reviewId) {
            return;
        }
        navigateUrlParam(routeChildren.ADMIN_REVIEW_ADD_MORE_CHOICE, { reviewId }, navigate);
    };

    const handleDownloadFiles = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void => {
        e.preventDefault();
        for (const doc of documents) {
            const anchor = document.createElement('a');
            const url = URL.createObjectURL(doc.blob!);
            anchor.href = url;
            anchor.download = doc.file.name;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        }
    };

    return (
        <>
            <BackButton backLinkText="Go back" dataTestid="back-button" />

            <h1>Do you want to download the files you didn't choose?</h1>

            <p>
                You didn't select these files to add to the existing{' '}
                {reviewTypeLabel.toSentenceCase()}:
            </p>

            <ul>
                {unselectedFiles.map((doc) => (
                    <li key={doc.file.name}>{doc.file.name}</li>
                ))}
            </ul>

            <p>
                You can{' '}
                <Link to={'#'} onClick={handleDownloadFiles}>
                    download these files
                </Link>{' '}
                if you need to keep a copy. If not, continue to complete the review of this
                document.
            </p>
            <Button onClick={handleContinue} className="review-details-download-choice__actions">
                Continue
            </Button>
        </>
    );
};

export default ReviewDetailsDownloadChoiceStage;
