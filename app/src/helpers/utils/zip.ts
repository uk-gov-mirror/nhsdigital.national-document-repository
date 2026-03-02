import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js';

export const zipFiles = async (files: File[]): Promise<Blob> => {
    const blobWriter = new BlobWriter();
    const zipWriter = new ZipWriter(blobWriter);

    for (const file of files) {
        const blobReader = new BlobReader(file);
        await zipWriter.add(file.name, blobReader, {
            useWebWorkers: false,
        });
    }

    return await zipWriter.close();
};
