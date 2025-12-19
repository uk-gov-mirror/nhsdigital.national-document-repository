import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js';
import { UploadDocument } from '../../types/pages/UploadDocumentsPage/types';

export const zipFiles = async (documents: UploadDocument[]): Promise<Blob> => {
    const blobWriter = new BlobWriter();
    const zipWriter = new ZipWriter(blobWriter);

    for (const document of documents) {
        const blobReader = new BlobReader(document.file);
        await zipWriter.add(document.file.name, blobReader, {
            useWebWorkers: false,
        });
    }

    return await zipWriter.close();
};
