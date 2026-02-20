# 🧪 End-to-End Testing Setup

These tests serve as a suite of end-to-end (E2E) tests to validate FHIR API functionality and snapshot comparisons.

There are 2 suites which separately test

1. FHIR API endpoints using mTLS `lambdas/tests/e2e/api/fhir/` (routed to **PDM** usecase using `Confidential patient data` snomed code: `717391000000106`)
2. API endpoints **not** using mTLS `lambdas/tests/e2e/api/` (routed to **Lloyd George** usecase using `Lloyd George record folder` snomed code: `16521000000101`)

as well as APIM E2E tests `lambdas/tests/e2e/apim/`.

## 🔐 AWS Authentication

You must be authenticated with AWS to run the api tests.

Before authenticating, ensure you have a valid AWS profile configured:

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

Your profile name (e.g. NDR-Dev-RW) must match what you use in the commands below. Make sure your AWS profile has access to the required resources.

### Inside the dev container (preferred method): aws-vault

Use `aws-vault` to assume the profile with a secure, temporary-session subshell.

```bash
List configured profiles::
  'aws-vault list'

Start an authenticated session::
  'aws-vault exec <your-aws-profile>'

If the session expires, start a new one:
  'exit'
  'aws-vault exec <your-aws-profile>'
```

### Alternative outside the dev container: AWS SSO CLI

Authenticate your profile and set it as the active one:

```bash
aws sso login --profile <your-aws-profile>

export AWS_PROFILE=<your-aws-profile>
```

## 🔧 Available Make Commands

All of the below make commands can be run either inside or outside the dev container. It is preferable to work inside the dev container as a developer tool to ensure code formatting and pre-commits are consistent throughout the team, keeping a high standard.

* To run inside the dev container append `CONTAINER=true` to each command

* If you need to work outside the dev container you **must** run `make env` first to set up your venv and any required dependencies

```bash
make test-fhir-api-e2e WORKSPACE=<workspace> CONTIANER=true

make test-api-e2e

make test-apim-e2e
 ```

### Snapshots

Snapshots reduce the amount of individual assertions by comparing pre and post an object e.g. a JSON returned from an API.

Snapshot testing is used in the non mTLS test suite only. To update snapshots you can run the following make command:

```bash
make test-api-e2e-snapshots
```

This runs pytest with the additional argument `--snapshot-update` which will update and replace the existing snapshots.

### Certificate inspection

You can download the mTLS certificates used in the FHIR api requests if you need to inspect them

```bash
make download-api-certs WORKSPACE=<workspace>
```

❗ Always delete these after use and never commit them.

## 🌍 Required Environment Variables

In order to execute the Lloyd George API E2E tests (i.e. `make test-api-e2e`) you will need to ensure the following environment variables are set.

You can export them inside the subshell started by aws-vault exec - these will be scoped to your session and won’t leak to your host environment. Or equivalently, for working outside the dev container, export them in your shell configuration file (`~/.zshrc` or `~/.bashrc`). Or you can **temporarily** add them to the `conftest.py`, but do not commit these:

| Environment Variable | Description                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `NDR_API_KEY`          | The API key required to authenticate requests to the NDR API. API Gateway → API Keys for associated env e.g. ndr-dev_apim-api-key |
| `AWS_WORKSPACE`      | The workspace that is being tested.                                                                                               |
| `MOCK_CIS2_KEY`        | The value of the Mock CIS2 Key. Found in Parameter Store: /auth/password/MOCK_KEY                                                 |

If you update your shell config, remember to reload it:

```bash
source ~/.zshrc   # ~/.bashrc
```

## APIM E2E Tests

The **APIM E2E tests** validate the full integration and behavior of the API Management layer within the system. These tests ensure that:

* FHIR API endpoints (/DocumentReference) are correctly exposed and accessible via APIM.
* mTLS authentication and authorization mechanisms are functioning as expected.
* The routing and transformation logic configured in APIM behaves correctly.
* The downstream services respond appropriately when accessed through APIM.

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

* `api-name`: Specifies the name of the API being tested. In this case, it's the National Document Repository FHIR R4 API.
* `proxy-name`: Indicates the APIM proxy configuration to use during testing. This ensures the tests target the correct APIM instance and environment.

### Important Notes

* Environment Configuration: Make sure your test environment is properly configured with access to APIM and any required secrets or credentials.

  * You can test your proxygen set up via `proxygen instance list` and expect to see `national-document-repository_FHIR_R4` listed.
    For more information on proxygen credentials see: <https://nhsd-confluence.digital.nhs.uk/pages/viewpage.action?spaceKey=APM&title=Proxygen+CLI+user+guide>

* Dependencies: These tests rely on other services being up and running (e.g. backend API, databases). Ensure all dependencies are available before running the tests.
