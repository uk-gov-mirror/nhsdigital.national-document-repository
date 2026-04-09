import { Bundle } from '../../types/fhirR4/bundle';
import bundleHistory1Json from '../../types/fhirR4/bundleHistory1.fhir.json';
import { FhirDocumentReference } from '../../types/fhirR4/documentReference';
import { DOCUMENT_TYPE } from './documentType';
import {
    getCreatedDate,
    getCustodianValue,
    getDocumentReferenceFromFhir,
    getVersionId,
} from './fhirUtil';

const buildDoc = (overrides: Partial<FhirDocumentReference> = {}): FhirDocumentReference =>
    ({ resourceType: 'DocumentReference', ...overrides }) as FhirDocumentReference;

describe('fhirUtil', () => {
    describe('helper accessors tested vs bundleHistory1Json', () => {
        const doc = (bundleHistory1Json as unknown as Bundle<FhirDocumentReference>).entry![0]
            .resource;

        it('should extract versionId via getVersionId', () => {
            expect(getVersionId(doc)).toBe('1');
        });

        it('should extract created date via getCreatedDate', () => {
            expect(getCreatedDate(doc)).toBe('2024-01-10T09:15:00Z');
        });

        it('should extract custodian value via getCustodianValue', () => {
            expect(getCustodianValue(doc)).toBe('A12345');
        });
    });

    describe('getVersionId', () => {
        it('returns empty string when meta is undefined', () => {
            expect(getVersionId(buildDoc())).toBe('');
        });

        it('returns empty string when meta.versionId is undefined', () => {
            expect(getVersionId(buildDoc({ meta: {} }))).toBe('');
        });

        it('returns the versionId when present', () => {
            expect(getVersionId(buildDoc({ meta: { versionId: '42' } }))).toBe('42');
        });
    });

    describe('getCreatedDate', () => {
        it('returns empty string when date is undefined', () => {
            expect(getCreatedDate(buildDoc())).toBe('');
        });

        it('returns the date string when present', () => {
            expect(getCreatedDate(buildDoc({ date: '2025-06-01T12:00:00Z' }))).toBe(
                '2025-06-01T12:00:00Z',
            );
        });
    });

    describe('getCustodianValue', () => {
        it('returns empty string when custodian is undefined', () => {
            expect(getCustodianValue(buildDoc())).toBe('');
        });

        it('returns empty string when custodian has no identifier and no display', () => {
            expect(getCustodianValue(buildDoc({ custodian: {} }))).toBe('');
        });

        it('returns identifier value when present', () => {
            expect(
                getCustodianValue(buildDoc({ custodian: { identifier: { value: 'ODS001' } } })),
            ).toBe('ODS001');
        });

        it('falls back to display when identifier value is undefined', () => {
            expect(getCustodianValue(buildDoc({ custodian: { display: 'My Practice' } }))).toBe(
                'My Practice',
            );
        });

        it('returns empty string when identifier value is undefined and display is undefined', () => {
            expect(getCustodianValue(buildDoc({ custodian: { identifier: {} } }))).toBe('');
        });
    });

    describe('getDocumentReferenceFromFhir', () => {
        it('maps a fully populated FHIR DocumentReference to DocumentReference', () => {
            const fhirDoc = buildDoc({
                id: 'doc-123',
                date: '2024-06-15T10:00:00Z',
                author: [{ identifier: { value: 'ODS999' } }],
                type: { coding: [{ code: DOCUMENT_TYPE.LLOYD_GEORGE }] },
                meta: { versionId: '3' },
                content: [
                    {
                        attachment: {
                            title: 'patient-record.pdf',
                            size: 54321,
                            contentType: 'application/pdf',
                            url: 'https://example.org/fhir/Binary/abc',
                        },
                    },
                ],
            });

            const result = getDocumentReferenceFromFhir(fhirDoc);

            expect(result).toEqual({
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                id: 'doc-123',
                created: '2024-06-15T10:00:00Z',
                author: 'ODS999',
                fileName: 'patient-record.pdf',
                fileSize: 54321,
                version: '3',
                contentType: 'application/pdf',
                url: 'https://example.org/fhir/Binary/abc',
                isPdf: true,
                virusScannerResult: '',
            });
        });

        it('sets isPdf to false for non-PDF content types', () => {
            const fhirDoc = buildDoc({
                id: 'doc-456',
                content: [
                    {
                        attachment: {
                            title: 'image.png',
                            size: 1024,
                            contentType: 'image/png',
                            url: 'https://example.org/fhir/Binary/img',
                        },
                    },
                ],
            });

            const result = getDocumentReferenceFromFhir(fhirDoc);

            expect(result.isPdf).toBe(false);
            expect(result.contentType).toBe('image/png');
        });

        it('defaults fileName to empty string when attachment title is missing', () => {
            const fhirDoc = buildDoc({
                id: 'doc-789',
                content: [{ attachment: { url: 'https://example.org/fhir/Binary/x' } }],
            });

            const result = getDocumentReferenceFromFhir(fhirDoc);

            expect(result.fileName).toBe('');
        });

        it('defaults fileSize to 0 when attachment size is missing', () => {
            const fhirDoc = buildDoc({
                id: 'doc-size',
                content: [{ attachment: { url: 'https://example.org/fhir/Binary/x' } }],
            });

            const result = getDocumentReferenceFromFhir(fhirDoc);

            expect(result.fileSize).toBe(0);
        });

        it('defaults contentType to empty string when not provided', () => {
            const fhirDoc = buildDoc({
                id: 'doc-ct',
                content: [{ attachment: { url: 'https://example.org/fhir/Binary/x' } }],
            });

            const result = getDocumentReferenceFromFhir(fhirDoc);

            expect(result.contentType).toBe('');
            expect(result.isPdf).toBe(false);
        });

        it('uses author value as fallback for author', () => {
            const fhirDoc = buildDoc({
                id: 'doc-display',
                author: [{ display: 'GP Surgery' }],
                content: [{ attachment: { url: 'https://example.org/fhir/Binary/x' } }],
            });

            const result = getDocumentReferenceFromFhir(fhirDoc);

            expect(result.author).toBe('GP Surgery');
        });

        it('defaults author to empty string when custodian is missing', () => {
            const fhirDoc = buildDoc({
                id: 'doc-no-custodian',
                content: [{ attachment: { url: 'https://example.org/fhir/Binary/x' } }],
            });

            const result = getDocumentReferenceFromFhir(fhirDoc);

            expect(result.author).toBe('');
        });

        it('defaults created to empty string when date is missing', () => {
            const fhirDoc = buildDoc({
                id: 'doc-no-date',
                content: [{ attachment: { url: 'https://example.org/fhir/Binary/x' } }],
            });

            const result = getDocumentReferenceFromFhir(fhirDoc);

            expect(result.created).toBe('');
        });

        it('defaults version to empty string when meta is missing', () => {
            const fhirDoc = buildDoc({
                id: 'doc-no-meta',
                content: [{ attachment: { url: 'https://example.org/fhir/Binary/x' } }],
            });

            const result = getDocumentReferenceFromFhir(fhirDoc);

            expect(result.version).toBe('');
        });

        it('handles EHR document type', () => {
            const fhirDoc = buildDoc({
                id: 'ehr-doc',
                type: { coding: [{ code: DOCUMENT_TYPE.EHR }] },
                content: [{ attachment: { url: 'https://example.org/fhir/Binary/x' } }],
            });

            const result = getDocumentReferenceFromFhir(fhirDoc);

            expect(result.documentSnomedCodeType).toBe(DOCUMENT_TYPE.EHR);
        });

        it('maps the bundleHistory1Json fixture entry correctly', () => {
            const doc = (bundleHistory1Json as unknown as Bundle<FhirDocumentReference>).entry![0]
                .resource;

            const result = getDocumentReferenceFromFhir(doc);

            expect(result).toEqual({
                documentSnomedCodeType: undefined,
                id: 'LG-12345',
                created: '2024-01-10T09:15:00Z',
                author: 'A12345',
                fileName: 'Lloyd George Record',
                fileSize: 120456,
                version: '1',
                contentType: 'application/pdf',
                url: 'https://example.org/fhir/Binary/abcd',
                isPdf: true,
                virusScannerResult: '',
            });
        });

        it('always sets virusScannerResult to empty string', () => {
            const fhirDoc = buildDoc({
                id: 'doc-virus',
                content: [{ attachment: { url: 'https://example.org/fhir/Binary/x' } }],
            });

            const result = getDocumentReferenceFromFhir(fhirDoc);

            expect(result.virusScannerResult).toBe('');
        });
    });
});
