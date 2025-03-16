#!/bin/bash

# Script to sync secrets from .env file to GitHub repository secrets
# Requires GitHub CLI (gh) to be installed and authenticated

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENV_FILE=".env"
REQUIRED_SECRETS=(
  "GCP_PROJECT_ID"
  "TWITCH_CLIENT_ID"
  "TWITCH_CLIENT_SECRET"
  "NEXTAUTH_SECRET"
  "NEXTAUTH_URL"
  "API_BASE_URL"
)

# Mapping of .env variables to GitHub secrets
# Format: "ENV_VAR_NAME:GITHUB_SECRET_NAME"
MAPPING=(
  "PROJECT_ID:GCP_PROJECT_ID"
  "TWITCH_CLIENT_ID:TWITCH_CLIENT_ID"
  "TWITCH_CLIENT_SECRET:TWITCH_CLIENT_SECRET"
  "NEXTAUTH_SECRET:NEXTAUTH_SECRET"
  "NEXTAUTH_URL:NEXTAUTH_URL"
  "API_BASE_URL:API_BASE_URL"
)

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}Error: $ENV_FILE file not found.${NC}"
  echo -e "Please create a $ENV_FILE file with the required variables."
  exit 1
fi

# Check if gh is installed
if ! command -v gh &> /dev/null; then
  echo -e "${RED}Error: GitHub CLI (gh) is not installed.${NC}"
  echo -e "Please install it from https://cli.github.com/ and authenticate."
  exit 1
fi

# Check if user is authenticated with gh
if ! gh auth status &> /dev/null; then
  echo -e "${RED}Error: You are not authenticated with GitHub CLI.${NC}"
  echo -e "Please run 'gh auth login' to authenticate."
  exit 1
fi

# Get repository information
REPO_URL=$(git config --get remote.origin.url)
if [ -z "$REPO_URL" ]; then
  echo -e "${RED}Error: Unable to determine GitHub repository.${NC}"
  echo -e "Please run this script from a git repository with a remote origin set."
  exit 1
fi

# Extract owner and repo name
if [[ $REPO_URL == *"github.com"* ]]; then
  # Handle HTTPS URLs like https://github.com/owner/repo.git
  REPO_PATH=$(echo $REPO_URL | sed -E 's|https://github.com/||' | sed -E 's|git@github.com:||' | sed -E 's|\.git$||')
else
  # Handle SSH URLs like git@github.com:owner/repo.git
  REPO_PATH=$(echo $REPO_URL | sed -E 's|git@github.com:||' | sed -E 's|\.git$||')
fi

OWNER=$(echo $REPO_PATH | cut -d '/' -f 1)
REPO=$(echo $REPO_PATH | cut -d '/' -f 2)

echo -e "${BLUE}===========================================================${NC}"
echo -e "${BLUE}GitHub Secret Sync Tool${NC}"
echo -e "${BLUE}===========================================================${NC}"
echo -e "Repository: ${YELLOW}$OWNER/$REPO${NC}"
echo -e "Environment File: ${YELLOW}$ENV_FILE${NC}"
echo -e "${BLUE}-----------------------------------------------------------${NC}"

# Function to set a secret
set_secret() {
  local env_var=$1
  local secret_name=$2
  local value=$3
  
  if [ -z "$value" ]; then
    echo -e "  ${YELLOW}⚠ Skipping $secret_name (empty value)${NC}"
    return
  fi
  
  echo -e "  Setting secret ${YELLOW}$secret_name${NC}..."
  
  # Use GitHub CLI to set the secret
  if echo "$value" | gh secret set "$secret_name" --repo "$OWNER/$REPO" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Successfully set $secret_name${NC}"
  else
    echo -e "  ${RED}✗ Failed to set $secret_name${NC}"
    exit 1
  fi
}

# Load variables from .env file without executing it
echo -e "${BLUE}Loading variables from $ENV_FILE...${NC}"
ENV_VARS=$(grep -v '^\s*#' $ENV_FILE | grep -v '^\s*$' | sed -E 's/export\s+//')

# Track missing required secrets
MISSING_SECRETS=()

# Process each mapping
for map in "${MAPPING[@]}"; do
  ENV_VAR=$(echo $map | cut -d ':' -f 1)
  SECRET_NAME=$(echo $map | cut -d ':' -f 2)
  
  # Extract value from loaded variables
  VALUE=$(echo "$ENV_VARS" | grep "^$ENV_VAR=" | cut -d '=' -f 2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  
  # Check if value exists
  if [ -z "$VALUE" ]; then
    echo -e "  ${RED}✗ Missing value for $ENV_VAR${NC}"
    MISSING_SECRETS+=("$ENV_VAR")
  else
    # Set the secret
    set_secret "$ENV_VAR" "$SECRET_NAME" "$VALUE"
  fi
done

# Check for required Service Account and Workload Identity Provider
echo -e "${BLUE}-----------------------------------------------------------${NC}"
echo -e "Checking for Service Account and Workload Identity Provider...${NC}"

# Service Account
SERVICE_ACCOUNT=$(echo "$ENV_VARS" | grep "^SERVICE_ACCOUNT=" | cut -d '=' -f 2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
if [ -z "$SERVICE_ACCOUNT" ]; then
  echo -e "  ${YELLOW}⚠ SERVICE_ACCOUNT not found in $ENV_FILE${NC}"
  echo -e "  ${YELLOW}You'll need to set this manually:${NC}"
  echo -e "  ${YELLOW}gh secret set SERVICE_ACCOUNT --repo $OWNER/$REPO${NC}"
  MISSING_SECRETS+=("SERVICE_ACCOUNT")
else
  set_secret "SERVICE_ACCOUNT" "SERVICE_ACCOUNT" "$SERVICE_ACCOUNT"
fi

# Workload Identity Provider
WORKLOAD_IDENTITY_PROVIDER=$(echo "$ENV_VARS" | grep "^WORKLOAD_IDENTITY_PROVIDER=" | cut -d '=' -f 2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
if [ -z "$WORKLOAD_IDENTITY_PROVIDER" ]; then
  echo -e "  ${YELLOW}⚠ WORKLOAD_IDENTITY_PROVIDER not found in $ENV_FILE${NC}"
  echo -e "  ${YELLOW}You'll need to set this manually:${NC}"
  echo -e "  ${YELLOW}gh secret set WORKLOAD_IDENTITY_PROVIDER --repo $OWNER/$REPO${NC}"
  MISSING_SECRETS+=("WORKLOAD_IDENTITY_PROVIDER")
else
  set_secret "WORKLOAD_IDENTITY_PROVIDER" "WORKLOAD_IDENTITY_PROVIDER" "$WORKLOAD_IDENTITY_PROVIDER"
fi

echo -e "${BLUE}===========================================================${NC}"

# Summary
if [ ${#MISSING_SECRETS[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ All secrets synced successfully!${NC}"
else
  echo -e "${YELLOW}⚠ The following variables were missing:${NC}"
  for secret in "${MISSING_SECRETS[@]}"; do
    echo -e "  - $secret"
  done
  echo -e "${YELLOW}Please add them to your $ENV_FILE file and run this script again,${NC}"
  echo -e "${YELLOW}or set them manually using the GitHub CLI:${NC}"
  echo -e "${YELLOW}gh secret set SECRET_NAME --repo $OWNER/$REPO${NC}"
fi

echo -e "${BLUE}===========================================================${NC}"
echo -e "${GREEN}GitHub Actions workflow is now configured with your secrets!${NC}" 