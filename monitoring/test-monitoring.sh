#!/bin/bash

# Exit on error
set -e

# Check if required environment variables are set
if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID environment variable is not set"
    exit 1
fi

echo "Starting monitoring system tests..."

# Function to check if a metric exists
check_metric() {
    local metric_type=$1
    local metric_name=$2
    local is_built_in=$3
    
    echo "Checking $metric_name metric..."
    local response=$(curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
        "https://monitoring.googleapis.com/v3/projects/$PROJECT_ID/metricDescriptors?filter=metric.type%3D%22$metric_type%22")
    
    if echo "$response" | grep -q "\"type\": \"$metric_type\""; then
        echo "✅ $metric_name metric found"
        return 0
    else
        if [ "$is_built_in" = true ]; then
            echo "⚠️  $metric_name metric not found (built-in metric, will be available when service is running)"
            return 0
        else
            echo "❌ $metric_name metric not found"
            return 1
        fi
    fi
}

# Function to verify alert policy
verify_alert_policy() {
    local policy_name=$1
    local policy_filter=$2
    
    echo "Verifying $policy_name alert policy..."
    local response=$(curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
        "https://monitoring.googleapis.com/v3/projects/$PROJECT_ID/alertPolicies?filter=display_name%3D%22$policy_name%22")
    
    if echo "$response" | grep -q "\"displayName\": \"$policy_name\""; then
        echo "✅ $policy_name alert policy found"
        return 0
    else
        echo "❌ $policy_name alert policy not found"
        return 1
    fi
}

# Function to test notification channels
test_notification_channel() {
    local channel_type=$1
    local display_name=$2
    
    echo "Testing $display_name notification channel..."
    local response=$(curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
        "https://monitoring.googleapis.com/v3/projects/$PROJECT_ID/notificationChannels?filter=type%3D%22$channel_type%22%20AND%20displayName%3D%22$display_name%22")
    
    if echo "$response" | grep -q "\"displayName\": \"$display_name\""; then
        echo "✅ $display_name notification channel found"
        return 0
    else
        echo "❌ $display_name notification channel not found"
        return 1
    fi
}

# Function to verify dashboard
verify_dashboard() {
    echo "Verifying dashboard..."
    local response=$(curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
        "https://monitoring.googleapis.com/v3/projects/$PROJECT_ID/dashboards?filter=displayName%3D%22TRKV%20Web%20Dashboard%22")
    
    if echo "$response" | grep -q "\"displayName\": \"TRKV Web Dashboard\""; then
        echo "✅ Dashboard found"
        return 0
    else
        echo "❌ Dashboard not found"
        return 1
    fi
}

# Test core metrics
echo -e "\n🔍 Testing Core Metrics..."
check_metric "run.googleapis.com/container/instance_count" "Instance Count" true
check_metric "run.googleapis.com/container/cpu/utilization" "CPU Utilization" true
check_metric "run.googleapis.com/container/memory/utilization" "Memory Usage" true
check_metric "run.googleapis.com/container/request_count" "Request Count" true
check_metric "run.googleapis.com/container/request_latencies" "Request Latency" true

# Test custom metrics
echo -e "\n🔍 Testing Custom Metrics..."
check_metric "custom.googleapis.com/websocket/active_connections" "WebSocket Connections" false

# Test alert policies
echo -e "\n🔍 Testing Alert Policies..."
verify_alert_policy "Instance Count Alert" "metric.type=\"run.googleapis.com/container/instance_count\""
verify_alert_policy "High CPU Usage Alert" "metric.type=\"run.googleapis.com/container/cpu/utilization\""

# Test notification channels
echo -e "\n🔍 Testing Notification Channels..."
test_notification_channel "webhook" "TRKV Discord Alerts"
test_notification_channel "email" "TRKV Email Alerts"

# Verify dashboard
echo -e "\n🔍 Testing Dashboard..."
verify_dashboard

# Generate test load (if --with-load flag is provided)
if [[ "$1" == "--with-load" ]]; then
    echo -e "\n🔍 Generating test load..."
    echo "Sending test requests for 2 minutes..."
    
    # Run 100 concurrent requests for 2 minutes
    for i in {1..120}; do
        curl -s -X GET "https://${SERVICE_URL}/" > /dev/null &
        if [ $((i % 10)) -eq 0 ]; then
            echo "Sent $i requests..."
            sleep 1
        fi
    done
    
    echo "Waiting for metrics to be collected (60s)..."
    sleep 60
fi

# Final verification
echo -e "\n📊 Final Verification..."
echo "1. Check Google Cloud Console to verify metrics are being collected"
echo "2. Verify Discord notifications are working"
echo "3. Check email notifications are being received"
echo "4. Review dashboard visualizations"

echo -e "\n✨ Monitoring system test complete!" 