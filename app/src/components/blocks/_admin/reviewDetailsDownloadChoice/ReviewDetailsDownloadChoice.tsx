import React, { useEffect } from 'react';
import { Button } from 'nhsuk-react-components';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { navigateUrlParam, routeChildren } from '../../../../types/generic/routes';
import BackButton from '../../../generic/backButton/BackButton';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../../../helpers/utils/documentType';
import '../../../../helpers/utils/string-extensions';
import './ReviewDetailsDownloadChoice.scss';

type ReviewDetailsDownloadChoiceProps = {
    reviewSnoMed: DOCUMENT_TYPE;
};

const ReviewDetailsDownloadChoice: React.FC<ReviewDetailsDownloadChoiceProps> = ({
    reviewSnoMed,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { reviewId } = useParams<{ reviewId: string }>();

    const reviewTypeLabel = getConfigForDocType(reviewSnoMed).displayName;

    // Get unselected files from location state
    const unselectedFiles =
        (location.state as { unselectedFiles?: string[] })?.unselectedFiles || [];

    useEffect(() => {
        // If no unselected files in state, navigate back to file select page
        if (!location.state || !unselectedFiles.length) {
            if (reviewId) {
                const path = routeChildren.ADMIN_REVIEW_CHOOSE_WHICH_FILES.replace(
                    ':reviewId',
                    reviewId,
                );
                navigate(path, { replace: true });
            }
        }
    }, [location.state, unselectedFiles, reviewId, navigate]);

    const handleContinue = (): void => {
        if (!reviewId) {
            return;
        }
        navigateUrlParam(routeChildren.ADMIN_REVIEW_ADD_MORE_CHOICE, { reviewId }, navigate);
    };

    const handleDownloadFiles = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void => {
        e.preventDefault();
        // TODO: Implement download functionality for unselected files PRMP-827
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
                {unselectedFiles.map((filename) => (
                    <li key={filename}>{filename}</li>
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

export default ReviewDetailsDownloadChoice;
