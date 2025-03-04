const express = require("express");
const { isAuthenticated } = require("../middleware/auth");
const User = require("../models/User");
const passport = require("passport");
const axios = require("axios");

const router = express.Router();

router.post("/signup", async (req, res) => {
  console.log("[Terracotta] → [Users] Sign Up called");

  const { firstName, lastName, email, password } = req.body;

  try {
    let existingUser = await User.findOne({ email });

    if (existingUser) return res.status(400).send({ error: "User already exists" });

    // Password validation
    if (password)
      if (password.length > 34) return res.status(400).send({ error: "Password is too long. Maximum length of 34 characters allowed." });
      else if (password.length < 8) return res.status(400).send({ error: "Password is too short. Minimum length of 8 characters required." });
      else if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password))
        return res.status(400).send({
          error: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
        });

    // @TODO: Create stripe customer, payments are invoices at the moment

    const newUser = new User({
      firstName,
      lastName,
      email,
    });

    User.register(newUser, password, async (err, user) => {
      if (err) {
        console.log("[Express] Create User Registration Error", err);

        return res.status(500).send({ error: err.message, fatal: true });
      }

      passport.authenticate("local")(req, res, async () => {
        await newUser.save();

        return res.status(200).send({ user: newUser });
      });
    });
  } catch (error) {
    console.log("[Terracotta] → [Users] Sign Up Error", error);

    return res.status(500).send({ error: error.message, fatal: true });
  }
});

router.post("/login", passport.authenticate("local"), async (req, res) => {
  console.log("[Terracotta] → [Users] Login called");

  try {
    if (req.user) {
      req.session.save(async () => {
        let user = JSON.parse(JSON.stringify(req.user));

        delete user.salt;
        delete user.hash;
        delete user.__v;

        console.log(user);

        return res.send(user);
      });
    } else {
      return res.status(409).send("This email is not associated with an account. Please create an account.");
    }
  } catch (error) {
    console.log("[Terracotta] → [Users] Login Error", error);

    return res.status(500).send({ error: error.message, fatal: true });
  }
});

router.get("/test", isAuthenticated, async (req, res) => {
  console.log("[Terracotta] → [Users] Test called");

  return res.status(200).send("Test successful");
});

router.post("/github", isAuthenticated, async (req, res) => {
  console.log("[Terracotta] → [Users] GitHub OAuth callback called");

  const { code } = req.body;

  console.log("[Terracotta] → [Users] GitHub OAuth callback received code", code);
  console.log(req.user);

  try {
    const response = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (response.data.error) return res.status(400).send({ error: response.data.error });

    const user = await User.findById(req.user._id);

    user.githubAccessToken = response.data.access_token;
    await user.save();

    console.log("[Terracotta] → [Users] GitHub OAuth callback received access token", response.data);

    return res.status(200).send({ user });
  } catch (error) {
    console.log("[Terracotta] → [Users] GitHub OAuth callback error", error);

    return res.status(500).send({ error: error.message, fatal: true });
  }
});

router.get("/github/repos", isAuthenticated, async (req, res) => {
  console.log("[Terracotta] → [Users] GitHub Repositories called");

  try {
    const user = await User.findById(req.user._id);

    let page = 1;
    let hasMore = true;

    let repos = [];

    while (hasMore) {
      const response = await axios.get("https://api.github.com/user/repos", {
        headers: {
          Authorization: `Bearer ${user.githubAccessToken}`,
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

    let cleanedRepos = repos.map((repo) => {
      return {
        id: repo.id,
        name: repo.name,
        owner: repo.owner,
        html_url: repo.html_url,
        pushed_at: repo.pushed_at,
        private: repo.private,
      };
    });

    return res.status(200).send(cleanedRepos);
  } catch (error) {
    console.log("[Terracotta] → [Users] GitHub Repositories error", error);

    let user = await User.findById(req.user._id);

    if (error.response.data.message === "Bad credentials") {
      user.githubAccessToken = null;
      await user.save();

      return res.status(401).send({ error: "Invalid GitHub access token. Please reauthorize with GitHub.", user, github: true });
    }

    return res.status(500).send({ error: error.message, fatal: true });
  }
});

module.exports = router;
