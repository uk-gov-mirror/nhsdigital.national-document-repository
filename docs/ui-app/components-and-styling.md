# Components and Styling

This document describes the component architecture and styling conventions used in the NDR
front end. For the overall directory structure see the [README](README.md).

---

## Contents

| Section |
| --- |
| [Component tiers](#component-tiers) |
| [NHS component library precedence](#nhs-component-library-precedence) |
| [Styling stack](#styling-stack) |
| [PDF.js viewer](#pdfjs-viewer) |
| [File conventions](#file-conventions) |

---

## Component tiers

The UI is organised into four tiers. Each tier has a dedicated folder under
[`app/src/`](../../app/src/).

### Pages - [`src/pages/`](../../app/src/pages/)

Container components, one folder per user journey. A page component is thin - it calls a
co-located **page hook** (`use<PageName>PageHook.ts`) that owns all state, navigation and
side-effects, then passes data down to blocks. See [how-to-add-a-page.md](how-to-add-a-page.md)
for the full pattern.

Examples: `lloydGeorgeRecordPage`, `documentUploadPage`, `userPatientRestrictionsPage`,
`ReviewsPage`, `patientSearchPage`.

### Blocks - [`src/components/blocks/`](../../app/src/components/blocks/)

Feature-scoped components namespaced with an `_` prefix by domain:

| Domain folder | Purpose |
| --- | --- |
| `_admin` | Admin dashboard components |
| `_lloydGeorge` | Lloyd George record view / download / delete stages |
| `_documentManagement` | Document select, upload, reassign stages |
| `_documentVersion` | Version history views |
| `_reviews` | Document review workflows |
| `_delete` | Deletion confirmation flows |
| `_downloadReport` | ODS report download |
| `_patientDocuments` | Patient document list views |
| `_patientAccessAudit` | Deceased-patient access audit |
| `_userPatientRestrictions` | User-patient restriction management |
| `_cookiesPolicy` | Cookie consent components |

There are also a few shared folders (`deletionConfirmationStage`, `generic`, `testPanel`) that
sit outside the domain convention.

### Generic - [`src/components/generic/`](../../app/src/components/generic/)

Reusable primitives shared across multiple pages:

`backButton`, `createdBy`, `documentsListView`, `linkButton`, `pagination`, `paginationV2`,
`patientSearchForm`, `patientSummary`, `patientVerifyForm`, `pdfViewer`, `progressBar`,
`recordCard`, `recordLoader`, `recordMenuCard`, `reducedPatientInfo`, `serviceDeskLink`,
`spinner`, `spinnerButton`, `spinnerV2`, `staffMemberDetails`, `timeline`.

### Layout - [`src/components/layout/`](../../app/src/components/layout/)

Shared page chrome and cross-cutting UI components.

[`Layout.tsx`](../../app/src/components/layout/Layout.tsx) wraps every route and renders:

- **Header** / **Footer** - NHS-branded site header and footer.
- **PhaseBanner** - GOV.UK phase banner (alpha/beta).

`Layout.tsx` wraps every route. It handles:

- Skip-to-content link and focus management on navigation.
- Scroll reset on route change.
- Fullscreen mode toggle (hides header/banner for PDF viewer).
- Analytics initialisation when cookie consent is given.

The same folder also contains reusable layout components used by pages and blocks, including
**NavLinks**, **ErrorBox**, **ServiceErrorBox**, and **NotificationBanner**.

---

## NHS component library precedence

When adding a new component follow this order:

1. **`nhsuk-react-components`** (v5) - use the existing React wrapper when the component exists.
2. **`nhsuk-frontend`** (v9) - if there is no React wrapper, use the vanilla HTML/CSS and wrap
   it in a local React component.
3. **`govuk-frontend`** (v5) - fall back here when the NHS design system has no equivalent.
4. **`nhsapp-frontend`** (v4) - for NHS App-specific patterns (e.g. timeline).
5. **Build locally** - only when no upstream component exists. Stay compatible with any in-flight
   NHS design-system proposal so the component can be swapped out later.

---

## Styling stack

All four libraries are imported globally in
[`src/styles/App.scss`](../../app/src/styles/App.scss):

```scss
@import 'govuk-frontend/dist/govuk/base';
@import 'govuk-frontend/dist/govuk/core/index';
@import 'govuk-frontend/dist/govuk/utilities/index';
/* selective govuk component imports (phase-banner, warning-text, etc.) */

@import 'nhsuk-frontend/packages/nhsuk';

@import 'nhsapp-frontend/dist/nhsapp/components/timeline/_timeline.scss';
```

### Conventions

- **BEM** - Block, Element, Modifier naming
  ([getbem.com](https://getbem.com/)). Example class:
  `lloydgeorge_record-details_details--last-updated`.
- **Spacing utilities** - `App.scss` defines helper classes generated via mixins:
  `.mt-6`, `.mb-12`, `.px-24`, `.mx-auto`, `.gap-6`, `.h-100`, `.w-50`, etc.
- **Flexbox utilities** - `.d-flex`, `.flex-center`, `.align-center`, `.align-between`,
  `.align-evenly`, `.align-bottom`.
- **No CSS-in-JS / no CSS modules** - the project uses global SCSS only. Type declarations for
  `*.module.scss` exist in `react-app-env.d.ts` but are not actively used.
- **Component SCSS** - some components have a co-located `.scss` file
  (e.g. `SpinnerV2.scss`, `DocumentSelectStage.scss`) imported at the bottom of `App.scss`.

---

## PDF.js viewer

The [`pdfViewer`](../../app/src/components/generic/pdfViewer/) generic component renders PDFs
using the `pdfjs-viewer-element` web component (`<pdfjs-viewer-element viewer-path="/pdfjs">`).

Key details:

- The component accepts a `fileUrl`, optional CSS classes, an optional custom stylesheet, and a
  ref for external control.
- Print-button clicks are tracked via AWS RUM for analytics.
- The viewer assets are prepared in the Docker build stage
  ([`app/Dockerfile`](../../app/Dockerfile)):

```dockerfile
RUN cp ./node_modules/pdfjs-dist/build/pdf.worker.min.mjs ./public/
RUN mkdir -p ./public/pdfjs
RUN wget https://github.com/mozilla/pdf.js/releases/download/v5.4.624/pdfjs-5.4.624-dist.zip \
    -O ./public/pdfjs/pdfjs.zip
RUN unzip -o -d ./public/pdfjs ./public/pdfjs/pdfjs.zip
```

The worker and viewer are served from `/pdfjs` by nginx at runtime.

---

## File conventions

Every component lives in its own folder:

```text
ComponentName/
├── ComponentName.tsx          # Component implementation
├── ComponentName.test.tsx     # Co-located unit test
└── ComponentName.scss         # Optional - only when NHS/GOV.UK primitives are insufficient
```

Page folders follow the same pattern with an additional page hook:

```text
pageName/
├── PageName.tsx
├── PageName.test.tsx
├── usePageNamePageHook.ts
└── usePageNamePageHook.test.tsx
```

---

*Previous:* [error-handling.md](error-handling.md) · *Next:* [state-and-api.md](state-and-api.md) · [Back to README](README.md)
