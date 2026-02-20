#!/usr/bin/env bash
set -e

# Format Python and JavaScript files
# Usage: ./scripts/format.sh [--all] [--container] [--check]

FORMAT_ALL=false
CONTAINER=false
CHECK_MODE=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --all) FORMAT_ALL=true ;;
        --container) CONTAINER=true ;;
        --check) CHECK_MODE=true ;;
    esac
done

# Set Python commands based on environment
if [ "$CONTAINER" = true ]; then
    PYTHON="poetry run python3"
    RUFF="poetry run ruff"
else
    PYTHON="./lambdas/venv/bin/python3"
    RUFF="./lambdas/venv/bin/ruff"
fi

# Get Python files
if [ "$FORMAT_ALL" = true ]; then
    CHANGED_PY="lambdas"
else
    CHANGED_PY=$(git diff origin/main --name-status | grep -E '^[^D].*\.py$' | cut -f2 | xargs)
fi

# Format Python files
if [ -n "$CHANGED_PY" ]; then
    echo "Formatting Python: $CHANGED_PY"
    if [ "$CHECK_MODE" = true ]; then
        $PYTHON -m black --check --diff --color $CHANGED_PY
        $RUFF check $CHANGED_PY
        $PYTHON -m isort --check-only $CHANGED_PY
    else
        $PYTHON -m black $CHANGED_PY
        $RUFF check $CHANGED_PY --fix
        $PYTHON -m isort $CHANGED_PY
    fi
fi

# Get app files
CHANGED_APP_TS=$(git diff origin/main --name-status | grep -E '^[^D].*app/.*\.(ts|tsx|js)$' | cut -f2 | sed 's|^app/||' | xargs)
CHANGED_APP_ALL=$(git diff origin/main --name-status | grep -E '^[^D].*app/.*\.(ts|tsx|js|scss|json|css|md)$' | cut -f2 | sed 's|^app/||' | xargs)

# Format app files
if [ -n "$CHANGED_APP_TS" ] || [ -n "$CHANGED_APP_ALL" ]; then
    echo "Formatting app files..."
    [ -n "$CHANGED_APP_TS" ] && (cd app && npx eslint --fix $CHANGED_APP_TS)
    [ -n "$CHANGED_APP_ALL" ] && (cd app && npx prettier --write $CHANGED_APP_ALL)
fi

echo "✅ Formatting complete"
