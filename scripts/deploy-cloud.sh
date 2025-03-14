#!/bin/bash

# Exit on error
set -e

echo "=== Starting Cloud Build Deployment ==="

# Check if required environment variables are set
required_vars=(
  "PROJECT_ID"
  "REGION"
  "NEXT_PUBLIC_TWITCH_CLIENT_ID"
  "TWITCH_CLIENT_SECRET"
  "DATABASE_URL"
  "NEXTAUTH_SECRET"
  "NEXTAUTH_URL"
  "DISCORD_WEBHOOK_URL"
  "NOTIFICATION_EMAIL"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "Error: Required environment variable $var is not set"
    exit 1
  fi
done

echo "=== Submitting Cloud Build Job ==="

# Submit the build job to Cloud Build
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_REGION="$REGION",_NEXT_PUBLIC_TWITCH_CLIENT_ID="$NEXT_PUBLIC_TWITCH_CLIENT_ID",_TWITCH_CLIENT_SECRET="$TWITCH_CLIENT_SECRET",_DATABASE_URL="$DATABASE_URL",_NEXTAUTH_SECRET="$NEXTAUTH_SECRET",_NEXTAUTH_URL="$NEXTAUTH_URL",_DISCORD_WEBHOOK_URL="$DISCORD_WEBHOOK_URL",_NOTIFICATION_EMAIL="$NOTIFICATION_EMAIL" \
  --project="$PROJECT_ID"

echo "=== Cloud Build Job Submitted ==="

# Get the service URL
SERVICE_URL=$(gcloud run services describe trkv-web \
  --platform managed \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --format 'value(status.url)')

echo "=== Deployment Complete ==="
echo "Service URL: $SERVICE_URL"

# Test the deployment
echo "=== Testing Deployment ==="
curl -s "$SERVICE_URL/api/health" || echo "Warning: Health check failed" 