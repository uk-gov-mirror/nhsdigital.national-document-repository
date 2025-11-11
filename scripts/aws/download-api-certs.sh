#!/bin/bash
set -euo pipefail

# Usage: ./download-api-certs.sh <env>
WORKSPACE="$1"

# All sandbox envs map to ndr-dev for certs
if [[ "$WORKSPACE" != "ndr-test" && "$WORKSPACE" != "pre-prod" && "$WORKSPACE" != "prod" ]]; then
    PERSISTENT_WORKSPACE="ndr-dev"
else    
    PERSISTENT_WORKSPACE="$WORKSPACE"
fi

echo "Downloading mTLS certs using persistent workspace: $PERSISTENT_WORKSPACE"

REGION="eu-west-2"
TRUSTSTOREBUCKETNAME="${PERSISTENT_WORKSPACE}-ndr-truststore"
CA_PATH="ndr-truststore.pem"

LOCAL_CERT_DIR="lambdas/mtls_env_certs/${WORKSPACE}"
mkdir -p "$LOCAL_CERT_DIR"

# Download CA cert from S3
aws s3 cp "s3://${TRUSTSTOREBUCKETNAME}/${CA_PATH}" "${LOCAL_CERT_DIR}/cacert.pem"

# Download main client cert and key from SSM
CERT_PATH="/ndr/${PERSISTENT_WORKSPACE}/external_client_cert"
CERT_KEY="/ndr/${PERSISTENT_WORKSPACE}/external_client_key"

aws ssm get-parameter --name "${CERT_PATH}" --with-decryption | jq -r '.Parameter.Value' > "${LOCAL_CERT_DIR}/client.crt"
aws ssm get-parameter --name "${CERT_KEY}" --with-decryption | jq -r '.Parameter.Value' > "${LOCAL_CERT_DIR}/client.key"

# Download unauthorised client cert and key from SSM
CERT_PATH="/ndr/${PERSISTENT_WORKSPACE}/unauthorised_client_cert"
CERT_KEY="/ndr/${PERSISTENT_WORKSPACE}/unauthorised_client_key"

aws ssm get-parameter --name "${CERT_PATH}" --with-decryption | jq -r '.Parameter.Value' > "${LOCAL_CERT_DIR}/unauthorised_client.crt"
aws ssm get-parameter --name "${CERT_KEY}" --with-decryption | jq -r '.Parameter.Value' > "${LOCAL_CERT_DIR}/unauthorised_client.key"

# Verify main cert against CA
openssl verify -CAfile "${LOCAL_CERT_DIR}/cacert.pem" "${LOCAL_CERT_DIR}/client.crt"
# shellcheck disable=SC2181 # - Ignored Check exit code directly as required nested ifs to work with above logic
if [[ $? -eq 0 ]]; then
    echo "The downloaded main cert matches the Truststore PEM file"
else
    echo "The downloaded main cert doesn't match the Truststore PEM file"
    exit 1
fi

# Verify unauthorised cert against CA
openssl verify -CAfile "${LOCAL_CERT_DIR}/cacert.pem" "${LOCAL_CERT_DIR}/unauthorised_client.crt"
# shellcheck disable=SC2181 # - Ignored Check exit code directly as required nested ifs to work with above logic
if [[ $? -eq 0 ]]; then
    echo "The unauthorised cert matches the Truststore PEM file"
else
    echo "The unauthorised cert doesn't match the Truststore PEM file"
    exit 1
fi