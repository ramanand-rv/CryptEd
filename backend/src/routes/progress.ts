import express, { Request, Response } from "express";
import auth from "../middleware/auth.js";
import Progress from "../models/Progress.js";
import Course from "../models/Course.js";
import User from "../models/User.js";

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

// Update progress (mark chapter completed, record quiz result)
router.post("/:courseId", auth, async (req: AuthRequest, res: Response) => {
  try {
    const { completedChapters, quizResult } = req.body; // quizResult: { blockIndex, score, passed }
    const userId = req.user?.userId;
    const courseId = req.params.courseId;

    let progress = await Progress.findOne({ userId, courseId });

    if (!progress) {
      progress = new Progress({
        userId,
        courseId,
        completedChapters: [],
        quizScores: [],
      });
    }

    if (completedChapters) {
      // Merge unique chapter indices
      const newChapters = completedChapters.filter(
        (idx: number) => !progress!.completedChapters.includes(idx),
      );
      progress.completedChapters.push(...newChapters);
    }

    if (quizResult) {
      // Check if already have a score for this block, update or add
      const existingIndex = progress.quizScores.findIndex(
        (q) => q.blockIndex === quizResult.blockIndex,
      );
      if (existingIndex >= 0) {
        progress.quizScores[existingIndex] = quizResult;
      } else {
        progress.quizScores.push(quizResult);
      }
    }

    // Check if all chapters are completed (we need total chapters count)
    const course = await Course.findById(courseId);
    if (course) {
      const totalChapters = course.content.length; // assuming each block is a chapter
      if (
        progress.completedChapters.length >= totalChapters &&
        !progress.completedAt
      ) {
        progress.completedAt = new Date();
        // Here you could trigger NFT minting (Day 6)
      }
    }

    progress.lastAccessedAt = new Date();
    await progress.save();
    res.json(progress);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
