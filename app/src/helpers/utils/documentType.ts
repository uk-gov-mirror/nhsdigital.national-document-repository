import lloydGeorgeConfig from '../../config/lloydGeorgeConfig.json';
import electronicHealthRecordConfig from '../../config/electronicHealthRecordConfig.json';
import electronicHealthRecordAttachmentsConfig from '../../config/electronicHealthRecordAttachmentsConfig.json';

export enum DOCUMENT_TYPE {
    LLOYD_GEORGE = '16521000000101',
    EHR = '717301000000104', // TBC
    EHR_ATTACHMENTS = '24511000000107', // TBC
    LETTERS_AND_DOCS = '162931000000103', // TBC
    ALL = '16521000000101,717301000000104,24511000000107,162931000000103', // TBC
}

export type DOCUMENT_TYPE_CONFIG = {
    snomedCode: string;
    displayName: string;
    filenameOverride?: string;
    canBeUpdated: boolean;
    associatedSnomed: string;
    multifileUpload: boolean;
    multifileZipped: boolean;
    zippedFilename?: string;
    multifileReview: boolean;
    canBeDiscarded: boolean;
    stitched: boolean;
    singleDocumentOnly: boolean;
    stitchedFilenamePrefix?: string;
    acceptedFileTypes: string[];
    content: { [key: string]: string | string[] };
};

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
