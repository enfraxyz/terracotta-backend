import dotenv from "dotenv";
dotenv.config();

import * as fs from "fs";
import { exec } from "child_process";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";

const getInstallationToken = async (owner: string, repo: string) => {
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
export const cloneRepository = async (repoUrl: string, branch: string, clonePath: string) => {
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
export const getPullRequestFiles = async (owner: string, repo: string, pullRequestNumber: number) => {
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

export const scanFilesForTerraformExtensions = async (files: any[]) => {
  const terraformFiles = files.filter((file) => file.filename.endsWith(".tf"));

  return terraformFiles;
};

export const autoPlanTerraform = async (repoClonePath: string) => {
  // for now we know that the main.tf file in the root of the repo.
  // so first we need to run `terraform init`
  // then we need to run `terraform plan`

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

  // once terraform plan is done, we need to get the output and pass that to our LLM to format the plan into a more readable format
};

// Run terraform init
const runTerraformInit = async (repoClonePath: string): Promise<boolean> => {
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
const runTerraformPlan = async (repoClonePath: string): Promise<boolean> => {
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
