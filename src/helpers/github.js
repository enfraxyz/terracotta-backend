require("dotenv").config();

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { fetchFileFromS3 } = require("./aws");

const AIHelper = require("./ai");

exports.checkForTerraformFiles = async (files) => {
  const terraformFiles = files.filter((file) => file.filename.endsWith(".tf"));
  return terraformFiles;
};

// Exportable Functions
exports.cloneRepository = async (owner, repo, branch, clonePath, installationId) => {
  if (fs.existsSync(clonePath)) {
    console.log(`Repository already exists at ${clonePath}.`);
  } else {
    const token = await getInstallationToken(owner, repo, installationId);
    const repoUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;

    return new Promise((resolve, reject) => {
      const command = `git clone --branch ${branch} --single-branch ${repoUrl} ${clonePath}`;
      console.log(`Executing: ${command}`);

      const process = exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error cloning repository: ${error.message}`);
          reject(error);
          return;
        }
        if (stderr) {
          console.error(`Git stderr: ${stderr}`);
        }
        console.log(`Clone completed: ${stdout}`);
        resolve();
      });

      process.stdout.on("data", (data) => console.log(`STDOUT: ${data}`));
      process.stderr.on("data", (data) => console.error(`STDERR: ${data}`));
    });
  }
};

exports.getPullRequestFiles = async (owner, repo, pullRequestNumber, installationId) => {
  const { Octokit } = await import("@octokit/rest");
  const token = await getInstallationToken(owner, repo, installationId);
  const octokit = new Octokit({ auth: token });

  const { data } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number: pullRequestNumber,
  });

  return data;
};

exports.getBranchNameFromPullRequest = async (owner, repo, pullRequestNumber, installationId) => {
  const { Octokit } = await import("@octokit/rest");
  const token = await getInstallationToken(owner, repo, installationId);
  const octokit = new Octokit({ auth: token });

  try {
    const { data } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullRequestNumber,
    });

    const branchName = data.head.ref;
    console.log(`Branch name for PR #${pullRequestNumber}: ${branchName}`);
    return branchName;
  } catch (error) {
    console.error(`Error fetching branch name for PR #${pullRequestNumber}:`, error);
    throw error;
  }
};

exports.scanFilesForTerraformExtensions = async (files) => {
  const terraformFiles = files.filter((file) => file.filename.endsWith(".tf"));
  return terraformFiles;
};

exports.autoPlanTerraform = async (repoClonePath) => {
  const initSuccess = await runTerraformInit(repoClonePath);

  console.log(`[Terracotta] → [GH | AutoPlan] Terraform init completed with success: ${initSuccess}`);

  if (!initSuccess) {
    return;
  }

  const planSuccess = await runTerraformPlan(repoClonePath);

  console.log(`[Terracotta] → [GH | AutoPlan] Terraform plan completed with success: ${planSuccess.success}`);

  return planSuccess;
};

exports.queryRepositories = async (accessToken) => {
  try {
    let page = 1;
    let hasMore = true;
    let repos = [];

    while (hasMore) {
      const response = await axios.get("https://api.github.com/user/repos", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          per_page: 100, // Maximum number of repos per page
          page: page,
        },
      });

      repos.push(...response.data);

      if (response.data.length < 100) hasMore = false;

      page++;
    }

    return repos;
  } catch (error) {
    console.log("[Terracotta] → [Users] GitHub Repositories error", error);
    return [];
  }
};

exports.createIssue = async (owner, repo, title, body, installationId) => {
  const { Octokit } = await import("@octokit/rest");
  const token = await getInstallationToken(owner, repo, installationId);
  const octokit = new Octokit({ auth: token });

  await octokit.issues.create({
    owner,
    repo,
    title,
    body,
  });
};

