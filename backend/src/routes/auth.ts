import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User.js";

const router = express.Router();

// Register educator
router.post("/register/educator", async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({
      email,
      password: hashedPassword,
      name,
      role: "educator",
    });
    await user.save();

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET as string,
    );
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        about: user.about,
        website: user.website,
        linkedin: user.linkedin,
        twitter: user.twitter,
        role: user.role,
        walletAddress: user.walletAddress,
        walletVerifiedAt: user.walletVerifiedAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Login educator
router.post("/login/educator", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, role: "educator" });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password!);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET as string,
    );
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        about: user.about,
        website: user.website,
        linkedin: user.linkedin,
        twitter: user.twitter,
        role: user.role,
        walletAddress: user.walletAddress,
        walletVerifiedAt: user.walletVerifiedAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Wallet login for learners
router.post("/login/wallet", async (req: Request, res: Response) => {
  try {
    const { walletAddress, name } = req.body;
    let user = await User.findOne({ walletAddress, role: "learner" });
    if (!user) {
      user = new User({
        walletAddress,
        name: name || "Learner",
        role: "learner",
      });
      await user.save();
    }
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET as string,
    );
    res.json({
      token,
      user: {
        id: user._id,
        walletAddress: user.walletAddress,
        name: user.name,
        about: user.about,
        website: user.website,
        linkedin: user.linkedin,
        twitter: user.twitter,
        role: user.role,
        walletVerifiedAt: user.walletVerifiedAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
