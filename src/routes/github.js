const express = require("express");
const router = express.Router();

// Example route for handling GitHub webhooks
router.post("/webhook", (req, res) => {
  // Handle the webhook event
  console.log("Received a GitHub webhook event");
  res.status(200).send("Webhook received");
});

// Add more routes as needed

module.exports = router;
