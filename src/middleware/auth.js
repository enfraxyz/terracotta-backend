exports.isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    console.log("[Express] Authenticated:", req.user.firstName, req.user.lastName, req.user._id);
    return next();
  }

  console.log("[Express] Not Authenticated");

  return res.status(401).send("You are not authenticated");
};
