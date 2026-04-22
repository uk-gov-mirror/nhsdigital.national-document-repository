# Build and Deploy

How the React SPA is built, packaged into a Docker image, and configured for
different environments.

---

## Contents

| Section |
| --- |
| [Build - Vite](#build--vite) |
| [Docker](#docker) |
| [Environment Variables](#environment-variables) |
| [NPM Scripts](#npm-scripts) |
| [Linting and Formatting](#linting-and-formatting) |
| [Deployment notes](#deployment-notes) |

---

## Build - Vite

**Config:** [`app/vite.config.ts`](../../app/vite.config.ts)

The build is driven by [Vite](https://vitejs.dev/) with the following plugins:

| Plugin | Purpose |
|--------|---------|
| `@vitejs/plugin-react-swc` | Fast JSX/TS compilation via SWC |
| `vite-plugin-svgr` | Import `.svg` files as named React components |
| `vite-plugin-commonjs` | Handles CommonJS modules (e.g. PDF.js viewer) |
| `vite-plugin-eslint` | Runs ESLint during dev-server rebuilds |
| `spaFallbackPlugin` (custom) | Rewrites non-file GET requests to `/main.html` for SPA routing |

### Entry point

The HTML entry is **`main.html`** (not `index.html`). Vite's Rollup input is
configured accordingly:

```ts
build: {
    rollupOptions: {
        input: './main.html',
    },
},
```

### Build command

```bash
npm run build        # tsc --noEmit && vite build
```

The `build` script first runs TypeScript type checking (`tsc --noEmit`), then
calls `vite build`. Output goes to `app/dist/`.

Source maps are generated only when `--mode development` is passed.

---

## Docker

**Dockerfile:** [`app/Dockerfile`](../../app/Dockerfile)

Two-stage build:

1. **Builder** (`node:24-alpine`)
   - Installs dependencies (`npm install --legacy-peer-deps`)
   - Copies the PDF.js worker (`pdf.worker.min.mjs`) into `public/`
   - Downloads and unzips the PDF.js viewer into `public/pdfjs/`
   - Runs `npm run build -- --mode $BUILD_ENV`

2. **Server** (`nginx:latest`)
   - Copies `dist/` from the builder
   - Templates `nginx.conf` - replaces `$CONTAINER_PORT` with the build arg
   - Exposes the configured port and runs nginx in the foreground

### Build args

| Arg | Default | Purpose |
|-----|---------|---------|
| `BUILD_ENV` | `development` | Passed to `vite build --mode`. Use `production` for prod builds. |
| `CONTAINER_PORT` | (required) | The port nginx listens on inside the container. |

---

## Environment Variables

All `VITE_*` variables are **baked in at build time** by Vite. The same template
also carries non-Vite values used by Docker and local start scripts
(`CONTAINER_PORT`, `HOST_PORT`, `PORT`).

**Source:** [`app/.env.template`](../../app/.env.template)

| Variable | Build/Run | Purpose |
|----------|-----------|---------|
| `VITE_DOC_STORE_API_ENDPOINT` | Build | Base URL for the backend API Gateway |
| `VITE_AWS_REGION` | Build | AWS region (defaults to `eu-west-2`) |
| `VITE_OIDC_PROVIDER_ID` | Build | CIS2 OIDC provider identifier |
| `VITE_RUM_IDENTITY_POOL_ID` | Build | Cognito Identity Pool for CloudWatch RUM |
| `VITE_MONITOR_ACCOUNT_ID` | Build | CloudWatch RUM Application Monitor ID (empty = RUM disabled) |
| `VITE_ENVIRONMENT` | Build | Environment name (`local`, `development`, `production`) |
| `VITE_IMAGE_VERSION` | Build | Image/build version tag for display/debugging |
| `PORT` | Run | Port used by the repo-level local start flow (`make start`); keep it aligned with `CYPRESS_BASE_URL` |
| `CONTAINER_PORT` | Build | Port inside the Docker container (nginx) |
| `HOST_PORT` | Run | Port exposed on the host when using `docker-compose` |

Copy `.env.template` to `.env` and fill in the placeholder values for local
development.

---

## NPM Scripts

**Source:** [`app/package.json`](../../app/package.json)

| Script | Command | When to use |
|--------|---------|-------------|
| `npm start` | `vite --port 3000` | Local development with hot-reload |
| `npm run build` | `tsc --noEmit && vite build` | Production / CI build |
| `npm run build-env-check` | `node ./react-build-env-checker.js && vite build` | Build with env-var validation |
| `npm run serve` | `vite preview` | Preview the production build locally (port 3000) |
| `npm run lint` | `eslint "src/**/*.+(ts\|tsx\|js)"` | Check lint errors |
| `npm run lint:fix` | Same + `--fix` | Auto-fix lint errors |
| `npm run format` | `prettier --write "**/*.+(ts\|tsx\|js\|scss\|json\|css\|md)"` | Format all files |
| `npm run prettier:check` | `prettier . -c` | CI check - fails if files are unformatted |
| `npm test` | `vitest` | Run unit tests in watch mode |
| `npm run test-all` | `vitest --run` | Single run of all unit tests |
| `npm run test-all:coverage` | `vitest --run --coverage src` | Unit tests with coverage report |
| `npm run cypress` | `cypress open` | Open Cypress interactive runner |
| `npm run cypress-run` | `cypress run --env grepTags=regression --browser chrome` | Headless regression suite |
| `npm run cypress-report` | Full reporting pipeline | Run regression tests, merge + generate mochawesome HTML report |

`npm start` itself always launches Vite on port `3000` because the script is
`vite --port 3000`. The `.env.template` `PORT` value is used by the repo's local
orchestration and smoke-test setup rather than by `npm start` directly.

---

## Linting and Formatting

| Tool | Config / Plugin | Notes |
|------|----------------|-------|
| ESLint | `eslint-config-react-app`, `eslint-plugin-unused-imports`, `eslint-config-prettier` | Extends CRA defaults; removes unused imports automatically with `lint:fix` |
| Prettier | `.prettierrc` | Formats TS, JS, SCSS, JSON, CSS, and Markdown |
| Husky + lint-staged | `app/.husky/`, `.lintstagedrc` | Runs lint + format on staged files before commit |

---

## Deployment notes

- The Docker image is built in CI with `BUILD_ENV` set per target environment.
- `VITE_*` values are injected during the Docker build step - they cannot be
  changed at runtime.
- The nginx config template (`docker/nginx.conf`) handles SPA fallback routing
  (all paths → `main.html`) and sets security headers.

---

*Previous:* [observability.md](observability.md) · *Next:* [ui-testing.md](ui-testing.md) · [Back to README](README.md)
