# Routing

All routing is defined in [`app/src/router/AppRouter.tsx`](../../app/src/router/AppRouter.tsx) using
**React Router v6** with a `BrowserRouter`.

---

## Contents

| Section |
| --- |
| [How the router is structured](#how-the-router-is-structured) |
| [Route types](#route-types) |
| [Guards](#guards) |
| [Route enums](#route-enums) |
| [Navigation helpers](#navigation-helpers) |
| [Catch-all route](#catch-all-route) |

---

## How the router is structured

`AppRouter` wraps the application in `<Router>` → `<Layout>` → `<AppRoutes>`.

`AppRoutes` splits routes into three groups based on the `ROUTE_TYPE` enum from
[`app/src/types/generic/routes.ts`](../../app/src/types/generic/routes.ts), then nests them inside
the appropriate guards:

```text
<Routes>
  {publicRoutes}                              ← no guard
  <Route element={<RoleGuard><AuthGuard>}>    ← auth + role check
    {privateRoutes}
    <Route element={<PatientGuard>}>          ← patient context required
      {patientRoutes}
    </Route>
  </Route>
</Routes>
```

Every route is registered in the `routeMap` object keyed by its `routes` enum value. Each entry has:

| Property | Purpose |
| --- | --- |
| `page` | The JSX element to render |
| `type` | `ROUTE_TYPE.PUBLIC`, `PRIVATE`, or `PATIENT` |
| `unauthorized` | _(optional)_ Array of `REPOSITORY_ROLE` values that are **denied** access |

---

## Route types

Defined in the `ROUTE_TYPE` enum:

| Type | Guard stack | Example routes |
| --- | --- | --- |
| `PUBLIC` | None | `/`, `/auth-callback`, `/auth-error`, `/*` (not-found), `/privacy-policy`, `/cookies-policy` |
| `PRIVATE` | `RoleGuard` → `AuthGuard` | `/home`, `/patient/search`, `/feedback`, `/reviews`, `/user-patient-restrictions` |
| `PATIENT` | `RoleGuard` → `AuthGuard` → `PatientGuard` | `/patient/verify`, `/patient/lloyd-george-record`, `/patient/documents`, `/patient/document-upload` |

---

## Guards

Guards are wrapper components in [`app/src/router/guards/`](../../app/src/router/guards/) that
redirect when their conditions aren't met.

### AuthGuard

**File:** [`app/src/router/guards/authGuard/AuthGuard.tsx`](../../app/src/router/guards/authGuard/AuthGuard.tsx)

Checks `session.isLoggedIn` from `SessionProvider`. Redirects to `/unauthorised` when the user is
not logged in.

### RoleGuard

**File:** [`app/src/router/guards/roleGuard/RoleGuard.tsx`](../../app/src/router/guards/roleGuard/RoleGuard.tsx)

Looks up the current route in `routeMap` (resolving child routes to their parent first). If the
route has an `unauthorized` array and the user's role is in it, redirects to `/unauthorised`.

For example, Lloyd George routes set `unauthorized: [REPOSITORY_ROLE.PCSE]`, so PCSE users cannot
access them.

### PatientGuard

**File:** [`app/src/router/guards/patientGuard/PatientGuard.tsx`](../../app/src/router/guards/patientGuard/PatientGuard.tsx)

Checks that a patient is selected via `usePatient()`. If no patient is in context, redirects to
`/patient/search` (or a custom `navigationPath` if provided). Also returns an empty fragment until
the patient is confirmed, preventing child components from rendering without patient data.

### NonAuthGuard

**File:** [`app/src/router/guards/notAuthGuard/NonAuthGuard.tsx`](../../app/src/router/guards/notAuthGuard/NonAuthGuard.tsx)

The inverse of `AuthGuard` - redirects **already-authenticated** users away from a page. Used on
the start page in development mode to redirect logged-in users to `/home`.

### ReviewDataGuard

**File:** [`app/src/router/guards/reviewDataGuard/ReviewDataGuard.tsx`](../../app/src/router/guards/reviewDataGuard/ReviewDataGuard.tsx)

Validates that `reviewData` is present and that the `reviewId` URL param matches the expected
format (UUID or numeric ID with a suffix). Redirects to `/reviews` on failure.

---

## Route enums

### `routes`

Defined in [`app/src/types/generic/routes.ts`](../../app/src/types/generic/routes.ts). Every
top-level path is a member. Routes that support sub-navigation also have a `*_WILDCARD` companion
(e.g. `LLOYD_GEORGE` + `LLOYD_GEORGE_WILDCARD`) so React Router matches nested paths.

### `routeChildren`

Also in `routes.ts`. These are full paths for sub-steps inside a journey. They are **not**
registered in `routeMap` directly - pages handle their own child routing internally. Examples:

```text
/patient/lloyd-george-record/download
/patient/lloyd-george-record/download/select
/patient/lloyd-george-record/delete/confirmation
/patient/document-upload/select-files
/patient/document-upload/in-progress
/reviews/:reviewId/detail
/reviews/:reviewId/assess
```

Child routes use `:param` segments for dynamic values (e.g. `:reviewId`).

### `childRoutes` array

The `childRoutes` array in `AppRouter.tsx` maps each `routeChildren` entry to its parent `routes`
entry. `RoleGuard` uses this mapping to look up role restrictions - when a user navigates to a
child route, the guard checks the **parent's** `unauthorized` list.

---

## Navigation helpers

Two utility functions in `routes.ts` handle parameterised navigation:

| Function | Purpose |
| --- | --- |
| `navigateUrlParam(path, params, navigate, options?)` | Replaces `:param` placeholders in a path, then calls `navigate()` |
| `getToWithUrlParams(path, params)` | Returns a `To` object with params substituted, for use in `<Link to={…}>` |

---

## Catch-all route

`routes.NOT_FOUND` (`/*`) renders `NotFoundPage` as a public route. Any URL that doesn't match a
registered path falls through to this page.

---

*Next:* [error-handling.md](error-handling.md) · [Back to README](README.md)
