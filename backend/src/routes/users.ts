import express from "express";
import auth from "../middleware/auth.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

const router = express.Router();

const toSafeUser = (user: any) => ({
  id: user._id,
  email: user.email,
  name: user.name,
  about: user.about,
  role: user.role,
  walletAddress: user.walletAddress,
});

router.get("/me", auth, async (req: any, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(toSafeUser(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/me", auth, async (req: any, res) => {
  try {
    const { name, walletAddress, about } = req.body;
    const updates: Record<string, any> = {};

    if (name !== undefined) updates.name = name;
    if (walletAddress !== undefined) updates.walletAddress = walletAddress;
    if (about !== undefined) updates.about = about;

    const user = await User.findByIdAndUpdate(req.user.userId, updates, {
      new: true,
      select: "-password",
    });

    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(toSafeUser(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/me/password", auth, async (req: any, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ msg: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({ msg: "Current password is required" });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: "Current password is incorrect" });
      }
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
