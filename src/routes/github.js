const express = require("express");
const crypto = require("crypto");
const GithubHelper = require("../helpers/github");
const { fetchFileFromS3 } = require("../helpers/aws");
const AIHelper = require("../helpers/ai");
const User = require("../models/User");

const fs = require("fs");
const path = require("path");

const router = express.Router();

// Helper function to verify GitHub webhook signature
function verifySignature(req, secret) {
  const signature = req.headers["x-hub-signature-256"];
  const hmac = crypto.createHmac("sha256", secret);
  const digest = Buffer.from("sha256=" + hmac.update(JSON.stringify(req.body)).digest("hex"), "utf8");
  const checksum = Buffer.from(signature, "utf8");
  return crypto.timingSafeEqual(digest, checksum);
}

// Example route for handling GitHub webhooks
router.post("/webhook", express.json(), async (req, res) => {
  // const secret = process.env.GITHUB_WEBHOOK_SECRET;
  // if (!verifySignature(req, secret)) {
  //   res.status(401).send("Invalid signature");
  //   return;
  // }
  console.log("[Terracotta] → [GitHub] webhook received");

  const event = req.headers["x-github-event"];
  const action = req.body.action;

  // we want to check the installation id and ensure that we know what user is associated with it
  const installationId = req.body.installation.id.toString();

  const user = await User.findOne({ githubInstallations: { $in: [installationId] } });

  if (!user) {
    console.log("[Terracotta] → [GitHub] No user found for installation id", installationId);
    return res.status(401).send("Unauthorized");
  } else {
    console.log("[Terracotta] → [GitHub] User found for installation id", installationId, user);
  }

  // We want to find a thread, and if we don't find one, we want to create one
  // Each thread should be associated with a repo > branch > prNumber
  // Versus the current implementation where each thread is associated with a prId, because not every event has a prId associated with it

  // so the theory here is that we should first check for these values, and then we can use them to find the thread
  // we always want repoId, branch, and prNumber

  // however, we may not alawys have a pull_request object but instead a issue object
  // so we need to check for that first

  let repoId, branch, prNumber;

  if (req.body.pull_request) {
    repoId = req.body.repository.id;
    branch = req.body.pull_request.head.ref;
    prNumber = req.body.pull_request.number;
  } else if (req.body.issue) {
    repoId = req.body.repository.id;
    prNumber = req.body.issue.number;
    branch = await GithubHelper.getBranchNameFromPullRequest(req.body.repository.owner.login, req.body.repository.name, req.body.issue.number, installationId);
  }

  let thread = user.threads.find((thread) => thread.repoId === repoId && thread.branch === branch && thread.prNumber === prNumber);

  if (!thread) {
    console.log("[Terracotta] → [GitHub] No thread found for:", repoId, branch, prNumber);

    // Create a new thread
    const newThread = await AIHelper.createThread();
    user.threads.push({ repoId, branch, prNumber, threadId: newThread });

    await user.save();
    thread = newThread;
  } else {
    console.log("[Terracotta] → [GitHub] Thread found for:", repoId, branch, prNumber);
    thread = thread.threadId;
  }

  if (event === "pull_request" && (action === "opened" || action === "reopened")) {
    console.log("[Terracotta] → [GitHub] pull request opened");

    const owner = req.body.repository.owner.login;
    const repo = req.body.repository.name;
    const number = req.body.pull_request.number;
    const branch = req.body.pull_request.head.ref;

    const files = await GithubHelper.getPullRequestFiles(owner, repo, number, installationId);

    // Check if any file in the PR has a .tf extension
    const hasTerraformFiles = files.some((file) => file.filename.endsWith(".tf"));

    if (hasTerraformFiles) {
      console.log("[Terracotta] → [GitHub] Found Terraform files in PR");
      // Additional processing for Terracotta files can be added here

      // We fetch the pre-existing state file from S3, and then we'll use it to check if the PR is valid
      // const stateFile = await fetchFileFromS3(process.env.S3_BUCKET, process.env.S3_STATE_KEY);

      let terraformFiles = await GithubHelper.scanFilesForTerraformExtensions(files);

      console.log(terraformFiles.map((file) => file.filename));

      const repoHtmlUrl = req.body.repository.html_url;

      const repoClonePath = `./temp/${owner}/${repo}.${branch}`;

      await GithubHelper.cloneRepository(repoHtmlUrl, branch, repoClonePath);

      let plan = await GithubHelper.autoPlanTerraform(repoClonePath);

      if (plan.success) {
        const aiResponse = await AIHelper.runTerraformPlan(plan.message);
        await GithubHelper.addCommentToPullRequest(owner, repo, number, aiResponse, installationId);
      }
    } else {
      console.log("[Terracotta] → [GitHub] No Terraform files found in PR");
    }
  } else if (event === "issue_comment" && action === "created") {
    console.log("[Terracotta] → [GitHub] Comment created");
    const owner = req.body.repository.owner.login;
    const repo = req.body.repository.name;
    const repoHtmlUrl = req.body.repository.html_url;
    const number = req.body.issue.number;
    const comment = req.body.comment.body;
    const commentAuthor = req.body.comment.user.login;

    console.log(owner, repo, number, comment, commentAuthor);

    if (commentAuthor === "try-terracotta[bot]") {
      console.log("[Terracotta] → [GitHub] Comment is from Terracotta, ignoring");
      return;
    }

    // ignore comments that don't contain "@try-terracotta", "tc:", or "terracotta:"
    if (!comment.includes("@try-terracotta") && !comment.includes("tc:") && !comment.includes("terracotta:")) {
      console.log("[Terracotta] → [GitHub] Comment does not contain '@try-terracotta', 'tc:', or 'terracotta:', ignoring");
      return;
    }

    // Commands Check: tc:help, tc:review, tc:plan, tc:drift

    // if the comment is a help request, we want to add the comment to the thread
    if (comment.includes("tc:help") || comment.includes("terracotta:help") || comment.includes("@try-terracotta help")) {
      // generate me a help message in markdown format
      const helpMessagePath = path.join(__dirname, "../../markdown/help.md");
      const helpMessage = fs.readFileSync(helpMessagePath, "utf8");

      await GithubHelper.addCommentToPullRequest(owner, repo, number, helpMessage, installationId);
      return;
    }

    if (comment.includes("tc:review") || comment.includes("terracotta:review") || comment.includes("@try-terracotta review")) {
      console.log("[Terracotta] → [GitHub] Comment is a review request, implementing...");

      // get pr files

      const files = await GithubHelper.getPullRequestFiles(owner, repo, number, installationId);

      // scan files for TF code

      let terraformFiles = await GithubHelper.scanFilesForTerraformExtensions(files);

      if (terraformFiles.length === 0) {
        console.log("[Terracotta] → [GitHub] No Terraform files found in PR");

        const aiResponse = await AIHelper.simpleMessage(
          "No Terraform files found in PR, please write a nice message to the user explaining that. Keep it short and simple. Note that this is not an email but a github comment inside a PR, so no need to include a signature or anything like that. Better to just be casual and friendly."
        );

        await GithubHelper.addCommentToPullRequest(owner, repo, number, aiResponse, installationId);

        return;
      }

      const patches = terraformFiles.map((file) => {
        return {
          filename: file.filename,
          patch: file.patch,
        };
      });

      await AIHelper.addMessageToThread(thread, "Please review the following Terraform code: " + JSON.stringify(patches));

      const runThread = await AIHelper.runThread(thread);

      await GithubHelper.addCommentToPullRequest(owner, repo, number, runThread, installationId);

      return;
    }

    if (comment.includes("tc:plan") || comment.includes("terracotta:plan") || comment.includes("@try-terracotta plan")) {
      console.log("[Terracotta] → [GitHub] Comment is a plan request, implementing...");

      // we want to essentially do what we do in the pull request event, but we want to do it on command

      // check for TF files before we do anything
      const files = await GithubHelper.getPullRequestFiles(owner, repo, number, installationId);

      // scan files for TF code
      let terraformFiles = await GithubHelper.scanFilesForTerraformExtensions(files);

      if (terraformFiles.length === 0) {
        console.log("[Terracotta] → [GitHub] No Terraform files found in PR");

        const aiResponse = await AIHelper.simpleMessage(
          "No Terraform files found in PR, please write a nice message to the user explaining that. Keep it short and simple. Note that this is not an email but a github comment inside a PR, so no need to include a signature or anything like that. Better to just be casual and friendly."
        );

        await GithubHelper.addCommentToPullRequest(owner, repo, number, aiResponse, installationId);

        return;
      }

      const repoClonePath = `./temp/${owner}/${repo}.${branch}`;

      // first we need to check if the repo is already cloned
      if (!fs.existsSync(repoClonePath)) {
        console.log("[Terracotta] → [GitHub] Repo is not cloned, cloning...");
        await GithubHelper.cloneRepository(repoHtmlUrl, branch, repoClonePath);
      } else {
        console.log("[Terracotta] → [GitHub] Repo is already cloned, removing...");
        fs.rmSync(repoClonePath, { recursive: true, force: true });
        console.log("[Terracotta] → [GitHub] Repo removed, cloning...");
        await GithubHelper.cloneRepository(repoHtmlUrl, branch, repoClonePath);

        console.log("[Terracotta] → [GitHub] Repo cloned, continuing...");
      }

      let plan = await GithubHelper.autoPlanTerraform(repoClonePath);

      if (plan.success) {
        const aiResponse = await AIHelper.runTerraformPlan(plan.message);
        await GithubHelper.addCommentToPullRequest(owner, repo, number, aiResponse, installationId);
      }

      return;
    }

    if (comment.includes("tc:drift") || comment.includes("terracotta:drift") || comment.includes("@try-terracotta drift")) {
      console.log("[Terracotta] → [GitHub] Comment is a drift request, implementing...");
      return;
    }

    // If the comment is not a command, we want to add the comment to the thread
    await AIHelper.addMessageToThread(thread, comment);

    // We want to get the response from the thread
    const response = await AIHelper.runThread(thread);

    // We want to add the response to the comment
    await GithubHelper.addCommentToPullRequest(owner, repo, number, response, installationId);
  } else {
    console.log("[Terracotta] → [GitHub] Not a pull request event");
    console.log(req.body);

    const owner = req.body.repository.owner.login;
    const repo = req.body.repository.name;
  }

  res.status(200).send("Webhook received");
});

module.exports = router;
