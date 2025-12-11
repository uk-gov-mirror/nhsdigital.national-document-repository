#!/bin/bash
set -euo pipefail

# Set environment variables for ndr-dev
export AWS_WORKSPACE="ndr-dev"

CONTAINER="venv"

# Parse optional arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
  --container)
    CONTAINER="$2"
    shift
    ;;
  *)
    echo "Unknown parameter passed: $1"
    exit 1
    ;;
  esac
  shift
done

echo "APIM Environment variables set for WORKSPACE ndr-dev"

# Run the tests
if [ "$CONTAINER" = "true" ]; then
  cd ./lambdas && PYTHONPATH=. poetry run pytest tests/e2e/apim #-vv --api-name=national-document-repository_FHIR_R4 --proxy-name=national-document-repository--internal-dev--national-document-repository_FHIR_R4
else
  cd ./lambdas && ./venv/bin/python3 -m pytest tests/e2e/apim -vv --api-name=national-document-repository_FHIR_R4 --proxy-name=national-document-repository--internal-dev--national-document-repository_FHIR_R4
fi
