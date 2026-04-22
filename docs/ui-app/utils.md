# Utility Functions and Constants

Shared helpers used across the UI. Grouped by concern - formatting, validation,
document handling, file operations, navigation, accessibility, and miscellaneous.

> Observability helpers (AWS RUM / `AnalyticsProvider`) are documented separately
> in [observability.md](observability.md).

---

## Contents

| Section |
| --- |
| [Helpers](#helpers--appsrchelpersutils) |
| [Constants](#constants--appsrchelpersconstants) |
| [JSON Configs](#json-configs--appsrcconfig) |
| [Conventions](#conventions) |

---

## Helpers - `app/src/helpers/utils/`

### Formatting

| File | Key exports | Purpose |
|------|-------------|---------|
| [`formatDate.ts`](../../app/src/helpers/utils/formatDate.ts) | `getFormattedDate`, `getFormattedDateTime`, `formatDateWithDashes`, `getFormattedDateFromString`, `getFormattedDateTimeFromString`, `getFormatDateWithAtTime` | Locale-aware date/time formatting (`en-GB`, `Europe/London` timezone). Accepts `Date` objects or ISO/Unix strings. |
| [`formatDatetime.ts`](../../app/src/helpers/utils/formatDatetime.ts) | `getFormattedDatetime` | Formats `Date` to `dd Month yyyy, hh:mm:ss` in UK timezone. |
| [`formatPatientFullName.ts`](../../app/src/helpers/utils/formatPatientFullName.ts) | `formatPatientFullName` | Joins given names + family name into a display string. |
| [`formatNhsNumber.ts`](../../app/src/helpers/utils/formatNhsNumber.ts) | `formatNhsNumber` | Formats a 10-digit NHS number as `123 456 7890`. |
| [`formatSmartcardNumber.ts`](../../app/src/helpers/utils/formatSmartcardNumber.ts) | `formatSmartcardNumber` | Formats a 12-digit smartcard number as `1234 5678 9012`. |
| [`formatFileSize.ts`](../../app/src/helpers/utils/formatFileSize.ts) | `formatFileSize` | Converts bytes to a human-readable string (`KB`, `MB`, `GB`). |
| [`string-extensions.ts`](../../app/src/helpers/utils/string-extensions.ts) | `String.prototype.toSentenceCase` | Adds a `toSentenceCase()` method to `String`. |

### Validation

| File | Key exports | Purpose |
|------|-------------|---------|
| [`nhsNumberValidator.ts`](../../app/src/helpers/utils/nhsNumberValidator.ts) | `validateNhsNumber` | Validates NHS number format (10 digits, optional spaces/dashes) and MOD-11 check digit. |
| [`formConfig.ts`](../../app/src/helpers/utils/formConfig.ts) | `ARFFormConfig` | `react-hook-form` controller config with per-file size validation (max 5 GB). |

### Document handling

| File | Key exports | Purpose |
|------|-------------|---------|
| [`documentType.ts`](../../app/src/helpers/utils/documentType.ts) | `DOCUMENT_TYPE` enum, content-key types, `documentTypeConfigs` | Maps SNOMED codes to document-type configuration objects loaded from [`app/src/config/`](../../app/src/config/). |
| [`documentUpload.ts`](../../app/src/helpers/utils/documentUpload.ts) | Upload-related helpers | Builds presigned-URL payloads and tracks upload progress. |
| [`uploadDocumentHelpers.ts`](../../app/src/helpers/utils/uploadDocumentHelpers.ts) | Additional upload utilities | Helpers for assembling upload sessions and documents. |
| [`mergePdfs.ts`](../../app/src/helpers/utils/mergePdfs.ts) | `mergePdfs` | Merges multiple PDFs into one using `pdf-lib`. |
| [`pdfMerger.ts`](../../app/src/helpers/utils/pdfMerger.ts) | `pdfMerger` | Alternative merge path using `pdf-merger-js`. |
| [`documentManagement/pageNumbers.ts`](../../app/src/helpers/utils/documentManagement/pageNumbers.ts) | `pageNumbers` | Generates page number strings for stitched PDF output. |
| [`getPdfObjectUrl.ts`](../../app/src/helpers/utils/getPdfObjectUrl.ts) | `getPdfObjectUrl`, `fetchBlob`, `getObjectUrl` | Fetches a PDF via axios as a Blob and creates an Object URL for in-browser viewing. |
| [`sortReviewDocs.ts`](../../app/src/helpers/utils/sortReviewDocs.ts) | `sortDocumentsForReview` | Sorts and merges uploaded documents with additional files for the review step. |
| [`fhirUtil.ts`](../../app/src/helpers/utils/fhirUtil.ts) | `getVersionId`, `getCreatedDate`, `getAuthorValue`, `getDocumentReferenceFromFhir` | Extracts fields from FHIR R4 `DocumentReference` resources and maps them to the internal `DocumentReference` type. |

### File operations

| File | Key exports | Purpose |
|------|-------------|---------|
| [`downloadFile.ts`](../../app/src/helpers/utils/downloadFile.ts) | `downloadFile` | Triggers a browser file-download from a Blob/URL. |
| [`toFileList.ts`](../../app/src/helpers/utils/toFileList.ts) | `toFileList` | Converts an array of `File` objects into a `FileList`. |
| [`fileExtensionToContentType.tsx`](../../app/src/helpers/utils/fileExtensionToContentType.tsx) | `fileExtensionToContentType` | Maps file extensions (`.pdf`, `.txt`, etc.) to MIME content types. |
| [`zip.ts`](../../app/src/helpers/utils/zip.ts) | Zip helpers | Creates zip archives using `@zip.js/zip.js`. |

### Navigation and URL handling

| File | Key exports | Purpose |
|------|-------------|---------|
| [`urlManipulations.ts`](../../app/src/helpers/utils/urlManipulations.ts) | URL-manipulation helpers | Builds and parses query strings and path segments. |
| [`handlePatientSearch.ts`](../../app/src/helpers/utils/handlePatientSearch.ts) | `handlePatientSearch` | Coordinates the patient-search flow: validates input, calls the API, and navigates on success. |

### Accessibility and focus

| File | Key exports | Purpose |
|------|-------------|---------|
| [`manageFocus.ts`](../../app/src/helpers/utils/manageFocus.ts) | `manageFocus` | Programmatically moves focus to a target element (e.g. after a page transition). |
| [`fullscreen.ts`](../../app/src/helpers/utils/fullscreen.ts) | Fullscreen toggle helpers | Enters/exits fullscreen mode for the PDF viewer. |

### Error message helpers

| File | Key exports | Purpose |
|------|-------------|---------|
| [`errorCodes.ts`](../../app/src/helpers/utils/errorCodes.ts) | `errorCodes` map | Maps backend error codes (e.g. `LIN_5001`, `DMS_2001`) to user-facing messages. |
| [`errorMessages.ts`](../../app/src/helpers/utils/errorMessages.ts) | `getMappedErrorMessage`, `groupErrorsByType` | Generic helpers for looking up typed error messages and grouping errors for display. |
| [`errorToParams.ts`](../../app/src/helpers/utils/errorToParams.ts) | `errorToParams` | Converts an error response into route search params for error pages. |
| [`feedbackErrorMessages.ts`](../../app/src/helpers/utils/feedbackErrorMessages.ts) | `FEEDBACK_ERROR_TYPE`, `feedbackErrorMessages` | Error-message map specific to the feedback form. |

### Miscellaneous

| File | Key exports | Purpose |
|------|-------------|---------|
| [`jwtDecoder.ts`](../../app/src/helpers/utils/jwtDecoder.ts) | `decodeJwtToken` | Wraps `jwt-decode` for typed JWT decoding. |
| [`isLocal.ts`](../../app/src/helpers/utils/isLocal.ts) | `isLocal`, `isMock`, `isRunningInCypress` | Environment detection - local dev, mock mode, and test runners. |
| [`createTimestamp.ts`](../../app/src/helpers/utils/createTimestamp.ts) | `unixTimestamp` | Returns the current Unix timestamp via `moment`. |
| [`waitForSeconds.ts`](../../app/src/helpers/utils/waitForSeconds.ts) | `waitForSeconds` | Promise-based delay. |
| [`parseTextWithLinks.tsx`](../../app/src/helpers/utils/parseTextWithLinks.tsx) | `parseTextWithLinks` | Converts link-marked strings into React `<a>` elements. |

---

## Constants - `app/src/helpers/constants/`

Small, pure-value modules imported across the codebase.

| File | Key exports | Purpose |
|------|-------------|---------|
| [`errors.ts`](../../app/src/helpers/constants/errors.ts) | Error-message string constants | Reusable error strings for the user-patient-restrictions feature. |
| [`network.ts`](../../app/src/helpers/constants/network.ts) | `UPDATE_DOCUMENT_STATE_FREQUENCY_MILLISECONDS`, `MAX_POLLING_TIME` | Polling intervals and timeouts for long-running document state checks. |
| [`numbers.ts`](../../app/src/helpers/constants/numbers.ts) | `NHS_NUMBER_UNKNOWN` | Sentinel value `"0000000000"` for unknown NHS numbers. |
| [`regex.ts`](../../app/src/helpers/constants/regex.ts) | `NHS_NUMBER_PATTERN` | Regex accepting 10-digit NHS numbers with optional space/dash separators. |

---

## JSON Configs - `app/src/config/`

Static JSON files that define per-document-type configuration. These are imported
by [`documentType.ts`](../../app/src/helpers/utils/documentType.ts) and merged
into `DOCUMENT_TYPE_CONFIG` objects.

| File | Describes |
|------|-----------|
| [`documentTypesConfig.json`](../../app/src/config/documentTypesConfig.json) | Master list of document types with SNOMED codes, display names, and upload metadata. |
| [`lloydGeorgeConfig.json`](../../app/src/config/lloydGeorgeConfig.json) | Scanned Paper Notes (Lloyd George) - accepted file types, stitching rules, content strings. |
| [`electronicHealthRecordConfig.json`](../../app/src/config/electronicHealthRecordConfig.json) | Electronic Health Record (EHR) configuration. |
| [`electronicHealthRecordAttachmentsConfig.json`](../../app/src/config/electronicHealthRecordAttachmentsConfig.json) | EHR Attachments configuration (not independently uploadable). |
| [`lettersAndDocumentsConfig.json`](../../app/src/config/lettersAndDocumentsConfig.json) | Letters and Documents configuration. |
| [`rejectedFileTypes.json`](../../app/src/config/rejectedFileTypes.json) | File extensions that are explicitly rejected by the upload validator. |

To add a new document type, create a config JSON in this directory, add its
SNOMED code to the `DOCUMENT_TYPE` enum, then register the config in
`documentType.ts`.

---

## Conventions

- **Co-located tests** - every util file should have a sibling `*.test.ts` or
  `*.test.tsx` file.
- **Pure functions preferred** - utils should avoid React hooks or side-effects
  where possible.
- **Constants** in `helpers/constants/` are plain values; anything with logic
  belongs in `helpers/utils/`.

---

*Previous:* [data-models.md](data-models.md) · *Next:* [observability.md](observability.md) · [Back to README](README.md)
