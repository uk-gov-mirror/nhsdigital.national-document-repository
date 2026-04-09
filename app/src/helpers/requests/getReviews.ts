import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { endpoints } from '../../types/generic/endpoints';
import { GetDocumentReviewDto, ReviewDetails, ReviewsResponse } from '../../types/generic/reviews';
import {
    DOCUMENT_UPLOAD_STATE,
    ReviewUploadDocument,
    UploadDocumentType,
} from '../../types/pages/UploadDocumentsPage/types';
import getMockResponses, {
    getSingleReviewMockResponse,
    setupMockRequest,
} from '../test/getMockReviews';
import { isLocal } from '../utils/isLocal';
import { getConfigForDocType } from '../utils/documentType';
import getDocumentSearchResults, { DocumentSearchResultsArgs } from './getDocumentSearchResults';
import getDocument from './getDocument';
import { fileExtensionToContentType } from '../utils/fileExtensionToContentType';
import { AuthHeaders } from '../../types/blocks/authHeaders';
import { NHS_NUMBER_UNKNOWN } from '../constants/numbers';
import { fetchBlob } from '../utils/getPdfObjectUrl';

const getReviews = async (
    baseUrl: string,
    baseHeaders: AuthHeaders,
    nhsNumber: string,
    nextPageStartKey: string,
    limit: number = 10,
): Promise<ReviewsResponse> => {
    const gatewayUrl = baseUrl + endpoints.DOCUMENT_REVIEW;

    const params = new URLSearchParams({
        limit: limit.toString(),
        nextPageToken: nextPageStartKey,
        nhsNumber: nhsNumber?.replaceAll(/\s/g, ''), // replace whitespace
    });

    if (isLocal) {
        setupMockRequest!(params);
        return await getMockResponses!(params);
    }

    const response = await axios.get<ReviewsResponse>(gatewayUrl + `?${params.toString()}`, {
        headers: { ...baseHeaders },
    });

    return response.data;
};

export const getReviewById = async (
    baseUrl: string,
    baseHeaders: AuthHeaders,
    reviewId: string,
    versionNumber: string,
    nhsNumber: string,
): Promise<GetDocumentReviewDto> => {
    const gatewayUrl = `${baseUrl}${endpoints.DOCUMENT_REVIEW}/${reviewId}/${versionNumber}`;

    const params = new URLSearchParams({
        patientId: nhsNumber?.replaceAll(/\s/g, ''), // replace whitespace
    });

    if (isLocal) {
        return await getSingleReviewMockResponse!(reviewId, versionNumber);
    }

    const response = await axios.get<GetDocumentReviewDto>(gatewayUrl + `?${params.toString()}`, {
        headers: { ...baseHeaders },
    });

    return response.data;
};

export type GetReviewDataArgs = {
    baseUrl: string;
    baseHeaders: AuthHeaders;
    reviewData: ReviewDetails;
};

export type GetReviewDataResult = {
    uploadDocuments: ReviewUploadDocument[];
    additionalFiles: ReviewUploadDocument[];
    existingUploadDocuments: ReviewUploadDocument[];
    hasExistingRecordInStorage: boolean;
    aborted: boolean;
};

export const getReviewData = async ({
    baseUrl,
    baseHeaders,
    reviewData,
}: GetReviewDataArgs): Promise<GetReviewDataResult> => {
    const uploadDocs: ReviewUploadDocument[] = [];
    const docTypeConfig = getConfigForDocType(reviewData.snomedCode);

    let hasExistingRecordInStorage = false;

    if (docTypeConfig.singleDocumentOnly && reviewData.nhsNumber !== NHS_NUMBER_UNKNOWN) {
        const params: DocumentSearchResultsArgs = {
            nhsNumber: reviewData.nhsNumber,
            baseUrl,
            baseHeaders,
            docType: reviewData.snomedCode,
        };

        const results = await getDocumentSearchResults(params);
        reviewData.existingFiles = results;

        if (results.length > 0) {
            hasExistingRecordInStorage = true;

            const result = await getDocument({
                nhsNumber: reviewData.nhsNumber,
                baseUrl,
                baseHeaders,
                documentId: results[0].id,
            });

            const data = await fetchBlob(result.url);

            uploadDocs.push({
                type: UploadDocumentType.EXISTING,
                id: results[0].id,
                file: new File([data], results[0].fileName, {
                    type: results[0].contentType,
                }),
                blob: data,
                state: DOCUMENT_UPLOAD_STATE.SELECTED,
                progress: 0,
                docType: reviewData.snomedCode,
                numPages: undefined,
                validated: false,
                versionId: results[0].version,
            });
        }
    }

    const review = await getReviewById(
        baseUrl,
        baseHeaders,
        reviewData.id,
        reviewData.version,
        reviewData.nhsNumber || '',
    );

    reviewData.addReviewFiles(review);

    for (const reviewFile of review.files) {
        if (!reviewFile.presignedUrl) {
            return {
                uploadDocuments: [],
                additionalFiles: [],
                existingUploadDocuments: [],
                hasExistingRecordInStorage,
                aborted: true,
            };
        }

        const data = await fetchBlob(reviewFile.presignedUrl);

        uploadDocs.push({
            type: UploadDocumentType.REVIEW,
            id: uuidv4(),
            file: new File([data], reviewFile.fileName, {
                type: fileExtensionToContentType(reviewFile.fileName.split('.').pop() || ''),
            }),
            blob: data,
            state: DOCUMENT_UPLOAD_STATE.SELECTED,
            progress: 0,
            docType: reviewData.snomedCode,
            numPages: undefined,
            validated: false,
        });
    }

    const existingUploadDocuments = uploadDocs.filter(
        (f) => f.type === UploadDocumentType.EXISTING,
    );
    const additionalFiles = uploadDocs.filter((f) => f.type !== UploadDocumentType.EXISTING);

    return {
        uploadDocuments: uploadDocs,
        additionalFiles,
        existingUploadDocuments,
        hasExistingRecordInStorage,
        aborted: false,
    };
};
export default getReviews;
