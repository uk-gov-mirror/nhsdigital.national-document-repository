import { Mock } from 'vitest';
import * as downloadFileModule from './downloadFile';
import { zipFiles } from './zip';

vi.mock('./zip');

const mockZipFiles = zipFiles as Mock;

describe('file download helpers', () => {
    describe('downloadFile', () => {
        it('should create a download link and click it', () => {
            const file = new Blob(['Hello, world!'], { type: 'text/plain' });
            const fileName = 'hello.txt';

            const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
            const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

            const clickSpy = vi.fn();
            document.createElement = vi.fn().mockReturnValue({
                href: '',
                download: '',
                click: clickSpy,
            });

            downloadFileModule.downloadFile(file, fileName);

            expect(createObjectURLSpy).toHaveBeenCalledWith(file);
            expect(clickSpy).toHaveBeenCalled();
            expect(revokeObjectURLSpy).toHaveBeenCalled();
        });
    });

    describe('downloadFilesAsZip', () => {
        it('should zip files and trigger a download', async () => {
            const zipBlob = new Blob(['Zipped content'], { type: 'application/zip' });
            mockZipFiles.mockResolvedValueOnce(zipBlob);

            const files = [new File(['File 1'], 'file1.txt'), new File(['File 2'], 'file2.txt')];
            const downloadFileName = 'files.zip';

            const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
            const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

            const clickSpy = vi.fn();
            document.createElement = vi.fn().mockReturnValue({
                href: '',
                download: '',
                click: clickSpy,
            });

            await downloadFileModule.downloadFilesAsZip(files, downloadFileName);

            expect(createObjectURLSpy).toHaveBeenCalledWith(zipBlob);
            expect(clickSpy).toHaveBeenCalled();
            expect(revokeObjectURLSpy).toHaveBeenCalled();
        });
    });
});
