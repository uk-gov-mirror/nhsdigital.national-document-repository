export type ReviewListItemDto = {
    id: string;
    nhsNumber: string;
    document_snomed_code_type: string;
    odsCode: string; // Author
    dateUploaded: string;
    reviewReason: string;
};

export type ReviewListItem = {
    id: string;
    nhsNumber: string;
    recordType: RecordType; // Translated from document_snomed_code_type
    uploader: string; // odsCode code of the uploader
    dateUploaded: string;
    reviewReason: string;
};

export type ReviewsResponse = {
    documentReviewReferences: ReviewListItemDto[];
    nextPageToken: string;
    count: number; // Not total count but count of items returned
};

export type RecordType = 'Lloyd George' | 'Electronic Health Record' | 'Unknown Type';

export const snowmedLookupDictionary: { [key: string]: RecordType } = {
    // https://termbrowser.nhs.uk/?perspective=full&conceptId1=16521000000101&edition=uk-edition&release=v20250924&server=https://termbrowser.nhs.uk/sct-browser-api/snomed&langRefset=999001261000000100,999000691000001104
    '16521000000101': 'Lloyd George',
    // https://termbrowser.nhs.uk/?perspective=full&conceptId1=717391000000106&edition=uk-edition&release=v20250924&server=https://termbrowser.nhs.uk/sct-browser-api/snomed&langRefset=999001261000000100,999000691000001104
    '717391000000106': 'Electronic Health Record',
};

export const translateSnowmed = (document_snomed_code_type: string): RecordType => {
    return snowmedLookupDictionary[document_snomed_code_type] || 'Unknown Type';
};
