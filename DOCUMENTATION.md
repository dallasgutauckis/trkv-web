# Twitch VIP Manager Bot Documentation

## Overview

The Twitch VIP Manager Bot is a web application that allows Twitch streamers to automate the management of VIP status in their channels. The application enables streamers to create channel point rewards that viewers can redeem to gain temporary VIP status, track active VIPs, and manage VIP expirations.

## Core Features

### 1. Authentication

- **Twitch OAuth Integration**: Users authenticate with their Twitch accounts using OAuth.
- **Scope Management**: The application requests appropriate scopes to manage channel points, VIPs, and other required permissions.
- **Session Management**: User sessions are maintained securely with refresh token handling.
- **Permission Verification**: The settings page checks for missing required scopes and prompts users to re-authenticate if needed.

### 2. VIP Management

- **Temporary VIP Status**: Grant time-limited VIP status to viewers.
- **VIP Tracking**: Monitor all active VIPs, including those granted through the application and manually.
- **VIP Removal**: Automatically remove VIP status when the time period expires.
- **VIP Extension**: Allow extending the duration of existing VIP status.
- **Manual Controls**: Manually grant or revoke VIP status from the dashboard.
- **Automated Cleanup**: Scheduled cron job to automatically remove expired VIPs.

### 3. Channel Points Integration

- **Custom Reward Creation**: Create custom channel point rewards for VIP status.
- **Reward Configuration**: Customize the title, cost, and other properties of the channel point reward.
- **Redemption Handling**: Automatically process channel point redemptions to grant VIP status.
- **EventSub Integration**: Use Twitch's EventSub to receive real-time notifications of reward redemptions.
- **Redemption Monitoring**: Dedicated service to monitor and process channel point redemptions in real-time.
- **Multiple Notification Methods**: Support for both webhook-based EventSub and WebSocket-based EventSub.
- **Standalone EventSub Service**: A separate Python-based service that monitors EventSub events and provides high reliability.

### 4. Dashboard

- **VIP List**: View all current VIPs in the channel with their expiration times.
- **Activity Log**: Track VIP grants, extensions, and removals.
- **Settings Management**: Configure VIP duration, auto-removal settings, and notifications.
- **Real-time Updates**: Receive real-time updates via Server-Sent Events (SSE) when VIP status changes.
- **Account Information**: View and manage Twitch account details and permissions.
- **VIP Activity Log**: Dedicated page to view the history of VIP grants and extensions.

### 5. Audit and Logging

- **Comprehensive Audit Trail**: Log all VIP-related actions including grants, removals, and extensions.
- **User Attribution**: Track which user or system performed each action.
- **Metadata Storage**: Store additional context about each action, such as redemption details.
- **System Actions**: Log automated actions like expired VIP removals.

## Technical Architecture

### Frontend

- **Next.js Framework**: Server-side rendered React application.
- **TailwindCSS**: Styling and UI components.
- **React Hooks**: State management and component logic.
- **Server-Sent Events (SSE)**: Real-time updates for VIP status changes.
- **Custom UI Components**: Reusable UI components for consistent design.

### Backend

- **Next.js API Routes**: RESTful API endpoints for all functionality.
- **Firebase Firestore**: Database for storing user data, VIP sessions, and audit logs.
- **Twitch API Integration**: Communication with Twitch for VIP management and channel points.
- **Twurple Library**: SDK for interacting with Twitch APIs.
- **EventSub WebSocket**: Subscription to Twitch events for real-time notifications using WebSocket connections.
- **EventSub Webhooks**: HTTP-based notifications for Twitch events.
- **Redemption Monitor Service**: Background service that listens for channel point redemptions and processes them.
- **Cron Jobs**: Scheduled tasks for maintenance operations like removing expired VIPs.

### Standalone EventSub Service

- **Python-based Service**: Separate service built with Python's asyncio framework.
- **WebSocket Connection**: Direct connection to Twitch's EventSub WebSocket API.
- **Auto-recovery**: Automatic reconnection with exponential backoff.
- **Channel Notifications**: Sends chat messages when the service comes online and when VIP status is granted.
- **Containerized Deployment**: Runs in a Docker container on Google Cloud Run.
- **High Reliability**: Designed to never crash and automatically recover from errors.

### Data Models

#### User
- Basic user information (Twitch ID, username, etc.)
- User settings and preferences
- Authentication tokens

#### VIP Session
- VIP user details
- Grant information (who granted, when, method)
- Expiration time
- Status (active/inactive)

