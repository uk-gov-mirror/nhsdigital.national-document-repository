# Lambdas Overview - National Document Repository

---

## Overview

All backend logic lives under `lambdas/`. Each Lambda is a Python 3.11 function that follows
a consistent layered pattern:

```text
Handler → Decorators → Service → Base Service (usually boto3 client) → AWS
                            └──> Repository (mostly bulk-upload specific)
                            └──> Model (Pydantic validation)
                            └──> Enum (typed constants)
```

---

## Directory Structure

```text
lambdas/
├── handlers/          # Lambda entry-points (one file per Lambda)
├── services/          # Business-logic layer
│   └── base/          # Mostly AWS-client wrappers (S3, DynamoDB, SQS, SSM, IAM, CloudWatch, ...)
├── repositories/      # Data-access helpers (currently bulk-upload only)
│   └── bulk_upload/
├── models/            # Pydantic request/response/domain models
│   └── fhir/          # FHIR R4 resource shapes
├── enums/             # Typed string/int enums used across all layers
│   └── fhir/
├── utils/
│   ├── decorators/    # Reusable Lambda decorators
│   ├── constants/     # Shared constant values
│   └── *.py           # Helper utilities (logging, responses, exceptions, ...)
├── scripts/           # One-off operational scripts (migrations, layer updates, ...)
├── tests/
│   ├── unit/          # Unit tests (mocked AWS)
│   └── e2e/           # End-to-end tests against real environments
└── requirements/
    └── layers/        # Per-layer pip requirement files
```

---

## Triggers

Lambdas in this project are invoked by seven distinct trigger types. Each trigger type
shapes the event structure, the decorator stack, and the response format used by the handler.

---

### 1. API Gateway (REST / HTTP)

The most common trigger. API Gateway forwards an HTTP request to the Lambda as a proxy
event and expects a `{"statusCode", "headers", "body"}` response.

Event shape (key fields):

```json
{
  "httpMethod": "GET",
  "path": "/DocumentReference",
  "queryStringParameters": { "patientId": "9000000009" },
  "headers": { "Authorization": "<jwt>" },
  "body": null
}
```

Typical decorator stack:

```python
@validate_patient_id               # validate NHS number in queryStringParameters
@set_request_context_for_logging   # decode JWT, populate request_context
@ensure_environment_variables(...)   # guard required env vars
@override_error_check              # test error injection (non-prod only)
@handle_lambda_exceptions          # map exceptions → HTTP responses
def lambda_handler(event, context):
    ...
    return ApiGatewayResponse(200, body, "GET").create_api_gateway_response()
```

Example handlers: `create_document_reference_handler.py`, `get_document_reference_handler.py`, all FHIR handlers,
`search_patient_details_handler.py`, `token_handler.py`, etc.

---

### 2. API Gateway Custom Authoriser

API Gateway calls the authoriser Lambda before routing a request to the target Lambda.
The event contains the `methodArn` of the resource being accessed plus the caller's headers.
The handler returns an IAM `AuthPolicy` (allow/deny).

Event shape (key fields):

```json
{
  "methodArn": "arn:aws:execute-api:eu-west-2:123456789:abc123/dev/GET/DocumentReference",
  "headers": { "Authorization": "<jwt>" },
  "queryStringParameters": { "patientId": "9000000009" }
}
```

Response: `AuthPolicy` - an IAM policy document (allow or deny), not an `ApiGatewayResponse`.

Example handler: `authoriser_handler.py`

---

### 3. SQS

SQS delivers messages in batches. The Lambda is invoked once per batch; the handler
iterates over `event["Records"]` and processes each message individually.
There is no HTTP response - the handler returns `None` (or raises to trigger a retry).

Event shape (key fields):

```json
{
  "Records": [
    {
      "messageId": "...",
      "body": "{\"nhsNumber\": \"9000000009\", ...}",
      "attributes": { "ApproximateReceiveCount": "1" }
    }
  ]
}
```

Typical decorator stack:

```python
@set_request_context_for_logging
@ensure_environment_variables(...)
def lambda_handler(event, context):
    for record in event.get("Records", []):
        pass
```

Example handlers: `bulk_upload_handler.py`, `mns_notification_handler.py`,
`document_review_processor_handler.py`, `lloyd_george_record_stitch_handler.py`.

---

### 4. DynamoDB Streams

