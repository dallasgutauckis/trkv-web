# GitHub Secrets Sync Scripts

This directory contains scripts to sync your local environment variables to GitHub repository secrets, which are required for the GitHub Actions deployment workflow.

## Available Scripts

Two versions of the script are provided:

1. **Bash Script** (`sync-github-secrets.sh`): Uses GitHub CLI
2. **Node.js Script** (`sync-github-secrets.js`): Uses GitHub REST API

Choose the one that best fits your workflow and environment.

## Prerequisites

### For the Bash Script

- **GitHub CLI**: The script uses `gh` to set repository secrets
  - Installation: https://cli.github.com/
  - Authentication: Run `gh auth login` before using the script

### For the Node.js Script

- **Node.js**: Version 14 or higher
- **NPM Packages**: The script requires several dependencies
  ```bash
  npm install @octokit/rest dotenv libsodium-wrappers chalk prompts
  ```
- **GitHub Token**: A personal access token with `repo` permissions

## Required Environment Variables

Your `.env` file should include the following variables:

```
# Google Cloud
PROJECT_ID=your_gcp_project_id
SERVICE_ACCOUNT=your_service_account_email
WORKLOAD_IDENTITY_PROVIDER=your_workload_identity_provider_url

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

Or use `node` directly:

```bash
node scripts/sync-github-secrets.js
```

## What the Scripts Do

1. Check if the `.env` file exists
2. Load environment variables from the `.env` file
3. Determine the GitHub repository from Git configuration
4. Authenticate with GitHub (CLI or API token)
5. For each mapped variable:
   - Check if it exists in the `.env` file
   - Convert it to a GitHub repository secret
6. Provide a summary of the results

## Troubleshooting

- **Missing GitHub CLI**: Install the GitHub CLI from https://cli.github.com/
- **Authentication Errors**: Run `gh auth login` or check your personal access token
- **Missing Variables**: Add the required variables to your `.env` file
- **Repository Detection Failed**: Run the script from the root of your Git repository 