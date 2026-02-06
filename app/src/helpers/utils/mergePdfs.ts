import PDFMerger from 'pdf-merger-js';
import { DOWNLOAD_STAGE } from '../../types/generic/downloadStage';
import { SetStateAction } from 'react';
import {
    ReviewUploadDocument,
    UploadDocumentType,
} from '../../types/pages/UploadDocumentsPage/types';

export const mergePdfsFromUploadDocuments = async (
    uploadDocuments: ReviewUploadDocument[],
    setPdfObjectUrl: (value: SetStateAction<string>) => void,
    setDownloadStage: (value: SetStateAction<DOWNLOAD_STAGE>) => void,
): Promise<Blob | undefined> => {
    if (uploadDocuments.length === 0) {
        setDownloadStage(DOWNLOAD_STAGE.FAILED);
        return;
    }

    const existing = uploadDocuments.find((d) => d.type === UploadDocumentType.EXISTING);

    let sortedFiles = uploadDocuments
        .filter((d) => d.type !== UploadDocumentType.EXISTING)
        .sort((a, b) => a.position! - b.position!);
    if (existing) {
        sortedFiles = [existing, ...sortedFiles];
    }

    const merger = new PDFMerger();

    for (const uploadDocument of sortedFiles) {
        if (uploadDocument.blob) {
            await merger.add(uploadDocument.blob ?? uploadDocument.file);
        } else {
            await merger.add(uploadDocument.file);
        }
    }

    // Get the merged PDF as a Uint8Array
    const mergedPdfBuffer = await merger.saveAsBuffer();

    // Create a blob from the buffer (convert to Uint8Array first to ensure compatibility)
    const uint8Array = new Uint8Array(mergedPdfBuffer);
    const mergedPdfBlob = new Blob([uint8Array], { type: 'application/pdf' });

    // Create object URL from the merged blob
    const objectUrl = URL.createObjectURL(mergedPdfBlob);
    setPdfObjectUrl(objectUrl);
    return mergedPdfBlob;
};