DynamoDB Streams deliver change records (INSERT / MODIFY / REMOVE) from a table.
The handler uses `@validate_dynamo_stream` to assert the event is well-formed,
then inspects `event["Records"][0]["dynamodb"]` for the old/new image.

Event shape (key fields):

```json
{
  "Records": [
    {
      "eventName": "REMOVE",
      "dynamodb": {
        "OldImage": { "ID": { "S": "abc" }, "NhsNumber": { "S": "9000000009" } },
        "NewImage": {}
      }
    }
  ]
}
```

Typical decorator stack:

```python
@handle_lambda_exceptions
@validate_dynamo_stream 
def lambda_handler(event, context):
    record = event["Records"][0]
    old_image = parse_dynamo_record(record["dynamodb"]["OldImage"])
    ...
```

Example handler: `delete_document_object_handler.py`

---

### 5. CloudFront Edge (Lambda@Edge)

Edge Lambdas run at CloudFront Points of Presence for origin-request events.
They modify the request (e.g. re-sign presigned URLs) and return the modified request
object directly - no `ApiGatewayResponse`.

Event shape (key fields):

```json
{
  "Records": [
    {
      "cf": {
        "request": {
          "method": "GET",
          "uri": "/some/key",
          "querystring": "X-Amz-Signature=...",
          "headers": { "host": [{ "value": "bucket.s3.amazonaws.com" }] }
        }
      }
    }
  ]
}
```

Typical decorator stack:

```python
@handle_edge_exceptions 
def lambda_handler(event, context):
    request = event["Records"][0]["cf"]["request"]
    modified = EdgePresignService(env).use_presigned(request)
    return modified
```

> Edge Lambdas run in the `us-east-1` region regardless of the origin.

Example handler: `edge_presign_handler.py`

---

### 6. EventBridge (Scheduled & S3 Events)

Two subtypes share this trigger:

#### 6a. Scheduled rules (cron / rate)

EventBridge fires the Lambda on a schedule. The event payload is a small metadata object.

```json
{
  "source": "aws.events",
  "detail-type": "Scheduled Event",
  "detail": {}
}
```

Typical decorator stack:

```python
@ensure_environment_variables_for_non_webapi(names=[...])
@handle_lambda_exceptions
def lambda_handler(_event, _context):
    service.run()
```

Example handlers: `statistical_report_handler.py`, `report_orchestration_handler.py`,
`report_distribution_handler.py`.

#### 6b. S3 events via EventBridge

S3 can publish object-created events to EventBridge. The handler detects them via
`event.get("source") == "aws.s3"`.

```json
{
  "source": "aws.s3",
  "detail-type": "Object Created",
  "detail": {
    "bucket": { "name": "staging-bucket" },
    "object": { "key": "metadata/upload.csv" }
  }
}
```

Example handler: `bulk_upload_metadata_processor_handler.py` - handles an expedited
path when a metadata file lands in S3.

---

### 7. S3 Direct Notification

S3 can be configured to invoke a Lambda directly when objects are created in a
bucket (without going through EventBridge). The event shape wraps each notification as
an entry in `event["Records"]`, with all object metadata nested under `record["s3"]`.
This is distinct from the EventBridge S3 path (section 6b) - here there is no
`source`/`detail-type` envelope; the `Records[].s3` structure arrives straight from S3.

Event shape (key fields):

```json
{
  "Records": [
    {
      "eventName": "ObjectCreated:Put",
      "s3": {
        "bucket": { "name": "staging-bucket" },
        "object": {
          "key": "review/upload-id/filename.pdf",
          "size": 204800
        }
      }
    }
  ]
}
```

Typical decorator stack:

```python
@set_request_context_for_logging
@ensure_environment_variables(names=[...])
def lambda_handler(event, context):
    for record in event.get("Records"):
        object_key  = record["s3"]["object"]["key"]
        object_size = record["s3"]["object"]["size"]
        service.handle_upload_document_reference_request(object_key, object_size)
```

Example handler: `document_reference_virus_scan_handler.py` - triggered when a file
lands in the staging S3 bucket; runs virus scanning and, depending on the key prefix,
dispatches to either the standard upload service or the document review processing service.

---

### 8. SNS

SNS wraps each notification as a record inside `event["Records"]`, with the actual
message string nested at `record["Sns"]["Message"]`.

Event shape (key fields):

