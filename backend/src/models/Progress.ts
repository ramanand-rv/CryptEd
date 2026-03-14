import mongoose, { Schema, Document } from "mongoose";

export interface IProgress extends Document {
  userId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  completedChapters: number[]; // indices of completed chapters/blocks
  quizScores: Array<{ blockIndex: number; score: number; passed: boolean }>;
  completedAt?: Date;
  lastAccessedAt: Date;
}

const ProgressSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    completedChapters: [{ type: Number, default: [] }],
    quizScores: [
      {
        blockIndex: Number,
        score: Number,
        passed: Boolean,
      },
    ],
    completedAt: { type: Date },
    lastAccessedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Ensure one progress record per user per course
ProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export default mongoose.model<IProgress>("Progress", ProgressSchema);