#### Channel Point Reward
- Reward configuration
- Associated channel
- Status (enabled/disabled)

#### Audit Log
- Detailed records of all VIP-related actions
- User attribution
- Timestamps and metadata

#### Redemption Monitor
- Tracks active channel point reward monitoring
- Stores channel and reward IDs
- Tracks monitoring status

### Deployment

- **Google Cloud Run**: Containerized deployment for scalability.
- **Docker**: Containerization for consistent environments.
- **Cloud Build**: CI/CD pipeline for automated deployments.
- **Artifact Registry**: Storage for Docker images.
- **Cloud Scheduler**: Triggers cron jobs for scheduled tasks.
- **Multi-service Architecture**: Main web application and standalone EventSub service.

## Security Features

- **Token Management**: Secure handling of Twitch access and refresh tokens.
- **Authentication Checks**: Verification of user identity and permissions for all actions.
- **Rate Limiting**: Protection against abuse of API endpoints.
- **Error Handling**: Graceful handling of errors with appropriate user feedback.
- **Scope Verification**: Checking for required OAuth scopes and prompting for re-authentication when needed.
- **Cron Job Authentication**: Secure authentication for scheduled tasks.

## Monitoring and Maintenance

- **Health Checks**: Endpoints to verify application health.
- **Cron Jobs**: Scheduled tasks for removing expired VIPs.
- **Logging**: Comprehensive logging for debugging and auditing.
- **Error Reporting**: Capture and report errors for quick resolution.
- **Service Recovery**: Ability to refresh and restart monitoring services after server restarts.
- **EventSub Status Monitoring**: Track the status of EventSub subscriptions.
- **Cloud Logging Integration**: Structured logging to Google Cloud Logging.

## User Flows

### Streamer Setup
1. Authenticate with Twitch
2. Configure VIP settings (duration, auto-removal)
3. Create a channel point reward
4. Monitor VIPs from the dashboard

### Viewer VIP Redemption
1. Viewer redeems channel points for VIP
2. EventSub service receives notification via WebSocket
3. Service processes the redemption and calls the main application API
4. VIP status is granted for the configured duration
5. Service sends a chat message to the channel
6. Streamer sees the new VIP in their dashboard
7. VIP status is automatically removed when it expires

### Settings Management
1. Streamer accesses the settings page
2. Views current permissions and account information
3. Identifies and resolves any missing permissions
4. Updates preferences for VIP management

### VIP Expiration Process
1. Cloud Scheduler triggers the cron job at regular intervals
2. System identifies VIPs with expired durations
3. VIP status is automatically removed from expired users
4. Actions are logged in the audit trail
5. Dashboard is updated in real-time via SSE

## API Endpoints

### Authentication
- `/api/auth/[...nextauth]`: NextAuth.js endpoints for Twitch OAuth

### VIP Management
- `/api/vip`: CRUD operations for VIP status
- `/api/vip/extend`: Extend existing VIP duration

### Channel Points
- `/api/channel-points`: Manage channel point rewards

### EventSub
- `/api/webhooks/eventsub`: Receive Twitch EventSub notifications

### Monitoring
- `/api/ws`: Server-Sent Events for real-time updates
- `/api/health`: Health check endpoint
- `/api/cron/remove-expired-vips`: Scheduled task to remove expired VIPs

### Settings
- `/api/settings/scopes`: Check and manage required OAuth scopes

### Audit
- `/api/audit-log`: Retrieve audit logs for a channel

## Services

### Redemption Monitor
- Listens for channel point redemptions via EventSub WebSocket
- Processes redemptions to grant VIP status
- Manages active listeners for multiple channels
- Handles reconnection and error recovery

### EventSub Manager
- Creates and manages EventSub subscriptions
- Supports both webhook and WebSocket subscription types
- Handles subscription lifecycle (creation, deletion, renewal)

### Cron Service
- Runs scheduled tasks at regular intervals
- Removes expired VIPs automatically
- Updates database records and notifies clients of changes

### Standalone EventSub Service
- Connects directly to Twitch's EventSub WebSocket API
- Monitors channel point redemptions in real-time
- Sends chat notifications to channels
- Automatically recovers from errors and reconnects
- Runs as a separate service in Google Cloud Run

## Future Enhancements

- Subscription-based VIP grants
- Bits-based VIP grants
- Discord integration for notifications
- Analytics dashboard for VIP usage
- Custom VIP durations based on redemption cost 