```json
{
  "Records": [
    {
      "Sns": {
        "TopicArn": "arn:aws:sns:eu-west-2:...",
        "Message": "{\"AlarmName\": \"...\", \"NewStateValue\": \"ALARM\"}"
      }
    }
  ]
}
```

Example handler: `im_alerting_handler.py` - receives CloudWatch alarm notifications
via SNS and posts alerts to Teams / Slack.

---

### 9. Direct Invocation (Step Functions / SDK)

Some Lambdas are invoked directly - either by AWS Step Functions or manually. The event is a fully custom JSON payload agreed between caller and handler.

Event shape (example - migration handler):

```json
{
  "tableArn": "arn:aws:dynamodb:eu-west-2:...:table/dev_LloydGeorge",
  "segment": 0,
  "totalSegments": 4,
  "migrationScript": "add_created_date",
  "executionId": "exec-abc123"
}
```

These handlers typically have no API Gateway decorators and return a plain dict
(not an `ApiGatewayResponse`).

Example handlers: `migration_dynamodb_handler.py`, `migration_dynamodb_segment_handler.py`,
`concurrency_controller_handler.py`, `bulk_upload_metadata_processor_handler.py`

---

## How a Lambda Request Flows

Below is the execution order for a typical API Gateway–backed Lambda:

```text
API Gateway
    │
    ▼
lambda_handler(event, context)   ← defined in handlers/<name>_handler.py
    │
    ├─ @set_request_context_for_logging   ← decode JWT, populate request_context
    ├─ @validate_patient_id               ← validate NHS number in querystring
    ├─ @ensure_environment_variables      ← assert required env vars are present
    ├─ @override_error_check              ← short-circuit for test error injection
    └─ @handle_lambda_exceptions          ← catch LambdaException / ClientError
            │
            ▼
        Business logic
            ├─ FeatureFlagService          ← AppConfig feature flags
            ├─ XxxService                  ← domain service
            │       ├─ DynamoDBService     ← base DynamoDB wrapper
            │       ├─ S3Service           ← base S3 wrapper
            │       ├─ SSMService          ← base SSM wrapper
            │       └─ SQSService          ← base SQS wrapper
            └─ ApiGatewayResponse(200, ...).create_api_gateway_response()
```

CloudFront Edge lambdas follow the same pattern but use `handle_edge_exceptions`
and return `EdgeResponse` objects instead of `ApiGatewayResponse`.

## Decorator Layer

All decorators live in `lambdas/utils/decorators/`.  
They are stacked on `lambda_handler` and evaluated from the outermost (top) inward.

| Decorator                                    | File                              | Purpose                                                                                                                                                                 |
|----------------------------------------------|-----------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `@set_request_context_for_logging`           | `set_audit_arg.py`                | Decode JWT from `Authorization` header; populate `request_context` (request ID, NHS correlation ID, user claims).                                                       |
| `@validate_patient_id`                       | `validate_patient_id.py`          | Assert `queryStringParameters.patientId` is a valid NHS number; returns 400 on failure. Also provides `validate_patient_id_fhir` variant for FHIR `subject:identifier`. |
| `@ensure_environment_variables(names=[...])` | `ensure_env_var.py`               | Assert all listed env vars are present; returns 500 if any are missing. Non-API variant raises `MissingEnvVarException` instead.                                        |
| `@override_error_check`                      | `override_error_check.py`         | **Test-only.** If `ERROR_TRIGGER` env var is set in non-prod workspaces, injects a configured error response. Skipped in `pre-prod` / `prod`.                           |
| `@handle_lambda_exceptions`                  | `handle_lambda_exceptions.py`     | Catch-all for `LambdaException`, `ClientError`, and `Exception`; maps them to appropriate HTTP responses. FHIR variant returns OperationOutcome JSON.                   |
| `@validate_document_type`                    | `validate_document_type.py`       | Assert `queryStringParameters.docType` is a valid `SupportedDocumentTypes` value; returns 400 on failure.                                                               |
| `@validate_sqs_event`                        | `validate_sqs_message_event.py`   | Assert the event contains at least one `Records` entry from SQS; returns 400 on failure.                                                                                |
| `@validate_dynamo_stream`                    | `validate_dynamo_stream_event.py` | Assert the event contains valid DynamoDB stream records; returns 400 on failure.                                                                                        |
| `@validate_job_id`                           | `validate_job_id.py`              | Assert `queryStringParameters.jobId` is present; returns 400 on failure.                                                                                                |
| `@validate_s3_request`                       | `validate_s3_request.py`          | For CloudFront origin-request events - validates required AWS presigned-URL query params and headers.                                                                   |
| `@handle_edge_exceptions`                    | `handle_edge_exceptions.py`       | Edge equivalent of `handle_lambda_exceptions`; returns `EdgeResponse` objects.                                                                                          |

