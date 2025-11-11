#!/bin/bash
set -euo pipefail

# Set environment variables for ndr-dev
export PDM_METADATA_TABLE="ndr-dev_PDMDocumentMetadata"
export PDM_S3_BUCKET="ndr-dev-pdm-document-store"

echo "APIM Environment variables set for WORKSPACE ndr-dev"

# Run the tests
cd ./lambdas && ./venv/bin/python3 -m pytest tests/e2e/apim -vv --api-name=national-document-repository_FHIR_R4 --proxy-name=national-document-repository--internal-dev--national-document-repository_FHIR_R4
