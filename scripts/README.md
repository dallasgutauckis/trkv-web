# GitHub Secrets & Variables Sync Scripts

This directory contains scripts to sync your local environment variables to GitHub repository secrets and environment variables, which are required for the GitHub Actions deployment workflow.

## Available Scripts

Two versions of the script are provided:

1. **Bash Script** (`sync-github-secrets.sh`): Uses GitHub CLI
2. **Node.js Script** (`sync-github-secrets.js`): Uses GitHub REST API

Choose the one that best fits your workflow and environment.

## What's the Difference Between Secrets and Variables?

- **Secrets**: For sensitive information (API keys, tokens, passwords). These are encrypted and masked in logs.
- **Environment Variables**: For non-sensitive information (project IDs, URLs, region names). These are visible in logs.

## How Variables Are Categorized

The scripts categorize variables from your `.env` file as follows:

### Secrets (Sensitive)
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `SERVICE_ACCOUNT`
- `WORKLOAD_IDENTITY_PROVIDER`

### Environment Variables (Non-Sensitive)
- `PROJECT_ID`
- `NEXTAUTH_URL`
- `API_BASE_URL`
- `REGION`

## Prerequisites

### For the Bash Script

- **GitHub CLI**: The script uses `gh` to set repository secrets and variables
  - Installation: https://cli.github.com/
  - Authentication: Run `gh auth login` before using the script

### For the Node.js Script

- **Node.js**: Version 14 or higher
- **NPM Packages**: The script requires several dependencies
  ```bash
  cd scripts
  npm install
  ```
- **GitHub Token**: A personal access token with `repo` permissions

## Required Environment Variables

Your `.env` file should include the following variables:

```
# Google Cloud
PROJECT_ID=your_gcp_project_id
SERVICE_ACCOUNT=your_service_account_email
WORKLOAD_IDENTITY_PROVIDER=your_workload_identity_provider_url
REGION=your_gcp_region

# Twitch
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret

# NextAuth
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=your_nextauth_url

# API
API_BASE_URL=your_api_base_url

# For Node.js script (optional)
GITHUB_TOKEN=your_github_personal_access_token
```

## Usage

### Bash Script

Make the script executable and run it:

```bash
chmod +x scripts/sync-github-secrets.sh
./scripts/sync-github-secrets.sh
```

### Node.js Script

Make the script executable and run it:

```bash
chmod +x scripts/sync-github-secrets.js
./scripts/sync-github-secrets.js
```

Or use the npm script:

```bash
cd scripts
npm run sync
```

## What the Scripts Do

1. Check if the `.env` file exists
2. Load environment variables from the `.env` file
3. Determine the GitHub repository from Git configuration
4. Authenticate with GitHub (CLI or API token)
5. Process each variable:
   - If it's sensitive, set it as a GitHub repository secret
   - If it's non-sensitive, set it as a GitHub environment variable in the "production" environment
6. Provide a summary of the results

## Troubleshooting

- **Missing GitHub CLI**: Install the GitHub CLI from https://cli.github.com/
- **Authentication Errors**: Run `gh auth login` or check your personal access token
- **Missing Variables**: Add the required variables to your `.env` file
- **Repository Detection Failed**: Run the script from the root of your Git repository
- **Environment Creation Failed**: Ensure your GitHub token has sufficient permissions
- **Variable Name Conflicts**: If you get errors about duplicate variable names, check if you've already set them manually 