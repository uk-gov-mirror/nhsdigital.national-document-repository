import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    DOCUMENT_TYPE,
    createDocumentTypeContent,
    getDocumentTypeLabel,
    getConfigForDocType,
    getConfigForDocTypeGeneric,
    type LGContentKeys,
} from './documentType';

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

        it('should return config for LETTERS_AND_DOCS', () => {
            const config = getConfigForDocType(DOCUMENT_TYPE.LETTERS_AND_DOCS);
            expect(config.snomedCode).toBe(DOCUMENT_TYPE.LETTERS_AND_DOCS);
            expect(config.displayName).toBe('other docs and letters');
            expect(config.multifileUpload).toBe(true);
        });

        it('should throw error for unknown document type', () => {
            expect(() => getConfigForDocType('unknown' as DOCUMENT_TYPE)).toThrow(
                'No config found for document type: unknown',
            );
        });
    });

    describe('createDocumentTypeContent', () => {
        const content = {
            title: 'My Title',
            description: 'Hello {name}, you have {count} items.',
            list: ['item one', 'item two'],
        } as const;

        type TestKeys = keyof typeof content;

        let util: ReturnType<
            typeof createDocumentTypeContent<TestKeys, string | readonly string[]>
        >;
        let warnSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            util = createDocumentTypeContent(
                content as Record<TestKeys, string | readonly string[]>,
            );
            warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        });

        afterEach(() => {
            warnSpy.mockRestore();
        });

        describe('direct property access', () => {
            it('exposes string values as direct properties', () => {
                expect(util.title).toBe('My Title');
            });

            it('exposes array values as direct properties', () => {
                expect(util.list).toEqual(['item one', 'item two']);
            });
        });

        describe('getValue', () => {
            it('returns the value for a known key', () => {
                expect(util.getValue('title')).toBe('My Title');
            });

            it('returns an array value for a known key', () => {
                expect(util.getValue('list')).toEqual(['item one', 'item two']);
            });

            it('returns empty string and warns when the key is missing', () => {
                const result = util.getValue('nonExistent' as TestKeys);
                expect(result).toBe('');
                expect(warnSpy).toHaveBeenCalledWith(
                    'Content key "nonExistent" not found in document type content.',
                );
            });
        });

        describe('getValueFormatString', () => {
            it('replaces a single placeholder with the matching object property', () => {
                const titleUtil = createDocumentTypeContent({ msg: 'Hello {name}' });
                const result = titleUtil.getValueFormatString('msg', { name: 'Alice' });
                expect(result).toBe('Hello Alice');
            });

            it('replaces multiple placeholders in one string', () => {
                const result = util.getValueFormatString('description', {
                    name: 'Bob',
                    count: 3,
                });
                expect(result).toBe('Hello Bob, you have 3 items.');
            });

            it('leaves a placeholder unchanged when the matching key is absent from obj', () => {
                const result = util.getValueFormatString('description', { name: 'Carol' });
                expect(result).toBe('Hello Carol, you have {count} items.');
            });

            it('returns the raw string unchanged when there are no placeholders', () => {
                const result = util.getValueFormatString('title', {});
                expect(result).toBe('My Title');
            });

            it('returns the array value unchanged when the value is not a string', () => {
                const result = util.getValueFormatString('list', { name: 'anyone' });
                expect(result).toEqual(['item one', 'item two']);
            });

            it('returns undefined and warns when the key is missing', () => {
                const result = util.getValueFormatString('nonExistent' as TestKeys, {});
                expect(result).toBeUndefined();
                expect(warnSpy).toHaveBeenCalledWith(
                    'Content key "nonExistent" not found in document type content.',
                );
            });
        });
    });

    describe('getConfigForDocTypeGeneric', () => {
        it('returns a typed config for LLOYD_GEORGE with LG-specific keys accessible', () => {
            const config = getConfigForDocTypeGeneric<LGContentKeys>(DOCUMENT_TYPE.LLOYD_GEORGE);
            expect(config.snomedCode).toBe(DOCUMENT_TYPE.LLOYD_GEORGE);
            const label = config.content.getValue<string, LGContentKeys>('versionHistoryLinkLabel');
            expect(typeof label).toBe('string');
            expect(label!.length).toBeGreaterThan(0);
        });

        it('returns config for EHR', () => {
            const config = getConfigForDocTypeGeneric(DOCUMENT_TYPE.EHR);
            expect(config.snomedCode).toBe(DOCUMENT_TYPE.EHR);
        });

        it('returns config for EHR_ATTACHMENTS', () => {
            const config = getConfigForDocTypeGeneric(DOCUMENT_TYPE.EHR_ATTACHMENTS);
            expect(config.snomedCode).toBe(DOCUMENT_TYPE.EHR_ATTACHMENTS);
        });

        it('returns config for LETTERS_AND_DOCS', () => {
            const config = getConfigForDocTypeGeneric(DOCUMENT_TYPE.LETTERS_AND_DOCS);
            expect(config.snomedCode).toBe(DOCUMENT_TYPE.LETTERS_AND_DOCS);
        });

        it('falls back to getConfigForDocType for unknown type', () => {
            expect(() => getConfigForDocTypeGeneric('unknown' as DOCUMENT_TYPE)).toThrow(
                'No config found for document type: unknown',
            );
        });
    });
});
