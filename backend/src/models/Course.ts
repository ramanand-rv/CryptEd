import mongoose, { Schema, Document } from "mongoose";

// Structure of a content block (for now TipTap's JSON output)
export interface IContentBlock {
  type: string; // e.g., 'paragraph', 'heading', 'video', 'quiz'
  attrs?: Record<string, any>;
  content?: any[]; // for nested blocks
  text?: string;
}

export interface ICourse extends Document {
  title: string;
  description: string;
  educatorId: mongoose.Types.ObjectId;
  price: number; // in lamports
  content: IContentBlock[]; // array of blocks
  nftMetadataUri?: string; // IPFS URI for NFT image/metadata
  views: number;
  reviews: Array<{
    userId?: mongoose.Types.ObjectId;
    name?: string;
    rating: number;
    comment?: string;
    createdAt: Date;
  }>;
  rewardPool?: {
    totalAmount: number; // lamports
    remaining: number;
    winnersCount: number;
    winners: mongoose.Types.ObjectId[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    educatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    price: { type: Number, required: true, default: 0 },
    content: { type: Array, required: true, default: [] },
    nftMetadataUri: { type: String },
    views: { type: Number, default: 0 },
    reviews: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        name: String,
        rating: { type: Number, min: 1, max: 5, required: true },
        comment: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    rewardPool: {
      totalAmount: { type: Number, default: 0 },
      remaining: { type: Number, default: 0 },
      winnersCount: { type: Number, default: 0 },
      winners: [{ type: Schema.Types.ObjectId, ref: "User" }],
    },
  },
  { timestamps: true },
);

export default mongoose.model<ICourse>("Course", CourseSchema);
