# UI Testing (Unit and Component Tests)

All unit and component tests use **Vitest** with **React Testing Library**.
Tests are co-located next to the file they cover.

For end-to-end (Cypress) testing, see [e2e-testing.md](e2e-testing.md).

---

## Contents

| Section |
| --- |
| [Stack](#stack) |
| [Configuration](#configuration) |
| [Test location convention](#test-location-convention) |
| [Test builders](#test-builders) |
| [Accessibility testing](#accessibility-testing) |
| [Mocking patterns](#mocking-patterns) |
| [Running tests](#running-tests) |
| [Other test helpers](#other-test-helpers) |

---

## Stack

| Package | Role |
|---------|------|
| `vitest` | Test runner (Vite-native, Jest-compatible API) |
| `@testing-library/react` | Renders React components and provides DOM queries |
| `@testing-library/user-event` | Simulates user interactions (click, type, etc.) |
| `@testing-library/jest-dom` | Custom matchers (`toBeInTheDocument`, `toHaveTextContent`, …) |
| `jsdom` | Browser-like DOM environment for tests |
| `jest-axe` | Automated accessibility checks (axe-core) |
| `sinon` | Stubs and spies (used alongside Vitest mocks) |
| `@vitest/coverage-v8` | Code coverage via V8 |

---

## Configuration

**Vitest config:** [`app/vitest.config.ts`](../../app/vitest.config.ts)

```ts
test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
        reporter: ['html', 'lcov'],
    },
    setupFiles: ['./src/setupTests.ts'],
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 15000,
},
```

- `globals: true` - `describe`, `it`, `expect`, `vi` are available without
  imports.
- `clearMocks` / `restoreMocks` - every test starts with a clean mock state.

**Setup file:** [`app/src/setupTests.ts`](../../app/src/setupTests.ts) - imports
`@testing-library/jest-dom` for DOM matchers and sets a global `vitest` flag.

---

## Test location convention

Tests live next to the source file they cover:

```text
src/pages/somePage/
├── SomePage.tsx
├── SomePage.test.tsx            ← page rendering test
├── useSomePageHook.ts
└── useSomePageHook.test.tsx     ← hook logic test
```

The same pattern applies to components, hooks, requests, and utils.

---

## Test builders

**Source:** [`app/src/helpers/test/testBuilders.ts`](../../app/src/helpers/test/testBuilders.ts)

Factory functions that create test fixtures with sensible defaults. Accept
optional partial overrides.

| Builder | Returns |
|---------|---------|
| `buildPatientDetails()` | `PatientDetails` |
| `buildUserAuth()` | `UserAuth` (includes a valid-looking JWT) |
| `buildConfig()` | `GlobalConfig` (mock-local flags + feature flags) |
| `buildDocument()` | `UploadDocument` |
| `buildTextFile()` / `buildLgFile()` | `File` |
| `buildSearchResult()` | `SearchResult` |
| `buildLgSearchResult()` | `LloydGeorgeStitchResult` |
| `buildUploadSession()` / `buildMockUploadSession()` | `UploadSession` |
| `buildPatientAccessAudit()` | `PatientAccessAudit[]` |
| `buildDocumentConfig()` | `DOCUMENT_TYPE_CONFIG` |
| `buildMockReviewResponse()` | `ReviewsResponse` |
| `buildDocumentReference()` | `DocumentReference` |
| `buildUserRestrictions()` | `UserPatientRestriction[]` |
| `buildUserInformation()` | `UserInformation` |

Usage:

```ts
const patient = buildPatientDetails({ familyName: 'Smith' });
```

---

## Accessibility testing

**Source:** [`app/src/helpers/test/axeTestHelper.ts`](../../app/src/helpers/test/axeTestHelper.ts)

Provides `runAxeTest` and `runAxeTestForLayout` - pre-configured `jest-axe`
instances. Call `runAxeTest` in every page and component test:

```tsx
import { runAxeTest } from '../../helpers/test/axeTestHelper';

it('is accessible', async () => {
    const { container } = render(<MyComponent />);
    const results = await runAxeTest(container);
    expect(results).toHaveNoViolations();
});
```

> **Note:** Several axe rules are currently suppressed via
> `SUPPRESS_ACCESSIBILITY_TEST = true` in the helper. The team plans to
> progressively re-enable them.

---

## Mocking patterns

> **Hoisted pattern:** All `vi.mock()` calls are hoisted to the top of the test file scope by Vitest, regardless of where they appear in the code. When you need to reference mock functions inside a `vi.mock()` callback, use `vi.hoisted()` to define them outside the callback but still have them hoisted.

### Axios

```ts
vi.mock('axios');
const mockedAxios = axios as vi.Mocked<typeof axios>;
mockedAxios.get.mockResolvedValue({ data: { ... } });
```

### Custom hooks

```ts
vi.mock('../../helpers/hooks/usePatient');
vi.mocked(usePatient).mockReturnValue(buildPatientDetails());
```

### react-router

```ts
vi.mock('react-router-dom', async () => ({
    ...(await vi.importActual('react-router-dom')),
    useNavigate: () => mockNavigate,
}));
```

### Using `vi.hoisted()`

When mock functions need to be referenced inside a `vi.mock()` callback, define them outside using `vi.hoisted()`:

```ts
const mockUseLocation = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => ({
    ...(await vi.importActual('react-router-dom')),
    useLocation: mockUseLocation,
}));

describe('MyComponent', () => {
    it('uses location', () => {
        mockUseLocation.mockReturnValueOnce({ search: '?id=123' });
        // ... test code ...
    });
});
```

### Provider wrapping

Components that consume context providers need to be rendered inside those
providers. Use the providers' override props rather than trying to pass raw
context values directly:

```tsx
render(
    <ConfigProvider configOverride={buildConfig()}>
        <PatientDetailsProvider patientDetails={buildPatientDetails()}>
            <MyComponent />
        </PatientDetailsProvider>
    </ConfigProvider>,
);
```

---

## Running tests

| Command | What it does |
|---------|--------------|
| `npm test` | Starts Vitest in **watch mode** - re-runs on file changes |
| `npm run test-all` | Single run of all tests (no watch) |
| `npm run test-all:coverage` | Single run with V8 coverage for `src/` |

### Coverage output

After `npm run test-all:coverage`:

- **HTML report** → `app/coverage/index.html`
- **LCOV data** → `app/coverage/lcov.info` (consumed by Sonar / CI tools)

---

## Other test helpers

| File | Purpose |
|------|---------|
| [`app/src/helpers/test/formUtils.ts`](../../app/src/helpers/test/formUtils.ts) | Helpers for testing `react-hook-form` controlled components |
| [`app/src/helpers/test/testDataForPdsNameValidation.ts`](../../app/src/helpers/test/testDataForPdsNameValidation.ts) | Edge-case name data for PDS name validation tests |
| [`app/src/helpers/test/getMockReviews.ts`](../../app/src/helpers/test/getMockReviews.ts) | Generates mock review data for upload-review tests |
| [`app/src/helpers/test/getMockVersionHistory.ts`](../../app/src/helpers/test/getMockVersionHistory.ts) | Generates mock version-history data |

---

*Previous:* [build-and-deploy.md](build-and-deploy.md) · *Next:* [e2e-testing.md](e2e-testing.md) · [Back to README](README.md)
