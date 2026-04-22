# Error Handling

Errors in the UI fall into three categories: **custom error classes** thrown during async
operations, **UI error codes** rendered via a generic error page, and **inline error components**
shown within a page. This document covers each layer.

---

## Contents

| Section |
| --- |
| [Custom error classes](#custom-error-classes) |
| [`ErrorResponse` type](#errorresponse-type) |
| [`UIErrorCode` enum](#uierrorcode-enum) |
| [Error-code lookup](#error-code-lookup-backend-codes) |
| [Error-surface components](#error-surface-components) |
| [Error pages](#error-pages) |
| [Error mapping helpers](#error-mapping-helpers) |
| [How to add a new error](#how-to-add-a-new-error) |

---

## Custom error classes

Defined in [`app/src/types/generic/errors.tsx`](../../app/src/types/generic/errors.tsx).

| Class | Error code | When thrown |
| --- | --- | --- |
| `DownloadManifestError` | `DMS_2001` | A document download manifest request fails |
| `StitchRecordError` | `LGS_5000` | Lloyd George record stitching (PDF merge) fails |

Both classes extend `Error` and attach an `ErrorResponse`-shaped `response.data` property so they
can be handled the same way as axios errors.

---

## `ErrorResponse` type

Defined in [`app/src/types/generic/errorResponse.ts`](../../app/src/types/generic/errorResponse.ts):

```ts
type ErrorResponse = {
    message: string;
    err_code?: string;
    interaction_id?: string;
};
```

Backend API errors arrive in this shape. The optional `err_code` maps to a human-readable message
via the error-code lookup (see below).

---

## `UIErrorCode` enum

Also in [`errors.tsx`](../../app/src/types/generic/errors.tsx). These codes are raised **client-side**
and rendered on `GenericErrorPage`:

| Code | Constant | Meaning |
| --- | --- | --- |
| `UPR01` | `USER_PATIENT_RESTRICTIONS_SELF_ADD` | User tried to restrict their own smartcard |
| `PA001` | `PATIENT_NOT_REGISTERED_AT_YOUR_PRACTICE` | Patient is at another practice |
| `PA002` | `PATIENT_ACCESS_RESTRICTED` | Staff member's access to this patient is restricted |
| `PA003` | `PATIENT_DECEASED` | Patient record is marked deceased |

Each code has a corresponding `UIErrorContent` entry in the `UIErrors` record, providing a `title`
and `messageParagraphs` render function.

To navigate to the generic error page with a UI error code:

```ts
navigate(routes.GENERIC_ERROR + '?errorCode=' + UIErrorCode.PATIENT_DECEASED);
```

---

## Error-code lookup (backend codes)

[`app/src/helpers/utils/errorCodes.ts`](../../app/src/helpers/utils/errorCodes.ts) maps backend
`err_code` strings to user-facing messages. `ServerErrorPage` decodes the `?encodedError` query
parameter and looks up the code here. If no match is found, a generic fallback message is shown.

Code prefixes follow the backend lambda naming convention:

| Prefix | Origin |
| --- | --- |
| `CDR_` | Create Document Reference |
| `DT_` | Document Type Error |
| `VDT_` | Document Type Validation |
| `LR_` | Login Redirect |
| `LIN_` | Login / CIS2 auth |
| `DMS_` | Document Manifest Service |
| `LGS_` | Lloyd George Stitch |
| `DRS_` | Document Reference Search |
| `DDS_` | Document Delete Service |
| `OUT_` | Logout |
| `ENV_` | Environment config |
| `GWY_` | API Gateway |
| `SFB_` | Send Feedback |
| `SP_` | Search Patient |
| `UC_` | Upload Confirm |
| `LGL_` | Lloyd George Lock |

---

## Error-surface components

### `ErrorBox`

**File:** [`app/src/components/layout/errorBox/ErrorBox.tsx`](../../app/src/components/layout/errorBox/ErrorBox.tsx)

An inline validation-style error summary (wraps `nhsuk-react-components` `ErrorSummary`). Use this
for form validation and file-upload errors where the user stays on the same page and corrects their
input.

Key props:

| Prop | Purpose |
| --- | --- |
| `messageTitle` | Bold heading inside the error summary |
| `messageBody` | Paragraph text |
| `messageLinkBody` / `errorInputLink` | Clickable link to the erroring input |
| `errorOnClick` | Callback link alternative to `errorInputLink` |
| `errorMessageList` / `groupErrorsFn` | Grouped list of errors (used for multi-file upload errors) |

### `ServiceErrorBox`

**File:** [`app/src/components/layout/serviceErrorBox/ServiceErrorBox.tsx`](../../app/src/components/layout/serviceErrorBox/ServiceErrorBox.tsx)

A 5xx-style "service unavailable" banner. Displays a fixed heading
("Sorry, the service is currently unavailable") with an optional custom message and a link to the
NHS service desk. Use this when an API call fails and the user cannot recover by retrying their
input.

---

## Error pages

These are full-page error screens, each mapped to a public route in `routeMap`:

| Page | Route | When shown |
| --- | --- | --- |
| `AuthErrorPage` | `/auth-error` | User is logged out unexpectedly or auth flow fails |
| `UnauthorisedPage` | `/unauthorised` | `AuthGuard` or `RoleGuard` redirects here |
| `UnauthorisedLoginPage` | `/unauthorised-login` | User's smartcard roles don't match any authorised role |
| `ServerErrorPage` | `/server-error` | Backend returns an error - reads `?encodedError` query param |
| `SessionExpiredErrorPage` | `/session-expired` | Inactivity timeout - disables RUM and prompts re-login |
| `GenericErrorPage` | `/error` | Renders a `UIErrorCode` from `?errorCode` query param |
| `NotFoundPage` | `/*` | Catch-all for unmatched URLs |

**Source locations:**

- [`app/src/pages/authErrorPage/`](../../app/src/pages/authErrorPage/)
- [`app/src/pages/unauthorisedPage/`](../../app/src/pages/unauthorisedPage/)
- [`app/src/pages/unauthorisedLoginPage/`](../../app/src/pages/unauthorisedLoginPage/)
- [`app/src/pages/serverErrorPage/`](../../app/src/pages/serverErrorPage/)
- [`app/src/pages/sessionExpiredErrorPage/`](../../app/src/pages/sessionExpiredErrorPage/)
- [`app/src/pages/genericErrorPage/`](../../app/src/pages/genericErrorPage/)
- [`app/src/pages/notFoundPage/`](../../app/src/pages/notFoundPage/)

---

## Error mapping helpers

### `errorToParams` / `errorCodeToParams`

**File:** [`app/src/helpers/utils/errorToParams.ts`](../../app/src/helpers/utils/errorToParams.ts)

Encodes an `AxiosError` (or a raw error code string) into a base64 `?encodedError` query parameter
for navigation to `ServerErrorPage`:

```ts
navigate(routes.SERVER_ERROR + errorToParams(axiosError));
```

The encoded value is a JSON array `[err_code, interaction_id]`.

### `getMappedErrorMessage` / `groupErrorsByType`

**File:** [`app/src/helpers/utils/errorMessages.ts`](../../app/src/helpers/utils/errorMessages.ts)

Utilities for `ErrorBox` when displaying grouped error lists (e.g. file upload validation).
`groupErrorsByType` aggregates `ErrorMessageListItem` entries by their error type, merging link IDs
so a single error summary item can scroll to the first affected input.

Supporting types are in
[`app/src/types/pages/genericPageErrors.ts`](../../app/src/types/pages/genericPageErrors.ts):
`ErrorMessageMap`, `ErrorMessageListItem`, `GroupedErrorRecords`, `GroupErrors`.

---

## How to add a new error

1. **Pick or define an error code.**
   - For backend errors: the lambda should return an `err_code` string. Add its mapping to
     [`errorCodes.ts`](../../app/src/helpers/utils/errorCodes.ts).
   - For client-side errors: add a new member to `UIErrorCode` in
     [`errors.tsx`](../../app/src/types/generic/errors.tsx) and a corresponding entry in the
     `UIErrors` record with `title` and `messageParagraphs`.

2. **Choose the error surface.**
   - **`ErrorBox`** - inline validation that keeps the user on the page.
   - **`ServiceErrorBox`** - service-unavailable banner within a page.
   - **`ServerErrorPage`** - navigate with `errorToParams()` for backend errors.
   - **`GenericErrorPage`** - navigate with `?errorCode=<UIErrorCode>` for client-side errors.
   - **Dedicated page** - only if the error has a unique recovery flow (e.g. `SessionExpiredErrorPage`).

3. **Wire the navigation.** Use `errorToParams` or `errorCodeToParams` for `ServerErrorPage`, or
   build the query string manually for `GenericErrorPage`.

4. **Test.** Write a unit test that triggers the error condition and asserts the correct
   page/component renders with the expected message.

---

*Previous:* [routing.md](routing.md) · *Next:* [components-and-styling.md](components-and-styling.md) · [Back to README](README.md)
