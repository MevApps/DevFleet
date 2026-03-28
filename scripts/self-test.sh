#!/usr/bin/env bash
set -euo pipefail

: "${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY to run the self-test}"

GOAL="${1:-Add spec.created and plan.created message emission from ProductPlugin and ArchitectPlugin}"

echo "DevFleet Self-Test"
echo "=================="
echo "Goal: $GOAL"
echo ""

export RUN_SELF_TEST=true
export SELF_TEST_GOAL="$GOAL"

npx jest tests/integration/self-test.test.ts --testTimeout=660000 --verbose
