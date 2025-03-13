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

# Function to prompt for input with validation
prompt_input() {
    local prompt=$1
    local var_name=$2
    local default=$3
    local required=${4:-true}
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " input
        input=${input:-$default}
    else
        read -p "$prompt: " input
    fi
    
    if [ "$required" = true ] && [ -z "$input" ]; then
        echo -e "${RED}Error: This field is required${NC}"
        return 1
    fi
    
    export "$var_name=$input"
    return 0
}

# Function to generate a random string
generate_random_string() {
    local length=$1
    openssl rand -base64 $length | tr -dc 'a-zA-Z0-9' | head -c $length
}

# Main execution
main() {
    print_header "Setting up Environment Variables"
    
    # Project settings
    prompt_input "Enter Google Cloud Project ID" "PROJECT_ID"
    prompt_input "Enter deployment region (e.g., us-east1)" "REGION" "us-east1"
    
    # Twitch settings
    prompt_input "Enter Twitch Client ID" "NEXT_PUBLIC_TWITCH_CLIENT_ID"
    prompt_input "Enter Twitch Client Secret" "TWITCH_CLIENT_SECRET"
    
    # Database settings
    prompt_input "Enter Database URL" "DATABASE_URL"
    
    # Authentication settings
    prompt_input "Enter NextAuth Secret (or press enter to generate)" "NEXTAUTH_SECRET" "$(generate_random_string 32)"
    prompt_input "Enter NextAuth URL" "NEXTAUTH_URL"
    
    # Notification settings
    prompt_input "Enter Discord Webhook URL" "DISCORD_WEBHOOK_URL"
    prompt_input "Enter Notification Email" "NOTIFICATION_EMAIL"
    
    # Save to .env file
    print_header "Saving Environment Variables"
    
    cat > .env << EOL
PROJECT_ID=$PROJECT_ID
REGION=$REGION
NEXT_PUBLIC_TWITCH_CLIENT_ID=$NEXT_PUBLIC_TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET=$TWITCH_CLIENT_SECRET
DATABASE_URL=$DATABASE_URL
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
NEXTAUTH_URL=$NEXTAUTH_URL
DISCORD_WEBHOOK_URL=$DISCORD_WEBHOOK_URL
NOTIFICATION_EMAIL=$NOTIFICATION_EMAIL
EOL
    
    echo -e "${GREEN}Environment variables have been saved to .env${NC}"
    
    # Export variables for current session
    export PROJECT_ID REGION NEXT_PUBLIC_TWITCH_CLIENT_ID TWITCH_CLIENT_SECRET \
           DATABASE_URL NEXTAUTH_SECRET NEXTAUTH_URL DISCORD_WEBHOOK_URL NOTIFICATION_EMAIL
    
    print_header "Next Steps"
    echo "1. Review the environment variables in .env"
    echo "2. Run ./scripts/deploy.sh to deploy the application"
    echo "3. Monitor the deployment process"
    echo "4. Verify the application is running correctly"
}

# Run main function
main 