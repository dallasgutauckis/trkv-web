#!/bin/bash

# Exit on error
set -e

# Check if required environment variables are set
if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID environment variable is not set"
    exit 1
fi

if [ -z "$DISCORD_WEBHOOK_URL" ]; then
    echo "Error: DISCORD_WEBHOOK_URL environment variable is not set"
    exit 1
fi

if [ -z "$NOTIFICATION_EMAIL" ]; then
    echo "Error: NOTIFICATION_EMAIL environment variable is not set"
    exit 1
fi

echo "Creating notification channels..."

# Create Discord notification channel
DISCORD_CHANNEL_ID=$(gcloud beta monitoring channels create \
    --display-name="TRKV Discord Alerts" \
    --type=webhook_tokenauth \
    --channel-labels="url=${DISCORD_WEBHOOK_URL}" \
    --format="get(name)" \
    --project="${PROJECT_ID}")

echo "Created Discord notification channel: ${DISCORD_CHANNEL_ID}"

# Create Email notification channel
EMAIL_CHANNEL_ID=$(gcloud beta monitoring channels create \
    --display-name="TRKV Email Alerts" \
    --type=email \
    --channel-labels="email_address=${NOTIFICATION_EMAIL}" \
    --format="get(name)" \
    --project="${PROJECT_ID}")

echo "Created Email notification channel: ${EMAIL_CHANNEL_ID}"

# Replace placeholders in dashboard configuration
echo "Configuring dashboard..."
TEMP_DASHBOARD=$(mktemp)
cat monitoring/dashboard.json | \
    sed "s/\${PROJECT_ID}/${PROJECT_ID}/g" | \
    sed "s/\${DISCORD_CHANNEL_ID}/${DISCORD_CHANNEL_ID}/g" | \
    sed "s/\${EMAIL_CHANNEL_ID}/${EMAIL_CHANNEL_ID}/g" > "$TEMP_DASHBOARD"

# Create the dashboard
echo "Deploying dashboard..."
gcloud monitoring dashboards create \
    --project="${PROJECT_ID}" \
    --config-from-file="$TEMP_DASHBOARD"

# Clean up temporary file
rm "$TEMP_DASHBOARD"

echo "Dashboard deployment complete!"
echo "Next steps:"
echo "1. Visit the Google Cloud Console to view your dashboard"
echo "2. Verify that notification channels are working"
echo "3. Test the alerts by temporarily adjusting thresholds" 