import { Button } from 'nhsuk-react-components';
import { JSX } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ReviewDetails } from '../../../../types/generic/reviews';
import { navigateUrlParam, routeChildren } from '../../../../types/generic/routes';
import { ReviewUploadDocument } from '../../../../types/pages/UploadDocumentsPage/types';
import Spinner from '../../../generic/spinner/Spinner';

type ReviewDetailsDontKnowNHSNumberStageProps = {
    reviewData: ReviewDetails | null;
    documents: ReviewUploadDocument[];
};

const ReviewDetailsDontKnowNHSNumberStage = ({
    reviewData,
    documents,
}: ReviewDetailsDontKnowNHSNumberStageProps): JSX.Element => {
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

    if (!reviewData) {
        return <Spinner status={'Loading'} />;
    }

    return (
        <div className="nhsuk-width-container">
            <div className="nhsuk-grid-row">
                <div className="nhsuk-grid-column-two-thirds">
                    <h1 className="nhsuk-heading-l">Download this document</h1>

                    <p>
                        You must download this document, then print it and send it to{' '}
                        <a
                            href="https://pcse.england.nhs.uk/services/medical-records/moving-medical-records"
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
                            onClick={(e: React.MouseEvent<HTMLAnchorElement>): void => {
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

export default ReviewDetailsDontKnowNHSNumberStage;
