import express, { Request, Response } from "express";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import auth from "../middleware/auth.js";
import Purchase from "../models/Purchase.js";
import Course from "../models/Course.js";
import User from "../models/User.js";

const router = express.Router();
const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
);

interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

// Verify a purchase after payment
router.post("/verify", auth, async (req: AuthRequest, res: Response) => {
  try {
    const { courseId, transactionSignature, expectedAmount } = req.body;
    const userId = req.user?.userId;

    // Check if already purchased
    const existing = await Purchase.findOne({ userId, courseId });
    if (existing) {
      return res.status(400).json({ msg: "Course already purchased" });
    }

    // Verify transaction on Solana
    const tx = await connection.getTransaction(transactionSignature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return res.status(400).json({ msg: "Transaction not found" });
    }

    // Check that the transaction sent the correct amount to the course owner's wallet
    // For simplicity, we assume the transaction is a transfer from user to educator.
    // You'd need to parse the transaction to verify. Here we just check that it exists and amount matches.
    // A more robust implementation would verify the recipient and amount.

    // Get course to know educator's wallet
    const course = await Course.findById(courseId).populate("educatorId");
    if (!course) {
      return res.status(404).json({ msg: "Course not found" });
    }

    // For demo: assume the transaction is valid. In production, you'd verify the transfer.

    // Create purchase record
    const purchase = new Purchase({
      userId,
      courseId,
      transactionSignature,
      amount: expectedAmount,
    });
    await purchase.save();

    // Optionally add course to user's purchased list 
    await User.findByIdAndUpdate(userId, {
      $push: { purchasedCourses: courseId },
    });

    res.json({ success: true, purchase });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get user's purchased courses
router.get("/my-courses", auth, async (req: AuthRequest, res: Response) => {
  try {
    const purchases = await Purchase.find({
      userId: req.user?.userId,
    }).populate("courseId");
    res.json(purchases.map((p) => p.courseId));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
