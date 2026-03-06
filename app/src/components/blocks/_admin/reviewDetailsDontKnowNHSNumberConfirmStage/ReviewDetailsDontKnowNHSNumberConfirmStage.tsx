import { Button, WarningCallout } from 'nhsuk-react-components';
import { JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { navigateUrlParam, routeChildren } from '../../../../types/generic/routes';
import BackButton from '../../../generic/backButton/BackButton';
import useReviewId from '../../../../helpers/hooks/useReviewId';

const ReviewDetailsDontKnowNHSNumberConfirmStage = (): JSX.Element => {
    const navigate = useNavigate();
    const reviewId = useReviewId();

    const handleFinishReviewing = async (e: React.MouseEvent<HTMLElement>): Promise<void> => {
        if (!reviewId) {
            return;
        }

        navigateUrlParam(routeChildren.REVIEW_COMPLETE_PATIENT_UNKNOWN, { reviewId }, navigate);
    };

    return (
        <div className="nhsuk-width-container">
            <BackButton dataTestid="back-button" />
            <h1 className="nhsuk-heading-l">Check this document has downloaded to your computer</h1>

            <WarningCallout data-testid="review-notification">
                <WarningCallout.Label>Important</WarningCallout.Label>
                <p>
                    Check this document has downloaded to your computer. When you finish reviewing
                    this document, it will be removed from your list of documents to review and you
                    will not be able to access it again.
                </p>
            </WarningCallout>

            <div className="d-flex align-center">
                <Button
                    type="submit"
                    id="finish-review-button"
                    className="mr-9 mb-1"
                    onClick={handleFinishReviewing}
                >
                    Finish reviewing this document
                </Button>

                <a
                    href={routeChildren.REVIEW_DONT_KNOW_NHS_NUMBER.replaceAll(
                        ':reviewId',
                        reviewId!,
                    )}
                    id="go-back-download-link"
                    className="nhsuk-link"
                    onClick={(e): void => {
                        e.preventDefault();
                        navigate(-1);
                    }}
                >
                    Go back to download the document
                </a>
            </div>
        </div>
    );
};

export default ReviewDetailsDontKnowNHSNumberConfirmStage;