`handle_lambda_exceptions` should always be the innermost decorator so it can
catch anything raised by the business logic.

---

## Error Handling and Exceptions

Error handling in this project is deliberately split into two distinct tiers so that
low-level infrastructure concerns are decoupled from HTTP / API Gateway semantics.

---

### Two-Tier Exception System

#### Tier 1 - Lower-level Python exceptions (`utils/exceptions.py`)

Plain Python `Exception` subclasses raised by services, repositories, and utilities
when they encounter unexpected conditions. They carry no HTTP status code or error code;
the calling service is responsible for catching them and promoting them to a
`LambdaException` with an appropriate `LambdaError`.

Representative examples:

| Exception                      | Raised when                                                               |
|--------------------------------|---------------------------------------------------------------------------|
| `DynamoServiceException`       | A DynamoDB operation fails unexpectedly                                   |
| `PdsErrorException`            | The PDS API returns an unexpected error                                   |
| `PdsTooManyRequestsException`  | The PDS API returns HTTP 429                                              |
| `InvalidNhsNumberException`    | NHS number fails checksum validation                                      |
| `DocumentServiceException`     | A generic document service failure                                        |
| `FileUploadInProgress`         | A concurrent upload is already in progress for the patient                |
| `TransactionConflictException` | A DynamoDB transact-write hits a `TransactionCanceledException`           |
| `BulkUploadException`          | A bulk upload pipeline step fails                                         |

#### Tier 2 - Domain exceptions (`utils/lambda_exceptions.py`)

`LambdaException` is the base class for all domain-specific exceptions that cross the
handler boundary. Every child class is directly tied to one or more `LambdaError` enum
values and carries an HTTP `status_code`.

```python
class LambdaException(Exception):
    def __init__(self, status_code: int, error: LambdaError, *, details: Optional[str] = None):
        self.status_code = status_code
        self.error       = error
        self.message     = error.value["message"]
        self.err_code    = error.value["err_code"]
        self.details     = details   # optional extra context (appended to message)
```

Raising a domain exception (typical service pattern):

```python
from utils.lambda_exceptions import SearchPatientException
from enums.lambda_error import LambdaError

raise SearchPatientException(404, LambdaError.SearchPatientNoPDS)

# With extra context appended to the message:
raise SearchPatientException(500, LambdaError.SearchPatientNoId, details=str(e))
```

---

### LambdaError Enum

`enums/lambda_error.py` is the single source of truth for every error code and
message in the project.

Each member is a plain `dict` with at least two keys:

```python
SearchPatientNoPDS = {
    "err_code": "SP_4002",
    "message": "Patient does not exist for given NHS number",
    "fhir_coding": UKCoreSpineError.RESOURCE_NOT_FOUND,  # optional, FHIR only
}
```

#### Error code naming convention

```text
<PREFIX>_<HTTP_CLASS><SEQ>

PREFIX  - two-to-four letter domain abbreviation
            SP  = Search Patient
            DR  = Document Reference
            DDS = Document Deletion Service
            LGS = LG Stitch
            DMS = Document Manifest Service
            LIN = Login
            FFL = Feature Flags
            VSR = Virus Scan Result
            UC  = Upload Confirm
            PS  = PDF Stitching
            CE  = CloudFront Edge
            UR  = User Restriction
            UE  = Unhandled/Internal
            GWY = AWS Gateway (generic boto3 failure)
            ENV = Environment variable missing

HTTP_CLASS - 4 = client-side (4xx), 5 = server-side (5xx)
SEQ        - sequential number within the prefix+class group
```

#### Helper methods on `LambdaError`

| Method                          | Returns         | Use case                                              |
|---------------------------------|-----------------|-------------------------------------------------------|
| `error.create_error_body()`     | `str` (JSON)    | Build `ApiGatewayResponse` body directly              |
| `error.create_error_response()` | `ErrorResponse` | Build and further customise an `ErrorResponse` object |
| `error.to_str()`                | `str`           | Log-friendly `[ERR_CODE] message` string              |

