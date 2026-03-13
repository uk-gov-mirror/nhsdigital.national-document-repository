import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { UPLOAD_FILE_ERROR_TYPE } from '../../../helpers/utils/fileUploadErrorMessages';
import { DOCUMENT_TYPE } from '../../../helpers/utils/documentType';
import { JourneyType } from '../../../helpers/utils/urlManipulations';
export type SetUploadStage = Dispatch<SetStateAction<UPLOAD_STAGE>>;
export type SetUploadDocuments = Dispatch<SetStateAction<Array<UploadDocument>>>;

export enum UPLOAD_STAGE {
    Selecting = 0,
    Uploading = 1,
    Complete = 2,
}

export enum DOCUMENT_UPLOAD_STATE {
    UNSELECTED = 'UNSELECTED',
    SELECTED = 'SELECTED',
    UPLOADING = 'UPLOADING',
    SUCCEEDED = 'SUCCEEDED',
    FAILED = 'FAILED',
    ERROR = 'ERROR',
    SCANNING = 'SCANNING',
    CLEAN = 'CLEAN',
    INFECTED = 'INFECTED',
}

export enum DOCUMENT_STATUS {
    FINAL = 'final',
    CANCELLED = 'cancelled',
    INFECTED = 'infected',
    NOT_FOUND = 'not-found',
    INVALID = 'invalid',
}

export enum UploadDocumentType {
    REVIEW = 'REVIEW',
    EXISTING = 'EXISTING',
}

export type ReviewUploadDocument = UploadDocument & {
    type?: UploadDocumentType;
    blob?: Blob;
};

export type UploadDocument = {
    state: DOCUMENT_UPLOAD_STATE;
    file: File;
    progress?: number;
    id: string;
    docType: DOCUMENT_TYPE;
    ref?: string;
    key?: string;
    position?: number;
    numPages?: number;
    error?: UPLOAD_FILE_ERROR_TYPE;
    errorCode?: string;
    validated?: boolean;
    versionId?: string;
};

export interface FileInputEvent extends FormEvent<HTMLInputElement> {
    target: HTMLInputElement & EventTarget;
}

export type ExistingDocument = {
    docType: DOCUMENT_TYPE | null;
    blob: Blob | null;
    fileName: string | null;
    documentId?: string | null;
    versionId: string;
};
export type DocumentUploadLocationState = {
    journey?: JourneyType;
    existingDocuments?: ExistingDocument[];
};
