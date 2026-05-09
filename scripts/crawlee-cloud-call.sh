#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-incremental}"
JOB_NAME="${JOB_NAME:-encuentra24-${MODE}}"
MAX_PAGES="${MAX_PAGES:-5}"
LOG_LEVEL="${LOG_LEVEL:-info}"
MEMORY_MB="${CRAWLEE_CLOUD_MEMORY_MB:-2048}"
TIMEOUT_SECS="${CRAWLEE_CLOUD_TIMEOUT_SECS:-14400}"
CRAWLEE_CLOUD_BIN="${CRAWLEE_CLOUD_BIN:-crawlee-cloud}"
SYNC_DATASET="${SYNC_DATASET:-false}"

case "$MODE" in
  incremental|full|detail-only) ;;
  *)
    echo "Usage: $0 [incremental|full|detail-only]" >&2
    exit 2
    ;;
esac

if [ -z "${CRAWL_DETAILS+x}" ]; then
  if [ "$MODE" = "full" ]; then
    CRAWL_DETAILS="false"
  else
    CRAWL_DETAILS="true"
  fi
fi

INPUT_FILE="$(mktemp "${TMPDIR:-/tmp}/encuentra24-actor-input.XXXXXX")"
trap 'rm -f "$INPUT_FILE"' EXIT

cat > "$INPUT_FILE" <<JSON
{
  "mode": "$MODE",
  "maxPages": $MAX_PAGES,
  "crawlDetails": $CRAWL_DETAILS,
  "syncDataset": $SYNC_DATASET,
  "logLevel": "$LOG_LEVEL",
  "jobName": "$JOB_NAME",
  "metadata": {
    "trigger": "${TRIGGER:-manual}",
    "host": "${HOSTNAME:-unknown}",
    "createdAt": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  }
}
JSON

"$CRAWLEE_CLOUD_BIN" call encuentra24 \
  --input "$INPUT_FILE" \
  --wait \
  --timeout "$TIMEOUT_SECS" \
  --memory "$MEMORY_MB"
