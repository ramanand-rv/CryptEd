import mongoose, { Schema, Document } from "mongoose";

export interface IUserOwnedNFT {
  mintAddress: string;
  courseId?: mongoose.Types.ObjectId;
  courseTitle?: string;
  metadataUri?: string;
  mintedAt?: Date;
}

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
  walletVerifiedAt?: Date;
  walletNonce?: string;
  walletNonceCreatedAt?: Date;
  walletVerificationMessage?: string;
  purchasedCourses?: mongoose.Types.ObjectId[];
  completedCourses: Array<{
    courseId: mongoose.Types.ObjectId;
    completedAt: Date;
  }>;
  ownedNFTs: Array<string | IUserOwnedNFT>;
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
  walletVerifiedAt: { type: Date },
  walletNonce: { type: String },
  walletNonceCreatedAt: { type: Date },
  walletVerificationMessage: { type: String },
  purchasedCourses: [{ type: Schema.Types.ObjectId, ref: "Course" }],
  completedCourses: [{ courseId: Schema.Types.ObjectId, completedAt: Date }],
  ownedNFTs: { type: [Schema.Types.Mixed], default: [] },
});

export default mongoose.model<IUser>("User", UserSchema);
