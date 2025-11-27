# 🧪 End-to-End Testing Setup

These tests focus on the features of the NDR. This will serve as a blended suite of integration and end-to-end (E2E) tests, with the aim to validate API functionality and snapshot comparisons.

There are 2 suites which separately test

1. FHIR API endpoints using mTLS `lambdas/tests/e2e/api/fhir/` (routed to **PDM** usecase)
2. API endpoints **not** using mTLS `lambdas/tests/e2e/api/` (routed to **Lloyd George** usecase)

as well as APIM E2E tests `lambdas/tests/e2e/apim/`.

## 🔐 AWS Authentication

You must be authenticated with AWS to run the api tests. Use the following commands with a configured profile set up in ~/.aws/config to authenticate:

```bash
aws sso login --profile <your-aws-profile>

export AWS_PROFILE=<your-aws-profile>
```

An example profile:

```bash
[sso-session PRM]
sso_start_url = https://d-9c67018f89.awsapps.com/start#
sso_region = eu-west-2

[profile NDR-Dev-RW]
sso_session=PRM
sso_account_id=<dev-aws-account-id>
sso_role_name=DomainCGpit-Administrators
region=eu-west-2
output=json
```

Make sure your AWS profile has access to the required resources.

## 🔧 Available Make Commands

- `make test-fhir-api-e2e WORKSPACE=<workspace>` — Runs the FHIR API E2E tests with mTLS against a given workspace

- `make test-api-e2e` — Runs the E2E tests without mTLS

- `make test-apim-e2e` - Runs the APIM E2E tests

### Snapshots

Snapshots reduce the amount of individual assertions by comparing pre and post an object e.g. a JSON returned from an API.

Snapshot testing is used in the non mTLS test suite only. To update snapshots you can run the following make command:

- `make test-api-e2e-snapshots` — Runs snapshot comparison tests

This runs pytest with the additional argument `--snapshot-update` which will replace the existing snapshots.

### Certificate inspection

You can download the mTLS certificates used in the requests if you need to inspect them by running

- `make download-api-certs WORKSPACE=<workspace>` — Downloads mTLS client cert and client key used in the request

❗ Always delete these after use and never commit them.

## 🌍 Required Environment Variables

In order to execute the E2E tests without mTLS (i.e. `make test-api-e2e`) you will need to ensure the following environment variables are set. You can export them in your shell configuration file (`~/.zshrc` or `~/.bashrc`) or **temporarily** add them to the `conftest.py`:

| Environment Variable | Description                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `NDR_API_KEY`        | The API key required to authenticate requests to the NDR API. API Gateway → API Keys for associated env e.g. ndr-dev_apim-api-key |
| `NDR_API_ENDPOINT`   | The URI string used to connect to the NDR API.                                                                                    |
| `NDR_S3_BUCKET`      | The name of the Store e.g. ndr-dev-lloyd-george-store.                                                                            |
| `NDR_DYNAMO_STORE`   | The name of the Reference Data Store e.g. ndr-dev_LloydGeorgeReferenceMetadata.                                                   |
| `MOCK_CIS2_KEY`      | The value of the Mock CIS2 Key. Found in Parameter Store: /auth/password/MOCK_KEY                                                 |

After updating your shell config, reload it:

```bash
source ~/.zshrc   # or source ~/.bashrc
```

## APIM E2E Tests

The **APIM E2E tests** validate the full integration and behavior of the API Management layer within the system. These tests ensure that:

- FHIR API endpoints (/DocumentReference) are correctly exposed and accessible via APIM.
- mTLS authentication and authorization mechanisms are functioning as expected.
- The routing and transformation logic configured in APIM behaves correctly.
- The downstream services respond appropriately when accessed through APIM.

### Running the Tests

#### Authentication Requirement

Before running the APIM E2E tests, you must generate a **Proxygen access token**. This token is required to authenticate requests against the APIM proxy.

You can generate a temporary token using the `pytest-nhsd-apim` plugin

```shell
proxygen pytest-nhsd-apim get-token
```

Once generated, export the token to your shell environment so it's available during test execution. For example, in your `.zshrc` or `.bashrc` file:

```shell
export APIGEE_ACCESS_TOKEN=your_token_here
```

#### Executing

To execute the APIM E2E tests, use the following Make command:

```bash
make test-apim-e2e
```

This command validates APIM functionality for the National Document Repository FHIR R4 API using the following configuration:

```shell
cd ./lambdas && ./venv/bin/python3 -m pytest tests/e2e/apim -vv \
  --api-name=national-document-repository_FHIR_R4 \
  --proxy-name=national-document-repository--internal-dev--national-document-repository_FHIR_R4
```

### Arguments

- `api-name`: Specifies the name of the API being tested. In this case, it's the National Document Repository FHIR R4 API.
- `proxy-name`: Indicates the APIM proxy configuration to use during testing. This ensures the tests target the correct APIM instance and environment.

### Important Notes

- Environment Configuration: Make sure your test environment is properly configured with access to APIM and any required secrets or credentials.

  - You can test your proxygen set up via `proxygen instance list` and expect to see `national-document-repository_FHIR_R4` listed.
    For more information on proxygen credentials see: <https://nhsd-confluence.digital.nhs.uk/pages/viewpage.action?spaceKey=APM&title=Proxygen+CLI+user+guide>

- Dependencies: These tests rely on other services being up and running (e.g. backend API, databases). Ensure all dependencies are available before running the tests.
