/**
 * FHIR R4 DocumentReference Resource
 * A reference to a document of any kind for any purpose.
 *
 * @see https://hl7.org/fhir/R4/documentreference.html
 */

import {
    Attachment,
    CodeableConcept,
    Coding,
    DomainResource,
    Element,
    Extension,
    Identifier,
    Period,
    Reference,
} from './baseTypes';
import {
    DocumentReferenceDocStatus,
    DocumentReferenceStatus,
    DocumentRelationshipType,
} from './valueSets';
export {
    DocumentReferenceDocStatus,
    DocumentReferenceStatus,
    DocumentRelationshipType,
} from './valueSets';

/**
 * Relationships to other documents.
 * @see https://hl7.org/fhir/R4/documentreference-definitions.html#DocumentReference.relatesTo
 */
export interface DocumentReferenceRelatesTo extends Element {
    /** Additional content defined by implementations */
    extension?: Extension[];
    /** Extensions that cannot be ignored even if unrecognized */
    modifierExtension?: Extension[];
    /** replaces | transforms | signs | appends */
    code: DocumentRelationshipType | string;
    /** Target of the relationship */
    target: Reference;
}

/**
 * Document referenced — the actual content of the document.
 * @see https://hl7.org/fhir/R4/documentreference-definitions.html#DocumentReference.content
 */
export interface DocumentReferenceContent extends Element {
    /** Additional content defined by implementations */
    extension?: Extension[];
    /** Extensions that cannot be ignored even if unrecognized */
    modifierExtension?: Extension[];
    /** Where to access the document */
    attachment: Attachment;
    /** Format/content rules for the document */
    format?: Coding;
}

/**
 * Clinical context of the document.
 * @see https://hl7.org/fhir/R4/documentreference-definitions.html#DocumentReference.context
 */
export interface DocumentReferenceContext extends Element {
    /** Additional content defined by implementations */
    extension?: Extension[];
    /** Extensions that cannot be ignored even if unrecognized */
    modifierExtension?: Extension[];
    /** Context of the document content — Encounter or EpisodeOfCare */
    encounter?: Reference[];
    /** Main clinical acts documented (e.g. procedure codes) */
    event?: CodeableConcept[];
    /** Time of service that is being documented */
    period?: Period;
    /** Kind of facility where patient was seen */
    facilityType?: CodeableConcept;
    /** Additional details about where the content was created (e.g. clinical specialty) */
    practiceSetting?: CodeableConcept;
    /** Patient demographics from source */
    sourcePatientInfo?: Reference;
    /** Related identifiers or resources */
    related?: Reference[];
}

// ─── DocumentReference Resource ──────────────────────────────────────────────

/**
 * A reference to a document of any kind for any purpose. Provides metadata
 * about the document so that the document can be discovered and managed. The
 * scope of a document is any serially-produced media object with an identified
 * MIME type, e.g., clinical notes, discharge summaries, x-rays, etc.
 *
 * @see https://hl7.org/fhir/R4/documentreference.html
 */
export interface FhirDocumentReference extends DomainResource {
    /** Resource type discriminator */
    resourceType: 'DocumentReference';

    /**
     * Master Version Specific Identifier.
     * Document identifier as assigned by the source of the document.
     * This identifier is specific to this version of the document.
     */
    masterIdentifier?: Identifier;

    /**
     * Other identifiers for the document.
     * May include accession numbers, provider-specific identifiers, etc.
     */
    identifier?: Identifier[];

    /**
     * The status of this document reference.
     * current | superseded | entered-in-error
     */
    status: DocumentReferenceStatus | string;

    /**
     * Status of the underlying document.
     * preliminary | final | amended | entered-in-error
     */
    docStatus?: DocumentReferenceDocStatus | string;

    /**
     * Kind of document (LOINC if possible).
     * Specifies the particular kind of document referenced.
     */
    type?: CodeableConcept;

    /**
     * Categorization of document.
     * A categorization for the type of document referenced — helps for indexing
     * and searching. This may be implied by or derived from the code specified
     * in the DocumentReference.type.
     */
    category?: CodeableConcept[];

    /**
     * Who/what is the subject of the document.
     * Who or what the document is about. The document can be about a person
     * (patient or healthcare practitioner), a device, or even a group of subjects.
     * Reference(Patient | Practitioner | Group | Device)
     */
    subject?: Reference;

    /**
     * When this document reference was created.
     * When the document reference was created.
     */
    date?: string;

    /**
     * Who and/or what authored the document.
     * Identifies who is responsible for adding the information to the document.
     * Reference(Practitioner | PractitionerRole | Organization | Device | Patient | RelatedPerson)
     */
    author?: Reference[];

    /**
     * Who/what authenticated the document.
     * Which person or organization authenticates that this document is valid.
     * Reference(Practitioner | PractitionerRole | Organization)
     */
    authenticator?: Reference;

    /**
     * Organization which maintains the document.
     * Identifies the organization or group who is responsible for ongoing
     * maintenance of and access to the document.
     * Reference(Organization)
     */
    custodian?: Reference;

    /**
     * Relationships to other documents.
     * Relationships that this document has with other document references that already exist.
     */
    relatesTo?: DocumentReferenceRelatesTo[];

    /**
     * Human-readable description of the source document.
     */
    description?: string;

    /**
     * Document security-tags.
     * A set of Security-Tag codes specifying the level of privacy/security
     * of the document. Note that DocumentReference.meta.security contains
     * the security labels of the "reference" to the document, while
     * DocumentReference.securityLabel contains the security labels of the
     * document itself.
     */
    securityLabel?: CodeableConcept[];

    /**
     * Document referenced.
     * The document and format referenced. There may be multiple content elements,
     * each with a different format.
     */
    content: DocumentReferenceContent[];

    /**
     * Clinical context of document.
     * The clinical context in which the document was prepared.
     */
    context?: DocumentReferenceContext;
}
