import lloydGeorgeConfig from '../../config/lloydGeorgeConfig.json';
import electronicHealthRecordConfig from '../../config/electronicHealthRecordConfig.json';
import electronicHealthRecordAttachmentsConfig from '../../config/electronicHealthRecordAttachmentsConfig.json';
import lettersAndDocumentsConfig from '../../config/lettersAndDocumentsConfig.json';

export enum DOCUMENT_TYPE {
    LLOYD_GEORGE = '16521000000101',
    EHR = '717301000000104', // TBC
    EHR_ATTACHMENTS = '24511000000107', // TBC
    LETTERS_AND_DOCS = '162931000000103', // TBC
    ALL = '16521000000101,717301000000104,24511000000107,162931000000103', // TBC
}

export type ContentKey =
    | 'reviewDocumentTitle'
    | 'viewDocumentTitle'
    | 'addFilesSelectTitle'
    | 'uploadFilesSelectTitle'
    | 'chooseFilesMessage'
    | 'chooseFilesButtonLabel'
    | 'chooseFilesWarningText'
    | 'confirmFilesTitle'
    | 'beforeYouUploadTitle'
    | 'previewUploadTitle'
    | 'uploadFilesExtraParagraph'
    | 'uploadFilesBulletPoints'
    | 'skipDocumentLinkText'
    | 'confirmFilesTableTitle'
    | 'confirmFilesTableParagraph'
    | 'addMoreFilesRadioNoText'
    | 'addMoreFilesRadioYesText'
    | 'reviewAssessmentPageTitle'
    | 'stitchedPreviewFirstParagraph'
    | 'choosePagesToRemoveTitle'
    | 'choosePagesToRemoveWarning'
    | 'addFilesLinkLabel'
    | 'reassignPagesLinkLabel'
    | 'chosenToRemovePagesSubtitle';
export interface IndividualDocumentTypeContent extends Record<ContentKey, string | string[]> {}

// The individual config for each document type
export type DOCUMENT_TYPE_CONFIG = {
    acceptedFileTypes: string[];
    associatedSnomed?: DOCUMENT_TYPE;
    canBeDiscarded: boolean;
    canBeUpdated: boolean;
    content: IndividualDocumentTypeContent;
    displayName: string;
    filenameOverride?: string;
    reviewDocumentsFileNamePrefix?: string;
    multifileReview: boolean;
    multifileUpload: boolean;
    multifileZipped: boolean;
    singleDocumentOnly: boolean;
    snomedCode: DOCUMENT_TYPE;
    stitched: boolean;
    stitchedFilenamePrefix?: string;
    zippedFilename?: string;
};

export type DocumentTypeContentKey = 'uploadTitle' | 'uploadDescription';
export interface DocumentTypeContent extends Record<DocumentTypeContentKey, string> {}

// The document type as defined in the documentTypesConfig.json
export interface DocumentType {
    name: string;
    snomedCode: string;
    configName: string;
    content: DocumentTypeContent;
}

export type DocumentTypesConfig = DocumentType[];

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
        case DOCUMENT_TYPE.LETTERS_AND_DOCS:
            return lettersAndDocumentsConfig as DOCUMENT_TYPE_CONFIG;
        default:
            throw new Error(`No config found for document type: ${docType}`);
    }
};
