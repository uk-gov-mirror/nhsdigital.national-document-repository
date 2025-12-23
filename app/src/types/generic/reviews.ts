import { DOCUMENT_TYPE, getConfigForDocType } from '../../helpers/utils/documentType';

export type ReviewListItemDto = {
    id: string;
    nhsNumber: string;
    document_snomed_code_type: DOCUMENT_TYPE;
    odsCode: string; // Author
    dateUploaded: string;
    reviewReason: string;
};

export type ReviewListItem = {
    id: string;
    nhsNumber: string;
    recordType: string; // Translated from document_snomed_code_type
    snomedCode: DOCUMENT_TYPE;
    uploader: string; // odsCode code of the uploader
    dateUploaded: string;
    reviewReason: string;
};

export type ReviewsResponse = {
    documentReviewReferences: ReviewListItemDto[];
    nextPageToken: string;
    count: number; // Not total count but count of items returned
};

export class ReviewDetails {
    recordType: string;

    constructor(
        public id: string,
        public snomedCode: DOCUMENT_TYPE,
        public lastUpdated: string,
        public uploader: string,
        public dateUploaded: string,
        public reviewReason: string,
        public documentUrl: string,
    ) {
        this.recordType = getConfigForDocType(snomedCode).displayName;
    }
}
