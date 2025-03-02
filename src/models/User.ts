import mongoose, { Document, Schema, Model } from "mongoose";

// Define the User interface extending Document for TypeScript
interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define the User schema
const UserSchema: Schema<IUser> = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt fields
  } 
);

// Create the User model
const User: Model<IUser> = mongoose.model<IUser>("User", UserSchema);

export default User;
