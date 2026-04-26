import mongoose, { Document, Schema } from "mongoose";

export interface IAssignment extends Document {
  courseId: mongoose.Types.ObjectId;
  lessonId: string;
  blockIndex: number;
  title: string;
  instructions: string;
  acceptedFileTypes: string[];
  maxScore: number;
  passingScore: number;
  isRequired: boolean;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    lessonId: { type: String, required: true, trim: true },
    blockIndex: { type: Number, required: true, min: 0 },
    title: { type: String, required: true, trim: true },
    instructions: { type: String, required: true, trim: true },
    acceptedFileTypes: [{ type: String, trim: true }],
    maxScore: { type: Number, required: true, min: 1, default: 100 },
    passingScore: { type: Number, required: true, min: 0, default: 70 },
    isRequired: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

AssignmentSchema.index({ courseId: 1, lessonId: 1 }, { unique: true });
AssignmentSchema.index({ courseId: 1, blockIndex: 1 });

export default mongoose.model<IAssignment>("Assignment", AssignmentSchema);
