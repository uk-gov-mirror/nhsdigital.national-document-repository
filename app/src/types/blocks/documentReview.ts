import { DOCUMENT_TYPE } from '../../helpers/utils/documentType';

export type DocumentReviewDto = {
    id: string;
    uploadDate: number;
    files: DocumentReviewFile[];
    documentSnomedCodeType: DOCUMENT_TYPE;
    version: string;
};

type DocumentReviewFile = {
    fileName: string;
    presignedUrl: string;
};

export type DocumentReviewStatusDto = {
    id: string;
    reviewStatus: string;
    version: string;
    reviewReason: string;
};

export enum DocumentReviewStatus {
    PENDING_REVIEW = 'PENDING_REVIEW',
    APPROVED = 'APPROVED',
    REVIEW_IN_PROGRESS = 'REVIEW_IN_PROGRESS',
    REJECTED = 'REJECTED',
    AWAITING_DOCUMENTS = 'AWAITING_DOCUMENTS',
    REJECTED_DUPLICATE = 'REJECTED_DUPLICATE',
    REASSIGNED = 'REASSIGNED',
    REASSIGNED_PATIENT_UNKNOWN = 'REASSIGNED_PATIENT_UNKNOWN',
    NEVER_REVIEWED = 'NEVER_REVIEWED',
    REVIEW_PENDING_UPLOAD = 'REVIEW_PENDING_UPLOAD',
    VIRUS_SCAN_FAILED = 'VIRUS_SCAN_FAILED',
}

export type PatchDocumentReviewRequest = {
    reviewStatus: DocumentReviewStatus;
    documentReferenceId?: string;
    nhsNumber?: string; // new nhs number if 'not my record'
};
