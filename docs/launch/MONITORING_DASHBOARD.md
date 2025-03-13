# Monitoring Dashboard Configuration

## Instance Metrics Panel

### Instance Count
- Metric: `run.googleapis.com/container/instance_count`
- Display: Line chart
- Alert threshold: = 2 (Warning)
- Aggregation: Maximum per minute
- Description: Tracks active instance count against max limit

### Instance Utilization
- Metric: `run.googleapis.com/container/cpu/utilization`
- Display: Stacked area chart
- Alert thresholds:
  - Warning: > 70%
  - Critical: > 85%
- Aggregation: Average per minute per instance
- Description: CPU utilization per instance

## Request Handling Panel

### Concurrent Requests
- Metric: `run.googleapis.com/container/concurrent_requests`
- Display: Line chart
- Alert thresholds:
  - Warning: > 50 per instance
  - Critical: > 70 per instance
- Aggregation: Sum per minute
- Description: Total concurrent requests across instances

### Request Latency
- Metric: `run.googleapis.com/container/request_latencies`
- Display: Heatmap
- Alert thresholds:
  - Warning: p95 > 150ms
  - Critical: p95 > 200ms
- Aggregation: 95th percentile per minute
- Description: Request latency distribution

## Resource Usage Panel

### Memory Usage
- Metric: `run.googleapis.com/container/memory/utilization`
- Display: Line chart
- Alert thresholds:
  - Warning: > 70%
  - Critical: > 85%
- Aggregation: Average per minute per instance
- Description: Memory usage per instance

### Network Traffic
- Metric: `run.googleapis.com/container/network/received_bytes_count`
- Display: Area chart
- Alert threshold: > 80% of quota
- Aggregation: Sum per minute
- Description: Network ingress/egress

## Application Health Panel

### Error Rate
- Metric: `run.googleapis.com/container/request_count`
- Display: Line chart
- Filter: Status code >= 400
- Alert thresholds:
  - Warning: > 1% error rate
  - Critical: > 5% error rate
- Aggregation: Count per minute
- Description: HTTP error count

### WebSocket Connections
- Metric: `custom/websocket/active_connections`
- Display: Line chart
- Alert threshold: > 800 per instance
- Aggregation: Sum per minute
- Description: Active WebSocket connections

## Database Panel

### Firestore Operations
- Metrics:
  - `firestore.googleapis.com/document/read_count`
  - `firestore.googleapis.com/document/write_count`
- Display: Stacked bar chart
- Alert thresholds:
  - Warning: > 40,000 daily operations
  - Critical: > 45,000 daily operations
- Aggregation: Sum per hour
- Description: Database operation volume

### Query Performance
- Metric: `firestore.googleapis.com/query/execution_time`
- Display: Heatmap
- Alert threshold: p95 > 500ms
- Aggregation: 95th percentile per minute
- Description: Query execution time distribution

## Cost Tracking Panel

### Instance Hours
- Metric: `run.googleapis.com/container/billable_instance_time`
- Display: Bar chart
- Alert threshold: > 40 hours/day
- Aggregation: Sum per hour
- Description: Billable instance time

### Resource Cost
- Metrics:
  - Cloud Run costs
  - Firestore costs
  - Network costs
- Display: Stacked area chart
- Alert threshold: > $10/day
- Aggregation: Sum per day
- Description: Daily resource costs

## Dashboard Settings

### Time Range Options
- Last hour
- Last 6 hours
- Last 24 hours
- Last 7 days
- Custom range

### Refresh Rate
- Auto-refresh: 1 minute
- Manual refresh button
- Last updated timestamp

### Export Options
- PNG/PDF export
- CSV data export
- Dashboard sharing

### Alert Integration
- Discord notifications
- Email alerts
- PagerDuty integration
- Alert history view

## Custom Views

### Operations View
- Instance metrics
- Request handling
- Error rates
- Active alerts

### Cost View
- Resource usage
- Instance hours
- Daily costs
- Budget tracking

### Performance View
- Latency metrics
- Database performance
- WebSocket stats
- Resource utilization 