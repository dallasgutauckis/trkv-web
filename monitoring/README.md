# Monitoring Dashboard Deployment

This directory contains the configuration and deployment scripts for the TRKV Web monitoring dashboard.

## Prerequisites

1. Google Cloud SDK installed and configured
2. `gcloud` beta components installed
3. Appropriate permissions in your Google Cloud project
4. Discord webhook URL for notifications
5. Email address for alerts

## Configuration

The following environment variables are required:

```bash
export PROJECT_ID="your-project-id"
export DISCORD_WEBHOOK_URL="your-discord-webhook-url"
export NOTIFICATION_EMAIL="your-email@example.com"
```

For testing with load generation:
```bash
export SERVICE_URL="your-cloud-run-service-url"
```

## Deployment

1. Make the deployment script executable:
```bash
chmod +x deploy-dashboard.sh
```

2. Run the deployment script:
```bash
./deploy-dashboard.sh
```

## Testing

The `test-monitoring.sh` script verifies the monitoring setup:

1. Make the test script executable:
```bash
chmod +x test-monitoring.sh
```

2. Run basic verification:
```bash
./test-monitoring.sh
```

3. Run with load generation:
```bash
./test-monitoring.sh --with-load
```

The script tests:
- Core metrics existence
- Custom metrics setup
- Alert policy configuration
- Notification channels
- Dashboard deployment
- Optional load generation

### Test Results

The script provides clear status indicators:
- ✅ Passed tests
- ❌ Failed tests

Follow the final verification steps to ensure complete functionality.

## Dashboard Components

The dashboard includes:

- Instance count monitoring (max 2 instances)
- CPU utilization tracking
- Concurrent requests monitoring
- Request latency visualization
- Memory usage tracking
- Error rate monitoring
- WebSocket connection tracking
- Firestore operations monitoring

## Alert Policies

Two main alert policies are configured:

1. **Instance Count Alert**
   - Triggers when instance count exceeds 2
   - Notifies via Discord and email
   - Immediate notification (60s duration)

2. **High CPU Usage Alert**
   - Triggers when CPU utilization exceeds 85%
   - Notifies via Discord and email
   - 5-minute sustained threshold

## Customization

To modify the dashboard configuration:

1. Edit `dashboard.json` to adjust:
   - Metrics and thresholds
   - Chart types and layouts
   - Alert conditions
   - Refresh settings

2. Re-run the deployment script to apply changes

## Troubleshooting

If you encounter issues:

1. Verify environment variables are set correctly
2. Ensure you have required permissions
3. Check Google Cloud Console logs
4. Verify Discord webhook URL is valid
5. Confirm email notifications are not blocked

### Common Test Issues

1. **Metrics Not Found**
   - Ensure the service is deployed and running
   - Check metric names match exactly
   - Verify permissions for metric access

2. **Alert Policies Not Found**
   - Check policy names match configuration
   - Verify alert policy creation permissions
   - Review policy filters

3. **Notification Channels**
   - Validate Discord webhook URL
   - Check email address format
   - Verify channel creation permissions

## Maintenance

Regular tasks:

1. Review alert thresholds
2. Verify notification channels
3. Update Discord webhook if needed
4. Adjust scaling thresholds based on usage
5. Monitor dashboard performance
6. Run periodic verification tests 