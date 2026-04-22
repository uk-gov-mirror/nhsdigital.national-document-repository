# How to Add a Page

Step-by-step guide for adding a new page to the UI app, using the
**User Patient Restrictions** page as the canonical reference.

This page follows the **co-located page-hook pattern**: the page component stays
presentational while all state, navigation, and side-effects live in a sibling
`use<PageName>PageHook.ts` file.

---

## Contents

| Section |
| --- |
| [Reference files](#reference-files) |
| [Steps](#steps) |

---

## Reference files

| Concern | Path |
|---------|------|
| Page component | [`app/src/pages/userPatientRestrictionsPage/UserPatientRestrictionsPage.tsx`](../../app/src/pages/userPatientRestrictionsPage/UserPatientRestrictionsPage.tsx) |
| Page hook | [`app/src/pages/userPatientRestrictionsPage/useUserPatientRestrictionsPageHook.ts`](../../app/src/pages/userPatientRestrictionsPage/useUserPatientRestrictionsPageHook.ts) |
| Page hook test | [`app/src/pages/userPatientRestrictionsPage/useUserPatientRestrictionsPageHook.test.tsx`](../../app/src/pages/userPatientRestrictionsPage/useUserPatientRestrictionsPageHook.test.tsx) |
| Page test | [`app/src/pages/userPatientRestrictionsPage/UserPatientRestrictionsPage.test.tsx`](../../app/src/pages/userPatientRestrictionsPage/UserPatientRestrictionsPage.test.tsx) |
| Domain types | [`app/src/types/generic/userPatientRestriction.ts`](../../app/src/types/generic/userPatientRestriction.ts) |
| API requests | [`app/src/helpers/requests/userPatientRestrictions/`](../../app/src/helpers/requests/userPatientRestrictions/) |
| Route entries | [`app/src/types/generic/routes.ts`](../../app/src/types/generic/routes.ts) |
| Endpoint entries | [`app/src/types/generic/endpoints.ts`](../../app/src/types/generic/endpoints.ts) |
| Block components | [`app/src/components/blocks/_userPatientRestrictions/`](../../app/src/components/blocks/_userPatientRestrictions/) |
| Router | [`app/src/router/AppRouter.tsx`](../../app/src/router/AppRouter.tsx) |

---

## Steps

### 1. Define the route

Add entries to the `routes` enum and, if the page has sub-steps, to the
`routeChildren` enum in
[`routes.ts`](../../app/src/types/generic/routes.ts).

```ts
// routes enum
USER_PATIENT_RESTRICTIONS = '/user-patient-restrictions',
USER_PATIENT_RESTRICTIONS_WILDCARD = '/user-patient-restrictions/*',
```

```ts
// routeChildren enum - one entry per sub-step
USER_PATIENT_RESTRICTIONS_LIST = '/user-patient-restrictions/list',
USER_PATIENT_RESTRICTIONS_VIEW = '/user-patient-restrictions/view',
// ... etc.
```

Pick the guard type for the new route in
[`AppRouter.tsx`](../../app/src/router/AppRouter.tsx):

| `ROUTE_TYPE` | Guards applied | Use when |
|--------------|----------------|----------|
| `PUBLIC` | None | Start page, error pages, privacy policy |
| `PRIVATE` | `RoleGuard` → `AuthGuard` | Authenticated pages that do not require a selected patient |
| `PATIENT` | `RoleGuard` → `AuthGuard` → `PatientGuard` | Pages that operate on a specific patient |

Add the route to `routeMap` - both the base path and the wildcard:

```ts
[USER_PATIENT_RESTRICTIONS]: {
    page: <UserPatientRestrictionsPage />,
    type: ROUTE_TYPE.PRIVATE,
},
[USER_PATIENT_RESTRICTIONS_WILDCARD]: {
    page: <UserPatientRestrictionsPage />,
    type: ROUTE_TYPE.PRIVATE,
},
```

If certain roles should be blocked, add an `unauthorized` array
(e.g. `unauthorized: [REPOSITORY_ROLE.PCSE]`).

Register child routes in the `childRoutes` array when they need to inherit the
parent route's role rules or be resolved back to the parent by `RoleGuard`:

```ts
{
    route: routeChildren.USER_PATIENT_RESTRICTIONS_LIST,
    parent: USER_PATIENT_RESTRICTIONS,
},
```

---

### 2. Define types

Create a types file for the page's domain objects.

Shared types go in [`app/src/types/generic/`](../../app/src/types/generic/).
Page-local types go in [`app/src/types/pages/`](../../app/src/types/pages/).

For User Patient Restrictions the types live in
[`userPatientRestriction.ts`](../../app/src/types/generic/userPatientRestriction.ts):

```ts
export type UserPatientRestriction = {
    id: string;
    restrictedUser: string;
    nhsNumber: string;
    patientGivenName: string[];
    patientFamilyName: string;
    restrictedUserFirstName: string;
    restrictedUserLastName: string;
    created: string;
};

export enum UserPatientRestrictionsSubRoute {
    ADD = 'add',
    VIEW = 'view',
    REMOVE = 'remove',
}

export type UserInformation = {
    smartcardId: string;
    firstName: string;
    lastName: string;
};
```

Include request/response shapes and any sub-route or state enums the page
will need.

---

### 3. Add API endpoints

Add entries to the `endpoints` enum in
[`endpoints.ts`](../../app/src/types/generic/endpoints.ts):

```ts
USER_PATIENT_RESTRICTIONS = '/UserRestriction',
USER_PATIENT_RESTRICTIONS_SEARCH_USER = '/UserRestriction/SearchUser',
```

---

### 4. Create request functions

Create a folder under
[`app/src/helpers/requests/`](../../app/src/helpers/requests/) with one file
per API call. Each request follows the same pattern:

1. Accept `baseAPIUrl`, `baseAPIHeaders` (`AuthHeaders`), and any
   domain-specific parameters.
2. Build the URL from `baseAPIUrl + endpoints.XXX`.
3. Call `axios.get` / `axios.post` / `axios.patch`.
4. Re-throw errors as `AxiosError`.

Example - `getUserPatientRestrictions.ts` (abridged):

```ts
import axios, { AxiosError } from 'axios';
import { AuthHeaders } from '../../../types/blocks/authHeaders';
import { endpoints } from '../../../types/generic/endpoints';

const getUserPatientRestrictions = async ({
    nhsNumber, smartcardNumber, baseAPIUrl, baseAPIHeaders, limit = 10, pageToken,
}: GetUserPatientRestrictionsArgs): Promise<GetUserPatientRestrictionsResponse> => {
    try {
        const url = baseAPIUrl + endpoints.USER_PATIENT_RESTRICTIONS;
        const { data } = await axios.get(url, {
            headers: baseAPIHeaders,
            params: { nhsNumber, smartcardId: smartcardNumber, limit, nextPageToken: pageToken },
        });
        return data;
    } catch (e) {
        throw e as AxiosError;
    }
};
```

The reference page has four request files:

| File | HTTP method | Endpoint |
|------|-------------|----------|
| `getUserPatientRestrictions.ts` | GET | `USER_PATIENT_RESTRICTIONS` |
| `createUserPatientRestriction.ts` | POST | `USER_PATIENT_RESTRICTIONS` |
| `deleteUserPatientRestriction.ts` | PATCH | `USER_PATIENT_RESTRICTIONS/{id}` |
| `getUserInformation.ts` | GET | `USER_PATIENT_RESTRICTIONS_SEARCH_USER` |

Write a co-located `*.test.ts` for each request file.

---

### 5. Create the page hook

Create `use<PageName>PageHook.ts` **inside the page folder**, next to the
page component. The hook owns:

- All `useState` calls for the page (sub-route, loaded data, journey state).
- A `JourneyState` enum when the page has multiple stages (e.g.
  `UserPatientRestrictionsJourneyState` with `INITIAL`, `CONFIRMING`,
  `COMPLETE`).
- Navigation via `useNavigate()` and `routeChildren`.
- Calls to request functions and context hooks (`useConfig`, `useBaseAPIUrl`,
  `useBaseAPIHeaders`).
- A typed return object (`Use<PageName>PageReturn`) so the page component
  stays a thin consumer.

Example return type:

```ts
export type UseUserPatientRestrictionsPageReturn = {
    isEnabled: boolean | undefined;
    subRoute: UserPatientRestrictionsSubRoute | null;
    setSubRoute: Dispatch<SetStateAction<UserPatientRestrictionsSubRoute | null>>;
    restrictionToRemove: UserPatientRestriction | null;
    confirmVerifyPatientDetails: () => void;
    onRemoveRestriction: (restriction: UserPatientRestriction) => void;
    existingRestrictions: UserPatientRestriction[];
    setExistingRestrictions: Dispatch<SetStateAction<UserPatientRestriction[]>>;
    userInformation: UserInformation | null;
    setUserInformation: Dispatch<SetStateAction<UserInformation | null>>;
    journeyState: UserPatientRestrictionsJourneyState;
    setJourneyState: Dispatch<SetStateAction<UserPatientRestrictionsJourneyState>>;
};
```

Feature-flag gating also lives here - the reference page reads
`config.featureFlags.userRestrictionEnabled` via `useConfig()`.

---

### 6. Create the page component

Create a folder under
[`app/src/pages/`](../../app/src/pages/) named `<pageNameInCamelCase>Page/`.

The component:

1. Calls the page hook.
2. Renders a `<Routes>` block that maps each `routeChildren` entry to a
   block component.
3. Contains **no** business logic or state management - only layout and
   delegation.

Sub-routes that require patient context are wrapped in a nested
`<PatientGuard>` inside the page's own `<Routes>`:

```tsx
<Route
    element={
        <PatientGuard navigationPath={routes.USER_PATIENT_RESTRICTIONS}>
            <Outlet />
        </PatientGuard>
    }
>
    {/* patient-scoped sub-routes here */}
</Route>
```

A `<Route path="*" element={<NotFoundPage />} />` catches invalid child
paths.

---

### 7. Create block components

Create feature-scoped blocks under
[`app/src/components/blocks/_<domain>/`](../../app/src/components/blocks/).
The reference page has 12 block components in
`_userPatientRestrictions/`, one per stage:

- `userPatientRestrictionsIndex/`
- `userPatientRestrictionsListStage/`
- `userPatientRestrictionsSearchPatientStage/`
- `userPatientRestrictionsVerifyPatientStage/`
- `userPatientRestrictionsViewStage/`
- `userPatientRestrictionsExistingStage/`
- `userPatientRestrictionsSearchStaffStage/`
- `userPatientRestrictionsVerifyStaffStage/`
- `userPatientRestrictionsAddConfirmStage/`
- `userPatientRestrictionsAddCancelStage/`
- `userPatientRestrictionsRemoveConfirmStage/`
- `userPatientRestrictionsCompleteStage/`

Each block is a folder with `ComponentName.tsx` + `ComponentName.test.tsx`.

Use existing generic and layout components where possible. Prefer
`nhsuk-react-components` for new UI elements.

---

### 8. Add styling

Prefer components from `nhsuk-react-components` (React wrappers for the
NHS design system). If the component is not available there:

1. Fall back to `nhsuk-frontend` (vanilla HTML/CSS).
2. Then `govuk-frontend` or `nhsapp-frontend`.
3. Only build a custom component as a last resort.

Custom SCSS goes in
[`app/src/styles/App.scss`](../../app/src/styles/App.scss) - use BEM naming
and NHS spacing mixins.

---

### 9. Write unit tests

Co-locate tests next to the file under test:

| File | Test file |
|------|-----------|
| `UserPatientRestrictionsPage.tsx` | `UserPatientRestrictionsPage.test.tsx` |
| `useUserPatientRestrictionsPageHook.ts` | `useUserPatientRestrictionsPageHook.test.tsx` |
| Each request file | `<name>.test.ts` |
| Each block component | `<ComponentName>.test.tsx` |

**Page test** - keep this thin: mock the page hook, render, and check the page
mounts correctly. For new page tests, call `runAxeTest()` from
[`axeTestHelper.ts`](../../app/src/helpers/test/axeTestHelper.ts) for
accessibility.

**Page hook test** - the heavy one: use `renderHook()` from
`@testing-library/react`, mock `useConfig` and `useNavigate`, and cover:

- Initial state values.
- Feature flag behaviour.
- State transitions triggered by user actions (e.g. `confirmVerifyPatientDetails`,
  `onRemoveRestriction`).
- Correct navigation calls.

**Request tests** - mock `axios` with `vi.mock('axios')`, assert the right
URL, headers, params, and error re-throw.

Add test data builders in
[`testBuilders.ts`](../../app/src/helpers/test/testBuilders.ts) for any new
domain types (e.g. `buildUserRestrictions`, `buildUserInformation`).

Run tests: `npm test` (watch mode) or `npm run test-all` (single run).
From the app directory, you can also use `make test-ui` or `make test-ui-coverage` from the root.

---

### 10. Write E2E tests

Add a Cypress spec under
[`app/cypress/e2e/0-ndr-core-tests/`](../../app/cypress/e2e/0-ndr-core-tests/)
in the appropriate persona sub-folder. Tag with `@regression`.

Use stable selectors (`data-testid`) and intercept API calls with
`cy.intercept()` to avoid flake.

---

### 11. Global state (rare)

Most pages keep all state in the page hook. Only add to an existing
provider if the data is genuinely needed across multiple pages.

---

### 12. Checklist

Before raising a PR, confirm:

- [ ] Route enum entries added (`routes` + wildcard, `routeChildren`).
- [ ] Route registered in `routeMap` with correct `ROUTE_TYPE`.
- [ ] Child routes registered in `childRoutes` array.
- [ ] Endpoint(s) added to `endpoints` enum.
- [ ] Domain types defined in `types/generic/` or `types/pages/`.
- [ ] Request functions created with co-located tests.
- [ ] Page hook created and fully tested.
- [ ] Page component renders - no business logic.
- [ ] Block components created with tests.
- [ ] `runAxeTest()` called in the page test.
- [ ] Test builders added for new types.
- [ ] Cypress regression test added.
- [ ] `npm run test-all` passes.

---

*Previous:* [e2e-testing.md](e2e-testing.md) · [Back to README](README.md)
