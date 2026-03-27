import { Bundle } from '../../types/fhirR4/bundle';
import { FhirDocumentReference } from '../../types/fhirR4/documentReference';
import { DocumentReferenceStatus } from '../../types/fhirR4/documentReference';

export const mockDocumentVersionHistoryResponse: Bundle<FhirDocumentReference> = {
    resourceType: 'Bundle',
    type: 'history',
    total: 5,
    entry: [
        {
            fullUrl: 'urn:uuid:c889dbbf-2e3a-5860-ab90-9421b5e29b86',
            resource: {
                resourceType: 'DocumentReference',
                id: 'c889dbbf-2e3a-5860-ab90-9421b5e29b86',
                meta: {
                    versionId: '2',
                    lastUpdated: '2025-11-10T14:00:00Z',
                },
                status: DocumentReferenceStatus.Superseded,
                type: {
                    coding: [
                        {
                            system: 'http://snomed.info/sct',
                            code: '16521000000101',
                            display: 'Lloyd George record folder',
                        },
                    ],
                },
                subject: {
                    identifier: {
                        system: 'https://fhir.nhs.uk/Id/nhs-number',
                        value: '9000000009',
                    },
                },
                date: '2025-11-10T14:00:00Z',
                author: [
                    {
                        identifier: {
                            system: 'https://fhir.nhs.uk/Id/ods-organization-code',
                            value: 'Y12345',
                        },
                        display: 'Y12345',
                    },
                ],
                custodian: {
                    identifier: {
                        system: 'https://fhir.nhs.uk/Id/ods-organization-code',
                        value: 'Y12345',
                    },
                    display: 'Y12345',
                },
                content: [
                    {
                        attachment: {
                            contentType: 'application/pdf',
                            url: '/dev/testFile.pdf',
                            size: 2048,
                            title: 'document_v2.pdf',
                            creation: '2025-11-10T14:00:00Z',
                        },
                    },
                ],
            },
        },
        {
            fullUrl: 'urn:uuid:a4f3c812-7e90-4b21-9f3d-6c1a2e84d057',
            resource: {
                resourceType: 'DocumentReference',
                id: 'a4f3c812-7e90-4b21-9f3d-6c1a2e84d057',
                meta: {
                    versionId: '4',
                    lastUpdated: '2026-01-20T08:45:00Z',
                },
                status: DocumentReferenceStatus.Superseded,
                type: {
                    coding: [
                        {
                            system: 'http://snomed.info/sct',
                            code: '16521000000101',
                            display: 'Lloyd George record folder',
                        },
                    ],
                },
                subject: {
                    identifier: {
                        system: 'https://fhir.nhs.uk/Id/nhs-number',
                        value: '9000000009',
                    },
                },
                date: '2026-01-20T08:45:00Z',
                author: [
                    {
                        identifier: {
                            system: 'https://fhir.nhs.uk/Id/ods-organization-code',
                            value: 'B67890',
                        },
                        display: 'B67890',
                    },
                ],
                custodian: {
                    identifier: {
                        system: 'https://fhir.nhs.uk/Id/ods-organization-code',
                        value: 'B67890',
                    },
                    display: 'B67890',
                },
                content: [
                    {
                        attachment: {
                            contentType: 'application/pdf',
                            url: '/dev/testFile4.pdf',
                            size: 4096,
                            title: 'document_v4.pdf',
                            creation: '2026-01-20T08:45:00Z',
                        },
                    },
                ],
            },
        },
        {
            fullUrl: 'urn:uuid:232865e2-c1b5-58c5-bc1c-9d355907b649',
            resource: {
                resourceType: 'DocumentReference',
                id: '232865e2-c1b5-58c5-bc1c-9d355907b649',
                meta: {
                    versionId: '1',
                    lastUpdated: '2025-10-01T09:00:00Z',
                },
                status: DocumentReferenceStatus.Superseded,
                type: {
                    coding: [
                        {
                            system: 'http://snomed.info/sct',
                            code: '16521000000101',
                            display: 'Lloyd George record folder',
                        },
                    ],
                },
                subject: {
                    identifier: {
                        system: 'https://fhir.nhs.uk/Id/nhs-number',
                        value: '9000000009',
                    },
                },
                date: '2025-10-01T09:00:00Z',
                author: [
                    {
                        identifier: {
                            system: 'https://fhir.nhs.uk/Id/ods-organization-code',
                            value: 'A12345',
                        },
                        display: 'A12345',
                    },
                ],
                custodian: {
                    identifier: {
                        system: 'https://fhir.nhs.uk/Id/ods-organization-code',
                        value: 'A12345',
                    },
                    display: 'A12345',
                },
                content: [
                    {
                        attachment: {
                            contentType: 'application/pdf',
                            url: '/dev/testFile3.pdf',
                            size: 1024,
                            title: 'document_v1.pdf',
                            creation: '2025-10-01T09:00:00Z',
                        },
                    },
                ],
            },
        },
        {
            fullUrl: 'urn:uuid:e7b1d94f-3c62-4a87-b5e0-8f2d1a6c9340',
            resource: {
                resourceType: 'DocumentReference',
                id: 'e7b1d94f-3c62-4a87-b5e0-8f2d1a6c9340',
                meta: {
                    versionId: '5',
                    lastUpdated: '2026-02-28T16:15:00Z',
                },
                status: DocumentReferenceStatus.Current,
                type: {
                    coding: [
                        {
                            system: 'http://snomed.info/sct',
                            code: '16521000000101',
                            display: 'Lloyd George record folder',
                        },
                    ],
                },
                subject: {
                    identifier: {
                        system: 'https://fhir.nhs.uk/Id/nhs-number',
                        value: '9000000009',
                    },
                },
                date: '2026-02-28T16:15:00Z',
                author: [
                    {
                        identifier: {
                            system: 'https://fhir.nhs.uk/Id/ods-organization-code',
                            value: 'Y12345',
                        },
                        display: 'Y12345',
                    },
                ],
                custodian: {
                    identifier: {
                        system: 'https://fhir.nhs.uk/Id/ods-organization-code',
                        value: 'Y12345',
                    },
                    display: 'Y12345',
                },
                content: [
                    {
                        attachment: {
                            contentType: 'application/pdf',
                            url: '/dev/testFile5.pdf',
                            size: 5120,
                            title: 'document_v5.pdf',
                            creation: '2026-02-28T16:15:00Z',
                        },
                    },
                ],
            },
        },
        {
            fullUrl: 'urn:uuid:2a7a270e-aa1d-532e-8648-d5d8e3defb82',
            resource: {
                resourceType: 'DocumentReference',
                id: '2a7a270e-aa1d-532e-8648-d5d8e3defb82',
                meta: {
                    versionId: '3',
                    lastUpdated: '2025-12-15T10:30:00Z',
                },
                status: DocumentReferenceStatus.Superseded,
                type: {
                    coding: [
                        {
                            system: 'http://snomed.info/sct',
                            code: '16521000000101',
                            display: 'Lloyd George record folder',
                        },
                    ],
                },
                subject: {
                    identifier: {
                        system: 'https://fhir.nhs.uk/Id/nhs-number',
                        value: '9000000009',
                    },
                },
                date: '2025-12-15T10:30:00Z',
                author: [
                    {
                        identifier: {
                            system: 'https://fhir.nhs.uk/Id/ods-organization-code',
                            value: 'Y12345',
                        },
                        display: 'Y12345',
                    },
                ],
                custodian: {
                    identifier: {
                        system: 'https://fhir.nhs.uk/Id/ods-organization-code',
                        value: 'Y12345',
                    },
                    display: 'Y12345',
                },
                content: [
                    {
                        attachment: {
                            contentType: 'application/pdf',
                            url: '/dev/testFile1.pdf',
                            size: 3072,
                            title: 'document_v3.pdf',
                            creation: '2025-12-15T10:30:00Z',
                        },
                    },
                ],
            },
        },
    ],
};
