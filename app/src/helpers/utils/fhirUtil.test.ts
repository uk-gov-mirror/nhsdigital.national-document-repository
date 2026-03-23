import { Bundle } from '../../types/fhirR4/bundle';
import bundleHistory1Json from '../../types/fhirR4/bundleHistory1.fhir.json';
import { FhirDocumentReference } from '../../types/fhirR4/documentReference';
import { getCreatedDate, getCustodianValue, getVersionId } from './fhirUtil';

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
});
