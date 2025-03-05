require("dotenv").config();

const axios = require("axios");
const fs = require("fs");
const { exec } = require("child_process");

const getInstallationToken = async (owner, repo) => {
  const { createAppAuth } = await import("@octokit/auth-app");

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error("GITHUB_APP_ID and GITHUB_PRIVATE_KEY must be set in the environment variables.");
  }

  const auth = createAppAuth({
    appId,
    privateKey,
    installationId: "61806270",
  });

  const { token } = await auth({ type: "installation" });

  return token;
};

// Clone a repository into a temporary directory
const cloneRepository = async (repoUrl, branch, clonePath) => {
  if (fs.existsSync(clonePath)) {
    console.log(`Repository already exists at ${clonePath}.`);
  } else {
    console.log(`Cloning repository from ${repoUrl} to ${clonePath}...`);
    exec(`git clone --branch ${branch} --single-branch ${repoUrl} ${clonePath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error cloning repository: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`Git stderr: ${stderr}`);
        return;
      }
      console.log(`Clone completed: ${stdout}`);
    });
  }
};

// Get pull request files
const getPullRequestFiles = async (owner, repo, pullRequestNumber) => {
  const { Octokit } = await import("@octokit/rest");
  const token = await getInstallationToken(owner, repo);
  const octokit = new Octokit({ auth: token });

  console.log(repo);
  console.log(pullRequestNumber);
  console.log(owner);

  const { data } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number: pullRequestNumber,
  });

  return data;
};

const scanFilesForTerraformExtensions = async (files) => {
  const terraformFiles = files.filter((file) => file.filename.endsWith(".tf"));

  return terraformFiles;
};

const autoPlanTerraform = async (repoClonePath) => {
  const initSuccess = await runTerraformInit(repoClonePath);

  console.log(`[Terracotta] → [GH | AutoPlan] Terraform init completed with success: ${initSuccess}`);

  if (!initSuccess) {
    return;
  }

  const planSuccess = await runTerraformPlan(repoClonePath);

  console.log(`[Terracotta] → [GH | AutoPlan] Terraform plan completed with success: ${planSuccess}`);

  if (!planSuccess) {
    return;
  }
};

// Run terraform init
const runTerraformInit = async (repoClonePath) => {
  console.log(`[Terracotta] → [GH | AutoPlan] Running terraform init in ${repoClonePath}...`);

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

// Run terraform plan
const runTerraformPlan = async (repoClonePath) => {
  console.log(`[Terracotta] → [GH | AutoPlan] Running terraform plan in ${repoClonePath}...`);

  return new Promise((resolve) => {
    exec(`cd ${repoClonePath} && terraform plan -no-color`, (error, stdout, stderr) => {
      if (error) {
        console.error(`[GH | AutoPlan] Error running terraform plan: ${error.message}`);
        resolve(false);
        return;
      }
      if (stderr) {
        console.error(`[GH | AutoPlan] Terraform plan stderr: ${stderr}`);
        resolve(false);
        return;
      }
      console.log(`[GH | AutoPlan] Terraform plan completed successfully`);
      console.log(stdout);
      resolve(true);
    });
  });
};

const queryRepositories = async (accessToken) => {
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

module.exports = {
  cloneRepository,
  getPullRequestFiles,
  scanFilesForTerraformExtensions,
  autoPlanTerraform,
  queryRepositories,
};
