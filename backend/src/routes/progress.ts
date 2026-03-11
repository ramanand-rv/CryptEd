import express, { Request, Response } from "express";
import auth from "../middleware/auth.js";
import Progress from "../models/Progress.js";
import Course from "../models/Course.js";
import User from "../models/User.js";
import { mintCourseCompletionNFT } from "../services/metaplex.js";
import { distributeReward } from "../services/reward.js";

const router = express.Router();

interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

// Get progress for a specific course
router.get("/:courseId", auth, async (req: AuthRequest, res: Response) => {
  try {
    const progress = await Progress.findOne({
      userId: req.user?.userId,
      courseId: req.params.courseId,
    });
    res.json(progress || { completedChapters: [], quizScores: [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:courseId", auth, async (req: AuthRequest, res: Response) => {
  try {
    const { chapterIndex, quizScore } = req.body;
    const userId = req.user?.userId;
    const courseId = req.params.courseId;

    let progress = await Progress.findOne({ userId, courseId });
    if (!progress) {
      progress = new Progress({
        userId,
        courseId,
        completedChapters: [],
        quizScores: {},
      });
    }

    if (
      chapterIndex !== undefined &&
      !progress.completedChapters.includes(chapterIndex)
    ) {
      progress.completedChapters.push(chapterIndex);
    }

    if (quizScore !== undefined) {
      progress.quizScores.push({
        blockIndex: chapterIndex,
        score: quizScore,
        passed: quizScore >= 70, // Assuming 70 is passing grade
      });
    }

    // Check if course is completed
    const course = await Course.findById(courseId).populate("educatorId");
    if (!course) return res.status(404).json({ msg: "Course not found" });

    const totalChapters = course.content.length;
    const isCompleted =
      progress.completedChapters.length >= totalChapters &&
      !progress.completedAt;

    if (isCompleted) {
      progress.completedAt = new Date();

      // Mint NFT if metadata URI exists
      if (course.nftMetadataUri) {
        try {
          // Get learner's wallet address (assuming user has walletAddress field)
          const user = await User.findById(userId);
          if (user?.walletAddress) {
            const mintAddress = await mintCourseCompletionNFT(
              user.walletAddress,
              course.nftMetadataUri,
              course.title,
            );
            // Store mint address in user's ownedNFTs
            await User.findByIdAndUpdate(userId, {
              $push: { ownedNFTs: mintAddress },
            });
          }
        } catch (err) {
          console.error("NFT minting failed:", err);
          // Don't fail the whole request, just log error
        }
      }
      if (userId) {
        await distributeReward(courseId, userId);
      }
    }

    await progress.save();
    res.json(progress);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
