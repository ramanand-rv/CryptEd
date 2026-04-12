import express, { Request, Response } from "express";
import auth from "../middleware/auth.js";
import Progress from "../models/Progress.js";
import Course from "../models/Course.js";
import User from "../models/User.js";
import { mintCourseCompletionNFT } from "../services/metaplex.js";
import { distributeReward } from "../services/reward.js";
import {
  asCourseIdString,
  hasCertificateForCourse,
} from "../services/certificates.js";

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
    if (!userId) return res.status(401).json({ msg: "Unauthorized" });

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
    const educatorId = course.educatorId
      ? String((course.educatorId as any)?._id ?? course.educatorId)
      : undefined;
    const educator = educatorId ? await User.findById(educatorId) : null;
    const educatorWalletVerified = Boolean(educator?.walletVerifiedAt);

    const totalChapters = course.content.length || 0;
    const isCompletedNow =
      totalChapters > 0 &&
      progress.completedChapters.length >= totalChapters &&
      !progress.completedAt;

    const learner = await User.findById(userId);
    if (!learner) return res.status(404).json({ msg: "User not found" });

    let shouldPersistLearner = false;

    if (isCompletedNow) {
      progress.completedAt = new Date();
      const existingCompletion = learner.completedCourses.some(
        (entry) => entry.courseId?.toString() === asCourseIdString(course._id),
      );
      if (!existingCompletion) {
        learner.completedCourses.push({
          courseId: course._id,
          completedAt: progress.completedAt,
        });
        shouldPersistLearner = true;
      }

      if (educatorWalletVerified) {
        await distributeReward(courseId, userId);
      }
    }

    const hasCourseCompletion = learner.completedCourses.some(
      (entry) => entry.courseId?.toString() === asCourseIdString(course._id),
    );
    const alreadyMintedForCourse = hasCertificateForCourse(
      learner.ownedNFTs as unknown[],
      course._id,
    );
    const canMintCertificate =
      hasCourseCompletion &&
      !alreadyMintedForCourse &&
      Boolean(learner.walletAddress) &&
      Boolean(course.nftMetadataUri) &&
      educatorWalletVerified;

    if (canMintCertificate) {
      try {
        const mintAddress = await mintCourseCompletionNFT(
          learner.walletAddress!,
          course.nftMetadataUri!,
          course.title,
        );
        learner.ownedNFTs.push({
          mintAddress,
          courseId: course._id,
          courseTitle: course.title,
          metadataUri: course.nftMetadataUri,
          mintedAt: new Date(),
        });
        shouldPersistLearner = true;
      } catch (err) {
        console.error("NFT minting failed:", err);
      }
    }

    if (shouldPersistLearner) {
      await learner.save();
    }
    await progress.save();
    res.json(progress);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
