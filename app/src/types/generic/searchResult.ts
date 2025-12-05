import { DOCUMENT_TYPE } from '../../helpers/utils/documentType';

export type SearchResult = {
    fileName: string;
    created: string;
    virusScannerResult: string;
    id: string;
    fileSize: number;
    version: string;
    documentSnomedCodeType: DOCUMENT_TYPE;
    contentType: string;
};
