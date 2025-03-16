#!/bin/bash

# Script to sync secrets and environment variables from .env file to GitHub repository
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

# Variables to be set as secrets (sensitive information)
SECRETS=(
  "TWITCH_CLIENT_ID"
  "TWITCH_CLIENT_SECRET"
  "NEXTAUTH_SECRET"
  "SERVICE_ACCOUNT"
  "WORKLOAD_IDENTITY_PROVIDER"
)

# Variables to be set as environment variables (non-sensitive information)
ENV_VARS=(
  "PROJECT_ID"
  "NEXTAUTH_URL"
  "API_BASE_URL"
  "REGION"
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
echo -e "${BLUE}GitHub Secrets & Variables Sync Tool${NC}"
echo -e "${BLUE}===========================================================${NC}"
echo -e "Repository: ${YELLOW}$OWNER/$REPO${NC}"
echo -e "Environment File: ${YELLOW}$ENV_FILE${NC}"
echo -e "${BLUE}-----------------------------------------------------------${NC}"

# Function to set a secret
set_secret() {
  local var_name=$1
  local value=$2
  
  if [ -z "$value" ]; then
    echo -e "  ${YELLOW}⚠ Skipping $var_name (empty value)${NC}"
    return 1
  fi
  
  echo -e "  Setting secret ${YELLOW}$var_name${NC}..."
  
  # Use GitHub CLI to set the secret
  if echo "$value" | gh secret set "$var_name" --repo "$OWNER/$REPO" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Successfully set $var_name${NC}"
    return 0
  else
    echo -e "  ${RED}✗ Failed to set $var_name${NC}"
    return 1
  fi
}

# Function to set an environment variable
set_env_var() {
  local var_name=$1
  local value=$2
  local env_name="production"
  
  if [ -z "$value" ]; then
    echo -e "  ${YELLOW}⚠ Skipping $var_name (empty value)${NC}"
    return 1
  fi
  
  echo -e "  Setting environment variable ${YELLOW}$var_name${NC}..."
  
  # First check if the environment exists
  if ! gh api "repos/$OWNER/$REPO/environments/$env_name" &> /dev/null; then
    echo -e "  ${YELLOW}Creating environment $env_name...${NC}"
    # Create the environment
    if ! gh api "repos/$OWNER/$REPO/environments/$env_name" -X PUT &> /dev/null; then
      echo -e "  ${RED}✗ Failed to create environment $env_name${NC}"
      echo -e "  ${YELLOW}Will attempt to set variable anyway${NC}"
    fi
  fi
  
  # Use GitHub CLI to set the environment variable
  if gh variable set "$var_name" --body "$value" --env "$env_name" --repo "$OWNER/$REPO" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Successfully set $var_name${NC}"
    return 0
  else
    echo -e "  ${RED}✗ Failed to set $var_name${NC}"
    return 1
  fi
}

# Load variables from .env file without executing it
echo -e "${BLUE}Loading variables from $ENV_FILE...${NC}"
ENV_VARS_CONTENT=$(grep -v '^\s*#' $ENV_FILE | grep -v '^\s*$' | sed -E 's/export\s+//')

# Track missing required variables
MISSING_SECRETS=()
MISSING_ENV_VARS=()

# Process secrets
echo -e "${BLUE}Setting repository secrets:${NC}"
for secret_name in "${SECRETS[@]}"; do
  # Extract value from loaded variables
  VALUE=$(echo "$ENV_VARS_CONTENT" | grep "^$secret_name=" | cut -d '=' -f 2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  
  # Check if value exists
  if [ -z "$VALUE" ]; then
    echo -e "  ${RED}✗ Missing value for $secret_name${NC}"
    MISSING_SECRETS+=("$secret_name")
  else
    # Set the secret
    set_secret "$secret_name" "$VALUE" || true
  fi
done

# Process environment variables
echo -e "\n${BLUE}Setting repository environment variables:${NC}"
for var_name in "${ENV_VARS[@]}"; do
  # Extract value from loaded variables
  VALUE=$(echo "$ENV_VARS_CONTENT" | grep "^$var_name=" | cut -d '=' -f 2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  
  # Check if value exists
  if [ -z "$VALUE" ]; then
    echo -e "  ${RED}✗ Missing value for $var_name${NC}"
    MISSING_ENV_VARS+=("$var_name")
  else
    # Set the environment variable
    set_env_var "$var_name" "$VALUE" || true
  fi
done

echo -e "${BLUE}===========================================================${NC}"

# Summary
if [ ${#MISSING_SECRETS[@]} -eq 0 ] && [ ${#MISSING_ENV_VARS[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ All variables synced successfully!${NC}"
else
  echo -e "${YELLOW}⚠ The following variables were missing:${NC}"
  
  if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
    echo -e "${YELLOW}  Secrets:${NC}"
    for secret in "${MISSING_SECRETS[@]}"; do
      echo -e "    - $secret"
    done
  fi
  
  if [ ${#MISSING_ENV_VARS[@]} -gt 0 ]; then
    echo -e "${YELLOW}  Environment Variables:${NC}"
    for var in "${MISSING_ENV_VARS[@]}"; do
      echo -e "    - $var"
    done
  fi
  
  echo -e "${YELLOW}Please add them to your $ENV_FILE file and run this script again,${NC}"
  echo -e "${YELLOW}or set them manually using the GitHub CLI:${NC}"
  echo -e "${YELLOW}  For secrets: gh secret set SECRET_NAME --repo $OWNER/$REPO${NC}"
  echo -e "${YELLOW}  For variables: gh variable set VAR_NAME --env production --repo $OWNER/$REPO${NC}"
fi

echo -e "${BLUE}===========================================================${NC}"
echo -e "${GREEN}GitHub Actions workflow is now configured with your variables!${NC}" 