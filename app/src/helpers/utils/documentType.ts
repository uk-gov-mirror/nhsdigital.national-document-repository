import lloydGeorgeConfig from '../../config/lloydGeorgeConfig.json';
import electronicHealthRecordConfig from '../../config/electronicHealthRecordConfig.json';
import ehrAttachmentsConfiguration from '../../config/electronicHealthRecordAttachmentsConfig.json';
import lettersAndDocumentsConfig from '../../config/lettersAndDocumentsConfig.json';

/**
 * SNOMED codes identifying each document type supported by the system.
 * These values are used as keys in API requests and document references.
 */
export enum DOCUMENT_TYPE {
    LLOYD_GEORGE = '16521000000101',
    EHR = '717301000000104',
    EHR_ATTACHMENTS = '24511000000107',
    LETTERS_AND_DOCS = '162931000000103',
    ALL = '16521000000101,717301000000104,24511000000107,162931000000103',
}

/**
 * Content keys available to Lloyd George documents.
 * Extends `ContentKeys` with LG-specific keys for version history UI elements.
 */
export type LGContentKeys =
    | ContentKeys
    | 'versionHistoryLinkLabel'
    | 'versionHistoryLinkDescription'
    | 'searchResultDocumentTypeLabel'
    | 'versionHistoryHeader'
    | 'versionHistoryTimelineHeader'
    | 'restoreProgressingPageTitle'
    | 'versionHistoryCompleteLabel';
/** Content keys available to Electronic Health Record documents. */
export type EhrContentKeys = ContentKeys;
/** Content keys available to EHR Attachments documents. */
export type EhrAttachmentsContentKeys = ContentKeys;
/** Content keys available to Letters and Documents. */
export type LettersAndDocsContentKeys = ContentKeys;

/**
 * Union of all content keys across every document type.
 * Use this when working with a config that may be any doc type (e.g. state typed
 * without knowing the doc type at compile time).
 *
 * Note: Because `LGContentKeys` adds extra keys beyond `ContentKeys`, `AllContentKeys`
 * is a superset of `ContentKeys`. A `DOCUMENT_TYPE_CONFIG_GENERIC<ContentKeys>` is
 * therefore NOT assignable to `DOCUMENT_TYPE_CONFIG_GENERIC<AllContentKeys>` — use
 * `getConfigForDocTypeGeneric` with the appropriate `T` instead.
 */
export type AllContentKeys =
    | LGContentKeys
    | EhrContentKeys
    | EhrAttachmentsContentKeys
    | LettersAndDocsContentKeys;

/**
 * The base set of content keys shared by every document type.
 * These map to string values (or arrays of strings) stored in each doc type's
 * JSON config file (e.g. lloydGeorgeConfig.json).
 *
 * To add a new key shared across all doc types, add it here AND to every
 * JSON config file. For a key specific to one doc type, extend the relevant
 * `*ContentKeys` type instead (e.g. `LGContentKeys`).
 */
export type ContentKeys =
    | 'reviewDocumentTitle'
    | 'viewDocumentTitle'
    | 'addFilesSelectTitle'
    | 'uploadFilesSelectTitle'
    | 'chooseFilesMessage'
    | 'chooseFilesButtonLabel'
    | 'chooseFilesWarningText'
    | 'confirmFilesTitle'
    | 'beforeYouUploadTitle'
    | 'previewUploadTitle'
    | 'uploadFilesExtraParagraph'
    | 'uploadFilesBulletPoints'
    | 'skipDocumentLinkText'
    | 'confirmFilesTableTitle'
    | 'confirmFilesTableParagraph'
    | 'addMoreFilesRadioNoText'
    | 'addMoreFilesRadioYesText'
    | 'reviewAssessmentPageTitle'
    | 'stitchedPreviewFirstParagraph'
    | 'choosePagesToRemoveTitle'
    | 'choosePagesToRemoveWarning'
    | 'addFilesLinkLabel'
    | 'chosenToRemovePagesSubtitle'
    | 'reassignPagesLinkLabel';

