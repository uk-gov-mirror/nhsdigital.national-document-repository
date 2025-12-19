import { PatientDetails } from '../../types/generic/patientDetails';
import { DOCUMENT_UPLOAD_STATE, UploadDocument } from '../../types/pages/UploadDocumentsPage/types';
import { generateStitchedFileName } from '../requests/uploadDocuments';
import { DOCUMENT_TYPE, DOCUMENT_TYPE_CONFIG } from './documentType';
import { v4 as uuidv4 } from 'uuid';
import { zipFiles } from './zip';

export const reduceDocumentsForUpload = async (
    documents: UploadDocument[],
    documentConfig: DOCUMENT_TYPE_CONFIG,
    mergedPdfBlob: Blob,
    patientDetails: PatientDetails,
    versionId: string,
): Promise<UploadDocument[]> => {
    if (documentConfig.stitched) {
        const filename = generateStitchedFileName(patientDetails, documentConfig);
        documents = [
            {
                id: uuidv4(),
                file: new File([mergedPdfBlob], filename, { type: 'application/pdf' }),
                state: DOCUMENT_UPLOAD_STATE.SELECTED,
                progress: 0,
                docType: documentConfig.snomedCode as DOCUMENT_TYPE,
                attempts: 0,
                versionId: versionId,
            },
        ];
    }

    if (documentConfig.multifileZipped) {
        const filename = `${documentConfig.zippedFilename}_(${documents.length}).zip`;

        const zip = await zipFiles(documents);

        documents = [
            {
                id: uuidv4(),
                file: new File([zip], filename, {
                    type: 'application/zip',
                }),
                state: DOCUMENT_UPLOAD_STATE.SELECTED,
                progress: 0,
                docType: documentConfig.snomedCode as DOCUMENT_TYPE,
                attempts: 0,
                versionId,
            },
        ];
    }

    return documents;
};
