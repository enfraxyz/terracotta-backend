const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    githubAccessToken: { type: String },
    githubInstallations: { type: Array, default: [] },
    threads: { type: Array, default: [] },
  },
  {
    timestamps: true,
  }
);

userSchema.plugin(passportLocalMongoose, { usernameField: "email" });
module.exports = mongoose.model("user", userSchema);
