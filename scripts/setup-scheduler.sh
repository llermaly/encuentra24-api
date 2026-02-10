#!/bin/bash
# Set up GCP Cloud Scheduler to automate crawls
# Approach: Cloud Scheduler → HTTP → Cloud Functions → Start VM
# VM runs crawl via crontab and shuts down after completion
set -euo pipefail

PROJECT_ID=$(gcloud config get-value project)
ZONE="us-east1-b"
VM_NAME="encuentra24-crawler"
REGION="us-east1"
SA_NAME="crawler-scheduler"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Project: $PROJECT_ID"
echo "VM: $VM_NAME ($ZONE)"
echo ""

# 1. Enable required APIs
echo "==> Enabling APIs..."
gcloud services enable cloudscheduler.googleapis.com \
  cloudfunctions.googleapis.com \
  compute.googleapis.com \
  cloudbuild.googleapis.com \
  --quiet

# 2. Create service account for scheduler (if not exists)
echo "==> Setting up service account..."
gcloud iam service-accounts describe "$SA_EMAIL" 2>/dev/null || \
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="Crawler Scheduler" \
    --quiet

# Grant compute.instanceAdmin to start/stop VMs
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/compute.instanceAdmin.v1" \
  --quiet > /dev/null

echo "==> Creating Cloud Scheduler jobs..."

# 3. Incremental crawl: 3x daily (6am, 2pm, 10pm Panama time = UTC-5)
# Panama times: 6:00, 14:00, 22:00 → UTC: 11:00, 19:00, 03:00
gcloud scheduler jobs delete crawl-incremental --location="$REGION" --quiet 2>/dev/null || true
gcloud scheduler jobs create http crawl-incremental \
  --location="$REGION" \
  --schedule="0 11,19,3 * * *" \
  --uri="https://compute.googleapis.com/compute/v1/projects/${PROJECT_ID}/zones/${ZONE}/instances/${VM_NAME}/start" \
  --http-method=POST \
  --oauth-service-account-email="$SA_EMAIL" \
  --oauth-token-scope="https://www.googleapis.com/auth/compute" \
  --description="Start VM for incremental crawl (3x daily)" \
  --quiet

# 4. Full crawl: Sunday 3am Panama = Sunday 8am UTC
# The vm-crawl.sh script auto-detects Sunday and runs --full
# We just need the VM running on Sunday mornings
# The 03:00 UTC schedule already covers this (Sunday included)
# But we add a separate one at 8am UTC on Sundays for the explicit full crawl
gcloud scheduler jobs delete crawl-full-weekly --location="$REGION" --quiet 2>/dev/null || true
gcloud scheduler jobs create http crawl-full-weekly \
  --location="$REGION" \
  --schedule="0 8 * * 0" \
  --uri="https://compute.googleapis.com/compute/v1/projects/${PROJECT_ID}/zones/${ZONE}/instances/${VM_NAME}/start" \
  --http-method=POST \
  --oauth-service-account-email="$SA_EMAIL" \
  --oauth-token-scope="https://www.googleapis.com/auth/compute" \
  --description="Start VM for full crawl (weekly Sunday)" \
  --quiet

echo ""
echo "==> Done! Scheduler jobs created."
echo ""
echo "Next steps:"
echo "  1. Set up VM startup script: run setup-vm-cron.sh"
echo "  2. Test: gcloud scheduler jobs run crawl-incremental --location=$REGION"
echo ""
echo "To list jobs: gcloud scheduler jobs list --location=$REGION"
echo "To pause:     gcloud scheduler jobs pause crawl-incremental --location=$REGION"
