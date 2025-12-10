#!/bin/bash
# shellcheck disable=SC1003,SC2028
check_aws_authentication() {
    caller_identity=$(aws sts get-caller-identity 2>/dev/null)

    if [[ -z "$caller_identity" ]]; then
        echo "No valid session. Please make sure the devcontainer was run with authorised AWS STS session"
        echo
    fi

    echo "Valid AWS CLI session for AWS account: $(aws sts get-caller-identity | jq -r '.Account')"
    return 0
}

echo '  __    _ _____  _____   '
echo ' |  \  | |  __ \|  _  \  '
echo ' | \ \ | | |  | | | \  | '
echo ' |  \ \| | |  | | |_/ /  '
echo ' | | \   | |__| | | \ \  '
echo ' |_|  \__|_____/|_|  \_\ '
echo '                         '
echo "You can list configured AWS profiles like this:"
echo "  'aws-vault list'"
echo
echo "Export the AWS Environment Variables for a your session like this:"
echo "  'aws-vault exec replace-this-with-my-aws-profile'"
echo
echo "If your session times out, simply exit the subshell and do it again:"
echo "  'exit'"
echo "  'aws-vault exec replace-this-with-my-aws-profile'"
echo
