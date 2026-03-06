const getReviewNavigationFormat = (reviewId: string, reviewVersion: string): string => {
    return `${reviewId}_${reviewVersion}`;
};

export default getReviewNavigationFormat;
