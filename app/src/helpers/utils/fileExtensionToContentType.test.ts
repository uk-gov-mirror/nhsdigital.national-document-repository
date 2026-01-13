import { describe, expect, it } from 'vitest';
import { fileExtensionToContentType } from './fileExtensionToContentType';

describe('fileExtensionToContentType', () => {
    it('maps known extensions', () => {
        expect(fileExtensionToContentType('pdf')).toBe('application/pdf');
        expect(fileExtensionToContentType('zip')).toBe('application/zip');
    });

    it('is case-insensitive', () => {
        expect(fileExtensionToContentType('PDF')).toBe('application/pdf');
        expect(fileExtensionToContentType('ZIP')).toBe('application/zip');
    });

    it('returns octet-stream for unknown extensions', () => {
        expect(fileExtensionToContentType('png')).toBe('application/octet-stream');
        expect(fileExtensionToContentType('')).toBe('application/octet-stream');
    });
});
