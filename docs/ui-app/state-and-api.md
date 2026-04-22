# State and API

This document covers context providers, custom hooks and the API request layer - the UI
equivalent of the backend's services and repositories. For the overall architecture see the
[README](README.md).

---

## Contents

| Section |
| --- |
| [Providers](#providers) |
| [Custom hooks](#custom-hooks) |
| [API requests](#api-requests) |
| [Endpoints enum](#endpoints-enum) |
| [Feature flags](#feature-flags) |
| [Mock / local mode](#mock--local-mode) |

---

## Providers

Providers live in [`src/providers/`](../../app/src/providers/) and are composed in
[`App.tsx`](../../app/src/App.tsx) in the order shown below. Each wraps a React context and
exposes one or more hooks.

```text
ConfigProvider
  └─ SessionProvider
       └─ AnalyticsProvider
            └─ PatientDetailsProvider
                 └─ PatientAccessAuditProvider
                      └─ AppRouter
```

| Provider | Stored shape | Hook(s) | sessionStorage key |
| --- | --- | --- | --- |
| [`ConfigProvider`](../../app/src/providers/configProvider/ConfigProvider.tsx) | `GlobalConfig` (`featureFlags` + `mockLocal`) | `useConfigContext()`, `useConfig()` | `AppConfig` |
| [`SessionProvider`](../../app/src/providers/sessionProvider/SessionProvider.tsx) | `Session` (`auth`, `isLoggedIn`, `isFullscreen`) | `useSessionContext()` | `UserSession` |
| [`AnalyticsProvider`](../../app/src/providers/analyticsProvider/AnalyticsProvider.tsx) | `AwsRum \| null` + `startAnalytics` callback | `useAnalyticsContext()` | `analytics-started` |
| [`PatientDetailsProvider`](../../app/src/providers/patientProvider/PatientProvider.tsx) | `PatientDetails \| null` | `usePatientDetailsContext()` | - |
| [`PatientAccessAuditProvider`](../../app/src/providers/patientAccessAuditProvider/PatientAccessAuditProvider.tsx) | `PatientAccessAudit[] \| null` | `usePatientAccessAuditContext()` | - |

`ConfigProvider` and `SessionProvider` persist to `sessionStorage` so state survives page
refreshes. `PatientDetailsProvider` and `PatientAccessAuditProvider` use plain React state and
reset on refresh.

---

## Custom hooks

Hooks in [`src/helpers/hooks/`](../../app/src/helpers/hooks/) provide convenient access to
context values and derived data.

| Hook | Returns | Source |
| --- | --- | --- |
| [`useConfig`](../../app/src/helpers/hooks/useConfig.tsx) | `GlobalConfig` | ConfigProvider |
| [`useBaseAPIUrl`](../../app/src/helpers/hooks/useBaseAPIUrl.tsx) | `string` - the `VITE_DOC_STORE_API_ENDPOINT` env var | Environment |
| [`useBaseAPIHeaders`](../../app/src/helpers/hooks/useBaseAPIHeaders.tsx) | `AuthHeaders` (`Content-Type` + authorisation token) | SessionProvider |
| [`usePatient`](../../app/src/helpers/hooks/usePatient.tsx) | `PatientDetails \| null` | PatientDetailsProvider |
| [`useRole`](../../app/src/helpers/hooks/useRole.tsx) | `REPOSITORY_ROLE \| null` | SessionProvider (`auth.role`) |
| [`useSmartcardNumber`](../../app/src/helpers/hooks/useSmartcardNumber.tsx) | `string \| null` - `nhs_user_id` decoded from JWT | SessionProvider |
| [`useTitle`](../../app/src/helpers/hooks/useTitle.tsx) | `void` - sets `document.title` as a side-effect | - |
| [`useReviewId`](../../app/src/helpers/hooks/useReviewId.tsx) | `string \| undefined` - validated `:reviewId` URL param | React Router |
| [`usePatientAccessAudit`](../../app/src/helpers/hooks/usePatientAccessAudit.tsx) | `PatientAccessAudit[] \| null` | PatientAccessAuditProvider |

---

## API requests

Request functions live in [`src/helpers/requests/`](../../app/src/helpers/requests/). Every
request follows the same pattern:

1. Accept `baseUrl`, `baseHeaders` (from `useBaseAPIUrl` and `useBaseAPIHeaders`) and
   domain-specific params.
2. Build the URL as `baseUrl + endpoints.XXX`.
3. Call `axios` (GET, POST, PUT, etc.).
4. Return the typed response data.
5. Re-throw errors as `AxiosError` for callers to handle.

### Canonical example - `getPatientDetails`

[`src/helpers/requests/getPatientDetails.ts`](../../app/src/helpers/requests/getPatientDetails.ts):

```typescript
const getPatientDetails = async ({
    nhsNumber,
    baseUrl,
    baseHeaders,
}: Args): Promise<PatientDetails> => {
    const gatewayUrl = baseUrl + endpoints.PATIENT_SEARCH;
    try {
        const { data } = await axios.get(gatewayUrl, {
            headers: { ...baseHeaders },
            params: { patientId: nhsNumber },
        });
        return data;
    } catch (e) {
        throw e as AxiosError;
    }
};
```

### Request inventory

| File | HTTP | Endpoint | Notes |
| --- | --- | --- | --- |
| `getAuthToken.ts` | GET | `AUTH` | Token exchange after OIDC callback |
| `getPatientDetails.ts` | GET | `PATIENT_SEARCH` | Search by NHS number |
| `getDocumentSearchResults.ts` | GET | `DOCUMENT_SEARCH` | Search document references |
| `getDocument.ts` | GET | `DOCUMENT_REFERENCE/{id}` | Supports version history; local-mode mock |
| `getDocumentVersionHistory.ts` | GET | `DOCUMENT_REFERENCE/{id}` | Version history for a document |
| `getLloydGeorgeRecord.ts` | GET | `LLOYDGEORGE_STITCH` | Trigger LG stitch job |
| `getPresignedUrlForZip.ts` | GET | `DOCUMENT_PRESIGN` | Pre-signed ZIP download URL |
| `getFeatureFlags.ts` | GET | `FEATURE_FLAGS` | Falls back to defaults on error |
| `getReviews.ts` | GET | `DOCUMENT_REVIEW` | Paginated; local-mode mock |
| `uploadDocuments.ts` | POST/PUT | `DOCUMENT_REFERENCE` | FHIR DocumentReference body; PUT for updates |
| `deleteAllDocuments.ts` | DELETE | `DOCUMENT_REFERENCE` | Bulk delete by patient |
| `downloadReport.ts` | GET | `ODS_REPORT` | ODS report download |
| `documentReview.ts` | GET | `DOCUMENT_REVIEW` | Single review detail |
| `patchReviews.ts` | PATCH | `DOCUMENT_REVIEW` | Update review status |
| `sendEmail.ts` | POST | `FEEDBACK` | Send feedback email |
| `postPatientAccessAudit.ts` | POST | `/AccessAudit` | Clinical-access audit event |
| `logout.ts` | GET | `LOGOUT` | End session |
| `userPatientRestrictions/` | Various | `USER_PATIENT_RESTRICTIONS` | Four request files for CRUD operations |

---

## Endpoints enum

Defined in [`src/types/generic/endpoints.ts`](../../app/src/types/generic/endpoints.ts):

```typescript
export enum endpoints {
    LOGIN            = '/Auth/Login',
    LOGOUT           = '/Auth/Logout',
    AUTH             = '/Auth/TokenRequest',
    PATIENT_SEARCH   = '/SearchPatient',
    DOCUMENT_SEARCH  = '/SearchDocumentReferences',
    DOCUMENT_REFERENCE = '/DocumentReference',
    DOCUMENT_PRESIGN = '/DocumentManifest',
    LLOYDGEORGE_STITCH = '/LloydGeorgeStitch',
    FEEDBACK         = '/Feedback',
    FEATURE_FLAGS    = '/FeatureFlags',
    VIRUS_SCAN       = '/VirusScan',
    UPLOAD_CONFIRMATION = '/UploadConfirm',
    DOCUMENT_STATUS  = '/DocumentStatus',
    ODS_REPORT       = '/OdsReport',
    MOCK_LOGIN       = 'Auth/MockLogin',
    DOCUMENT_REVIEW  = '/DocumentReview',
    USER_PATIENT_RESTRICTIONS = '/UserRestriction',
    USER_PATIENT_RESTRICTIONS_SEARCH_USER = '/UserRestriction/SearchUser',
}
```

---

## Feature flags

Feature flags are loaded during sign-in and stored in `ConfigProvider`.

- **Load path:** [`AuthCallbackPage`](../../app/src/pages/authCallbackPage/AuthCallbackPage.tsx)
  exchanges the auth code, then calls
  [`getFeatureFlags`](../../app/src/helpers/requests/getFeatureFlags.ts) with the freshly issued
  JWT and writes the result into `ConfigProvider`.
- **Type:** [`FeatureFlags`](../../app/src/types/generic/featureFlags.ts) - boolean toggles for
  in-progress features (`uploadLloydGeorgeWorkflowEnabled`, `documentCorrectEnabled`,
  `versionHistoryEnabled`, etc.).
- **Defaults:** `defaultFeatureFlags` sets all flags to `false`; `getFeatureFlags` falls back to
  those defaults on any error.
- **Access:** `useConfig().featureFlags`.
- **Usage:** Pages and blocks check these flags directly to redirect users or hide/show UI
  features (for example `versionHistoryEnabled`, `uploadDocumentIteration3Enabled`,
  `userRestrictionEnabled`).

---

## Mock / local mode

[`src/helpers/utils/isLocal.ts`](../../app/src/helpers/utils/isLocal.ts) exports:

| Export | Purpose |
| --- | --- |
| `isLocal` | `true` when `VITE_ENVIRONMENT` is unset or `'local'` |
| `isMock(err)` | `true` when local **and** the error is a network error |
| `isRunningInCypress()` | `true` inside Cypress or Vitest |

When `isLocal` is true:

- `ConfigProvider` initialises `mockLocal` with defaults (`userRole: GP_ADMIN`,
  `patientIsActive: true`, etc.).
- Several request functions and page flows (e.g. `getDocument`, `getReviews`, auth callback)
  fall back to mock data instead of calling the live API.
- Patient search falls back to `buildPatientDetails()` from
  [`src/helpers/test/testBuilders.ts`](../../app/src/helpers/test/testBuilders.ts) on network
  error.

This allows the UI to run without a backend for local development.

### Adding mocks

Mocking request logic should live at the **page or component level**, not in the request functions themselves. Pages/components call request functions and handle errors; if a network error occurs in local mode, they can substitute mock data. This keeps request functions thin (always hitting the actual API) and moves the conditional logic where it belongs—in the UI layer that understands when to show data.

Conditionals guarded by `isLocal` allow Vite to tree-shake mock data and fallback logic out of the production bundle during the build step, keeping deployments lean.

---

*Previous:* [components-and-styling.md](components-and-styling.md) · *Next:* [data-models.md](data-models.md) · [Back to README](README.md)
