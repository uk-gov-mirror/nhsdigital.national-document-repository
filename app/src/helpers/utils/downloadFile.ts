import { zipFiles } from './zip';

export const downloadFile = (file: Blob, fileName: string): void => {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
};

export const downloadFilesAsZip = async (
    files: File[],
    downloadFileName: string,
): Promise<void> => {
    const zip = await zipFiles(files);
    downloadFile(zip, downloadFileName);
};
