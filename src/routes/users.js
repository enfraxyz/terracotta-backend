const express = require("express");
const User = require("../models/User");
const passport = require("passport");

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
    console.log("[Express] Create User Full Error", error);

    return { error: error.message, fatal: true };
  }
});

router.post("/login", passport.authenticate("local"), (req, res) => {
  res.json({ message: "Logged in successfully" });
});

module.exports = router;
