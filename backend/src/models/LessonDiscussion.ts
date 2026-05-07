import mongoose, { Document, Schema } from "mongoose";

export interface ILessonDiscussionReply {
  message: string;
  authorId: mongoose.Types.ObjectId;
  authorName: string;
  authorRole: "educator" | "learner";
  createdAt: Date;
  updatedAt: Date;
}

export interface ILessonDiscussion extends Document {
  courseId: mongoose.Types.ObjectId;
  lessonId: string;
  question: string;
  askedById: mongoose.Types.ObjectId;
  askedByName: string;
  askedByRole: "educator" | "learner";
  status: "open" | "resolved";
  replies: ILessonDiscussionReply[];
  createdAt: Date;
  updatedAt: Date;
}

const LessonDiscussionReplySchema = new Schema<ILessonDiscussionReply>(
  {
    message: { type: String, required: true, trim: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true, trim: true },
    authorRole: {
      type: String,
      enum: ["educator", "learner"],
      required: true,
    },
  },
  { timestamps: true },
);

const LessonDiscussionSchema = new Schema<ILessonDiscussion>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    lessonId: { type: String, required: true, trim: true },
    question: { type: String, required: true, trim: true },
    askedById: { type: Schema.Types.ObjectId, ref: "User", required: true },
    askedByName: { type: String, required: true, trim: true },
    askedByRole: {
      type: String,
      enum: ["educator", "learner"],
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
      required: true,
    },
    replies: { type: [LessonDiscussionReplySchema], default: [] },
  },
  { timestamps: true },
);

LessonDiscussionSchema.index({ courseId: 1, lessonId: 1, createdAt: -1 });
LessonDiscussionSchema.index({ courseId: 1, lessonId: 1, status: 1 });

export default mongoose.model<ILessonDiscussion>(
  "LessonDiscussion",
  LessonDiscussionSchema,
);
