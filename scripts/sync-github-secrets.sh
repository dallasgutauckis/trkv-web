#!/bin/bash

# Script to sync all variables from .env file to GitHub repository secrets
# Requires GitHub CLI (gh) to be installed and authenticated

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
ENV_FILE=".env"
SHOW_HELP=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      SHOW_HELP=true
      shift
      ;;
    -e|--env-file)
      if [[ $# -gt 1 ]]; then
        ENV_FILE="$2"
        shift 2
      else
        echo -e "${RED}Error: Missing argument for $1${NC}"
        exit 1
      fi
      ;;
    *)
      echo -e "${RED}Error: Unknown option $1${NC}"
      SHOW_HELP=true
      shift
      ;;
  esac
done

# Show help message
if [[ $SHOW_HELP == true ]]; then
  echo "GitHub Secrets Sync Tool"
  echo ""
  echo "Usage:"
  echo "  ./sync-github-secrets.sh [options]"
  echo ""
  echo "Options:"
  echo "  -h, --help               Show this help message"
  echo "  -e, --env-file <file>    Specify a custom .env file path (default: ./.env)"
  echo ""
  echo "Examples:"
  echo "  ./sync-github-secrets.sh"
  echo "  ./sync-github-secrets.sh --env-file ../.env.production"
  echo ""
  echo "Description:"
  echo "  This script reads ALL variables from a .env file and sets them as"
  echo "  GitHub repository secrets for use in GitHub Actions workflows."
  exit 0
fi

# Remove predefined variables lists
# SECRETS=( ... )
# ENV_VARS=( ... )

# Print header
echo -e "${BLUE}=========================================================="
echo -e "GitHub Secrets Sync Tool"
echo -e "==========================================================${NC}"

# Check if .env file exists
if [[ ! -f "$ENV_FILE" ]]; then
  echo -e "${RED}Error: $ENV_FILE file not found.${NC}"
  echo "Please create a $ENV_FILE file with the required variables."
  exit 1
fi

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
  echo -e "${RED}Error: GitHub CLI (gh) not found.${NC}"
  echo "Please install the GitHub CLI and authenticate:"
  echo "  - Installation: https://cli.github.com/manual/installation"
  echo "  - Authentication: Run 'gh auth login'"
  exit 1
fi

# Check if gh CLI is authenticated
if ! gh auth status &> /dev/null; then
  echo -e "${RED}Error: GitHub CLI (gh) not authenticated.${NC}"
  echo "Please run 'gh auth login' to authenticate with your GitHub account."
  exit 1
fi

# Get repository info
REPO_URL=$(git config --get remote.origin.url)
if [[ -z "$REPO_URL" ]]; then
  echo -e "${RED}Error: Unable to determine GitHub repository.${NC}"
  echo "Please run this script from a git repository with a remote origin set."
  exit 1
fi

# Parse repository owner and name
if [[ $REPO_URL == *"github.com"* ]]; then
  # HTTPS URL
  REPO_INFO=$(echo $REPO_URL | sed -E 's/.*github.com[:\/]([^\/]+)\/([^\/\.]+)(\.git)?$/\1 \2/')
else
  # SSH URL
  REPO_INFO=$(echo $REPO_URL | sed -E 's/.*:([^\/]+)\/([^\/\.]+)(\.git)?$/\1 \2/')
fi

REPO_OWNER=$(echo $REPO_INFO | cut -d' ' -f1)
REPO_NAME=$(echo $REPO_INFO | cut -d' ' -f2 | sed 's/.git$//')

echo -e "Repository: ${YELLOW}$REPO_OWNER/$REPO_NAME${NC}"
echo -e "Environment File: ${YELLOW}$ENV_FILE${NC}"
echo -e "${BLUE}-----------------------------------------------------------${NC}"

# Process variables
echo -e "${BLUE}Setting repository secrets:${NC}"

# Track failures
FAILED_VARIABLES=()

# Read .env file line by line, skipping comments and empty lines
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip comments and empty lines
  if [[ -z "$line" || "$line" =~ ^# ]]; then
    continue
  fi
  
  # Extract variable name and value
  if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
    VAR_NAME="${BASH_REMATCH[1]}"
    VAR_VALUE="${BASH_REMATCH[2]}"
    
    # Skip GitHub token to avoid recursion issues
    if [[ "$VAR_NAME" == "GITHUB_TOKEN" ]]; then
      continue
    fi
    
    # Remove quotes if present
    VAR_VALUE=$(echo "$VAR_VALUE" | sed -E 's/^["'"'"'](.*)["'"'"']$/\1/')
    
    # Skip empty values
    if [[ -z "$VAR_VALUE" ]]; then
      echo -e "  ${YELLOW}⚠ Skipping empty value for $VAR_NAME${NC}"
      continue
    fi
    
    # Set as secret
    echo -e "  Setting secret ${YELLOW}$VAR_NAME${NC}..."
    if gh secret set "$VAR_NAME" -b"$VAR_VALUE" --repo "$REPO_OWNER/$REPO_NAME" &> /dev/null; then
      echo -e "  ${GREEN}✓ Successfully set $VAR_NAME${NC}"
    else
      echo -e "  ${RED}✗ Failed to set $VAR_NAME${NC}"
      FAILED_VARIABLES+=("$VAR_NAME")
    fi
  fi
done < "$ENV_FILE"

# Print summary
echo -e "${BLUE}==========================================================${NC}"

if [[ ${#FAILED_VARIABLES[@]} -eq 0 ]]; then
  echo -e "${GREEN}✓ All variables synced successfully!${NC}"
else
  echo -e "${YELLOW}⚠ The following variables failed to sync:${NC}"
  for VAR_NAME in "${FAILED_VARIABLES[@]}"; do
    echo -e "  - $VAR_NAME"
  done
fi

echo -e "${BLUE}==========================================================${NC}"
echo -e "${GREEN}GitHub Actions workflow is now configured with your variables!${NC}" 