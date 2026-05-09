#!/usr/bin/env bash
set -euo pipefail

API_URL="${CRAWLEE_CLOUD_API_URL:-http://localhost:3000}"
TOKEN="${CRAWLEE_CLOUD_TOKEN:-}"
ACTOR_ID="${CRAWLEE_CLOUD_ACTOR:-encuentra24}"
TIMEZONE="${CRAWLEE_CLOUD_TIMEZONE:-America/Panama}"
INCREMENTAL_MAX_PAGES="${INCREMENTAL_MAX_PAGES:-5}"
INCREMENTAL_CRAWL_DETAILS="${INCREMENTAL_CRAWL_DETAILS:-true}"
FULL_CRAWL_DETAILS="${FULL_CRAWL_DETAILS:-false}"
INCREMENTAL_SYNC_DATASET="${INCREMENTAL_SYNC_DATASET:-false}"
FULL_SYNC_DATASET="${FULL_SYNC_DATASET:-false}"

if [ -z "$TOKEN" ]; then
  echo "CRAWLEE_CLOUD_TOKEN is required" >&2
  exit 2
fi

tmp_files=()
cleanup() {
  if [ "${#tmp_files[@]}" -gt 0 ]; then
    rm -f "${tmp_files[@]}"
  fi
}
trap cleanup EXIT

json_file() {
  local file
  file="$(mktemp "${TMPDIR:-/tmp}/crawlee-schedule.XXXXXX")"
  tmp_files+=("$file")
  printf '%s' "$file"
}

existing_schedule_id() {
  local name="$1"
  local response
  response="$(json_file)"

  curl -fsS "${API_URL}/v2/schedules?limit=1000" \
    -H "Authorization: Bearer ${TOKEN}" \
    -o "$response"

  node -e "
const fs = require('node:fs');
const name = process.argv[1];
const file = process.argv[2];
const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
const item = payload.data.items.find((schedule) => schedule.name === name);
if (item) process.stdout.write(item.id);
" "$name" "$response"
}

upsert_schedule() {
  local name="$1"
  local cron="$2"
  local input_json="$3"
  local payload
  local existing_id

  payload="$(json_file)"
  node -e "
const fs = require('node:fs');
const [file, actorId, name, cronExpression, timezone, inputJson] = process.argv.slice(1);
fs.writeFileSync(file, JSON.stringify({
  actorId,
  name,
  cronExpression,
  timezone,
  isEnabled: true,
  input: JSON.parse(inputJson),
}, null, 2));
" "$payload" "$ACTOR_ID" "$name" "$cron" "$TIMEZONE" "$input_json"

  existing_id="$(existing_schedule_id "$name")"
  if [ -n "$existing_id" ]; then
    curl -fsS -X PUT "${API_URL}/v2/schedules/${existing_id}" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      --data-binary "@${payload}" >/dev/null
    echo "updated schedule ${name} (${existing_id})"
  else
    curl -fsS -X POST "${API_URL}/v2/schedules" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      --data-binary "@${payload}" >/dev/null
    echo "created schedule ${name}"
  fi
}

upsert_schedule \
  "encuentra24-hourly-incremental" \
  "0 * * * *" \
  "{\"mode\":\"incremental\",\"maxPages\":${INCREMENTAL_MAX_PAGES},\"crawlDetails\":${INCREMENTAL_CRAWL_DETAILS},\"syncDataset\":${INCREMENTAL_SYNC_DATASET},\"jobName\":\"encuentra24-hourly-incremental\",\"metadata\":{\"trigger\":\"crawlee-cloud-schedule\",\"cadence\":\"hourly\"}}"

upsert_schedule \
  "encuentra24-weekly-full-coverage" \
  "0 3 * * 0" \
  "{\"mode\":\"full\",\"crawlDetails\":${FULL_CRAWL_DETAILS},\"syncDataset\":${FULL_SYNC_DATASET},\"jobName\":\"encuentra24-weekly-full-coverage\",\"metadata\":{\"trigger\":\"crawlee-cloud-schedule\",\"cadence\":\"weekly\",\"purpose\":\"coverage-and-removed-listing-detection\"}}"
