import { Button } from 'nhsuk-react-components';
import { JSX, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReviewDetails } from '../../../../types/generic/reviews';
import { navigateUrlParam, routeChildren } from '../../../../types/generic/routes';
import {
    ReviewUploadDocument,
    UploadDocumentType,
} from '../../../../types/pages/UploadDocumentsPage/types';
import Spinner from '../../../generic/spinner/Spinner';
import BackButton from '../../../generic/backButton/BackButton';
import { zipFiles } from '../../../../helpers/utils/zip';
import { getConfigForDocType } from '../../../../helpers/utils/documentType';
import SpinnerButton from '../../../generic/spinnerButton/SpinnerButton';
import { downloadFile } from '../../../../helpers/utils/downloadFile';
import { getFormattedDate } from '../../../../helpers/utils/formatDate';
import useReviewId from '../../../../helpers/hooks/useReviewId';

type ReviewDetailsDontKnowNHSNumberStageProps = {
    reviewData: ReviewDetails | null;
    documents: ReviewUploadDocument[];
};

const ReviewDetailsDontKnowNHSNumberStage = ({
    reviewData,
    documents,
}: ReviewDetailsDontKnowNHSNumberStageProps): JSX.Element => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const reviewId = useReviewId();

    const handleFinishReviewing = async (e: React.MouseEvent<HTMLElement>): Promise<void> => {
        if (!reviewId) {
            return;
        }
        e.preventDefault();
        setLoading(true);

        const configFileNamePrefix =
            getConfigForDocType(reviewData?.snomedCode!)?.reviewDocumentsFileNamePrefix ||
            'unknown-documents';

        const zippedFiles = await zipFiles(
            documents
                .filter((doc) => doc.type !== UploadDocumentType.EXISTING)
                .map((doc) => doc.file),
        );
        downloadFile(zippedFiles, `${configFileNamePrefix} - ${getFormattedDate(new Date())}.zip`);

        setLoading(false);
        navigateUrlParam(routeChildren.REVIEW_DONT_KNOW_NHS_NUMBER_CONFIRM, { reviewId }, navigate);
    };

    if (!reviewData) {
        return <Spinner status={'Loading'} />;
    }

    return (
        <div className="nhsuk-width-container">
            <div className="nhsuk-grid-row">
                <div className="nhsuk-grid-column-two-thirds">
                    <BackButton dataTestid="back-button" />
                    <h1 className="nhsuk-heading-l">Download this document</h1>

                    <p>
                        You must download this document, then print it and send it to Primary Care
                        Support England following their{' '}
                        <a
                            href="https://pcse.england.nhs.uk/services/medical-records/moving-medical-records"
                            className="nhsuk-link"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            process for record transfers
                        </a>
                        .
                    </p>

                    {loading ? (
                        <SpinnerButton
                            id="continue-spinner"
                            status="Processing Files"
                            disabled={true}
                            className="mt-9"
                        />
                    ) : (
                        <Button
                            type="submit"
                            id="finish-review-button"
                            className="mt-9"
                            onClick={handleFinishReviewing}
                        >
                            Download this document
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReviewDetailsDontKnowNHSNumberStage;
