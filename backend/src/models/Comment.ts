import mongoose, { Document, Schema } from "mongoose";

export interface IComment extends Document {
  courseId: mongoose.Types.ObjectId;
  blockIndex: number;
  parentId?: mongoose.Types.ObjectId | null;
  userId: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    blockIndex: { type: Number, required: true, min: 0 },
    parentId: { type: Schema.Types.ObjectId, ref: "Comment", default: null },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: 1200 },
  },
  { timestamps: true },
);

CommentSchema.index({ courseId: 1, blockIndex: 1, createdAt: 1 });
CommentSchema.index({ courseId: 1, blockIndex: 1, parentId: 1, createdAt: 1 });

export default mongoose.model<IComment>("Comment", CommentSchema);
