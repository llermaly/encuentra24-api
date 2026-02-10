#!/bin/bash
# VM crawl script - called by GCE startup-script on boot
# Auto-detects Sunday for full crawl, otherwise incremental
# Shuts down the VM after completion
set -euo pipefail

WORKDIR="/home/gustavo/encuentra24-api"
LOG_DIR="$WORKDIR/data"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
DAY_OF_WEEK=$(date '+%u') # 1=Monday, 7=Sunday

mkdir -p "$LOG_DIR"
cd "$WORKDIR"

# Determine crawl mode
if [ "$DAY_OF_WEEK" = "7" ]; then
  CRAWL_ARGS="--full"
  LOGFILE="$LOG_DIR/crawl-full-${TIMESTAMP}.log"
  echo "[$(date)] Starting FULL crawl (Sunday)" | tee "$LOGFILE"
else
  CRAWL_ARGS=""
  LOGFILE="$LOG_DIR/crawl-incr-${TIMESTAMP}.log"
  echo "[$(date)] Starting INCREMENTAL crawl" | tee "$LOGFILE"
fi

# Pull latest code
echo "[$(date)] Pulling latest code..." >> "$LOGFILE" 2>&1
su - gustavo -c "cd $WORKDIR && git pull origin main" >> "$LOGFILE" 2>&1 || true

# Install deps if needed
echo "[$(date)] Checking dependencies..." >> "$LOGFILE" 2>&1
su - gustavo -c "cd $WORKDIR && npm install --omit=dev" >> "$LOGFILE" 2>&1

# Run crawl as gustavo user
echo "[$(date)] Running crawl..." >> "$LOGFILE" 2>&1
su - gustavo -c "cd $WORKDIR && npx tsx src/index.ts crawl $CRAWL_ARGS" >> "$LOGFILE" 2>&1
EXIT_CODE=$?

echo "[$(date)] Crawl finished with exit code $EXIT_CODE" >> "$LOGFILE" 2>&1

# Clean up old logs (keep last 30)
ls -t "$LOG_DIR"/crawl-*.log 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null || true

# Shutdown VM after crawl
echo "[$(date)] Shutting down VM..." >> "$LOGFILE" 2>&1
shutdown -h now
