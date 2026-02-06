#!/bin/bash
set -euo pipefail

# Initialize variables to track options
NDR_DIRECTORY="$(pwd)"
PARENT_DIR="$(dirname "$NDR_DIRECTORY")"
NDRI_DIRECTORY="$PARENT_DIR/national-document-repository-infrastructure"
BUILD_INFRA=true
NDRI_BRANCH="main"
NDRI_WORKFLOW_BRANCH="main"
NDRI_WORKFLOW_FILE="deploy-sandbox.yml"
NDR_BRANCH="main"
NDR_WORKFLOW_BRANCH="main"
NDR_WORKFLOW_FILE="lambdas-deploy-feature-to-sandbox.yml"
NDR_WORKFLOW_FILE_FULL="full-deploy-to-sandbox.yml"
FULL_DEPLOY=false
SANDBOX_NAME=""
START_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
SKIP_MAIN=false

spinner=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)
spin_i=0
poll_interval=10
spin_interval=0.15
last_poll=0

# Parse arguments
for arg in "$@"; do
  case $arg in
  --ndri_workflow_branch=*)
    NDRI_WORKFLOW_BRANCH="${arg#*=}"
    ;;
  --ndri_branch=*)
    NDRI_BRANCH="${arg#*=}"
    ;;
  --ndr_workflow_branch=*)
    NDR_WORKFLOW_BRANCH="${arg#*=}"
    ;;
  --ndr_branch=*)
    NDR_BRANCH="${arg#*=}"
    ;;
  --sandbox_name=*)
    SANDBOX_NAME="${arg#*=}"
    ;;
  --build_infra=*)
    BUILD_INFRA="${arg#*=}"
    ;;
  --full_deploy=*)
    FULL_DEPLOY="${arg#*=}"
    ;;
  --ndri_dir_loc_override=*)
    NDRI_DIRECTORY="${arg#*=}"
    ;;
  --skip_main=*)
    SKIP_MAIN="${arg#*=}"
    ;;
  *)
    echo "Unknown argument: $arg"
    echo "Usage: $0 [--ndri_workflow_branch=<branch>] [--ndri_branch=<branch>] [--ndr_branch=<branch>] [--ndr_workflow_branch=<branch>] [--sandbox_name=<sandbox_name>] [--build_infra=<true|false>]  [--ndri_dir_loc_override=<absolute_path>]"
    exit 1
    ;;
  esac
done

if [[ -z "$SANDBOX_NAME" ]]; then
  branch=$(git rev-parse --abbrev-ref HEAD)
  branch=$(echo "$branch" | sed 's/[^a-zA-Z0-9]//g')
  branch="${branch,,}"
  SANDBOX_NAME="$branch"
fi

case "$SANDBOX_NAME" in
main | dev | ndr-dev | ndr-test | pre-prod | prod)
  echo "Error: sandbox_name '$SANDBOX_NAME' is not allowed."
  echo "Refusing to run against protected environments (main, dev, ndr-dev)."
  exit 1
  ;;
esac

