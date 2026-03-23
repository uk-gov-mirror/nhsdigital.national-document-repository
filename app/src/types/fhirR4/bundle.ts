/**
 * FHIR R4 Bundle Resource
 * A container for a collection of resources.
 *
 * @see https://hl7.org/fhir/R4/bundle.html
 */

import { Identifier, Meta, Resource, Signature } from './baseTypes';

// ─── Value Sets / Enums ──────────────────────────────────────────────────────

/**
 * Indicates the purpose of a bundle — how it is intended to be used.
 * @see https://hl7.org/fhir/R4/valueset-bundle-type.html
 */
export enum BundleType {
    /** The bundle is a document */
    Document = 'document',
    /** The bundle is a message */
    Message = 'message',
    /** The bundle is a transaction */
    Transaction = 'transaction',
    /** The bundle is a transaction response */
    TransactionResponse = 'transaction-response',
    /** The bundle is a batch */
    Batch = 'batch',
    /** The bundle is a batch response */
    BatchResponse = 'batch-response',
    /** The bundle is a history list */
    History = 'history',
    /** The results of a search */
    Searchset = 'searchset',
    /** A collection of resources */
    Collection = 'collection',
}

/**
 * HTTP verbs used in Bundle.entry.request.
 * @see https://hl7.org/fhir/R4/valueset-http-verb.html
 */
export enum HTTPVerb {
    GET = 'GET',
    HEAD = 'HEAD',
    POST = 'POST',
    PUT = 'PUT',
    DELETE = 'DELETE',
    PATCH = 'PATCH',
}

/**
 * Why an entry is in the result set (for searchset bundles).
 * @see https://hl7.org/fhir/R4/valueset-search-entry-mode.html
 */
export enum SearchEntryMode {
    /** This resource matched the search specification */
    Match = 'match',
    /** This resource is returned because it is referred to from another resource in the search set */
    Include = 'include',
    /** An OperationOutcome that provides additional information about the processing of a search */
    Outcome = 'outcome',
}

// ─── Backbone Elements ───────────────────────────────────────────────────────

/**
 * Links related to this Bundle.
 * @see https://hl7.org/fhir/R4/bundle-definitions.html#Bundle.link
 */
export interface BundleLink {
    /** See https://www.iana.org/assignments/link-relations — e.g. self, next, previous */
    relation: string;
    /** Reference details for the link */
    url: string;
}

/**
 * Search-related information for a searchset bundle entry.
 * @see https://hl7.org/fhir/R4/bundle-definitions.html#Bundle.entry.search
 */
export interface BundleEntrySearch {
    /** match | include | outcome — why this is in the result set */
    mode?: SearchEntryMode | string;
    /** Search ranking (between 0 and 1) */
    score?: number;
}

/**
 * Additional execution information (transaction/batch/history).
 * @see https://hl7.org/fhir/R4/bundle-definitions.html#Bundle.entry.request
 */
export interface BundleEntryRequest {
    /** GET | HEAD | POST | PUT | DELETE | PATCH */
    method: HTTPVerb | string;
    /** URL for HTTP equivalent of this entry */
    url: string;
    /** For managing cache currency */
    ifNoneMatch?: string;
    /** For managing cache currency */
    ifModifiedSince?: string;
    /** For managing update contention */
    ifMatch?: string;
    /** For conditional creates */
    ifNoneExist?: string;
}

/**
 * Results of execution (transaction/batch/history).
 * @see https://hl7.org/fhir/R4/bundle-definitions.html#Bundle.entry.response
 */
export interface BundleEntryResponse {
    /** Status response code (text + optional HTTP code) */
    status: string;
    /** The location (if the operation returns a location) */
    location?: string;
    /** The Etag for the resource (if relevant) */
    etag?: string;
    /** Server's date-time modified */
    lastModified?: string;
    /** OperationOutcome with hints and warnings */
    outcome?: Resource;
}

/**
 * An entry in a bundle resource — will either contain a resource, or information about a request.
 * @see https://hl7.org/fhir/R4/bundle-definitions.html#Bundle.entry
 */
export interface BundleEntry<T extends Resource> {
    /** Links related to this entry */
    link?: BundleLink[];
    /** URI for resource (Absolute URL server address or URI for UUID/OID) */
    fullUrl?: string;
    /** A resource in the bundle */
    resource: T;
    /** Search related information */
    search?: BundleEntrySearch;
    /** Additional execution information (transaction/batch/history) */
    request?: BundleEntryRequest;
    /** Results of execution (transaction/batch/history) */
    response?: BundleEntryResponse;
}

// ─── Bundle Resource ─────────────────────────────────────────────────────────

/**
 * A container for a collection of resources.
 *
 * @see https://hl7.org/fhir/R4/bundle.html
 *
 * @typeParam T - The type of resource contained in the bundle entries.
 *               Defaults to `Resource` for generic use.
 */
export interface Bundle<T extends Resource> {
    /** Resource type discriminator */
    resourceType: string;
    /** Logical id of this artifact */
    id?: string;
    /** Metadata about the resource */
    meta?: Meta;
    /** A set of rules under which this content was created */
    implicitRules?: string;
    /** Language of the resource content */
    language?: string;
    /** Persistent identifier for the bundle */
    identifier?: Identifier;
    /** document | message | transaction | transaction-response | batch | batch-response | history | searchset | collection */
    type: BundleType | string;
    /** When the bundle was assembled */
    timestamp?: string;
    /** If search, the total number of matches */
    total?: number;
    /** Links related to this Bundle */
    link?: BundleLink[];
    /** Entry in the bundle — will have a resource or information */
    entry?: Array<BundleEntry<T>>;
    /** Digital Signature */
    signature?: Signature;
}
