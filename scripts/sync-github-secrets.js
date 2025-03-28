#!/usr/bin/env node

/**
 * GitHub Secrets & Variables Sync Tool
 * 
 * This script reads variables from a .env file and sets them as GitHub repository 
 * secrets or environment variables for use in GitHub Actions workflows.
 * 
 * Usage:
 *   node sync-github-secrets.js [options]
 * 
 * Options:
 *   --help                 Show this help message
 *   --env-file <file>      Specify a custom .env file path (default: ./.env)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Octokit } = require('@octokit/rest');
const dotenv = require('dotenv');
const sodium = require('libsodium-wrappers');
const chalk = require('chalk');
const prompts = require('prompts');
const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2);
let envFilePath = '.env';
let showHelp = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help' || args[i] === '-h') {
    showHelp = true;
  } else if (args[i] === '--env-file' || args[i] === '-e') {
    if (i + 1 < args.length) {
      envFilePath = args[i + 1];
      i++; // Skip the next argument
    } else {
      console.error('\x1b[31mError: Missing argument for --env-file\x1b[0m');
      process.exit(1);
    }
  } else {
    console.error(`\x1b[31mError: Unknown option ${args[i]}\x1b[0m`);
    showHelp = true;
  }
}

// Show help message
if (showHelp) {
  console.log('GitHub Secrets & Variables Sync Tool');
  console.log('');
  console.log('Usage:');
  console.log('  node sync-github-secrets.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  -h, --help                 Show this help message');
  console.log('  -e, --env-file <file>      Specify a custom .env file path (default: ./.env)');
  console.log('');
  console.log('Examples:');
  console.log('  node sync-github-secrets.js');
  console.log('  node sync-github-secrets.js --env-file ../.env.production');
  console.log('');
  console.log('Description:');
  console.log('  This script reads variables from a .env file and sets them as GitHub repository');
  console.log('  secrets or environment variables for use in GitHub Actions workflows.');
  console.log('');
  console.log('  Sensitive variables (like API keys and tokens) are set as encrypted secrets,');
  console.log('  while non-sensitive variables (like project IDs and URLs) are set as environment');
  console.log('  variables in the \'production\' environment.');
  process.exit(0);
}

// Print header
console.log(chalk.blue('=========================================================='));
console.log(chalk.blue('GitHub Secrets & Variables Sync Tool'));
console.log(chalk.blue('=========================================================='));

// Main function
async function main() {
  try {
    // Check if .env file exists
    if (!fs.existsSync(envFilePath)) {
      console.error(chalk.red(`Error: ${envFilePath} file not found.`));
      console.error(`Please create a ${envFilePath} file with the required variables.`);
      process.exit(1);
    }

    // Load .env file
    console.log(chalk.blue(`Loading variables from ${envFilePath}...`));
    const envConfig = dotenv.parse(fs.readFileSync(envFilePath));
    
    // Get repository info from git
    const repoInfo = getRepositoryInfo();
    if (!repoInfo) {
      console.error(chalk.red('Error: Unable to determine GitHub repository.'));
      console.error('Please run this script from a git repository with a remote origin set.');
      process.exit(1);
    }
    
    console.log(`Repository: ${chalk.yellow(`${repoInfo.owner}/${repoInfo.repo}`)}`);
    console.log(`Environment File: ${chalk.yellow(envFilePath)}`);
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

    // Process all variables as secrets
    console.log(chalk.blue('Setting repository secrets:'));
    
    const allVariables = Object.keys(envConfig);
    const failedVariables = [];
    
    // Skip GITHUB_TOKEN to avoid recursion issues
    for (const varName of allVariables) {
      if (varName === 'GITHUB_TOKEN') continue;
      
      const value = envConfig[varName];
      
      if (!value) {
        console.log(chalk.yellow(`⚠ Skipping empty value for ${varName}`));
        continue;
      }
      
      // Set the variable as a secret
      const success = await setSecret(octokit, repoInfo, varName, value, publicKey, publicKeyId);
      if (!success) {
        failedVariables.push(varName);
      }
    }

    // Print summary
    console.log(chalk.blue('=========================================================='));
    
    if (failedVariables.length === 0) {
      console.log(chalk.green('✓ All variables synced successfully!'));
    } else {
      console.log(chalk.yellow('⚠ The following variables failed to sync:'));
      failedVariables.forEach(varName => {
        console.log(`  - ${varName}`);
      });
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
  // Ensure sodium is ready
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
    
    // Set the secret using the request method directly
    await octokit.request('PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}', {
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
    // Use the request method directly instead of the high-level API call
    // that might not be properly implemented in the current Octokit version
    await octokit.request('PUT /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}', {
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
  const env = dotenv.parse(fs.readFileSync(envFilePath));
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