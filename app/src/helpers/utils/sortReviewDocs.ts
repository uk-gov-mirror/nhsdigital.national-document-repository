import { ReviewUploadDocument } from '../../types/pages/UploadDocumentsPage/types';

export const sortDocumentsForReview = (
    uploadDocuments: ReviewUploadDocument[],
    additionalFiles: ReviewUploadDocument[],
): ReviewUploadDocument[] => {
    const updatedUploadDocuments = uploadDocuments.map((document) => {
        const fileInAdditionalFiles = additionalFiles.find((f) => f.id === document.id);
        if (fileInAdditionalFiles?.position !== undefined) {
            return { ...document, position: fileInAdditionalFiles.position };
        }
        return document;
    });

    const newFiles = additionalFiles.filter(
        (f) => f.type === undefined && !uploadDocuments.some((d) => d.file.name === f.file.name),
    );

    return [...updatedUploadDocuments, ...newFiles];
};
