import axios from 'axios';
import { endpoints } from '../../types/generic/endpoints';
import { ReviewsResponse } from '../../types/generic/reviews';
import getMockResponses, { setupMockRequest } from '../test/getMockReviews';
import { isLocal } from '../utils/isLocal';

const getReviews = async (
    baseUrl: string,
    nhsNumber: string,
    nextPageStartKey: string,
    limit: number = 10,
): Promise<ReviewsResponse> => {
    const gatewayUrl = baseUrl + endpoints.REVIEW_LIST;

    const params = new URLSearchParams({
        limit: limit.toString(),
        startKey: nextPageStartKey,
        nhsNumber: nhsNumber?.replaceAll(/\s/g, ''), // replace whitespace
    });

    if (isLocal) {
        setupMockRequest!(params);
        return await getMockResponses!(params);
    }

    const response = await axios.get<ReviewsResponse>(gatewayUrl + `?${params.toString()}`);

    return response.data;
};

export default getReviews;
