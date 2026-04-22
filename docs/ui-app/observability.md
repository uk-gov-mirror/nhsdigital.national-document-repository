# Observability

The UI is a client-side React SPA, so browser-side telemetry is handled separately from backend
logging. In this app that means **AWS CloudWatch RUM** for browser telemetry, plus a separate
**patient-access audit** provider for clinical-access events sent to the backend API.

---

## Contents

| Section |
| --- |
| [AWS CloudWatch RUM - `AnalyticsProvider`](#aws-cloudwatch-rum--analyticsprovider) |
| [Patient Access Audit - `PatientAccessAuditProvider`](#patient-access-audit--patientaccessauditprovider) |
| [Relationship to backend logging](#relationship-to-backend-logging) |

---

## AWS CloudWatch RUM - `AnalyticsProvider`

**Source:** [`app/src/providers/analyticsProvider/AnalyticsProvider.tsx`](../../app/src/providers/analyticsProvider/AnalyticsProvider.tsx)

`AnalyticsProvider` wraps the app tree and exposes `[awsRum, startAnalytics]` via
`useAnalyticsContext()`. The provider creates the
[`aws-rum-web`](https://github.com/aws-observability/aws-rum-web) client, while
[`Layout.tsx`](../../app/src/components/layout/Layout.tsx) decides when to start it.

The configured RUM telemetries are:

- **HTTP requests**
- **Unhandled JavaScript errors**
- **Performance metrics**

### How it works

1. `Layout.tsx` calls `startAnalytics()` on navigation when statistics cookies are allowed and
   analytics is not active.
2. If `VITE_MONITOR_ACCOUNT_ID` is not set (e.g. local dev), RUM is skipped.
3. A `sessionStorage` flag (`analytics-started`) prevents duplicate
   initialisation within the same tab. Cookie settings and the session-expired flow can set this
   flag back to `no`.
4. After the `AwsRum` client is created, the provider reads the user session
   from `sessionStorage` (`UserSession`), decodes the JWT, and attaches custom
   session attributes:

   | Attribute | Source |
   |-----------|--------|
   | `ndrUserRole` | `session.auth.role` |
   | `ndrOdsName` | JWT `selected_organisation.name` |
   | `ndrOdsCode` | JWT `selected_organisation.org_ods_code` |
   | `ndrRoleCode` | JWT `selected_organisation.role_code` |
   | `ndrIcbOdsCode` | JWT `selected_organisation.icb_ods_code` |
   | `ndrSmartCardRole` | JWT `smart_card_role` |
   | `ndrSessionId` | JWT `ndr_session_id` |
   | `ndrNHSUserId` | JWT `nhs_user_id` |

5. Components can emit custom events through the `AwsRum` instance returned by
   `useAnalyticsContext()`. For example, the PDF viewer records a
   `print_pdf_button_clicked` event.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `VITE_MONITOR_ACCOUNT_ID` | CloudWatch RUM **Application Monitor ID**. Empty = RUM disabled. |
| `VITE_RUM_IDENTITY_POOL_ID` | Cognito **Identity Pool ID** used by the RUM client for unauthenticated AWS credentials. |
| `VITE_AWS_REGION` | AWS region for the RUM endpoint (defaults to `eu-west-2`). |

These are set at build time by Vite (see [build-and-deploy.md](build-and-deploy.md)).

### RUM configuration

The `AwsRumConfig` object is defined inline in the provider:

```ts
const config: AwsRumConfig = {
    sessionSampleRate: 1,          // capture 100 % of sessions
    identityPoolId: '...',
    endpoint: `https://dataplane.rum.${region}.amazonaws.com`,
    telemetries: ['http', 'errors', 'performance'],
    allowCookies: true,
    enableXRay: false,
};
```

- `sessionSampleRate: 1` means every session is captured. Adjust in production
  if volume is a concern.
- `enableXRay: false` - X-Ray trace propagation is not currently enabled.

### Viewing RUM data

1. Open the **CloudWatch → RUM → Application monitors** console in the correct
    AWS account and region.
2. Select the application monitor whose ID matches `VITE_MONITOR_ACCOUNT_ID`.
3. Dashboards show request, error, and performance telemetry for the UI.

### Adding a custom event

To record an explicit RUM event from a component:

```tsx
const [analytics] = useAnalyticsContext();

analytics?.recordEvent('my_custom_event', { key: 'value' });
```

Keep event names lowercase with underscores and include only non-PII data.

---

## Patient Access Audit - `PatientAccessAuditProvider`

**Source:** [`app/src/providers/patientAccessAuditProvider/PatientAccessAuditProvider.tsx`](../../app/src/providers/patientAccessAuditProvider/PatientAccessAuditProvider.tsx)

This provider is **distinct from RUM**. It stores an array of
`PatientAccessAudit` records that track _why_ a user accessed a patient's data
(for example deceased-patient access reasons). These audit events are submitted
through backend APIs rather than being sent directly to CloudWatch from the browser.

The context exposes a `[state, setState]` tuple via
`usePatientAccessAuditContext()`. Pages that require an audit reason (e.g.
accessing a deceased patient's record) populate this state before making the API
call.

The `PatientAccessAudit` type is defined in
[`app/src/types/generic/accessAudit.ts`](../../app/src/types/generic/accessAudit.ts).

---

## Relationship to backend logging

| Layer | Destination | Mechanism |
|-------|-------------|-----------|
| UI browser telemetry | CloudWatch RUM | `aws-rum-web` client in the browser |
| UI audit events | Backend API | `PatientAccessAuditProvider` state passed to request handlers |
| Backend lambdas | CloudWatch Logs | Python `logging` / structured JSON |

Correlation between UI and backend activity typically relies on the session and user identifiers
attached to RUM plus the request metadata carried in backend API calls.

---

*Previous:* [utils.md](utils.md) · *Next:* [build-and-deploy.md](build-and-deploy.md) · [Back to README](README.md)
