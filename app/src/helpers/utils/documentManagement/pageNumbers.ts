import { getDocument } from 'pdfjs-dist';

export const parsePageNumbersToIndexRanges = (pageNumberStrings: string[]): number[][] => {
    const pageNumbers = pageNumberStrings.map((part) => {
        const trimmedPart = part.trim();
        if (trimmedPart.includes('-')) {
            const [start, end] = trimmedPart.split('-').map((num) => Number(num.trim()) - 1);
            return Array.from({ length: end - start + 1 }, (_, i) => start + i);
        }
        return [Number(trimmedPart) - 1];
    });
    const uniquePageNumbers = [...new Set(pageNumbers.flat())].sort((a, b) => a - b);

    const ranges: number[][] = [];
    for (const num of uniquePageNumbers) {
        const lastRange = ranges.at(-1);
        if (lastRange && num === lastRange.at(-1)! + 1) {
            lastRange.push(num);
        } else {
            ranges.push([num]);
        }
    }

    return ranges;
};

export const getUniquePageNumbersFromIndexRanges = (indexRanges: number[][]): number[] => {
    const pageNumbers = indexRanges.flat();
    return [...new Set(pageNumbers)].sort((a, b) => a - b);
};

export const extractPdfBlobUsingSelectedPages = async (
    baseBlob: Blob,
    selectedPages: number[][],
    includePages: boolean,
): Promise<Blob> => {
    const buffer1 = await baseBlob.arrayBuffer();
    const buffer2 = await baseBlob.arrayBuffer();
    const pdf = await getDocument(buffer1).promise;
    const uniquePageNumbers = getUniquePageNumbersFromIndexRanges(selectedPages);

    const options: [any] = [
        {
            document: new Uint8Array(buffer2),
        },
    ];

    if (includePages) {
        options[0]['includePages'] = uniquePageNumbers;
    } else {
        options[0]['excludePages'] = uniquePageNumbers;
    }

    const result = await pdf.extractPages(options);

    return new Blob([result.buffer as ArrayBuffer], { type: 'application/pdf' });
};
