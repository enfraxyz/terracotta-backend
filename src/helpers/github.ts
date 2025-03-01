import dotenv from "dotenv";
dotenv.config();

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

// Add more functions as needed