/**
 * A type-safe content store for a document type's UI strings.
 *
 * It is both a `Record<K, V>` (so keys are accessible as direct properties, e.g.
 * `content.previewUploadTitle`) and exposes a `getValue` helper for cases where
 * the key is a variable or a narrower subtype needs to be asserted.
 *
 * @typeParam K - The union of valid content key strings for this doc type
 *               (e.g. `LGContentKeys`, `ContentKeys`).
 * @typeParam V - The value type stored under each key (typically `string | string[]`).
 *
 * @example Direct property access (preferred for known keys):
 * ```ts
 * config.content.previewUploadTitle // string | string[]
 * ```
 *
 * @example `getValue` with a narrowed key type (useful for doc-type-specific keys):
 * ```ts
 * config.content.getValue<string, LGContentKeys>('versionHistoryLinkLabel')
 * ```
 */
export type IndividualDocumentTypeContentUtil<K extends string, V> = Record<K, V> & {
    /**
     * Retrieves a content value by key with an optional return type assertion.
     *
     * @typeParam TReturn - Narrows the return type (defaults to `V & string`).
     * @typeParam TKeys  - Constrains which keys are accepted (defaults to all `K`).
     *                    Pass a more specific key union (e.g. `LGContentKeys`) when
     *                    accessing keys that only exist on a particular doc type.
     * @param key - The content key to look up.
     */
    getValue<TReturn extends V = V & string, TKeys extends K = K>(key: TKeys): TReturn | undefined;
    /**
     * Retrieves a content value by key with an optional return type assertion.
     *
     * @typeParam TReturn - Narrows the return type (defaults to `V & string`).
     * @typeParam TKeys  - Constrains which keys are accepted (defaults to all `K`).
     *                    Pass a more specific key union (e.g. `LGContentKeys`) when
     *                    accessing keys that only exist on a particular doc type.
     * @param key - The content key to look up.
     * @param obj - An object whose properties will be used to replace placeholders in the content string.
     *              For example, with content "Hello {name}" and obj = { name: "Alice" }, the returned string would be "Hello Alice".
     */
    getValueFormatString<TReturn extends V = V & string, TKeys extends K = K>(
        key: TKeys,
        obj: object,
    ): TReturn | undefined;
};

/**
 * Factory that builds an `IndividualDocumentTypeContentUtil` from a plain record.
 *
 * The returned object spreads all key/value pairs onto itself so they are
 * accessible as direct properties, and attaches a `getValue` method.
 *
 * This is an internal helper — consumers should call `getConfigForDocType` or
 * `getConfigForDocTypeGeneric` rather than using this directly.
 *
 * @typeParam K - The union of content key strings.
 * @typeParam V - The value type (typically `string | string[]`).
 */
export const createDocumentTypeContent = <K extends string, V>(
    content: Record<K, V>,
): IndividualDocumentTypeContentUtil<K, V> => ({
    ...content,
    getValue<TReturn extends V | undefined = V & string, TKeys extends K = K>(key: TKeys): TReturn {
        const value = content[key as K] as V | undefined;
        if (!value) {
            // eslint-disable-next-line no-console
            console.warn(`Content key "${key}" not found in document type content.`);
            return '' as TReturn;
        }
        return value as TReturn;
    },
    getValueFormatString<TReturn extends V = V & string, TKeys extends K = K>(
        key: TKeys,
        obj: object,
    ): TReturn | undefined {
        const value = content[key as K] as V | undefined;
        // for value for example "Hello {name}" and obj = { name: "Alice" }, replace "{name}" with "Alice"
        if (typeof value === 'string') {
            const formattedValue = value.replace(/{(\w+)}/g, (_, k) => {
                const replacement = obj[k as keyof typeof obj];
                if (replacement === undefined) {
                    return `{${k}}`;
                }
                return String(replacement);
            });
            return formattedValue as TReturn;
        }
        if (!value) {
            // eslint-disable-next-line no-console
            console.warn(`Content key "${key}" not found in document type content.`);
            return undefined as TReturn;
        }
        return value as TReturn;
    },
});

