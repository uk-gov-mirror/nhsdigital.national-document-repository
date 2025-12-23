import { Button } from 'nhsuk-react-components';
import { JSX } from 'react';
import { navigateUrlParam, routeChildren } from '../../../../types/generic/routes';
import { Link, useNavigate, useParams } from 'react-router-dom';

type ReviewDetailsDontKnowNHSNumberPageProps = {
    reviewSnoMed: string;
};

const ReviewDetailsDontKnowNHSNumberPage = ({
    reviewSnoMed,
}: ReviewDetailsDontKnowNHSNumberPageProps): JSX.Element => {
    const navigate = useNavigate();
    const { reviewId } = useParams<{ reviewId: string }>();

    const handleFinishReviewing = async (): Promise<void> => {
        if (!reviewId) {
            return;
        }

        navigateUrlParam(
            routeChildren.ADMIN_REVIEW_COMPLETE_PATIENT_UNKNOWN,
            { reviewId },
            navigate,
        );
    };

    return (
        <div className="nhsuk-width-container">
            <div className="nhsuk-grid-row">
                <div className="nhsuk-grid-column-two-thirds">
                    <h1 className="nhsuk-heading-l">Download this document</h1>

                    <p>
                        You must download this document, then print it and send it to{' '}
                        <a
                            href="https://pcse.england.nhs.uk/services/medical-records/moving-medical-records" // TODO: Verify link
                            className="nhsuk-link"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Primary Care Support England
                        </a>{' '}
                        following their process for record transfers.
                    </p>

                    <p className="pb-9">
                        <Link
                            to="#"
                            className="nhsuk-link"
                            onClick={(e): void => {
                                e.preventDefault();
                                // TODO: Add download logic here PRMP-827
                            }}
                        >
                            Download all records
                        </Link>
                    </p>

                    <Button
                        type="submit"
                        id="finish-review-button"
                        className="mt-9"
                        onClick={handleFinishReviewing}
                    >
                        Finish reviewing this document
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ReviewDetailsDontKnowNHSNumberPage;
