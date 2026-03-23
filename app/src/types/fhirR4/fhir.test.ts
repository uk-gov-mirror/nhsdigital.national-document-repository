import { describe, expect, it } from 'vitest';
import { BundleType } from './bundle';
import type { Bundle, BundleEntry } from './bundle';
import type { FhirDocumentReference } from './documentReference';
import bundleHistory1Json from './bundleHistory1.fhir.json';
import bundleHistory2Json from './bundleHistory2.fhir.json';

const bundleHistory = bundleHistory1Json as unknown as Bundle<FhirDocumentReference>;
const firstEntry = bundleHistory.entry?.[0]?.resource as FhirDocumentReference;
const secondEntry = bundleHistory.entry?.[1]?.resource as FhirDocumentReference;

describe('FHIR Bundle<DocumentReference> history mapping', () => {
    describe.each([
        ['bundleHistory1Json', bundleHistory1Json],
        ['bundleHistory2Json', bundleHistory2Json],
    ])('Generic Bundle model mapping — %s', (_, fixture) => {
        const bundle = fixture as unknown as Bundle<FhirDocumentReference>;

        describe('Bundle shape', () => {
            it('has resourceType "Bundle"', () => {
                expect(bundle.resourceType).toBe('Bundle');
            });

            it('has a valid BundleType for type', () => {
                expect(Object.values(BundleType)).toContain(bundle.type);
            });

            it('has a timestamp string', () => {
                expect(typeof bundle.timestamp).toBe('string');
                expect(bundle.timestamp).toBeTruthy();
            });

            it('has a numeric total', () => {
                expect(typeof bundle.total).toBe('number');
            });

            it('has an entry array', () => {
                expect(Array.isArray(bundle.entry)).toBe(true);
            });

            it('total matches entry count', () => {
                expect(bundle.entry?.length).toBe(bundle.total);
            });
        });

        describe('Bundle entry shape', () => {
            it('every entry has a fullUrl string', () => {
                bundle.entry?.forEach((e: BundleEntry<FhirDocumentReference>) => {
                    if (typeof e.fullUrl !== 'undefined') {
                        expect(typeof e.fullUrl).toBe('string');
                        expect(e.fullUrl).toBeTruthy();
                    } else {
                        expect(e.fullUrl).toBeUndefined();
                    }
                });
            });

            it('every entry has a resource object', () => {
                bundle.entry?.forEach((e: BundleEntry<FhirDocumentReference>) => {
                    expect(e.resource).toBeDefined();
                    expect(typeof e.resource).toBe('object');
                });
            });
        });

        describe('DocumentReference shape', () => {
            it('every resource has resourceType "DocumentReference"', () => {
                bundle.entry?.forEach((e: BundleEntry<FhirDocumentReference>) => {
                    expect(e.resource.resourceType).toBe('DocumentReference');
                });
            });

            it('every resource has an id string', () => {
                bundle.entry?.forEach((e: BundleEntry<FhirDocumentReference>) => {
                    expect(typeof e.resource.id).toBe('string');
                    expect(e.resource.id).toBeTruthy();
                });
            });

            it('every resource has meta.versionId', () => {
                bundle.entry?.forEach((e: BundleEntry<FhirDocumentReference>) => {
                    expect(e.resource.meta?.versionId).toBeDefined();
                });
            });

            it('every resource has a date string', () => {
                bundle.entry?.forEach((e: BundleEntry<FhirDocumentReference>) => {
                    expect(typeof e.resource.date).toBe('string');
                });
            });

            it('every resource has subject with NHS number identifier', () => {
                bundle.entry?.forEach((e: BundleEntry<FhirDocumentReference>) => {
                    expect(e.resource.subject?.identifier?.system).toBe(
                        'https://fhir.nhs.uk/Id/nhs-number',
                    );
                    expect(e.resource.subject?.identifier?.value).toBeTruthy();
                });
            });

            it('every resource has at least one author with ODS identifier', () => {
                bundle.entry?.forEach((e: BundleEntry<FhirDocumentReference>) => {
                    expect(e.resource.author?.length).toBeGreaterThan(0);
                    expect(e.resource.author?.[0]?.identifier?.value).toBeTruthy();
                });
            });

            it('every resource has a custodian with ODS identifier', () => {
                bundle.entry?.forEach((e: BundleEntry<FhirDocumentReference>) => {
                    expect(e.resource.custodian?.identifier?.value).toBeTruthy();
                });
            });

            it('every resource has at least one content item', () => {
                bundle.entry?.forEach((e: BundleEntry<FhirDocumentReference>) => {
                    expect(e.resource.content.length).toBeGreaterThan(0);
                });
            });

            it('every content item has an attachment with url and contentType', () => {
                bundle.entry?.forEach((e: BundleEntry<FhirDocumentReference>) => {
                    e.resource.content.forEach((c) => {
                        if (typeof c.attachment.url === 'string') {
                            expect(c.attachment.url).toBeTruthy();
                        } else {
                            expect(c.attachment.url).toBeUndefined();
                        }
                        if (typeof c.attachment.contentType === 'string') {
                            expect(c.attachment.contentType).toBeTruthy();
                        } else {
                            expect(c.attachment.contentType).toBeUndefined();
                        }
                    });
                });
            });

            it('every content item attachment has a positive size', () => {
                bundle.entry?.forEach((e: BundleEntry<FhirDocumentReference>) => {
                    e.resource.content.forEach((c) => {
                        if (typeof c.attachment.size === 'number') {
                            expect(c.attachment.size).toBeGreaterThan(0);
                        } else {
                            expect(c.attachment.size).toBeUndefined();
                        }
                    });
                });
            });
        });
    });

    describe('Bundle top-level fields', () => {
        it('has resourceType "Bundle"', () => {
            expect(bundleHistory.resourceType).toBe('Bundle');
        });

        it('has type "history"', () => {
            expect(bundleHistory.type).toBe(BundleType.History);
        });

        it('has timestamp', () => {
            expect(bundleHistory.timestamp).toBe('2026-02-17T00:00:00Z');
        });

        it('has total of 2', () => {
            expect(bundleHistory.total).toBe(2);
        });

        it('has 2 entries', () => {
            expect(bundleHistory.entry).toHaveLength(2);
        });

        it('satisfies Bundle<DocumentReference> type', () => {
            const typed: Bundle<FhirDocumentReference> = bundleHistory;
            expect(typed).toBeDefined();
        });
    });

    describe('Bundle entry fullUrls', () => {
        it('first entry has expected fullUrl containing _history/1', () => {
            expect(bundleHistory.entry?.[0].fullUrl).toContain('_history/1');
        });

        it('second entry has expected fullUrl containing _history/2', () => {
            expect(bundleHistory.entry?.[1].fullUrl).toContain('_history/2');
        });
    });

    describe('DocumentReference — first entry (version 1)', () => {
        it('has resourceType "DocumentReference"', () => {
            expect(firstEntry.resourceType).toBe('DocumentReference');
        });

        it('has id "LG-12345"', () => {
            expect(firstEntry.id).toBe('LG-12345');
        });

        it('has meta.versionId "1"', () => {
            expect(firstEntry.meta?.versionId).toBe('1');
        });

        it('has date "2024-01-10T09:15:00Z"', () => {
            expect(firstEntry.date).toBe('2024-01-10T09:15:00Z');
        });

        it('has subject NHS number "9999999999"', () => {
            expect(firstEntry.subject?.identifier?.value).toBe('9999999999');
        });

        it('has subject NHS number system', () => {
            expect(firstEntry.subject?.identifier?.system).toBe(
                'https://fhir.nhs.uk/Id/nhs-number',
            );
        });

        it('has author ODS code "A12345"', () => {
            expect(firstEntry.author?.[0]?.identifier?.value).toBe('A12345');
        });

        it('has custodian ODS code "A12345"', () => {
            expect(firstEntry.custodian?.identifier?.value).toBe('A12345');
        });

        it('has one content item', () => {
            expect(firstEntry.content).toHaveLength(1);
        });

        it('content attachment has contentType "application/pdf"', () => {
            expect(firstEntry.content[0].attachment.contentType).toBe('application/pdf');
        });

        it('content attachment has title "Lloyd George Record"', () => {
            expect(firstEntry.content[0].attachment.title).toBe('Lloyd George Record');
        });

        it('content attachment has correct size', () => {
            expect(firstEntry.content[0].attachment.size).toBe(120456);
        });

        it('content attachment has url', () => {
            expect(firstEntry.content[0].attachment.url).toBe(
                'https://example.org/fhir/Binary/abcd',
            );
        });

        it('content attachment has creation date', () => {
            expect(firstEntry.content[0].attachment.creation).toBe('2024-01-10T09:15:00Z');
        });

        it('content format has NRL CodeSystem system', () => {
            expect(firstEntry.content[0].format?.system).toBe(
                'https://fhir.nhs.uk/England/CodeSystem/England-NRLFormatCode',
            );
        });

        it('content extension has stability code "static"', () => {
            const extension = firstEntry.content[0].extension?.[0];
            expect(extension?.valueCodeableConcept?.coding?.[0].code).toBe('static');
        });
    });

    describe('DocumentReference — second entry (version 2)', () => {
        it('has resourceType "DocumentReference"', () => {
            expect(secondEntry.resourceType).toBe('DocumentReference');
        });

        it('has id "LG-12345"', () => {
            expect(secondEntry.id).toBe('LG-12345');
        });

        it('has meta.versionId "2"', () => {
            expect(secondEntry.meta?.versionId).toBe('2');
        });

        it('has date "2024-02-12T14:05:00Z"', () => {
            expect(secondEntry.date).toBe('2024-02-12T14:05:00Z');
        });

        it('has same subject NHS number as version 1', () => {
            expect(secondEntry.subject?.identifier?.value).toBe('9999999999');
        });

        it('has author ODS code "A12345"', () => {
            expect(secondEntry.author?.[0]?.identifier?.value).toBe('A12345');
        });

        it('has custodian ODS code "A12345"', () => {
            expect(secondEntry.custodian?.identifier?.value).toBe('A12345');
        });

        it('content attachment has same size as version 1 (content unchanged)', () => {
            expect(secondEntry.content[0].attachment.size).toBe(120456);
        });

        it('content extension has stability code "static"', () => {
            const extension = secondEntry.content[0].extension?.[0];
            expect(extension?.valueCodeableConcept?.coding?.[0].code).toBe('static');
        });
    });

    describe('Version history consistency', () => {
        it('both versions share the same document id', () => {
            expect(firstEntry.id).toBe(secondEntry.id);
        });

        it('version numbers are sequential', () => {
            expect(Number(firstEntry.meta?.versionId)).toBe(1);
            expect(Number(secondEntry.meta?.versionId)).toBe(2);
        });

        it('second entry date is later than first entry date', () => {
            const firstDate = new Date(firstEntry.date ?? '');
            const secondDate = new Date(secondEntry.date ?? '');
            expect(secondDate.getTime()).toBeGreaterThan(firstDate.getTime());
        });

        it('both versions reference the same attachment URL', () => {
            expect(firstEntry.content[0].attachment.url).toBe(
                secondEntry.content[0].attachment.url,
            );
        });
    });
});
