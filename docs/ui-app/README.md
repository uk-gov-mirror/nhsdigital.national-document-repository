# UI Application Overview

The National Document Repository (NDR) front end is a **React 19 + Vite** single-page application.
It authenticates users via NHS CIS2 / OIDC and serves two primary personas - **GP practice staff**
(admin and clinical roles) and **PCSE** users - each with different access to patient records.

If you are new to the UI, follow the [root README](../../README.md), start with [how-to-add-a-page.md](how-to-add-a-page.md), and keep
[components-and-styling.md](components-and-styling.md) open for the NHS component-library
precedence rule.

---

## Contents

| Section | Description |
| --- | --- |
| [Documentation index](#documentation-index) | Links to all detailed topic guides |
| [Architecture](#architecture) | Layered app pattern and provider composition order |
| [Directory structure](#directory-structure) | Annotated source tree |

---

## Documentation index

| Document | Description | Key sections |
| --- | --- | --- |
| [routing.md](routing.md) | Router setup, route types, guard stack, `routes`/`routeChildren` enums | [Router structure](routing.md#how-the-router-is-structured), [Guards](routing.md#guards), [Route enums](routing.md#route-enums), [Navigation helpers](routing.md#navigation-helpers) |
| [error-handling.md](error-handling.md) | Custom errors, `UIErrorCode`, error components, error pages, error-code map | [Custom error classes](error-handling.md#custom-error-classes), [Error-code lookup](error-handling.md#error-code-lookup-backend-codes), [Error pages](error-handling.md#error-pages), [How to add a new error](error-handling.md#how-to-add-a-new-error) |
| [components-and-styling.md](components-and-styling.md) | Component tiers, NHS component library, SCSS stack | [Component tiers](components-and-styling.md#component-tiers), [NHS component precedence](components-and-styling.md#nhs-component-library-precedence), [Styling stack](components-and-styling.md#styling-stack), [PDF.js viewer](components-and-styling.md#pdfjs-viewer) |
| [state-and-api.md](state-and-api.md) | Providers, hooks, API requests, endpoints | [Providers](state-and-api.md#providers), [Custom hooks](state-and-api.md#custom-hooks), [API requests](state-and-api.md#api-requests), [Endpoints enum](state-and-api.md#endpoints-enum) |
| [data-models.md](data-models.md) | TypeScript types, FHIR R4, enums | [Type organisation](data-models.md#type-organisation), [Core domain types](data-models.md#core-domain-types), [FHIR R4 types](data-models.md#fhir-r4-types), [Key enums](data-models.md#key-enums) |
| [utils.md](utils.md) | Helper utilities and constants | [Formatting](utils.md#formatting), [Validation](utils.md#validation), [Document handling](utils.md#document-handling), [Conventions](utils.md#conventions) |
| [observability.md](observability.md) | AWS CloudWatch RUM via AnalyticsProvider | [How it works](observability.md#how-it-works), [Environment variables](observability.md#environment-variables), [Viewing RUM data](observability.md#viewing-rum-data), [Backend logging relationship](observability.md#relationship-to-backend-logging) |
| [build-and-deploy.md](build-and-deploy.md) | Vite build, Docker, env vars | [Build (Vite)](build-and-deploy.md#build--vite), [Docker](build-and-deploy.md#docker), [Environment variables](build-and-deploy.md#environment-variables), [Deployment notes](build-and-deploy.md#deployment-notes) |
| [ui-testing.md](ui-testing.md) | Vitest + RTL unit/component testing | [Stack](ui-testing.md#stack), [Configuration](ui-testing.md#configuration), [Mocking patterns](ui-testing.md#mocking-patterns), [Running tests](ui-testing.md#running-tests) |
| [e2e-testing.md](e2e-testing.md) | Cypress end-to-end and smoke tests | [Stack](e2e-testing.md#stack), [Configuration](e2e-testing.md#configuration), [Running Cypress](e2e-testing.md#running-cypress), [Authoring guidance](e2e-testing.md#authoring-guidance) |
| [how-to-add-a-page.md](how-to-add-a-page.md) | Step-by-step tutorial for adding a new page | [Reference files](how-to-add-a-page.md#reference-files), [Steps](how-to-add-a-page.md#steps), [Define the route](how-to-add-a-page.md#1-define-the-route), [Checklist](how-to-add-a-page.md#12-checklist) |



## Architecture

The app follows a layered pattern. Providers wrap the tree, pages compose blocks and generic
components, page hooks own state and navigation, and request helpers call the API Gateway.

```text
ConfigProvider
  -> SessionProvider
    -> AnalyticsProvider
      -> PatientDetailsProvider
        -> PatientAccessAuditProvider
          -> AppRouter
            -> Page
              -> Block / Generic component
                -> use<Page> hook
                  -> axios request helper
                    -> API Gateway
```

### Provider composition order

Defined in [`app/src/App.tsx`](../../app/src/App.tsx):

```text
ConfigProvider
  └─ SessionProvider
       └─ AnalyticsProvider
            └─ PatientDetailsProvider
                 └─ PatientAccessAuditProvider
                      └─ AppRouter
```

Each provider exposes either a context hook (`useSessionContext`, `usePatientDetailsContext`) or
an app-level helper hook layered on top (`useConfig`, `usePatient`, `usePatientAccessAudit`).

---

## Directory structure

```text
app/
├── src/
│   ├── App.tsx                  # Root component - provider composition
│   ├── main.tsx                 # Vite entry point
│   ├── router/                  # AppRouter and guards (AuthGuard, RoleGuard, PatientGuard…)
│   ├── pages/                   # One folder per page/journey
│   ├── components/
│   │   ├── blocks/              # Feature-scoped components (_domain/ namespaced)
│   │   ├── generic/             # Reusable primitives
│   │   └── layout/              # Header, Footer, Layout, ErrorBox, etc.
│   ├── providers/               # React context providers
│   ├── helpers/
│   │   ├── hooks/               # Custom hooks (usePatient, useRole, useConfig…)
│   │   ├── requests/            # Axios API request functions
│   │   ├── utils/               # Formatting, validation, file helpers
│   │   ├── constants/           # Shared constants (errors, network, regex)
│   │   └── test/                # Test builders and helpers
│   ├── types/                   # Shared types, enums, FHIR R4, error definitions
│   ├── styles/                  # Global SCSS (App.scss)
│   ├── config/                  # JSON config files
│   └── assets/                  # Static assets
├── cypress/                     # E2E and smoke tests
├── Dockerfile                   # Multi-stage build (node → nginx)
├── vite.config.ts               # Vite build config
├── vitest.config.ts             # Unit test config
└── package.json
```

---

