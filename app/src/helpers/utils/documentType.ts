import lloydGeorgeConfig from '../../config/lloydGeorgeConfig.json';
import electronicHealthRecordConfig from '../../config/electronicHealthRecordConfig.json';
import electronicHealthRecordAttachmentsConfig from '../../config/electronicHealthRecordAttachmentsConfig.json';

export enum DOCUMENT_TYPE {
    LLOYD_GEORGE = '16521000000101',
    EHR = '16521000000102', // TBC
    EHR_ATTACHMENTS = '16521000000103', // TBC
    LETTERS_AND_DOCS = '16521000000104', // TBC
    ALL = '16521000000101,16521000000102,16521000000103,16521000000104', // TBC
}

export type DOCUMENT_TYPE_CONFIG = {
    snomedCode: string;
    displayName: string;
    canBeUpdated: boolean;
    associatedSnomed: string;
    multifileUpload: boolean;
    multifileZipped: boolean;
    multifileReview: boolean;
    canBeDiscarded: boolean;
    stitched: boolean;
    acceptedFileTypes: string[];
    content: { key: string, value: string }[];
}

export const getDocumentTypeLabel = (docType: DOCUMENT_TYPE): string => {
    switch (docType) {
        case DOCUMENT_TYPE.LLOYD_GEORGE:
            return 'Scanned paper notes';
        case DOCUMENT_TYPE.EHR:
            return 'Electronic health record';
        case DOCUMENT_TYPE.EHR_ATTACHMENTS:
            return 'Electronic health record attachments';
        case DOCUMENT_TYPE.LETTERS_AND_DOCS:
            return 'Patient letters and documents';
        default:
            return '';
    }
};

export const getConfigForDocType = (docType: DOCUMENT_TYPE): DOCUMENT_TYPE_CONFIG => {
    switch (docType) {
        case DOCUMENT_TYPE.LLOYD_GEORGE:
            return lloydGeorgeConfig as DOCUMENT_TYPE_CONFIG;
        case DOCUMENT_TYPE.EHR:
            return electronicHealthRecordConfig as DOCUMENT_TYPE_CONFIG;
        case DOCUMENT_TYPE.EHR_ATTACHMENTS:
            return electronicHealthRecordAttachmentsConfig as DOCUMENT_TYPE_CONFIG;
        default:
            throw new Error(`No config found for document type: ${docType}`);
    }
};