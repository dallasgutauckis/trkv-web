#!/usr/bin/env node

/**
 * GitHub Secrets and Variables Sync Tool
 * 
 * This script syncs environment variables from a .env file to GitHub repository 
 * secrets and environment variables.
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

// Variables to be set as secrets (sensitive information)
const SECRETS = [
  'TWITCH_CLIENT_ID',
  'TWITCH_CLIENT_SECRET',
  'NEXTAUTH_SECRET',
  'SERVICE_ACCOUNT',
  'WORKLOAD_IDENTITY_PROVIDER'
];

// Variables to be set as environment variables (non-sensitive information)
const ENV_VARS = [
  'PROJECT_ID',
  'NEXTAUTH_URL',
  'API_BASE_URL',
  'REGION'
];

// Print header
console.log(chalk.blue('=========================================================='));
console.log(chalk.blue('GitHub Secrets & Variables Sync Tool'));
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
    const missingEnvVars = [];

    // Process secrets
    console.log(chalk.blue('Setting repository secrets:'));
    for (const secretName of SECRETS) {
      const value = envConfig[secretName];
      
      if (!value) {
        console.log(chalk.red(`✗ Missing value for ${secretName}`));
        missingSecrets.push(secretName);
        continue;
      }
      
      // Set the secret
      await setSecret(octokit, repoInfo, secretName, value, publicKey, publicKeyId);
    }

    // Process environment variables
    console.log(chalk.blue('\nSetting repository environment variables:'));
    
    // Check if environment exists, create 'production' if it doesn't
    let envExists = false;
    try {
      const { data: environments } = await octokit.repos.getAllEnvironments({
        owner: repoInfo.owner,
        repo: repoInfo.repo
      });
      
      envExists = environments.environments.some(env => env.name === 'production');
    } catch (error) {
      console.log(chalk.yellow('Could not fetch environments, will attempt to create if needed.'));
    }
    
    if (!envExists) {
      try {
        console.log(chalk.yellow('Creating "production" environment...'));
        await octokit.repos.createOrUpdateEnvironment({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          environment_name: 'production'
        });
      } catch (error) {
        console.error(chalk.red(`✗ Failed to create environment: ${error.message}`));
        console.log(chalk.yellow('Will attempt to set variables anyway.'));
      }
    }
    
    // Set environment variables
    for (const varName of ENV_VARS) {
      const value = envConfig[varName];
      
      if (!value) {
        console.log(chalk.red(`✗ Missing value for ${varName}`));
        missingEnvVars.push(varName);
        continue;
      }
      
      // Set the environment variable
      await setEnvironmentVariable(octokit, repoInfo, varName, value);
    }

    // Print summary
    console.log(chalk.blue('=========================================================='));
    
    if (missingSecrets.length === 0 && missingEnvVars.length === 0) {
      console.log(chalk.green('✓ All variables synced successfully!'));
    } else {
      console.log(chalk.yellow('⚠ The following variables were missing:'));
      
      if (missingSecrets.length > 0) {
        console.log(chalk.yellow('  Secrets:'));
        missingSecrets.forEach(secret => {
          console.log(`    - ${secret}`);
        });
      }
      
      if (missingEnvVars.length > 0) {
        console.log(chalk.yellow('  Environment Variables:'));
        missingEnvVars.forEach(envVar => {
          console.log(`    - ${envVar}`);
        });
      }
      
      console.log(chalk.yellow(`Please add them to your ${ENV_FILE} file and run this script again.`));
    }
    
    console.log(chalk.blue('=========================================================='));
    console.log(chalk.green('GitHub Actions workflow is now configured with your variables!'));
    
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

// Helper function to set a GitHub environment variable
async function setEnvironmentVariable(octokit, repoInfo, varName, varValue) {
  console.log(`  Setting environment variable ${chalk.yellow(varName)}...`);
  
  try {
    // Set the environment variable
    await octokit.repos.createOrUpdateEnvironmentVariable({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      environment_name: 'production',
      name: varName,
      value: varValue
    });
    
    console.log(`  ${chalk.green('✓ Successfully set ' + varName)}`);
    return true;
  } catch (error) {
    console.error(`  ${chalk.red('✗ Failed to set ' + varName)}: ${error.message}`);
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