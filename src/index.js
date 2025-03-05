require("../config/database").connect();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const githubRouter = require("./routes/github");
const usersRouter = require("./routes/users");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;
app.use(
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(
  cors({
    credentials: true,
    origin: true,
  })
);

app.enable("trust proxy");

let cookie = {
  maxAge: 86400000,
  secure: process.env.ENV === "local" ? false : true,
};

if (process.env.ENV !== "local") {
  cookie.sameSite = "none";
}

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    name: process.env.COOKIE_NAME,
    cookie: cookie,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Import models
const User = require("./models/User");

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
    },
    User.authenticate()
  )
);

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get("/", (req, res) => {
  res.send("Hello, Terracotta!");
});

app.get("/v1/health", (req, res) => {
  res.sendStatus(200);
});

app.use("/v1/users", usersRouter);
app.use("/v1/github", githubRouter);

app.listen(PORT, () => {
  console.log(`\x1b[33m[Terracotta]\x1b[0m is running on port ${PORT}`);
});
