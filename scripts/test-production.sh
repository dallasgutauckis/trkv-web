#!/bin/bash

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print section headers
print_header() {
    echo -e "\n${YELLOW}=== $1 ===${NC}\n"
}

# Function to check if a command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}Error: $1 is not installed${NC}"
        exit 1
    fi
}

# Function to test an endpoint
test_endpoint() {
    local url=$1
    local name=$2
    local expected_status=${3:-200}
    
    echo "Testing $name..."
    response=$(curl -s -w "\n%{http_code}" "$url")
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ $name passed${NC}"
    else
        echo -e "${RED}✗ $name failed (Status: $status_code)${NC}"
        echo "Response: $body"
    fi
}

# Function to test WebSocket connection
test_websocket() {
    local url=$1
    echo "Testing WebSocket connection..."
    
    # Use wscat if available, otherwise use netcat
    if command -v wscat &> /dev/null; then
        if wscat -c "$url" --timeout 5; then
            echo -e "${GREEN}✓ WebSocket connection successful${NC}"
        else
            echo -e "${RED}✗ WebSocket connection failed${NC}"
        fi
    else
        echo -e "${YELLOW}wscat not installed, skipping WebSocket test${NC}"
    fi
}

# Function to check environment variables
check_env_vars() {
    print_header "Checking Environment Variables"
    
    required_vars=(
        "NEXT_PUBLIC_TWITCH_CLIENT_ID"
        "TWITCH_CLIENT_SECRET"
        "NEXT_PUBLIC_API_URL"
        "DATABASE_URL"
        "NEXTAUTH_SECRET"
        "NEXTAUTH_URL"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo -e "${RED}✗ $var is not set${NC}"
        else
            echo -e "${GREEN}✓ $var is set${NC}"
        fi
    done
}

# Function to test database connection
test_database() {
    print_header "Testing Database Connection"
    
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${RED}Error: DATABASE_URL is not set${NC}"
        return
    fi
    
    # Try to connect to the database
    if node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        prisma.$connect()
            .then(() => {
                console.log('Database connection successful');
                process.exit(0);
            })
            .catch((error) => {
                console.error('Database connection failed:', error);
                process.exit(1);
            });
    "; then
        echo -e "${GREEN}✓ Database connection successful${NC}"
    else
        echo -e "${RED}✗ Database connection failed${NC}"
    fi
}

# Function to test API endpoints
test_api_endpoints() {
    print_header "Testing API Endpoints"
    
    base_url=${NEXT_PUBLIC_API_URL:-"http://localhost:3000"}
    
    # Test public endpoints
    test_endpoint "$base_url" "Home page"
    test_endpoint "$base_url/api/health" "Health check"
    
    # Test protected endpoints (should return 401)
    test_endpoint "$base_url/api/channels" "Protected channels endpoint" 401
    test_endpoint "$base_url/api/vips" "Protected VIPs endpoint" 401
}

# Function to test Twitch API integration
test_twitch_integration() {
    print_header "Testing Twitch API Integration"
    
    if [ -z "$NEXT_PUBLIC_TWITCH_CLIENT_ID" ] || [ -z "$TWITCH_CLIENT_SECRET" ]; then
        echo -e "${RED}Error: Twitch credentials not set${NC}"
        return
    fi
    
    # Test Twitch API access
    response=$(curl -s -H "Client-ID: $NEXT_PUBLIC_TWITCH_CLIENT_ID" \
        "https://api.twitch.tv/helix/users?login=twitchdev")
    
    if echo "$response" | grep -q "error"; then
        echo -e "${RED}✗ Twitch API access failed${NC}"
        echo "Response: $response"
    else
        echo -e "${GREEN}✓ Twitch API access successful${NC}"
    fi
}

# Function to check monitoring setup
check_monitoring() {
    print_header "Checking Monitoring Setup"
    
    # Check if monitoring endpoints are accessible
    base_url=${NEXT_PUBLIC_API_URL:-"http://localhost:3000"}
    test_endpoint "$base_url/api/metrics" "Metrics endpoint"
    
    # Check if monitoring dashboard is accessible
    if [ -n "$MONITORING_DASHBOARD_URL" ]; then
        test_endpoint "$MONITORING_DASHBOARD_URL" "Monitoring dashboard"
    else
        echo -e "${YELLOW}Monitoring dashboard URL not set${NC}"
    fi
}

# Main execution
main() {
    print_header "Starting Production Environment Tests"
    
    # Check required commands
    check_command "curl"
    check_command "node"
    
    # Run tests
    check_env_vars
    test_database
    test_api_endpoints
    test_twitch_integration
    check_monitoring
    
    print_header "Test Summary"
    echo -e "${GREEN}Production environment tests completed${NC}"
}

# Run main function
main 