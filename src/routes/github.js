const express = require("express");
const crypto = require("crypto");
const GithubHelper = require("../helpers/github");
const { fetchFileFromS3 } = require("../helpers/aws");
const AIHelper = require("../helpers/ai");
const User = require("../models/User");

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
    branch = req.body.issue.head.ref;
    prNumber = req.body.issue.number;

    // we probably want to get
  }

  const thread = user.threads.find((thread) => thread.repoId === repoId && thread.branch === branch && thread.prNumber === prNumber);

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

    const files = await GithubHelper.getPullRequestFiles(owner, repo, number);

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
        await GithubHelper.addCommentToPullRequest(owner, repo, number, aiResponse);
      }
    } else {
      console.log("[Terracotta] → [GitHub] No Terraform files found in PR");
    }
  } else if (event === "issue_comment" && action === "created") {
    console.log("[Terracotta] → [GitHub] Comment created");
    const owner = req.body.repository.owner.login;
    const repo = req.body.repository.name;
    const number = req.body.issue.number;
    const comment = req.body.comment.body;

    console.log(owner, repo, number, comment);
  } else {
    console.log("[Terracotta] → [GitHub] Not a pull request event");
    console.log(req.body);

    const owner = req.body.repository.owner.login;
    const repo = req.body.repository.name;
  }

  res.status(200).send("Webhook received");
});

module.exports = router;
