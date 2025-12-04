#!/bin/bash
set -euo pipefail

# Set environment variables for ndr-dev
export AWS_WORKSPACE="ndr-dev"

echo "APIM Environment variables set for WORKSPACE ndr-dev"

# Run the tests
cd ./lambdas && ./venv/bin/python3 -m pytest tests/e2e/apim -vv --api-name=national-document-repository_FHIR_R4 --proxy-name=national-document-repository--internal-dev--national-document-repository_FHIR_R4