/**
 * Convenience alias for a config typed with the full `AllContentKeys` union.
 * Use this when you don't need to distinguish between doc-type-specific keys
 * and just need to pass a config around without caring which doc type it is.
 *
 * For type-safe access to doc-type-specific keys (e.g. LG-only version history
 * keys), use `DOCUMENT_TYPE_CONFIG_GENERIC<LGContentKeys>` instead.
 */
export type DOCUMENT_TYPE_CONFIG = DOCUMENT_TYPE_CONFIG_GENERIC<AllContentKeys>;

/**
 * The full configuration object for a single document type.
 *
 * @typeParam K - The content key union for this doc type. Using a narrower type
 *               (e.g. `LGContentKeys`) gives compile-time safety when accessing
 *               doc-type-specific content keys. Using `AllContentKeys` gives a
 *               looser type that works for any doc type.
 */
export type DOCUMENT_TYPE_CONFIG_GENERIC<K extends string> = {
    acceptedFileTypes: string[];
    associatedSnomed?: DOCUMENT_TYPE;
    canBeDiscarded: boolean;
    canBeUpdated: boolean;
    content: IndividualDocumentTypeContentUtil<K, string | string[]>;
    displayName: string;
    filenameOverride?: string;
    reviewDocumentsFileNamePrefix?: string;
    multifileReview: boolean;
    multifileUpload: boolean;
    multifileZipped: boolean;
    singleDocumentOnly: boolean;
    snomedCode: DOCUMENT_TYPE;
    stitched: boolean;
    stitchedFilenamePrefix?: string;
    zippedFilename?: string;
};

export type DocumentTypeContentKey = 'uploadTitle' | 'uploadDescription';
export type DocumentTypeContent = Record<DocumentTypeContentKey, string>;

// The document type as defined in the documentTypesConfig.json
export interface DocumentType {
    name: string;
    snomedCode: string;
    configName: string;
    content: DocumentTypeContent;
}

export type DocumentTypesConfig = DocumentType[];

/** Returns a human-readable display label for a given document type. */
export const getDocumentTypeLabel = (docType: DOCUMENT_TYPE): string => {
    switch (docType) {
        case DOCUMENT_TYPE.LLOYD_GEORGE:
            return 'Scanned paper notes';
        case DOCUMENT_TYPE.EHR:
            return 'Electronic health record';
        case DOCUMENT_TYPE.EHR_ATTACHMENTS:
            return 'Electronic health record attachments';
        case DOCUMENT_TYPE.LETTERS_AND_DOCS:
            return 'Patient letters and documents';
        default:
            return '';
    }
};

/**
 * Returns the config for a document type typed as `DOCUMENT_TYPE_CONFIG` (i.e.
 * `AllContentKeys`). Use this when you only need the common `ContentKeys` and
 * don't require access to doc-type-specific keys.
 *
 * For full type safety on doc-type-specific keys, use `getConfigForDocTypeGeneric`
 * with an explicit type parameter instead.
 */
export const getConfigForDocType = (docType: DOCUMENT_TYPE): DOCUMENT_TYPE_CONFIG => {
    switch (docType) {
        case DOCUMENT_TYPE.LLOYD_GEORGE:
            return getConfigForDocTypeGeneric(DOCUMENT_TYPE.LLOYD_GEORGE) as DOCUMENT_TYPE_CONFIG;
        case DOCUMENT_TYPE.EHR:
            return getConfigForDocTypeGeneric(DOCUMENT_TYPE.EHR) as DOCUMENT_TYPE_CONFIG;
        case DOCUMENT_TYPE.EHR_ATTACHMENTS:
            return getConfigForDocTypeGeneric(
                DOCUMENT_TYPE.EHR_ATTACHMENTS,
            ) as DOCUMENT_TYPE_CONFIG;
        case DOCUMENT_TYPE.LETTERS_AND_DOCS:
            return getConfigForDocTypeGeneric(
                DOCUMENT_TYPE.LETTERS_AND_DOCS,
            ) as DOCUMENT_TYPE_CONFIG;
        default:
            throw new Error(`No config found for document type: ${docType}`);
    }
};

