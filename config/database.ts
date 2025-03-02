import mongoose from "mongoose";

// MongoDB connection URI
const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/terra";

// Connect to MongoDB using Mongoose
const connectToDatabase = async () => {
  try {
    await mongoose.connect(uri);
    console.log("\x1b[33m[Terracotta]\x1b[0m → \x1b[32m[Mongoose]\x1b[0m Connected to MongoDB with: \x1b[34m" + uri + "\x1b[0m");
  } catch (error) {
    console.error("\x1b[33m[Terracotta]\x1b[0m → \x1b[31m[Mongoose]\x1b[0m Error connecting to MongoDB:", error);
    process.exit(1); // Exit process with failure
  }
};

// Export the connection function
export default connectToDatabase;