if [[ "$BUILD_INFRA" == "true" ]]; then
  echo "🏗️ Running infrastructure build"
  cd "$NDRI_DIRECTORY"
  echo "🔁 Triggering infrastructure workflow '$NDRI_WORKFLOW_FILE' from '$NDRI_WORKFLOW_BRANCH' with branch '$NDRI_BRANCH' to '$SANDBOX_NAME'..."
  # Trigger the workflow and capture the run ID
  gh workflow run "$NDRI_WORKFLOW_FILE" --ref "$NDRI_WORKFLOW_BRANCH" --field git_ref="$NDRI_BRANCH" --field sandbox_name="$SANDBOX_NAME" --field skip_main_deployment="$SKIP_MAIN" >/dev/null

  for i in {1..20}; do
    run_id=$(
      gh run list \
        --workflow "$NDRI_WORKFLOW_FILE" \
        --event workflow_dispatch \
        --json status,databaseId,createdAt,displayTitle \
        --jq ".[]
            | select(.displayTitle | contains(\"$NDRI_BRANCH | $SANDBOX_NAME\"))
            | select(.createdAt >= \"$START_TIME\")
            | select(.status == \"queued\" or .status == \"in_progress\")
            | .databaseId" |
        head -n1
    )

    [[ -n "$run_id" ]] && break
    sleep 2
  done

  if [[ -z "$run_id" ]]; then
    echo "❌ Could not find a workflow run to monitor."
    exit 1
  fi

  echo "✅ Workflow triggered successfully (run ID: $run_id)"
  echo "🔗 Run URL: https://github.com/NHSDigital/national-document-repository-infrastructure/actions/runs/${run_id}"
  echo "⏳ Monitoring workflow progress..."

  printf "\n"

  while true; do
    now=$(date +%s)

    # Poll GitHub only every $poll_interval seconds
    if ((now - last_poll >= poll_interval)); then
      read -r status conclusion < <(
        gh run view "$run_id" --json status,conclusion \
          -q '.status + " " + (.conclusion // "")'
      )
      last_poll=$now
    fi

    case "$status" in
    queued)
      printf "\r🕐 Deploy - Sandbox workflow queued... %s" "${spinner[spin_i++ % ${#spinner[@]}]}"
      ;;
    in_progress)
      printf "\r🏃 Deploy - Sandbox workflow is in progress... %s" "${spinner[spin_i++ % ${#spinner[@]}]}"
      ;;
    completed)
      printf "\r\033[K"
      if [[ "$conclusion" == "success" ]]; then
        echo "✅ Deploy - Sandbox workflow completed successfully."
        printf "\n"
        break
      else
        echo "❌ Deploy - Sandbox workflow failed with conclusion: $conclusion"
        printf "\n"
        exit 1
      fi
      ;;
    esac

    sleep "$spin_interval"
  done
else
  echo "🏃 Skipping infrastructure build"
fi

echo "🏗️ Running Lambda deployment"
cd "$NDR_DIRECTORY"
if [[ "$FULL_DEPLOY" == "true" ]]; then
  echo "🔁 Triggering Full Deploy to Sandbox workflow '$NDR_WORKFLOW_FILE_FULL' from '$NDR_WORKFLOW_BRANCH' with branch '$NDR_BRANCH' to '$SANDBOX_NAME'..."
  # Trigger the workflow and capture the run ID
  gh workflow run "$NDR_WORKFLOW_FILE_FULL" --ref "$NDR_WORKFLOW_BRANCH" --field build_branch="$NDR_BRANCH" --field sandbox="$SANDBOX_NAME" --field environment="development" >/dev/null
  DISPLAY_TITLE="$NDR_BRANCH | $SANDBOX_NAME | development | false | true | true"
  WORKFLOW_FILE="$NDR_WORKFLOW_FILE_FULL"
else
  echo "🔁 Triggering Deploy lambdas to Sandbox workflow '$NDR_WORKFLOW_FILE' from '$NDR_WORKFLOW_BRANCH' with branch '$NDR_BRANCH' to '$SANDBOX_NAME'..."
  # Trigger the workflow and capture the run ID
  gh workflow run "$NDR_WORKFLOW_FILE" --ref "$NDR_WORKFLOW_BRANCH" --field build_branch="$NDR_BRANCH" --field sandbox="$SANDBOX_NAME" --field environment="development" >/dev/null
  DISPLAY_TITLE="$NDR_BRANCH | $SANDBOX_NAME | development | true"
  WORKFLOW_FILE="$NDR_WORKFLOW_FILE"
fi

for i in {1..20}; do
  lambda_run_id=$(
    gh run list \
      --workflow "$WORKFLOW_FILE" \
      --event workflow_dispatch \
      --json status,databaseId,createdAt,displayTitle \
      --jq ".[]
          | select(.displayTitle == \"$DISPLAY_TITLE\")
          | select(.createdAt >= \"$START_TIME\")
          | select(.status == \"queued\" or .status == \"in_progress\")
          | .databaseId" |
      head -n1
  )

  [[ -n "$lambda_run_id" ]] && break
  sleep 2
done

if [[ -z "$lambda_run_id" ]]; then
  echo "❌ Could not find a Deploy to Sandbox workflow run to monitor."
  exit 1
fi

echo "✅ Deploy to Sandbox workflow triggered successfully (run ID: $lambda_run_id)"
echo "🔗 Run URL: https://github.com/NHSDigital/national-document-repository/actions/runs/${run_id}"
echo "⏳ Monitoring Deploy to Sandbox workflow progress..."

spin_i=0
last_poll=0
printf "\n"

while true; do
  now=$(date +%s)

  # Poll GitHub only every $poll_interval seconds
  if ((now - last_poll >= poll_interval)); then
    read -r status conclusion < <(
      gh run view "$lambda_run_id" --json status,conclusion \
        -q '.status + " " + (.conclusion // "")'
    )
    last_poll=$now
  fi

  case "$status" in
  queued)
    printf "\r🕐 Deploy to Sandbox workflow queued... %s" "${spinner[spin_i++ % ${#spinner[@]}]}"
    ;;
  in_progress)
    printf "\r🏃 Deploy to Sandbox workflow in progress... %s" "${spinner[spin_i++ % ${#spinner[@]}]}"
    ;;
  completed)
    printf "\r\033[K"
    if [[ "$conclusion" == "success" ]]; then
      echo "✅ Deploy to Sandbox workflow completed successfully."
      break
    else
      echo "❌ Deploy to Sandbox workflow failed with conclusion: $conclusion"
      exit 1
    fi
    ;;
  esac

  sleep "$spin_interval"
done
