import express, { Request, Response } from "express";
import githubRouter from "./routes/github.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.get("/", (req: Request, res: Response) => {
  res.send("Hello, Terracotta!");
});

app.use("/v1/github", githubRouter);

app.listen(PORT, () => {
  console.log(`\x1b[33m[Terracotta]\x1b[0m is running on port ${PORT}`);
});
