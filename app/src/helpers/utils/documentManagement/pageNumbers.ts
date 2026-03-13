import PDFMerger from 'pdf-merger-js/browser';
import { PDFDocument } from 'pdf-lib';

export const parsePageNumbersToRanges = (pageNumberStrings: string[]): number[][] => {
    const pageNumbers = pageNumberStrings.map((part) => {
        const trimmedPart = part.trim();
        if (trimmedPart.includes('-')) {
            const [start, end] = trimmedPart.split('-').map((num) => Number(num.trim()));
            return Array.from({ length: end - start + 1 }, (_, i) => start + i);
        }
        return [Number(trimmedPart)];
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

export const getUniquePageNumbersFromRanges = (ranges: number[][]): number[] => {
    const pageNumbers = ranges.flat();
    return [...new Set(pageNumbers)].sort((a, b) => a - b);
};

export const extractPdfBlobUsingSelectedPages = async (
    baseBlob: Blob,
    selectedPages: number[][],
    includePages: boolean,
): Promise<Blob> => {
    const buffer = await baseBlob.arrayBuffer();
    const uniquePageNumbers = getUniquePageNumbersFromRanges(selectedPages);

    // Determine which 1-based page numbers to include in the output
    let pagesToInclude: number[];
    if (includePages) {
        pagesToInclude = uniquePageNumbers;
    } else {
        const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const totalPages = srcDoc.getPageCount();
        const excludeSet = new Set(uniquePageNumbers);
        pagesToInclude = [];
        for (let i = 1; i <= totalPages; i++) {
            if (!excludeSet.has(i)) {
                pagesToInclude.push(i);
            }
        }
    }

    const merger = new PDFMerger();
    await merger.add(new Blob([buffer], { type: 'application/pdf' }), pagesToInclude);
    return await merger.saveAsBlob();
};
