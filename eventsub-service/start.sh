#!/bin/bash
set -e

# Print environment information (without sensitive values)
echo "Environment:"
echo "PORT=${PORT}"
echo "PROJECT_ID=${PROJECT_ID}"
echo "TWITCH_CLIENT_ID is set: $([ -n "$TWITCH_CLIENT_ID" ] && echo 'yes' || echo 'no')"
echo "TWITCH_CLIENT_SECRET is set: $([ -n "$TWITCH_CLIENT_SECRET" ] && echo 'yes' || echo 'no')"

# Add a small delay to ensure everything is ready
echo "Waiting for 2 seconds before starting..."
sleep 2

# Start the application
echo "Starting Hypercorn server on port ${PORT}..."
exec hypercorn --bind "0.0.0.0:${PORT}" --workers 1 asgi:application 