/**
 * Internal intermediate shape used when loading configs from JSON.
 * Replaces the typed `content` field with a plain `Record` so that
 * `createDocumentTypeContent` can wrap it into an `IndividualDocumentTypeContentUtil`.
 */
type BaseDocTypeConfig<K extends string> = Omit<DOCUMENT_TYPE_CONFIG_GENERIC<K>, 'content'> & {
    content: Record<K, string | string[]>;
};

/** Converts a `BaseDocTypeConfig` (plain record content) into a fully typed `DOCUMENT_TYPE_CONFIG_GENERIC`. */
const toDocTypeConfig = <T extends string>(
    config: BaseDocTypeConfig<T>,
): DOCUMENT_TYPE_CONFIG_GENERIC<T> => ({
    ...config,
    content: createDocumentTypeContent<T, string | string[]>(config.content),
});

/**
 * Returns the config for a document type with a precise content key type.
 *
 * Pass a doc-type-specific key union as `T` to get compile-time safety when
 * accessing keys that only exist for that doc type:
 *
 * ```ts
 * // Access LG-only keys safely:
 * const config = getConfigForDocTypeGeneric<LGContentKeys>(DOCUMENT_TYPE.LLOYD_GEORGE);
 * config.content.getValue<string, LGContentKeys>('versionHistoryLinkLabel');
 * ```
 *
 * When `T` is omitted it defaults to `AllContentKeys`, equivalent to calling
 * `getConfigForDocType`.
 *
 * The internal `as unknown as DOCUMENT_TYPE_CONFIG_GENERIC<T>` casts are necessary
 * because each switch branch builds a narrowly typed config (e.g.
 * `DOCUMENT_TYPE_CONFIG_GENERIC<LGContentKeys>`) that TypeScript cannot prove
 * satisfies the caller-supplied `T`. The cast is safe because the caller is asserting
 * they know which doc type they are requesting.
 *
 * @typeParam T - The content key union to use. Must extend `AllContentKeys`.
 */
export const getConfigForDocTypeGeneric = <T extends AllContentKeys>(
    docType: DOCUMENT_TYPE,
): DOCUMENT_TYPE_CONFIG_GENERIC<T> => {
    switch (docType) {
        case DOCUMENT_TYPE.LLOYD_GEORGE:
            return toDocTypeConfig<LGContentKeys>(
                lloydGeorgeConfig as BaseDocTypeConfig<LGContentKeys>,
            ) as unknown as DOCUMENT_TYPE_CONFIG_GENERIC<T>;
        case DOCUMENT_TYPE.EHR:
            return toDocTypeConfig<EhrContentKeys>(
                electronicHealthRecordConfig as BaseDocTypeConfig<EhrContentKeys>,
            ) as unknown as DOCUMENT_TYPE_CONFIG_GENERIC<T>;
        case DOCUMENT_TYPE.EHR_ATTACHMENTS:
            return toDocTypeConfig<EhrAttachmentsContentKeys>(
                ehrAttachmentsConfiguration as BaseDocTypeConfig<EhrAttachmentsContentKeys>,
            ) as unknown as DOCUMENT_TYPE_CONFIG_GENERIC<T>;
        case DOCUMENT_TYPE.LETTERS_AND_DOCS:
            return toDocTypeConfig<LettersAndDocsContentKeys>(
                lettersAndDocumentsConfig as BaseDocTypeConfig<LettersAndDocsContentKeys>,
            ) as unknown as DOCUMENT_TYPE_CONFIG_GENERIC<T>;
        default:
            return getConfigForDocType(docType);
    }
};

export type GetConfigForDocTypeGenericType = typeof getConfigForDocTypeGeneric;
