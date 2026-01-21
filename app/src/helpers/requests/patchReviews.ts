import axios, { AxiosError } from 'axios';
import { AuthHeaders } from '../../types/blocks/authHeaders';
import { DocumentReviewStatus } from '../../types/blocks/documentReview';
import { endpoints } from '../../types/generic/endpoints';
import { isLocal } from '../utils/isLocal';

export type PatchDocumentReviewRequestDto = {
    reviewStatus: DocumentReviewStatus;
    documentReferenceId?: string;
    nhsNumber?: string;
};

export const patchReview = async (
    baseUrl: string,
    baseHeaders: AuthHeaders,
    reviewId: string,
    versionNumber: string,
    patientId: string,
    update: PatchDocumentReviewRequestDto,
): Promise<void> => {
    const gatewayUrl = `${baseUrl}${endpoints.DOCUMENT_REVIEW}/${reviewId}/${versionNumber}`;

    const params = new URLSearchParams({
        patientId: patientId?.replaceAll(/\s/g, ''), // replace whitespace
    });

    if (isLocal) {
        return;
    }

    try {
        await axios.patch(gatewayUrl + `?${params.toString()}`, JSON.stringify(update), {
            headers: {
                ...baseHeaders,
            },
        });
    } catch (e) {
        const error = e as AxiosError;
        throw error;
    }
};

export default patchReview;
