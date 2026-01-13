export const fileExtensionToContentType = (extension: string): string => {
    const mapping: { [key: string]: string } = {
        pdf: 'application/pdf',
        zip: 'application/zip',
    };
    return mapping[extension.toLowerCase()] || 'application/octet-stream';
};