Both `create_error_body` and `create_error_response` accept optional `params` (for
`%`-style message substitution) and `details` (appended to the message):

```python
# Parameterised message: "Invalid patient number 9000000009"
LambdaError.PatientIdInvalid.create_error_body(params={"number": nhs_number})

# Detail appended: "Failed to query DynamoDB: <boto3 error string>"
LambdaError.GatewayError.to_str(details=str(client_error))
```

---

### ErrorResponse Serialisation

`utils/error_response.py` - the `ErrorResponse` class serialises an error into the
JSON body that API Gateway returns to the caller.

#### Standard (non-FHIR) response body

```json
{
  "message": "Patient does not exist for given NHS number",
  "err_code": "SP_4002",
  "interaction_id": "a1b2c3d4-..."
}
```

`interaction_id` is the `request_id` taken from `request_context` (populated by
`@set_request_context_for_logging`) - it lets callers correlate errors with CloudWatch
log entries.

#### FHIR response body (`ErrorResponse.create_error_fhir_response(coding)`)

Returns a serialised FHIR R4 `OperationOutcome` resource instead of the plain dict above.
The `fhir_coding` from the `LambdaError` value drives the `issue[0].details.coding`.

```json
{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "error",
    "code": "not-found",
    "details": {
      "coding": [{
        "system": "https://fhir.nhs.uk/CodeSystem/Spine-ErrorOrWarningCode",
        "code": "RESOURCE_NOT_FOUND",
        "display": "Resource not found"
      }]
    },
    "diagnostics": "Patient does not exist for given NHS number"
  }]
}
```

---

### Adding a New Error Code

1. **Add a member** to `LambdaError` in `enums/lambda_error.py`:

    ```python
    MyFeatureNotFound = {
        "err_code": "MF_4001",          # prefix_class+seq
        "message": "Item not found",
        "fhir_coding": UKCoreSpineError.RESOURCE_NOT_FOUND,  # if FHIR-facing
    }
    ```

2. **Add a subclass** (if a new domain) in `utils/lambda_exceptions.py`:

    ```python
    class MyFeatureException(LambdaException):
        pass
    ```

3. **Raise it** in the service:

    ```python
    raise MyFeatureException(404, LambdaError.MyFeatureNotFound)
    ```

4. **Apply the correct decorator** on the handler (`@handle_lambda_exceptions` or
   `@handle_lambda_exceptions_fhir`).

5. **Add unit tests** asserting the correct `status_code` and `err_code` are returned
   to the caller.

---

## Services Layer

`lambdas/services/` - one or more service files per feature domain.

Services contain all business logic. They are instantiated inside `lambda_handler`
and receive no AWS event directly.

### Key services

| Service                          | Description                                                                           |
|----------------------------------|---------------------------------------------------------------------------------------|
| `CreateDocumentReferenceService` | Validates documents, calls PDS, creates DynamoDB records and presigned S3 URLs.       |
| `DocumentService`                | Base class with helpers for fetching document references from DynamoDB by NHS number. |
| `SearchPatientDetailsService`    | Calls PDS API to look up patient details, updates session.                            |
| `FeatureFlagService`             | Reads feature flags from AWS AppConfig.                                               |
| `BulkUploadService`              | Orchestrates batch Lloyd George upload: validation, PDS lookup, SQS dispatch.         |
| `AuthoriserService`              | Validates JWT tokens for API Gateway custom authoriser.                               |
| `DocumentDeletionService`        | Soft/hard deletes document references from DynamoDB and S3.                           |
| `OidcService` / `TokenService`   | Handles OIDC token exchange with CIS2.                                                |
| `NrlApiService`                  | Manages NRL (National Record Locator) pointers.                                       |
| `reporting/*`                    | Statistical and metadata report generation services.                                  |
| `user_restrictions/*`            | CRUD for user access restrictions.                                                    |

### Service → base service pattern

```python
class CreateDocumentReferenceService:
    def __init__(self):
        self.ssm_service  = SSMService()      
        self.dynamo       = DynamoDBService() 
```

Services usually will not use `boto3` directly - they will go through the base services
in `services/base/`.

### Feature flags

Feature flags are managed with AWS AppConfig and accessed through `FeatureFlagService`:

