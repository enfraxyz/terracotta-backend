require("dotenv").config();

const axios = require("axios");
const fs = require("fs");
const { exec } = require("child_process");

const AIHelper = require("./ai");

exports.checkForTerraformFiles = async (files) => {
  const terraformFiles = files.filter((file) => file.filename.endsWith(".tf"));
  return terraformFiles;
};

// Exportable Functions
exports.cloneRepository = async (repoUrl, branch, clonePath) => {
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

exports.getPullRequestFiles = async (owner, repo, pullRequestNumber) => {
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

exports.createIssue = async (owner, repo, title, body) => {
  const { Octokit } = await import("@octokit/rest");
  const token = await getInstallationToken(owner, repo);
  const octokit = new Octokit({ auth: token });

  await octokit.issues.create({
    owner,
    repo,
    title,
    body,
  });
};

exports.addCommentToPullRequest = async (owner, repo, pullRequestNumber, comment) => {
  const { Octokit } = await import("@octokit/rest");
  const token = await getInstallationToken(owner, repo);
  const octokit = new Octokit({ auth: token });

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: pullRequestNumber,
    body: comment,
  });
};

/*
 *
 *
 * Internal Helper Functions
 *
 */

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

const runTerraformPlan = async (repoClonePath) => {
  console.log(`[Terracotta] → [GH | AutoPlan] Running terraform plan in ${repoClonePath}...`);

  return new Promise((resolve, reject) => {
    exec(`cd ${repoClonePath} && terraform plan -no-color`, (error, stdout, stderr) => {
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
