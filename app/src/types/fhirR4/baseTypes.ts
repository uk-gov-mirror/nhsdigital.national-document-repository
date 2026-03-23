/**
 * FHIR R4 Base Data Types
 * @see https://hl7.org/fhir/R4/datatypes.html
 * @see https://hl7.org/fhir/R4/references.html
 * @see https://hl7.org/fhir/R4/resource.html
 */

// ─── Element ─────────────────────────────────────────────────────────────────

/**
 * Base definition for all elements in a resource.
 * @see https://hl7.org/fhir/R4/element.html
 */
export interface Element {
    /** Unique id for inter-element referencing */
    id?: string;
    /** Additional content defined by implementations */
    extension?: Extension[];
}

// ─── Extension ───────────────────────────────────────────────────────────────

/**
 * Optional Extensions Element — found in all resources and data types.
 * @see https://hl7.org/fhir/R4/extensibility.html#Extension
 */
export interface Extension extends Element {
    /** Identifies the meaning of the extension */
    url: string;

    // Each extension can carry ONE of the following value types:
    valueBase64Binary?: string;
    valueBoolean?: boolean;
    valueCanonical?: string;
    valueCode?: string;
    valueDate?: string;
    valueDateTime?: string;
    valueDecimal?: number;
    valueId?: string;
    valueInstant?: string;
    valueInteger?: number;
    valueMarkdown?: string;
    valueOid?: string;
    valuePositiveInt?: number;
    valueString?: string;
    valueTime?: string;
    valueUnsignedInt?: number;
    valueUri?: string;
    valueUrl?: string;
    valueAddress?: Address;
    valueAttachment?: Attachment;
    valueCodeableConcept?: CodeableConcept;
    valueCoding?: Coding;
    valueContactPoint?: ContactPoint;
    valueHumanName?: HumanName;
    valueIdentifier?: Identifier;
    valuePeriod?: Period;
    valueQuantity?: Quantity;
    valueRange?: Range;
    valueReference?: Reference;
}

// ─── Resource ────────────────────────────────────────────────────────────────

/**
 * Metadata about a resource.
 * @see https://hl7.org/fhir/R4/resource.html#Meta
 */
export interface Meta extends Element {
    /** Version specific identifier */
    versionId?: string;
    /** When the resource version last changed */
    lastUpdated?: string;
    /** Identifies where the resource comes from */
    source?: string;
    /** Profiles this resource claims to conform to */
    profile?: string[];
    /** Security Labels applied to this resource */
    security?: Coding[];
    /** Tags applied to this resource */
    tag?: Coding[];
}

/**
 * Base Resource — the ancestor of all FHIR resources.
 * @see https://hl7.org/fhir/R4/resource.html
 */
export interface Resource {
    /** The type of the resource */
    resourceType: string;
    /** Logical id of this artifact */
    id?: string;
    /** Metadata about the resource */
    meta?: Meta;
    /** A set of rules under which this content was created */
    implicitRules?: string;
    /** Language of the resource content */
    language?: string;
}

/**
 * A human-readable summary of the resource.
 * @see https://hl7.org/fhir/R4/narrative.html
 */
export interface Narrative extends Element {
    /** generated | extensions | additional | empty */
    status: 'generated' | 'extensions' | 'additional' | 'empty';
    /** Limited xhtml content */
    div: string;
}

/**
 * DomainResource — a resource with narrative, extensions, and contained resources.
 * @see https://hl7.org/fhir/R4/domainresource.html
 */
export interface DomainResource extends Resource {
    /** Text summary of the resource, for human interpretation */
    text?: Narrative;
    /** Contained, inline Resources */
    contained?: Resource[];
    /** Additional content defined by implementations */
    extension?: Extension[];
    /** Extensions that cannot be ignored */
    modifierExtension?: Extension[];
}

// ─── Reference ───────────────────────────────────────────────────────────────

/**
 * A reference from one resource to another.
 * @see https://hl7.org/fhir/R4/references.html#Reference
 */
export interface Reference extends Element {
    /** Literal reference, Relative, internal or absolute URL */
    reference?: string;
    /** Type the reference refers to (e.g. "Patient") */
    type?: string;
    /** Logical reference, when literal reference is not known */
    identifier?: Identifier;
    /** Text alternative for the resource */
    display?: string;
}

// ─── Complex Data Types ──────────────────────────────────────────────────────

/**
 * An identifier intended for computation.
 * @see https://hl7.org/fhir/R4/datatypes.html#Identifier
 */
export interface Identifier extends Element {
    /** usual | official | temp | secondary | old (if known) */
    use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
    /** Description of identifier */
    type?: CodeableConcept;
    /** The namespace for the identifier value */
    system?: string;
    /** The value that is unique */
    value?: string;
    /** Time period when id is/was valid for use */
    period?: Period;
    /** Organization that issued id (may be just text) */
    assigner?: Reference;
}

/**
 * A concept defined by a terminology system.
 * @see https://hl7.org/fhir/R4/datatypes.html#Coding
 */
