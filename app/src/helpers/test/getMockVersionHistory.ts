import { Bundle } from '../../types/fhirR4/bundle';
import { FhirDocumentReference } from '../../types/fhirR4/documentReference';
import { DocumentReferenceStatus } from '../../types/fhirR4/documentReference';

export const mockDocumentVersionHistoryResponse: Bundle<FhirDocumentReference> = {
    resourceType: 'Bundle',
    type: 'history',
    total: 3,
    entry: [
        {
            fullUrl: 'urn:uuid:2a7a270e-aa1d-532e-8648-d5d8e3defb82',
            resource: {
                resourceType: 'DocumentReference',
                id: '2a7a270e-aa1d-532e-8648-d5d8e3defb82',
                meta: {
                    versionId: '3',
                    lastUpdated: '2025-12-15T10:30:00Z',
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
                            url: 'https://documents.example.com/2a7a270e-aa1d-532e-8648-d5d8e3defb82',
                            size: 3072,
                            title: 'document_v3.pdf',
                            creation: '2025-12-15T10:30:00Z',
                        },
                    },
                ],
            },
        },
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
                            url: 'https://documents.example.com/c889dbbf-2e3a-5860-ab90-9421b5e29b86',
                            size: 2048,
                            title: 'document_v2.pdf',
                            creation: '2025-11-10T14:00:00Z',
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
                            url: 'https://documents.example.com/232865e2-c1b5-58c5-bc1c-9d355907b649',
                            size: 1024,
                            title: 'document_v1.pdf',
                            creation: '2025-10-01T09:00:00Z',
                        },
                    },
                ],
            },
        },
    ],
};
