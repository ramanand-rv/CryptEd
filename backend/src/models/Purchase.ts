import mongoose, { Schema, Document } from "mongoose";

export interface IPurchase extends Document {
  userId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  transactionSignature: string;
  amount: number;
  purchasedAt: Date;
}

const PurchaseSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
  transactionSignature: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  purchasedAt: { type: Date, default: Date.now },
});

export default mongoose.model<IPurchase>("Purchase", PurchaseSchema);