exports.addCommentToPullRequest = async (owner, repo, pullRequestNumber, comment, installationId) => {
  const { Octokit } = await import("@octokit/rest");
  const token = await getInstallationToken(owner, repo, installationId);
  const octokit = new Octokit({ auth: token });

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: pullRequestNumber,
    body: comment,
  });
};

exports.getBackendConfig = async (repoClonePath) => {
  const backendConfig = extractS3BackendConfig(repoClonePath);
  return backendConfig;
};

/*
 *
 *
 * Internal Helper Functions
 *
 */

const getInstallationToken = async (owner, repo, installationId) => {
  const { createAppAuth } = await import("@octokit/auth-app");

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error("GITHUB_APP_ID and GITHUB_PRIVATE_KEY must be set in the environment variables.");
  }

  const auth = createAppAuth({
    appId,
    privateKey,
    installationId: installationId,
  });

  const { token } = await auth({ type: "installation" });

  return token;
};

const runTerraformInit = async (repoClonePath) => {
  console.log(`[Terracotta] → [GH | AutoPlan] Running terraform init in ${repoClonePath}...`);

  // can we check if the repoClonePath is a valid path?
  if (!fs.existsSync(repoClonePath)) {
    console.error(`[GH | AutoPlan] Repository path is not valid: ${repoClonePath}`);
    return false;
  }

  return new Promise((resolve) => {
    exec(`cd ${repoClonePath} && terraform init`, (error, stdout, stderr) => {
      if (error) {
        console.error(`[GH | AutoPlan] Error running terraform init: ${error.message}`);
        resolve(false);
        return;
      }
      if (stderr) {
        console.error(`[GH | AutoPlan] Terraform init stderr: ${stderr}`);
        resolve(false);
        return;
      }
      console.log(`[GH | AutoPlan] Terraform init completed successfully`);
      console.log(stdout);
      resolve(true);
    });
  });
};

const runTerraformPlan = async (repoClonePath) => {
  console.log(`[Terracotta] → [GH | AutoPlan] Running terraform plan in ${repoClonePath}...`);

  return new Promise((resolve, reject) => {
    exec(`cd ${repoClonePath} && terraform plan -no-color -out=terracottaPlan`, (error, stdout, stderr) => {
      if (error) {
        console.error(`[GH | AutoPlan] Error running terraform plan: ${error.message}`);
        resolve({ success: false, message: error.message });
        return;
      }
      if (stderr) {
        console.warn(`[GH | AutoPlan] Terraform plan stderr: ${stderr}`);
        resolve({ success: false, message: stderr });
      }
      console.log(`[GH | AutoPlan] Terraform plan completed successfully`);
      resolve({ success: true, message: stdout });
    });
  });
};

function extractS3BackendConfig(repoClonePath) {
  // Define possible file paths to check
  const possibleFiles = [
    path.join(repoClonePath, "main.tf"),
    path.join(repoClonePath, "backend.tf"),
    // Add any other potential files that might contain backend config
  ];

  let s3Config = null;

  // Check each file for backend configuration
  for (const filePath of possibleFiles) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");

      // Simple regex to extract S3 backend config
      // This is a basic implementation and might need refinement
      const backendMatch = content.match(/terraform\s*{[^}]*backend\s*"s3"\s*{([^}]*)}/s);

      if (backendMatch && backendMatch[1]) {
        const configText = backendMatch[1];

        // Extract bucket
        const bucketMatch = configText.match(/bucket\s*=\s*"([^"]*)"/);
        const bucket = bucketMatch ? bucketMatch[1] : null;

        // Extract key
        const keyMatch = configText.match(/key\s*=\s*"([^"]*)"/);
        const key = keyMatch ? keyMatch[1] : null;

        // Extract region
        const regionMatch = configText.match(/region\s*=\s*"([^"]*)"/);
        const region = regionMatch ? regionMatch[1] : null;

        if (bucket && key && region) {
          s3Config = { bucket, key, region };
          break; // Found a valid config, no need to check other files
        }
      }
    }
  }

  return s3Config;
}
