import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email?: string;
  walletAddress?: string;
  password?: string;
  role: "educator" | "learner";
  name?: string;
  about?: string;
  website?: string;
  linkedin?: string;
  twitter?: string;
  purchasedCourses?: mongoose.Types.ObjectId[];
  completedCourses: Array<{
    courseId: mongoose.Types.ObjectId;
    completedAt: Date;
  }>;
  ownedNFTs: string[];
}

const UserSchema: Schema = new Schema({
  email: { type: String, unique: true, sparse: true },
  walletAddress: { type: String, unique: true, sparse: true },
  password: { type: String },
  role: { type: String, enum: ["educator", "learner"], required: true },
  name: String,
  about: { type: String, default: "" },
  website: { type: String, default: "" },
  linkedin: { type: String, default: "" },
  twitter: { type: String, default: "" },
  purchasedCourses: [{ type: Schema.Types.ObjectId, ref: "Course" }],
  completedCourses: [{ courseId: Schema.Types.ObjectId, completedAt: Date }],
  ownedNFTs: [String],
});

export default mongoose.model<IUser>("User", UserSchema);
