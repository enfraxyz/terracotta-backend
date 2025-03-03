const express = require("express");
const crypto = require("crypto");
const { getPullRequestFiles, scanFilesForTerraformExtensions, cloneRepository, autoPlanTerraform } = require("../helpers/github");
const { fetchFileFromS3 } = require("../helpers/aws");

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

  console.log(req.body);

  if (event === "pull_request" && (action === "opened" || action === "reopened")) {
    console.log("[Terracotta] → [GitHub] pull request opened");

    const owner = req.body.repository.owner.login;
    const repo = req.body.repository.name;
    const number = req.body.pull_request.number;
    const branch = req.body.pull_request.head.ref;

    const files = await getPullRequestFiles(owner, repo, number);

    // Check if any file in the PR has a .tf extension
    const hasTerraformFiles = files.some((file) => file.filename.endsWith(".tf"));

    if (hasTerraformFiles) {
      console.log("[Terracotta] → [GitHub] Found Terraform files in PR");
      // Additional processing for Terracotta files can be added here

      // We fetch the pre-existing state file from S3, and then we'll use it to check if the PR is valid
      // const stateFile = await fetchFileFromS3(process.env.S3_BUCKET, process.env.S3_STATE_KEY);

      let terraformFiles = await scanFilesForTerraformExtensions(files);

      console.log(terraformFiles.map((file) => file.filename));

      const repoHtmlUrl = req.body.repository.html_url;

      const repoClonePath = `./temp/${owner}/${repo}#${branch}`;

      await cloneRepository(repoHtmlUrl, branch, repoClonePath);

      await autoPlanTerraform(repoClonePath);
    } else {
      console.log("[Terracotta] → [GitHub] No Terraform files found in PR");
    }
  }

  res.status(200).send("Webhook received");
});

module.exports = router;