export interface Coding extends Element {
    /** Identity of the terminology system */
    system?: string;
    /** Version of the system */
    version?: string;
    /** Symbol in syntax defined by the system */
    code?: string;
    /** Representation defined by the system */
    display?: string;
    /** If this coding was chosen directly by the user */
    userSelected?: boolean;
}

/**
 * A CodeableConcept represents a value that is usually supplied by
 * providing a reference to one or more terminologies.
 * @see https://hl7.org/fhir/R4/datatypes.html#CodeableConcept
 */
export interface CodeableConcept extends Element {
    /** Code defined by a terminology system */
    coding?: Coding[];
    /** Plain text representation of the concept */
    text?: string;
}

/**
 * A time period defined by a start and end date/time.
 * @see https://hl7.org/fhir/R4/datatypes.html#Period
 */
export interface Period extends Element {
    /** Starting time with inclusive boundary */
    start?: string;
    /** End time with inclusive boundary, if not ongoing */
    end?: string;
}

/**
 * A measured amount (or an amount that can potentially be measured).
 * @see https://hl7.org/fhir/R4/datatypes.html#Quantity
 */
export interface Quantity extends Element {
    /** Numerical value (with implicit precision) */
    value?: number;
    /** < | <= | >= | > — how to understand the value */
    comparator?: '<' | '<=' | '>=' | '>';
    /** Unit representation */
    unit?: string;
    /** System that defines coded unit form */
    system?: string;
    /** Coded form of the unit */
    code?: string;
}

/**
 * A set of ordered Quantities defined by a low and high limit.
 * @see https://hl7.org/fhir/R4/datatypes.html#Range
 */
export interface Range extends Element {
    /** Low limit */
    low?: Quantity;
    /** High limit */
    high?: Quantity;
}

/**
 * Content in a format defined elsewhere.
 * @see https://hl7.org/fhir/R4/datatypes.html#Attachment
 */
export interface Attachment extends Element {
    /** Mime type of the content, with charset etc. */
    contentType?: string;
    /** Human language of the content (BCP-47) */
    language?: string;
    /** Data inline, base64ed */
    data?: string;
    /** Uri where the data can be found */
    url?: string;
    /** Number of bytes of content (if url provided) */
    size?: number;
    /** Hash of the data (sha-1, base64ed) */
    hash?: string;
    /** Label to display in place of the data */
    title?: string;
    /** Date attachment was first created */
    creation?: string;
}

/**
 * A name of a human with text, parts and usage information.
 * @see https://hl7.org/fhir/R4/datatypes.html#HumanName
 */
export interface HumanName extends Element {
    /** usual | official | temp | nickname | anonymous | old | maiden */
    use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
    /** Text representation of the full name */
    text?: string;
    /** Family name (often called 'Surname') */
    family?: string;
    /** Given names (not always 'first'). Includes middle names */
    given?: string[];
    /** Parts that come before the name */
    prefix?: string[];
    /** Parts that come after the name */
    suffix?: string[];
    /** Time period when name was/is in use */
    period?: Period;
}

/**
 * Details for all kinds of technology-mediated contact points.
 * @see https://hl7.org/fhir/R4/datatypes.html#ContactPoint
 */
export interface ContactPoint extends Element {
    /** phone | fax | email | pager | url | sms | other */
    system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
    /** The actual contact point details */
    value?: string;
    /** home | work | temp | old | mobile — purpose of this contact point */
    use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
    /** Specify preferred order of use (1 = highest) */
    rank?: number;
    /** Time period when the contact point was/is in use */
    period?: Period;
}

/**
 * An address expressed using postal conventions.
 * @see https://hl7.org/fhir/R4/datatypes.html#Address
 */
export interface Address extends Element {
    /** home | work | temp | old | billing — purpose of this address */
    use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
    /** postal | physical | both */
    type?: 'postal' | 'physical' | 'both';
    /** Text representation of the address */
    text?: string;
    /** Street name, number, direction & P.O. Box etc. */
    line?: string[];
    /** Name of city, town etc. */
    city?: string;
    /** District name (aka county) */
    district?: string;
    /** Sub-unit of country (abbreviations ok) */
    state?: string;
    /** Postal code for area */
    postalCode?: string;
    /** Country (e.g. may be ISO 3166 2 or 3 letter code) */
    country?: string;
    /** Time period when address was/is in use */
    period?: Period;
}

/**
 * A signature along with supporting context.
 * @see https://hl7.org/fhir/R4/datatypes.html#Signature
 */
export interface Signature extends Element {
    /** Indication of the reason the entity signed the object(s) */
    type: Coding[];
    /** When the signature was created */
    when: string;
    /** Who signed */
    who: Reference;
    /** The party represented */
    onBehalfOf?: Reference;
    /** The technical format of the signed resources */
    targetFormat?: string;
    /** The technical format of the signature */
    sigFormat?: string;
    /** The actual signature content (XML DigSig. JWS, picture, etc.) */
    data?: string;
}
