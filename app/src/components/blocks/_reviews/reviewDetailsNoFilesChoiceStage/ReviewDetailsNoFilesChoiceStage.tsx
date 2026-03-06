import React, { useState } from 'react';
import { Button, Checkboxes, WarningCallout } from 'nhsuk-react-components';
import { Link, useNavigate } from 'react-router-dom';
import { navigateUrlParam, routeChildren } from '../../../../types/generic/routes';
import { getConfigForDocType } from '../../../../helpers/utils/documentType';
import BackButton from '../../../generic/backButton/BackButton';
import { ReviewDetails } from '../../../../types/generic/reviews';
import Spinner from '../../../generic/spinner/Spinner';
import useReviewId from '../../../../helpers/hooks/useReviewId';

type ReviewDetailsNoFilesChoiceStageProps = {
    reviewData: ReviewDetails | null;
};

const ReviewDetailsNoFilesChoiceStage: React.FC<ReviewDetailsNoFilesChoiceStageProps> = ({
    reviewData,
}) => {
    const navigate = useNavigate();
    const [confirmed, setConfirmed] = useState(false);
    const [showError, setShowError] = useState(false);
    const reviewId = useReviewId();

    if (!reviewData) {
        return <Spinner status={'Loading'} />;
    }

    const reviewTypeLabel = getConfigForDocType(reviewData.snomedCode).displayName;

    const handleContinue = (): void => {
        if (!confirmed || !reviewId) {
            setShowError(true);
            return;
        }

        navigateUrlParam(routeChildren.REVIEW_COMPLETE_NO_FILES_CHOICE, { reviewId }, navigate);
    };

    const handleGoBack = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void => {
        e.preventDefault();
        navigate(-1);
    };

    return (
        <>
            <BackButton backLinkText="Go back" dataTestid="back-button" />

            {showError && (
                <WarningCallout>
                    <WarningCallout.Label>There is a problem</WarningCallout.Label>
                    <p>Please confirm that you don't need to add any of these files</p>
                </WarningCallout>
            )}

            <h1>You've chosen not to add any of the new files</h1>

            <Checkboxes.Box
                id="confirmed"
                value="confirmed"
                checked={confirmed}
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void => {
                    setConfirmed(e.target.checked);
                    if (e.target.checked && showError) {
                        setShowError(false);
                    }
                }}
            >
                I don't need to add any of these files, continue to complete the review of this
                document
            </Checkboxes.Box>
            <div className="review-details-no-files-choice__actions">
                <Button onClick={handleContinue}>Continue</Button>
                <Link
                    to={'#'}
                    onClick={handleGoBack}
                    className="review-details-no-files-choice__back-link"
                >
                    Go back to choose files to add to the existing{' '}
                    {reviewTypeLabel.toSentenceCase()}
                </Link>
            </div>
        </>
    );
};

export default ReviewDetailsNoFilesChoiceStage;
