import express, { Request, Response } from "express";
import crypto from "crypto";
import { getPullRequestFiles } from "../helpers/github.js";
import { fetchFileFromS3 } from "../helpers/aws.js";

const router = express.Router();

// Helper function to verify GitHub webhook signature
function verifySignature(req: Request, secret: string): boolean {
  const signature = req.headers["x-hub-signature-256"] as string;
  const hmac = crypto.createHmac("sha256", secret);
  const digest = Buffer.from("sha256=" + hmac.update(JSON.stringify(req.body)).digest("hex"), "utf8");
  const checksum = Buffer.from(signature, "utf8");
  return crypto.timingSafeEqual(digest, checksum);
}

// Example route for handling GitHub webhooks
router.post("/webhook", express.json(), async (req: Request, res: Response): Promise<void> => {
  // const secret = process.env.GITHUB_WEBHOOK_SECRET as string;
  // if (!verifySignature(req, secret)) {
  //   res.status(401).send("Invalid signature");
  //   return;
  // }
  console.log("[Terracotta] → [GitHub] webhook received");

  const event = req.headers["x-github-event"] as string;
  const action = req.body.action;

  if (event === "pull_request" && (action === "opened" || action === "reopened")) {
    console.log("[Terracotta] → [GitHub] pull request opened");

    console.log(req.body);

    const owner = req.body.repository.owner.login;
    const repo = req.body.repository.name;
    const number = req.body.pull_request.number;

    const files = await getPullRequestFiles(owner, repo, number);

    // Check if any file in the PR has a .tk extension
    const hasTerraformFiles = files.some((file) => file.filename.endsWith(".tf"));

    if (hasTerraformFiles) {
      console.log("[Terracotta] → [GitHub] Found Terraform files in PR");
      // Additional processing for Terracotta files can be added here

      // We fetch the pre-existing state file from S3, and then we'll use it to check if the PR is valid
      const stateFile = await fetchFileFromS3(process.env.S3_BUCKET as string, process.env.S3_STATE_KEY as string);

      console.log(stateFile);
    } else {
      console.log("[Terracotta] → [GitHub] No Terraform files found in PR");
    }

    console.log(files);
  }

  res.status(200).send("Webhook received");
});

export default router;
