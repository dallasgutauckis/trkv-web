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

# Function to check environment variables
check_env_vars() {
    print_header "Checking Environment Variables"
    
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
    
    missing_vars=()
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        echo -e "${RED}Missing required environment variables:${NC}"
        printf '%s\n' "${missing_vars[@]}"
        exit 1
    fi
    
    echo -e "${GREEN}All required environment variables are set${NC}"
}

# Function to build the application
build_app() {
    print_header "Building Application"
    
    echo "Installing dependencies..."
    npm install
    
    echo "Building Next.js application..."
    npm run build
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Build successful${NC}"
    else
        echo -e "${RED}Build failed${NC}"
        exit 1
    fi
}

# Function to deploy to Cloud Run
deploy_to_cloud_run() {
    print_header "Deploying to Cloud Run"
    
    service_name="trkv-web"
    image_name="${REGION}-docker.pkg.dev/${PROJECT_ID}/trkv-web/${service_name}"
    
    echo "Creating Artifact Registry repository..."
    gcloud artifacts repositories create trkv-web \
        --repository-format=docker \
        --location="${REGION}" \
        --project="${PROJECT_ID}" \
        --quiet || true
    
    echo "Building Docker image..."
    # Create a new builder instance if it doesn't exist
    docker buildx create --name multiplatform-builder --use || true
    
    # Build and push directly to the registry
    docker buildx build \
        --platform linux/amd64 \
        --tag "${image_name}" \
        --push \
        .
    
    echo "Deploying to Cloud Run..."
    gcloud run deploy "${service_name}" \
        --image "${image_name}" \
        --platform managed \
        --region "${REGION}" \
        --project "${PROJECT_ID}" \
        --allow-unauthenticated \
        --set-env-vars="NEXT_PUBLIC_TWITCH_CLIENT_ID=${NEXT_PUBLIC_TWITCH_CLIENT_ID}" \
        --set-env-vars="TWITCH_CLIENT_SECRET=${TWITCH_CLIENT_SECRET}" \
        --set-env-vars="DATABASE_URL=${DATABASE_URL}" \
        --set-env-vars="NEXTAUTH_SECRET=${NEXTAUTH_SECRET}" \
        --set-env-vars="NEXTAUTH_URL=${NEXTAUTH_URL}" \
        --set-env-vars="DISCORD_WEBHOOK_URL=${DISCORD_WEBHOOK_URL}" \
        --set-env-vars="NOTIFICATION_EMAIL=${NOTIFICATION_EMAIL}" \
        --max-instances=2 \
        --min-instances=0 \
        --cpu=1 \
        --memory=2Gi \
        --port=3000
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Deployment successful${NC}"
    else
        echo -e "${RED}Deployment failed${NC}"
        exit 1
    fi
}

# Function to verify deployment
verify_deployment() {
    print_header "Verifying Deployment"
    
    service_url=$(gcloud run services describe trkv-web \
        --platform managed \
        --region "${REGION}" \
        --project "${PROJECT_ID}" \
        --format='value(status.url)')
    
    echo "Service URL: ${service_url}"
    
    # Test the deployed service
    echo "Testing deployed service..."
    response=$(curl -s -w "\n%{http_code}" "${service_url}/api/health")
    status_code=$(echo "$response" | tail -n1)
    
    if [ "$status_code" -eq 200 ]; then
        echo -e "${GREEN}Service is healthy${NC}"
    else
        echo -e "${RED}Service health check failed${NC}"
        exit 1
    fi
}

# Function to set up monitoring
setup_monitoring() {
    print_header "Setting up Monitoring"
    
    echo "Deploying monitoring dashboard..."
    ./monitoring/deploy-dashboard.sh
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Monitoring setup successful${NC}"
    else
        echo -e "${RED}Monitoring setup failed${NC}"
        exit 1
    fi
}

# Function to run production tests
run_production_tests() {
    print_header "Running Production Tests"
    
    export SERVICE_URL=$(gcloud run services describe trkv-web \
        --platform managed \
        --region "${REGION}" \
        --project "${PROJECT_ID}" \
        --format='value(status.url)')
    
    ./scripts/test-production.sh
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Production tests passed${NC}"
    else
        echo -e "${RED}Production tests failed${NC}"
        exit 1
    fi
}

# Main execution
main() {
    print_header "Starting Deployment"
    
    # Check required commands
    check_command "gcloud"
    check_command "docker"
    check_command "npm"
    
    # Check environment variables
    check_env_vars
    
    # Build the application
    build_app
    
    # Deploy to Cloud Run
    deploy_to_cloud_run
    
    # Verify deployment
    verify_deployment
    
    # Set up monitoring
    setup_monitoring
    
    # Run production tests
    run_production_tests
    
    print_header "Deployment Summary"
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo "Service URL: $(gcloud run services describe trkv-web \
        --platform managed \
        --region "${REGION}" \
        --project "${PROJECT_ID}" \
        --format='value(status.url)')"
}

# Run main function
main 