#!/usr/bin/env node

/**
 * GitHub Secrets Sync Tool
 * 
 * This script syncs environment variables from a .env file to GitHub repository secrets.
 * It uses the GitHub REST API with a personal access token for authentication.
 * 
 * Requirements:
 * - Node.js 14+
 * - A GitHub personal access token with repo permissions
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Octokit } = require('@octokit/rest');
const dotenv = require('dotenv');
const sodium = require('libsodium-wrappers');
const chalk = require('chalk');
const prompts = require('prompts');

// Configuration
const ENV_FILE = '.env';
const MAPPING = [
  { envVar: 'PROJECT_ID', secret: 'GCP_PROJECT_ID' },
  { envVar: 'TWITCH_CLIENT_ID', secret: 'TWITCH_CLIENT_ID' },
  { envVar: 'TWITCH_CLIENT_SECRET', secret: 'TWITCH_CLIENT_SECRET' },
  { envVar: 'NEXTAUTH_SECRET', secret: 'NEXTAUTH_SECRET' },
  { envVar: 'NEXTAUTH_URL', secret: 'NEXTAUTH_URL' },
  { envVar: 'API_BASE_URL', secret: 'API_BASE_URL' },
  { envVar: 'SERVICE_ACCOUNT', secret: 'SERVICE_ACCOUNT' },
  { envVar: 'WORKLOAD_IDENTITY_PROVIDER', secret: 'WORKLOAD_IDENTITY_PROVIDER' }
];

// Print header
console.log(chalk.blue('=========================================================='));
console.log(chalk.blue('GitHub Secret Sync Tool (Node.js Version)'));
console.log(chalk.blue('=========================================================='));

// Main function
async function main() {
  try {
    // Check if .env file exists
    if (!fs.existsSync(ENV_FILE)) {
      console.error(chalk.red(`Error: ${ENV_FILE} file not found.`));
      console.error(`Please create a ${ENV_FILE} file with the required variables.`);
      process.exit(1);
    }

    // Load .env file
    console.log(chalk.blue(`Loading variables from ${ENV_FILE}...`));
    const envConfig = dotenv.parse(fs.readFileSync(ENV_FILE));
    
    // Get repository info from git
    const repoInfo = getRepositoryInfo();
    if (!repoInfo) {
      console.error(chalk.red('Error: Unable to determine GitHub repository.'));
      console.error('Please run this script from a git repository with a remote origin set.');
      process.exit(1);
    }
    
    console.log(`Repository: ${chalk.yellow(`${repoInfo.owner}/${repoInfo.repo}`)}`);
    console.log(`Environment File: ${chalk.yellow(ENV_FILE)}`);
    console.log(chalk.blue('-----------------------------------------------------------'));

    // Get GitHub token
    const token = await getGitHubToken();
    if (!token) {
      console.error(chalk.red('Error: GitHub token not provided.'));
      process.exit(1);
    }

    // Initialize Octokit
    const octokit = new Octokit({ auth: token });
    
    // Get public key for secret encryption
    const publicKeyResponse = await octokit.actions.getRepoPublicKey({
      owner: repoInfo.owner,
      repo: repoInfo.repo
    });
    
    const publicKey = publicKeyResponse.data.key;
    const publicKeyId = publicKeyResponse.data.key_id;

    // Track missing variables
    const missingSecrets = [];

    // Process each mapping
    for (const map of MAPPING) {
      const value = envConfig[map.envVar];
      
      if (!value) {
        console.log(chalk.red(`✗ Missing value for ${map.envVar}`));
        missingSecrets.push(map.envVar);
        continue;
      }
      
      // Set the secret
      await setSecret(octokit, repoInfo, map.secret, value, publicKey, publicKeyId);
    }

    // Print summary
    console.log(chalk.blue('=========================================================='));
    
    if (missingSecrets.length === 0) {
      console.log(chalk.green('✓ All secrets synced successfully!'));
    } else {
      console.log(chalk.yellow('⚠ The following variables were missing:'));
      missingSecrets.forEach(secret => {
        console.log(`  - ${secret}`);
      });
      console.log(chalk.yellow(`Please add them to your ${ENV_FILE} file and run this script again.`));
    }
    
    console.log(chalk.blue('=========================================================='));
    console.log(chalk.green('GitHub Actions workflow is now configured with your secrets!'));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

// Helper function to encrypt a secret using sodium
async function encryptSecret(secret, publicKey) {
  await sodium.ready;
  
  // Convert the public key to a Uint8Array
  const keyBytes = Buffer.from(publicKey, 'base64');
  
  // Convert the secret to a Uint8Array
  const messageBytes = Buffer.from(secret);
  
  // Encrypt using libsodium
  const encryptedBytes = sodium.crypto_box_seal(messageBytes, keyBytes);
  
  // Return as base64 string
  return Buffer.from(encryptedBytes).toString('base64');
}

// Helper function to set a GitHub secret
async function setSecret(octokit, repoInfo, secretName, secretValue, publicKey, publicKeyId) {
  console.log(`  Setting secret ${chalk.yellow(secretName)}...`);
  
  try {
    // Encrypt the secret
    const encryptedValue = await encryptSecret(secretValue, publicKey);
    
    // Set the secret
    await octokit.actions.createOrUpdateRepoSecret({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      secret_name: secretName,
      encrypted_value: encryptedValue,
      key_id: publicKeyId
    });
    
    console.log(`  ${chalk.green('✓ Successfully set ' + secretName)}`);
    return true;
  } catch (error) {
    console.error(`  ${chalk.red('✗ Failed to set ' + secretName)}: ${error.message}`);
    return false;
  }
}

// Helper function to extract repository info from git
function getRepositoryInfo() {
  try {
    // Get the remote URL
    const remoteUrl = execSync('git config --get remote.origin.url').toString().trim();
    
    // Extract owner and repo
    let match;
    if (remoteUrl.includes('github.com')) {
      // Handle HTTPS URLs
      match = remoteUrl.match(/github\.com[:\/]([^\/]+)\/([^\/\.]+)(\.git)?$/);
    } else {
      // Handle SSH URLs
      match = remoteUrl.match(/([^:]+)\/([^\/\.]+)(\.git)?$/);
    }
    
    if (match && match.length >= 3) {
      return {
        owner: match[1],
        repo: match[2].replace('.git', '')
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Helper function to get GitHub token
async function getGitHubToken() {
  // First check if token is in env
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }
  
  // Then check if it's in the .env file
  const env = dotenv.parse(fs.readFileSync(ENV_FILE));
  if (env.GITHUB_TOKEN) {
    return env.GITHUB_TOKEN;
  }
  
  // If not, prompt the user
  console.log(chalk.yellow('No GitHub token found in environment variables or .env file.'));
  
  const response = await prompts({
    type: 'password',
    name: 'token',
    message: 'Please enter your GitHub Personal Access Token:',
    validate: value => value.length > 0 ? true : 'Token is required'
  });
  
  return response.token;
}

// Run the main function
main().catch(error => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
}); 