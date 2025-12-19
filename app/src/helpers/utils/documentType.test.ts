import { describe, it, expect, vi } from 'vitest';
import { DOCUMENT_TYPE, getDocumentTypeLabel, getConfigForDocType } from './documentType';

describe('documentType', () => {
    describe('getDocumentTypeLabel', () => {
        it('should return correct label for LLOYD_GEORGE', () => {
            expect(getDocumentTypeLabel(DOCUMENT_TYPE.LLOYD_GEORGE)).toBe('Scanned paper notes');
        });

        it('should return correct label for EHR', () => {
            expect(getDocumentTypeLabel(DOCUMENT_TYPE.EHR)).toBe('Electronic health record');
        });

        it('should return correct label for EHR_ATTACHMENTS', () => {
            expect(getDocumentTypeLabel(DOCUMENT_TYPE.EHR_ATTACHMENTS)).toBe(
                'Electronic health record attachments',
            );
        });

        it('should return correct label for LETTERS_AND_DOCS', () => {
            expect(getDocumentTypeLabel(DOCUMENT_TYPE.LETTERS_AND_DOCS)).toBe(
                'Patient letters and documents',
            );
        });

        it('should return empty string for unknown document type', () => {
            expect(getDocumentTypeLabel('unknown' as DOCUMENT_TYPE)).toBe('');
        });
    });

    describe('getConfigForDocType', () => {
        it('should return config for LLOYD_GEORGE', () => {
            const config = getConfigForDocType(DOCUMENT_TYPE.LLOYD_GEORGE);
            expect(config.snomedCode).toBe(DOCUMENT_TYPE.LLOYD_GEORGE);
            expect(config.displayName).toBe('scanned paper notes');
            expect(config.canBeUpdated).toBe(true);
        });

        it('should return config for EHR', () => {
            const config = getConfigForDocType(DOCUMENT_TYPE.EHR);
            expect(config.snomedCode).toBe(DOCUMENT_TYPE.EHR);
            expect(config.displayName).toBe('electronic health record');
            expect(config.canBeUpdated).toBe(false);
        });

        it('should return config for EHR_ATTACHMENTS', () => {
            const config = getConfigForDocType(DOCUMENT_TYPE.EHR_ATTACHMENTS);
            expect(config.snomedCode).toBe(DOCUMENT_TYPE.EHR_ATTACHMENTS);
            expect(config.displayName).toBe('electronic health record attachments');
            expect(config.multifileUpload).toBe(true);
        });

        it('should throw error for unsupported document type', () => {
            expect(() => getConfigForDocType(DOCUMENT_TYPE.LETTERS_AND_DOCS)).toThrow(
                `No config found for document type: ${DOCUMENT_TYPE.LETTERS_AND_DOCS}`,
            );
        });

        it('should throw error for unknown document type', () => {
            expect(() => getConfigForDocType('unknown' as DOCUMENT_TYPE)).toThrow(
                'No config found for document type: unknown',
            );
        });
    });
});
