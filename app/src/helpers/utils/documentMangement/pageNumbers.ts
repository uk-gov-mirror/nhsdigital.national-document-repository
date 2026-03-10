export const parsePageNumbersToIndices = (pageNumberStrings: string[]): number[] => {
    const pageNumbers = pageNumberStrings.flatMap((part) => {
        const trimmedPart = part.trim();
        if (trimmedPart.includes('-')) {
            const [start, end] = trimmedPart.split('-').map((num) => Number(num.trim()) - 1);
            return Array.from({ length: end - start + 1 }, (_, i) => start + i);
        }
        return [Number(trimmedPart) - 1];
    });
    const uniquePageNumbers = [...new Set(pageNumbers)].sort((a, b) => a - b);

    return uniquePageNumbers;
};
