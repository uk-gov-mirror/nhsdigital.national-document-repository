import { describe, it, expect, vi, beforeEach } from 'vitest';
import { zipFiles } from './zip';

const mockedAdd = vi.fn();
const mockedClose = vi.fn();

vi.mock('@zip.js/zip.js', () => ({
    BlobReader: vi.fn(class {}),
    BlobWriter: vi.fn(class {}),
    ZipWriter: vi.fn(
        class {
            add = mockedAdd;
            close = mockedClose;
        },
    ),
}));

describe('zipFiles', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create a zip file from documents', async () => {
        const mockBlob = new Blob(['zip content']);
        mockedClose.mockResolvedValue(mockBlob);

        const documents: File[] = [
            new File(['content1'], 'file1.txt'),
            new File(['content2'], 'file2.txt'),
        ];

        const result = await zipFiles(documents);

        expect(mockedAdd).toHaveBeenCalledTimes(2);
        expect(mockedAdd).toHaveBeenCalledWith('file1.txt', {}, { useWebWorkers: false });
        expect(mockedAdd).toHaveBeenCalledWith('file2.txt', {}, { useWebWorkers: false });
        expect(mockedClose).toHaveBeenCalled();
        expect(result).toBe(mockBlob);
    });

    it('should handle empty documents array', async () => {
        const mockBlob = new Blob(['empty zip']);
        mockedClose.mockResolvedValue(mockBlob);

        const result = await zipFiles([]);

        expect(mockedAdd).not.toHaveBeenCalled();
        expect(mockedClose).toHaveBeenCalled();
        expect(result).toBe(mockBlob);
    });

    it('should handle single document', async () => {
        const mockBlob = new Blob(['single file zip']);
        mockedClose.mockResolvedValue(mockBlob);

        const documents: File[] = [new File(['content'], 'single.pdf')];

        const result = await zipFiles(documents);

        expect(mockedAdd).toHaveBeenCalledOnce();
        expect(mockedAdd).toHaveBeenCalledWith('single.pdf', {}, { useWebWorkers: false });
        expect(result).toBe(mockBlob);
    });
});
