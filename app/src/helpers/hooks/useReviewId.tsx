import { useNavigate, useParams } from 'react-router-dom';
import { routes } from '../../types/generic/routes';

const useReviewId = (): string | undefined => {
    const { reviewId } = useParams<{ reviewId: string }>();
    const navigate = useNavigate();

    const reviewIdRegex = new RegExp(
        /^(([\dA-Za-z]{8}-[\dA-Za-z]{4}-[\dA-Za-z]{4}-[\dA-Za-z]{4}-[\dA-Za-z]{12})|(\d+))_\d+$/,
    );

    if (!reviewId || !reviewIdRegex.test(reviewId)) {
        navigate(routes.NOT_FOUND);
        return;
    }

    return reviewId;
};

export default useReviewId;
