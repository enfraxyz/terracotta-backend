import express from "express";

const app = express();
const PORT = process.env.PORT || 3001;

app.get("/", (req, res) => {
  res.send("Hello, Terracotta!");
});

app.use("/v1/github", require("./routes/github"));

app.listen(PORT, () => {
  console.log(`\x1b[33m[Terracotta]\x1b[0m is running on port ${PORT}`);
});
