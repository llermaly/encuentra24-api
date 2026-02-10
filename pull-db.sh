#!/usr/bin/env bash
set -euo pipefail

# Pull remote Turso database to local SQLite file
DB_NAME="encuentra24-api"
LOCAL_DB="./data/encuentra24.db"
DUMP_FILE="./data/dump.sql"

echo "Dumping remote database: $DB_NAME"
turso db shell "$DB_NAME" .dump > "$DUMP_FILE"

echo "Importing into local database: $LOCAL_DB"
rm -f "$LOCAL_DB"
cat "$DUMP_FILE" | sqlite3 "$LOCAL_DB"
rm "$DUMP_FILE"

echo "Done! Local database updated at $LOCAL_DB"
