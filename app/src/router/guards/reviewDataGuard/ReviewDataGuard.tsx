import { useEffect, type ReactNode } from 'react';
import { routes } from '../../../types/generic/routes';
import { useNavigate, useParams } from 'react-router-dom';
import { ReviewDetails } from '../../../types/generic/reviews';

type Props = {
    children: ReactNode;
    reviewData?: ReviewDetails | null;
};

const ReviewDataGuard = ({ children, reviewData }: Props): React.JSX.Element => {
    const navigate = useNavigate();
    const { reviewId } = useParams<{ reviewId: string }>();
    let reviewIdRegex = new RegExp(
        /^(([\dA-Za-z]{8}-[\dA-Za-z]{4}-[\dA-Za-z]{4}-[\dA-Za-z]{4}-[\dA-Za-z]{12})|(\d+))_\d+$/,
    );

    useEffect(() => {
        if (!reviewData || !reviewId || !reviewIdRegex.test(reviewId)) {
            navigate(routes.REVIEWS);
        }
    }, [reviewData, reviewId, navigate]);
    return <>{children}</>;
};

export default ReviewDataGuard;
