# Bulk Upload Projector

Emulates the bulk upload metadata processor against a local CSV file without making any AWS calls (no S3, SQS, or DynamoDB interactions).

Use it to validate a metadata CSV before a real upload — it tells you which patients would be ingested, which would be sent for review, and which rows would be hard rejected, along with where to place the file in S3.

## Setup

From the `lambdas` directory:

```bash
source venv/bin/activate
```

## Usage

```bash
python -m scripts.bulk_upload_projector <path_to_csv> [options]
```

### Options

| Option | Description |
|---|---|
| `--format-type general\|usb` | Preprocessor format type (default: `general`) |
| `--remap "ORIGINAL=MAPPED" ...` | Remap CSV column names to expected field names |
| `--fixed "KEY=VALUE" ...` | Apply fixed values to fields missing from the CSV |

## Examples

**Standard general format:**
```bash
python -m scripts.bulk_upload_projector metadata.csv
```

**USB format:**
```bash
python -m scripts.bulk_upload_projector metadata.csv --format-type usb
```

**With column remappings and fixed values:**
```bash
python -m scripts.bulk_upload_projector metadata.csv \
  --remap "NHS-NO=nhsnumber" "FILEPATH=file" \
  --fixed "GP-PRACTICE-CODE=M85143" "SCAN-DATE=01/01/2022"
```

## Output

Two files are written into the same directory as the input CSV:

### `projection_rows.csv`

One row per file entry with the following fields:

| Field | Description |
|---|---|
| `nhs_number` | Patient NHS number |
| `gp_practice_code` | GP ODS code |
| `file_path` | Original file path from the CSV |
| `stored_file_name` | Corrected file name that would be stored (empty if rejected) |
| `status` | `to_be_ingested`, `sent_for_review`, or `hard_rejected` |
| `reason` | Rejection reason (empty if ingested) |

### `projection_summary.txt`

A summary including:
- Count of patients to be ingested
- Count of patients sent for review
- Count of hard rejected rows
- Expected S3 location for the metadata file based on the file paths found in the CSV

## Status definitions

| Status | Meaning |
|---|---|
| `to_be_ingested` | File passed all validation and would be queued for ingestion |
| `sent_for_review` | Filename could not be validated or corrected — would go to the review queue |
| `hard_rejected` | Row failed metadata field validation entirely (e.g. missing required fields) |
