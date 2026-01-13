import { v4 as uuidv4 } from 'uuid';
import { GetDocumentResponse } from '../../helpers/requests/getDocument';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../helpers/utils/documentType';
import { DOCUMENT_UPLOAD_STATE, UploadDocument } from '../pages/UploadDocumentsPage/types';
import { SearchResult } from './searchResult';
import axios from 'axios';

export type ReviewFileDto = {
    fileName: string;
    presignedUrl: string;
};

// get document review dto
export type GetDocumentReviewDto = {
    id: string;
    uploadDate: string;
    documentSnomedCodeType: DOCUMENT_TYPE;
    files: ReviewFileDto[];
};

// Search Document Reviews
export type ReviewListItemDto = {
    id: string;
    nhsNumber: string;
    reviewReason: string;
    documentSnomedCodeType: DOCUMENT_TYPE;
    author: string; // Author / Sender / odsCode of the uploader
    uploadDate: string | number;
    version: string;
};

export type ReviewListItem = {
    id: string;
    nhsNumber: string;
    recordType: string; // Translated from document_snomed_code_type
    snomedCode: DOCUMENT_TYPE;
    uploader: string; // odsCode code of the uploader
    dateUploaded: string | number;
    version: string;
    reviewReason: string;
};

export type ReviewsResponse = {
    documentReviewReferences: ReviewListItemDto[];
    nextPageToken?: string;
    count: number; // Not total count but count of items returned
};

export type ReviewsListFiles = {
    fileName: string;
    presignedUrl: string;
    blob?: Blob;
    uploadDate?: string;
    size?: number;
};

export interface SearchResultsData
    extends SearchResult,
        Partial<Omit<GetDocumentResponse, 'contentType'>> {
    blob?: Blob;
}

export class ReviewDetails {
    recordType: string;
    files: ReviewsListFiles[] | null;
    existingFiles: SearchResultsData[] | null;
    nhsNumber: string;
    filesForUpload?: UploadDocument[];

    constructor(
        public id: string,
        public snomedCode: DOCUMENT_TYPE,
        public lastUpdated: string,
        public uploader: string,
        public dateUploaded: string,
        public reviewReason: string,
        public version: string,
        nhsNumber: string,
    ) {
        this.nhsNumber = nhsNumber.replaceAll(/\s/g, ''); // remove whitespace
        this.recordType = getConfigForDocType(snomedCode)?.displayName;
        this.files = null;
        this.existingFiles = null;
    }

    async getUploadDocuments(): Promise<UploadDocument[]> {
        if (this.filesForUpload) {
            return this.filesForUpload;
        }
        const documents: Promise<UploadDocument>[] = [
            ...(this.files?.map(async (file) => {
                if (!file.blob) {
                    const { data } = await axios.get(file.presignedUrl, {
                        responseType: 'blob',
                    });
                    file.blob = data;
                }
                return {
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    file: new File([file.blob!], file.fileName),
                    progress: 0,
                    id: uuidv4(),
                    docType: this.snomedCode,
                    attempts: 0,
                };
            }) || []),
        ];
        this.filesForUpload = await Promise.all(documents);
        return Promise.all(documents);
    }

    addReviewFiles(details: GetDocumentReviewDto): void {
        if (details.documentSnomedCodeType !== this.snomedCode) {
            throw new Error('Snomed code mismatch when adding review details');
        }
        if (details.id !== this.id) {
            throw new Error('Review ID mismatch when adding review details');
        }

        this.files = details.files.map((file) => ({
            fileName: file.fileName,
            presignedUrl: file.presignedUrl,
            uploadDate: details.uploadDate,
        }));
    }
}
