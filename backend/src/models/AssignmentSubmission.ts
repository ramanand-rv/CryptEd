import mongoose, { Document, Schema } from "mongoose";

export type AssignmentSubmissionStatus = "submitted" | "graded";

export interface IAssignmentSubmission extends Document {
  assignmentId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  lessonId: string;
  blockIndex: number;
  learnerId: mongoose.Types.ObjectId;
  fileName: string;
  fileUrl: string;
  notes?: string;
  status: AssignmentSubmissionStatus;
  score?: number;
  feedback?: string;
  passed?: boolean;
  gradedBy?: mongoose.Types.ObjectId;
  gradedAt?: Date;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSubmissionSchema = new Schema(
  {
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
    },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    lessonId: { type: String, required: true, trim: true },
    blockIndex: { type: Number, required: true, min: 0 },
    learnerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fileName: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true, trim: true },
    notes: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["submitted", "graded"],
      default: "submitted",
      required: true,
    },
    score: { type: Number, min: 0 },
    feedback: { type: String, trim: true, default: "" },
    passed: { type: Boolean },
    gradedBy: { type: Schema.Types.ObjectId, ref: "User" },
    gradedAt: { type: Date },
    submittedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true },
);

AssignmentSubmissionSchema.index({ assignmentId: 1, learnerId: 1 }, { unique: true });
AssignmentSubmissionSchema.index({ courseId: 1, lessonId: 1, learnerId: 1 });

export default mongoose.model<IAssignmentSubmission>(
  "AssignmentSubmission",
  AssignmentSubmissionSchema,
);
