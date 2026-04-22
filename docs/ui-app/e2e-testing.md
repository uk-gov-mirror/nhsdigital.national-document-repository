# End-to-End Testing (Cypress)

Cypress handles integration and smoke testing against the running application.
For unit/component tests, see [ui-testing.md](ui-testing.md).

---

## Contents

| Section |
| --- |
| [Stack](#stack) |
| [Configuration](#configuration) |
| [Folder structure](#folder-structure) |
| [Core tests vs Smoke tests](#core-tests-vs-smoke-tests) |
| [Custom commands](#custom-commands) |
| [Environment variables](#environment-variables) |
| [Running Cypress](#running-cypress) |
| [Authoring guidance](#authoring-guidance) |

---

## Stack

| Package | Role |
|---------|------|
| `cypress` | E2E test framework |
| `@cypress/grep` | Tag-based test filtering (`@regression`, `@smoke`) |
| `cypress-real-events` | Native browser events (hover, drag, etc.) |
| `mochawesome` / `mochawesome-merge` | JSON + HTML test reports |

---

## Configuration

**Config file:** [`app/cypress.config.ts`](../../app/cypress.config.ts)

Key settings:

| Setting | Value | Notes |
|---------|-------|-------|
| `baseUrl` | `process.env.CYPRESS_BASE_URL` | Typically `http://localhost:3000` for local |
| `downloadsFolder` | `cypress/downloads` | Where downloaded files are saved during tests |
| `trashAssetsBeforeRuns` | `true` | Cleans downloads/screenshots before each run |
| `reporter` | `mochawesome` | JSON reports written to `cypress/results/` |
| `video` | Controlled by `CYPRESS_OUTPUT_VIDEO` | Disabled by default; set env var to enable |
| `retries.runMode` | `5` | Automatic retries in headless CI mode |
| `retries.openMode` | `0` | No retries in interactive mode |
| `chromeWebSecurity` | `false` | Allows cross-origin requests (needed for CIS2 redirects) |

---

## Folder structure

```text
app/cypress/
├── e2e/
│   ├── 0-ndr-core-tests/            # Regression tests (run against local/mocked stack)
│   │   ├── auth_routes/              # Auth guard and role-based access tests
│   │   ├── gp_user_workflows/        # GP Admin / GP Clinical user journeys
│   │   ├── pcse_user_workflows/      # PCSE user journeys
│   │   ├── feature_flag_workflows/   # Feature-flag-gated behaviour
│   │   ├── startpage.cy.js
│   │   ├── privacy_page.cy.js
│   │   ├── feedback_page.cy.js
│   │   └── download_lloyd_george_summary.cy.js
│   └── 1-ndr-smoke-tests/           # Smoke tests (run against deployed environments)
│       └── gp_user_workflows/
├── fixtures/                         # Static test data
│   ├── requests/                     # Intercepted API response fixtures
│   ├── lg-files/                     # Sample Lloyd George PDFs
│   ├── non-pdf-files/                # Non-PDF files for rejection tests
│   ├── dynamo-db-items/              # DynamoDB seed data for smoke tests
│   ├── test_patient_record.pdf
│   └── test_patient_record_two.pdf
└── support/
    ├── e2e.ts                        # Global before/beforeEach, custom commands
    ├── commands.d.ts                 # TypeScript declarations for custom commands
    ├── routes.ts                     # Route constants
    ├── roles.ts                      # Role enum + resolution helper
    ├── feature_flags.ts              # Default feature-flag fixture
    ├── patients.ts                   # Test patient data
    ├── aws.commands.ts               # Cypress commands for S3/DynamoDB operations
    └── aws.config.ts                 # AWS SDK client configuration
```

---

## Core tests vs Smoke tests

| | Core (`0-ndr-core-tests/`) | Smoke (`1-ndr-smoke-tests/`) |
|-|---------------------------|------------------------------|
| **Target** | Local dev server with intercepted/mocked API | Deployed sandbox / pre-prod environment |
| **Tag** | `@regression` | `@smoke` |
| **Auth** | Mocked via `cy.login()` (fixture-based) | Environment-backed login flow via `cy.smokeLogin()` |
| **Data** | Fixtures in `cypress/fixtures/requests/` | Seeded into real S3/DynamoDB using AWS commands |
| **CI pipeline** | Runs on every PR | Runs post-deploy against a live environment |
| **Speed** | Fast (no network calls) | Slower (real backend) |

**Rule of thumb:** Write a **core test** for every user-visible workflow. Write
a **smoke test** only for critical happy paths that need to be validated against
a real backend.

---

## Custom commands

Defined in [`app/cypress/support/e2e.ts`](../../app/cypress/support/e2e.ts):

| Command | Purpose |
|---------|---------|
| `cy.getByTestId(id)` | Shorthand for `cy.get('[data-testid=...]')` |
| `cy.login(role, featureFlags?)` | Mock login - intercepts `/Auth/TokenRequest` and `/FeatureFlags`, then visits `/auth-callback` |
| `cy.smokeLogin(role, odsCode?)` | Smoke-test login flow through the start page form |
| `cy.declineCookies()` | Dismisses the NHS cookie banner if visible |
| `cy.navigateToHomePage()` | Clicks the home button |
| `cy.navigateToPatientSearchPage()` | Navigates home → patient search |
| `cy.navigateToDownloadReportPage()` | Navigates home → download report |
| `cy.pdfViewerPageShouldBeText(page, text)` | Asserts text content inside the PDF.js viewer iframe |

AWS-specific commands in [`aws.commands.ts`](../../app/cypress/support/aws.commands.ts):

| Command | Purpose |
|---------|---------|
| `cy.addPdfFileToS3(bucket, key, path)` | Upload a file to S3 |
| `cy.addItemToDynamoDb(table, item)` | Insert an item into DynamoDB |
| `cy.deleteFileFromS3(bucket, key)` | Delete a file from S3 |
| `cy.deleteAllFilesFromS3Prefix(bucket, prefix)` | Delete every object beneath an S3 prefix |
| `cy.deleteItemFromDynamoDb(table, id)` | Delete an item from DynamoDB |
| `cy.deleteItemsBySecondaryKeyFromDynamoDb(table, index, attr, value)` | Delete items by secondary index |

---

## Environment variables

Variables are read from `.env` (via `dotenv`) and mapped into `Cypress.env()`:

| Variable | Purpose |
|----------|---------|
| `CYPRESS_BASE_URL` | Application URL under test |
| `CYPRESS_ODSCODE` | ODS code entered by the smoke-test login flow |
| `CYPRESS_KEY` | Key entered by the smoke-test login flow |
| `CYPRESS_WORKSPACE` | `local` or a sandbox name - determines which patient data to use |
| `CYPRESS_OUTPUT_VIDEO` | Set to any value to enable video recording |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` / `AWS_REGION` | AWS credentials for smoke-test data seeding (can be bypassed by assuming an AWS role) |

---

## Running Cypress

| Command | What it does |
|---------|--------------|
| `npm run cypress` | Opens the interactive Cypress runner |
| `npm run cypress-run` | Headless run of `@regression`-tagged tests in Chrome |
| `npm run cypress-report` | Headless regression run → merge JSON results → generate mochawesome HTML report |

The report pipeline:

1. `cypress-report-run` - runs tests with `--reporter mochawesome`, outputs JSON to `cypress/results/`
2. `cypress-report-merge` - merges all JSON files into `mochawesomemerged.json`
3. `cypress-report-generate` - generates an HTML report from the merged JSON

---

## Authoring guidance

### Selectors

Always use `data-testid` attributes:

```js
cy.getByTestId('upload-btn').click();
```

Avoid relying on CSS classes, text content, or DOM structure that may change
with styling updates.

### Intercepting API calls

Core tests intercept all API calls with fixtures:

```js
cy.intercept('GET', '/DocumentReference*', {
    statusCode: 200,
    fixture: 'requests/document/GET_DocumentReference.json',
}).as('getDocRef');

// ... trigger the request ...
cy.wait('@getDocRef');
```

### Avoiding flake

- Use `cy.wait('@alias')` to wait for specific network requests rather than
  arbitrary timeouts.
- Use `cy.getByTestId()` which waits for the element to appear.
- Avoid assertions on exact timing or animation states.
- The config sets `retries.runMode: 5` to handle occasional CI flakiness.

### Tagging

Use `@cypress/grep` tags in test titles:

```js
it('should upload a document @regression', () => { ... });
it('should upload a document @smoke', () => { ... });
```

The `cypress-run` script filters to `@regression` by default. Smoke pipelines
filter to `@smoke`.

---

*Previous:* [ui-testing.md](ui-testing.md) · *Next:* [how-to-add-a-page.md](how-to-add-a-page.md) · [Back to README](README.md)