```python
feature_flag_service = FeatureFlagService()
feature_flag_service.validate_feature_flag(FeatureFlags.UPLOAD_LAMBDA_ENABLED.value)
# or
flags = feature_flag_service.get_feature_flags_by_flag(FeatureFlags.BULK_UPLOAD_SEND_TO_REVIEW_ENABLED)
```

Available flags are defined in `enums/feature_flags.py`.

---

## Base Services (AWS Clients)

`lambdas/services/base/` - thin wrappers around `boto3` clients.
They are singletons (using `__new__`) to avoid creating multiple boto3 sessions
per invocation.

| Class               | AWS service                                                                        |
|---------------------|------------------------------------------------------------------------------------|
| `DynamoDBService`   | DynamoDB (resource + client) - query, put, update, delete, transact-write          |
| `S3Service`         | S3 - get, put, delete, copy, presigned URLs, tagging; supports assumed-role client |
| `SSMService`        | SSM Parameter Store - get / put parameters (with optional decryption)              |
| `SQSService`        | SQS - send standard / FIFO / batch messages                                        |
| `IAMService`        | STS `assume_role` helper                                                           |
| `CloudWatchService` | CloudWatch Logs insights queries and metrics                                       |

---

## Repositories

`lambdas/repositories/bulk_upload/` - data-access objects used by bulk-upload
services to keep that domain's DynamoDB/S3/SQS access isolated.

| File                               | Responsibility                                     |
|------------------------------------|----------------------------------------------------|
| `bulk_upload_dynamo_repository.py` | Read/write staging metadata records                |
| `bulk_upload_s3_repository.py`     | Move files between staging and destination buckets |
| `bulk_upload_sqs_repository.py`    | Dispatch records to stitching / processing queues  |

`repositories/reporting/` holds equivalent helpers for report-related data access.

---

## Models

`lambdas/models/` - Pydantic models for request parsing and domain objects.

| Model file              | Key classes                                                |
|-------------------------|------------------------------------------------------------|
| `document_reference.py` | DocumentReference modules                                  |
| `pds_models.py`         | PDS FHIR patient response shapes                           |
| `auth_policy.py`        | API Gateway `AuthPolicy` for the custom authoriser         |
| `staging_metadata.py`   | Bulk-upload staging record                                 |
| `document_review.py`    | Document review model                                      |
| `feature_flags.py`      | AppConfig response model                                   |
| `fhir/`                 | FHIR R4 DocumentReference, OperationOutcome, Bundle shapes |

Models use `alias_generator=to_camel` / `to_pascal` so Pydantic automatically
maps between the Python `snake_case` attributes and JSON `camelCase`/`PascalCase` keys.

---

## Enums

`lambdas/enums/` - typed constants shared across all layers.

| Enum file                     | Purpose                                                                                                                     |
|-------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| `lambda_error.py`             | `LambdaError` - every error code + message used in `LambdaException`. Includes helpers `.create_error_body()`, `.to_str()`. |
| `feature_flags.py`            | `FeatureFlags` StrEnum - AppConfig flag names                                                                               |
| `document_status.py`          | Upload / availability statuses                                                                                              |
| `virus_scan_result.py`        | Virus scanner results                                                                                                       |
| `logging_app_interaction.py`  | Audit interaction labels attached to every log line                                                                         |
| `metadata_field_names.py`     | Bulk upload metadata file field name                                                                                        |
| `infrastructure.py`           | Environment / workspace names                                                                                               |
| `fhir/`                       | FHIR issue codings, interaction types                                                                                       |

---

## Utils

`lambdas/utils/`

| File / folder               | Purpose                                                                                                                                                       |
|-----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `audit_logging_setup.py`    | `LoggingService` - module-level singleton logger that emits structured JSON                                                                                   |
| `logging_formatter.py`      | `LoggingFormatter` - automatically enriches every log line with values from `request_context`                                                                 |
| `request_context.py`        | `request_context` - thread-local `ContextVar`-backed object; carries `request_id`, `patient_nhs_no`, `authorization`, `app_interaction`, `nhs_correlation_id` |
| `lambda_response.py`        | `ApiGatewayResponse` - builds the `{"statusCode", "headers", "body"}` dict expected by API Gateway                                                            |
| `edge_response.py`          | `EdgeResponse` - CloudFront-compatible equivalent                                                                                                             |
| `lambda_exceptions.py`      | `LambdaException` base class + domain-specific subclasses (`DocumentRefException`, `SearchPatientException`, ...)                                             |
| `error_response.py`         | `ErrorResponse` - serialises an error to JSON (`{"err_code", "message", "interaction_id"}`)                                                                   |
| `exceptions.py`             | Lower-level Python exceptions (`InvalidNhsNumberException`, `DynamoServiceException`, ...)                                                                    |
| `utilities.py`              | General helpers: NHS number checksum validation, ID generation                                                                                                |
| `lloyd_george_validator.py` | LG-specific filename/page validation rules                                                                                                                    |
| `pdf_validator.py`          | PDF integrity checks                                                                                                                                          |
| `s3_utils.py`               | S3 key / URL helpers                                                                                                                                          |
| `dynamo_utils.py`           | DynamoDB expression builders, serialisers                                                                                                                     |
| `sqs_utils.py`              | SQS batch helper                                                                                                                                              |
| `constants/`                | Shared constant strings (SSM parameter paths, etc.)                                                                                                           |

