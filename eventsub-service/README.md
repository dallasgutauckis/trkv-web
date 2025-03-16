# Twitch EventSub Monitoring Service

This service is a standalone Python application that monitors Twitch EventSub events for channel point redemptions and VIP status changes. It's designed to be highly reliable, with automatic reconnection, error recovery, and notification capabilities.

## Features

- **Real-time Monitoring**: Connects to Twitch's EventSub WebSocket API to receive events in real-time
- **Auto-recovery**: Automatically reconnects if the connection is lost
- **Channel Notifications**: Sends chat messages when the service comes online and when VIP status is granted
- **Firestore Integration**: Reads configuration from the same Firestore database as the main application
- **Google Cloud Logging**: Comprehensive logging for monitoring and debugging

## Architecture

The service is built using Python's asyncio framework for efficient handling of concurrent operations. It uses:

- **websockets**: For WebSocket connections to Twitch EventSub
- **aiohttp**: For making HTTP requests to the Twitch API and the main application
- **google-cloud-firestore**: For reading configuration from Firestore
- **google-cloud-logging**: For structured logging to Google Cloud Logging
- **backoff** and **tenacity**: For implementing retry logic with exponential backoff

## Deployment

The service is deployed to Google Cloud Run, which provides:

- Automatic scaling based on load
- Automatic restarts if the service crashes
- Managed SSL/TLS certificates
- Integration with Google Cloud Monitoring and Logging

### Environment Variables

The service requires the following environment variables:

- `TWITCH_CLIENT_ID`: Your Twitch application client ID
- `TWITCH_CLIENT_SECRET`: Your Twitch application client secret
- `PROJECT_ID`: Your Google Cloud project ID
- `API_BASE_URL`: The base URL of the main application API

## How It Works

1. The service initializes and connects to the Twitch EventSub WebSocket API
2. It loads the list of channels to monitor from Firestore
3. For each channel, it creates subscriptions for channel point redemptions and VIP status changes
4. When a channel point redemption is received, it calls the main application API to grant VIP status
5. It sends a chat message to the channel when VIP status is granted
6. If the connection is lost, it automatically reconnects with exponential backoff

## Reliability Features

- **Token Refresh**: Automatically refreshes the Twitch API token before it expires
- **Heartbeat Monitoring**: Sends periodic heartbeats to detect connection issues
- **Graceful Shutdown**: Properly closes connections and cancels tasks on shutdown
- **Error Handling**: Comprehensive error handling with detailed logging
- **Reconnection Logic**: Exponential backoff for reconnection attempts

## Deployment Instructions

1. Build the Docker image:
   ```
   docker build -t eventsub-service .
   ```

2. Deploy to Google Cloud Run:
   ```
   gcloud builds submit --config=cloudbuild.yaml
   ```

## Monitoring

The service logs all events to Google Cloud Logging. You can view the logs in the Google Cloud Console or use the gcloud command:

```
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=eventsub-service"
``` 