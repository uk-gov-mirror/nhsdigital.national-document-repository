# Data Models

This document catalogues the TypeScript types and enums used across the NDR front end. For how
these types flow through providers and requests see [state-and-api.md](state-and-api.md).

---

## Contents

| Section |
| --- |
| [Type organisation](#type-organisation) |
| [Core domain types](#core-domain-types) |
| [FHIR R4 types](#fhir-r4-types) |
| [Key enums](#key-enums) |
| [Convention: enums vs string unions](#convention-enums-vs-string-unions) |

---

## Type organisation

Types live in [`src/types/`](../../app/src/types/) split by scope:

| Folder | When to use |
| --- | --- |
| [`generic/`](../../app/src/types/generic/) | Shared across multiple pages - domain types, enums, error definitions |
| [`blocks/`](../../app/src/types/blocks/) | Scoped to a specific component or block |
| [`fhirR4/`](../../app/src/types/fhirR4/) | FHIR R4 resource definitions returned by the backend |
| [`pages/`](../../app/src/types/pages/) | Scoped to a single page (e.g. upload document states) |

---

## Core domain types

### PatientDetails

[`src/types/generic/patientDetails.ts`](../../app/src/types/generic/patientDetails.ts)

```typescript
type PatientDetails = {
    birthDate: string;
    familyName: string;
    givenName: Array<string>;
    nhsNumber: string;
    postalCode: string | null;
    superseded: boolean;
    restricted: boolean;
    active: boolean;
    deceased: boolean;
    canManageRecord?: boolean;
};
```

### UserAuth

[`src/types/blocks/userAuth.ts`](../../app/src/types/blocks/userAuth.ts)

```typescript
type UserAuth = {
    role: REPOSITORY_ROLE;
    authorisation_token: string;
};
```

### Session

Defined inline in [`SessionProvider.tsx`](../../app/src/providers/sessionProvider/SessionProvider.tsx):

```typescript
type Session = {
    auth: UserAuth | null;
    isLoggedIn: boolean;
    sessionOverride?: Partial<Session>;
    isFullscreen?: boolean;
};
```

### GlobalConfig

Defined inline in [`ConfigProvider.tsx`](../../app/src/providers/configProvider/ConfigProvider.tsx):

```typescript
type LocalFlags = {
    recordUploaded?: boolean;
    userRole?: REPOSITORY_ROLE;
    patientIsActive?: boolean;
    patientIsDeceased?: boolean;
    uploading?: boolean;
};

type GlobalConfig = {
    featureFlags: FeatureFlags;
    mockLocal: LocalFlags;
};
```

### FeatureFlags

[`src/types/generic/featureFlags.ts`](../../app/src/types/generic/featureFlags.ts)

```typescript
type FeatureFlags = {
    uploadLloydGeorgeWorkflowEnabled: boolean;
    uploadLambdaEnabled: boolean;
    uploadArfWorkflowEnabled: boolean;
    uploadDocumentIteration2Enabled?: boolean;
    uploadDocumentIteration3Enabled?: boolean;
    documentCorrectEnabled?: boolean;
    userRestrictionEnabled?: boolean;
    versionHistoryEnabled?: boolean;
};
```

### AuthHeaders

[`src/types/blocks/authHeaders.ts`](../../app/src/types/blocks/authHeaders.ts)

```typescript
type AuthHeaders = {
    'Content-Type': string;
    [key: string]: string;
};
```

### UploadDocument

[`src/types/pages/UploadDocumentsPage/types.ts`](../../app/src/types/pages/UploadDocumentsPage/types.ts)

```typescript
type UploadDocument = {
    state: DOCUMENT_UPLOAD_STATE;
    file: File;
    progress?: number;
    id: string;
    docType: DOCUMENT_TYPE;
    ref?: string;
    key?: string;
    position?: number;
    numPages?: number;
    error?: UPLOAD_FILE_ERROR_TYPE;
    errorCode?: string;
    validated?: boolean;
    versionId?: string;
};
```

### UploadSession

[`src/types/generic/uploadResult.ts`](../../app/src/types/generic/uploadResult.ts)

```typescript
type UploadSession = {
    [key: string]: S3Upload;
};

type S3Upload = {
    url: string;
    fields?: S3UploadFields;
};
```

### Other notable types

| Type | File | Purpose |
| --- | --- | --- |
| `ErrorResponse` | [`generic/errorResponse.ts`](../../app/src/types/generic/errorResponse.ts) | `{ message, err_code?, interaction_id? }` - API error shape |
| `NdrTokenData` | [`generic/ndrTokenData.ts`](../../app/src/types/generic/ndrTokenData.ts) | Decoded JWT payload (exp, role, org, smartcard) |
| `SearchResult` | [`generic/searchResult.ts`](../../app/src/types/generic/searchResult.ts) | Single document search result |
| `GenericDocument` | [`generic/genericDocument.ts`](../../app/src/types/generic/genericDocument.ts) | Minimal document reference (`fileName`, `id`, `ref?`) |
| `PatientAccessAudit` | [`generic/accessAudit.ts`](../../app/src/types/generic/accessAudit.ts) | Audit payload for deceased-patient access |
| `UserPatientRestriction` | [`generic/userPatientRestriction.ts`](../../app/src/types/generic/userPatientRestriction.ts) | Patient-level access restriction record |
| `ReviewDetails` | [`generic/reviews.ts`](../../app/src/types/generic/reviews.ts) | Rich review object (class with `addReviewFiles` method) |
| `ReviewsResponse` | [`generic/reviews.ts`](../../app/src/types/generic/reviews.ts) | Paginated list of `ReviewListItemDto` |
| `DocumentReviewDto` | [`blocks/documentReview.ts`](../../app/src/types/blocks/documentReview.ts) | Single document review DTO |
| `LocationParams<T>` | [`generic/location.ts`](../../app/src/types/generic/location.ts) | Typed wrapper for `react-router` location state |

---

## FHIR R4 types

[`src/types/fhirR4/`](../../app/src/types/fhirR4/) contains FHIR R4 definitions used when the
backend returns or accepts FHIR resources.

### Base types - [`baseTypes.ts`](../../app/src/types/fhirR4/baseTypes.ts)

Foundation types the other FHIR interfaces extend:

`Element`, `Extension`, `Meta`, `Resource`, `DomainResource`, `Narrative`, `Reference`,
`Identifier`, `Coding`, `CodeableConcept`, `Period`, `Quantity`, `Range`, `Attachment`,
`HumanName`, `ContactPoint`, `Address`, `Signature`.

### DocumentReference - [`documentReference.ts`](../../app/src/types/fhirR4/documentReference.ts)

```typescript
interface FhirDocumentReference extends DomainResource {
    resourceType: 'DocumentReference';
    status: DocumentReferenceStatus | string;
    type?: CodeableConcept;
    subject?: Reference;
    content: DocumentReferenceContent[];
    context?: DocumentReferenceContext;
    // … plus optional fields (author, custodian, relatesTo, etc.)
}
```

Used by `uploadDocuments` to build the request body and by search results to type the response.

### Bundle - [`bundle.ts`](../../app/src/types/fhirR4/bundle.ts)

```typescript
interface Bundle<T extends Resource> {
    resourceType: string;
    type: BundleType | string;
    total?: number;
    entry?: Array<BundleEntry<T>>;
    // …
}
```

### Value sets - [`valueSets.ts`](../../app/src/types/fhirR4/valueSets.ts)

Enums for FHIR coded values:

- `DocumentReferenceStatus` - `Current`, `Superseded`, `EnteredInError`
- `DocumentReferenceDocStatus` - `Preliminary`, `Final`, `Amended`, `EnteredInError`
- `DocumentRelationshipType` - `Replaces`, `Transforms`, `Signs`, `Appends`
- `BundleType` - `Document`, `Message`, `Transaction`, `History`, `Searchset`, etc.
- `HTTPVerb`, `SearchEntryMode`

FHIR fields that reference these enums use a `EnumType | string` union to accommodate values
not in the current set.

---

## Key enums

### Roles and auth

| Enum | File | Values |
| --- | --- | --- |
| `REPOSITORY_ROLE` | [`generic/authRole.ts`](../../app/src/types/generic/authRole.ts) | `GP_ADMIN`, `GP_CLINICAL`, `PCSE` |
| `USER_ROLE` | [`generic/roles.ts`](../../app/src/types/generic/roles.ts) | `GP` ("GP Practice"), `PCSE` ("Primary Care Support England") |

### Routing

| Enum | File | Purpose |
| --- | --- | --- |
| `ROUTE_TYPE` | [`generic/routes.ts`](../../app/src/types/generic/routes.ts) | `PUBLIC` (0), `PRIVATE` (1), `PATIENT` (2) - determines guard stack |
| `routes` | same file | All top-level route paths |
| `routeChildren` | same file | Sub-route paths for multi-step journeys |

### Documents and uploads

| Enum | File | Values |
| --- | --- | --- |
| `DOCUMENT_TYPE` | [`helpers/utils/documentType.ts`](../../app/src/helpers/utils/documentType.ts) | SNOMED codes: `LLOYD_GEORGE`, `EHR`, `EHR_ATTACHMENTS`, `LETTERS_AND_DOCS`, `ALL` |
| `DOCUMENT_UPLOAD_STATE` | [`pages/UploadDocumentsPage/types.ts`](../../app/src/types/pages/UploadDocumentsPage/types.ts) | `UNSELECTED` → `SELECTED` → `UPLOADING` → `SCANNING` → `CLEAN` / `INFECTED` / `FAILED` |
| `DOWNLOAD_STAGE` | [`generic/downloadStage.ts`](../../app/src/types/generic/downloadStage.ts) | `INITIAL`, `PENDING`, `REFRESH`, `SUCCEEDED`, `UPLOADING`, `FAILED`, `TIMEOUT`, `NO_RECORDS` |
| `JOB_STATUS` | [`generic/downloadManifestJobStatus.ts`](../../app/src/types/generic/downloadManifestJobStatus.ts) | `Pending`, `Completed`, `Processing`, `Failed` |

### Reviews

| Enum | File | Values |
| --- | --- | --- |
| `DocumentReviewStatus` | [`blocks/documentReview.ts`](../../app/src/types/blocks/documentReview.ts) | `PENDING_REVIEW`, `APPROVED`, `REVIEW_IN_PROGRESS`, `REJECTED`, `REASSIGNED`, etc. |
| `LG_RECORD_STAGE` | [`blocks/lloydGeorgeStages.ts`](../../app/src/types/blocks/lloydGeorgeStages.ts) | `RECORD`, `DOWNLOAD_ALL`, `DELETE_ALL`, `REMOVE` |
| `RECORD_ACTION` | [`blocks/lloydGeorgeActions.ts`](../../app/src/types/blocks/lloydGeorgeActions.ts) | `UPDATE`, `DOWNLOAD`, `DELETE` |
| `REPORT_TYPE` | [`generic/reports.ts`](../../app/src/types/generic/reports.ts) | `ODS_PATIENT_SUMMARY`, `ODS_REVIEW_SUMMARY` |

### Errors and search

| Enum | File | Values |
| --- | --- | --- |
| `UIErrorCode` | [`generic/errors.tsx`](../../app/src/types/generic/errors.tsx) | `UPR01`, `PA001`, `PA002`, `PA003` |
| `PATIENT_SEARCH_STATES` | [`helpers/utils/handlePatientSearch.ts`](../../app/src/helpers/utils/handlePatientSearch.ts) | `IDLE`, `SEARCHING`, `SUCCEEDED`, `FAILED` |

### Access audit

| Enum | File | Values |
| --- | --- | --- |
| `AccessAuditType` | [`generic/accessAudit.ts`](../../app/src/types/generic/accessAudit.ts) | `deceasedPatient` (0) |
| `DeceasedAccessAuditReasons` | same file | `medicalRequest` … `anotherReason` (coded `'01'`–`'99'`) |

### API endpoints

| Enum | File |
| --- | --- |
| `endpoints` | [`generic/endpoints.ts`](../../app/src/types/generic/endpoints.ts) |

See [state-and-api.md](state-and-api.md) for the full listing.

---

## Convention: enums vs string unions

The codebase **prefers enums** for any value set shared with the backend or used as
application state. String unions are rare and generally limited to FHIR types where the spec
allows extension (`DocumentReferenceStatus | string`).

When adding a new type:

- Use an **enum** for a known, finite set of values (roles, upload states, error codes).
- Use **`Enum | string`** when deserialising FHIR or external API responses that may contain
  values outside the current set.
- Avoid plain `string` for domain concepts.

---

*Previous:* [state-and-api.md](state-and-api.md) · *Next:* [utils.md](utils.md) · [Back to README](README.md)