### Structured logging

Every log line is JSON-formatted and automatically includes:

```json
{
  "Message": "...",
  "Correlation Id": "<aws_request_id>",
  "Patient NHS number": "...",
  "App Interaction": "PATIENT_SEARCH",
  "NHSD-Correlation-ID": "...",
  "Authorisation": { "..." : "...decoded JWT claims..." }
}
```

These fields are injected by `LoggingFormatter` from the `request_context`
that `@set_request_context_for_logging` populates at the start of every invocation.

---

## Lambda Layers

Dependencies are split into five Lambda Layers

| Layer                   | Requirement file                         | Key packages                                                                            |
|-------------------------|------------------------------------------|-----------------------------------------------------------------------------------------|
| `core_lambda_layer`     | `requirements_core_lambda_layer.txt`     | `boto3`, `pydantic[email]`, `PyJWT[crypto]`, `requests`, `pypdf`, `pikepdf`, `oauthlib` |
| `files_lambda_layer`    | `requirements_files_lambda_layer.txt`    | `msoffcrypto-tool`                                                                      |
| `data_lambda_layer`     | `requirements_data_lambda_layer.txt`     | `polars`                                                                                |
| `reports_lambda_layer`  | `requirements_reports_lambda_layer.txt`  | `openpyxl`, `reportlab`, `pyzipper`                                                     |
| `alerting_lambda_layer` | `requirements_alerting_lambda_layer.txt` | `Jinja2`, `pydantic`, `boto3`, `PyJWT`                                                  |

The lambda handler code itself (handlers + shared modules) is zipped separately
and does not include any third-party packages.

## Testing

### Unit tests

```bash
make test-unit                  # run all unit tests
make test-unit-coverage         # with XML coverage report (CI)
make test-unit-coverage-html    # with HTML report (local review)
```

Tests live in `lambdas/tests/unit/`, mirroring the source structure:

```text
tests/unit/
├── handlers/
├── services/
├── repositories/
├── models/
├── enums/
└── utils/
```

AWS services are mocked using `pytest-mock`. A shared `conftest.py`
provides common fixtures.

### E2E tests

```bash
make test-lg-fhir-api-e2e                         # LG FHIR API tests
make test-core-fhir-api-e2e WORKSPACE=<workspace> # Core FHIR API (needs mTLS certs)
make test-apim-e2e                                 # APIM gateway tests (ndr-dev)
make test-bulk-upload-e2e                          # Bulk upload result verification
```

E2E tests call real AWS endpoints and require appropriate credentials and
environment variables.

---

## Adding a New Lambda

1. **Create** `lambdas/handlers/<your_lambda_name>_handler.py` with a `lambda_handler(event, context)` function.
2. **Stack decorators** (at minimum `@set_request_context_for_logging`, `@ensure_environment_variables`, `@handle_lambda_exceptions`).
3. **Set** `request_context.app_interaction` to an appropriate `LoggingAppInteraction` value.
4. **Create** a service in `lambdas/services/<your_service_name>_service.py` for the business logic.
5. **Add models** to `lambdas/models/` if new request/response shapes are needed.
6. **Add error codes** to `enums/lambda_error.py` and exception subclass to `utils/lambda_exceptions.py`.
7. **Write unit tests** under `lambdas/tests/unit/handlers/` and `lambdas/tests/unit/services/`.
8. **Create the Lambda** in Terraform (infrastructure repo).
9. **Deploy** via `deploy-sandbox` GitHub workflow.
