import express, { Request, Response } from "express";
import auth from "../middleware/auth.js";
import Progress from "../models/Progress.js";
import Course from "../models/Course.js";
import User from "../models/User.js";
import { generateQuizQuestions } from "../services/ai.js";
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

const PASSING_SCORE = 70;
const FOLLOW_UP_THRESHOLD = 90;

type AdaptiveMode = "remedial" | "follow-up";

interface AdaptiveQuizPayload {
  mode: AdaptiveMode;
  chapterIndex: number;
  trigger: {
    latestScore: number;
    averageScore: number;
    attempts: number;
  };
  questions: any[];
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const clampScore = (score: number) => Math.min(Math.max(score, 0), 100);

const getAdaptiveMode = (latestScore: number, averageScore: number): AdaptiveMode | null => {
  if (latestScore < PASSING_SCORE) return "remedial";
  if (latestScore < FOLLOW_UP_THRESHOLD || averageScore < FOLLOW_UP_THRESHOLD) {
    return "follow-up";
  }
  return null;
};

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => String(tag).trim())
    .filter((tag) => tag.length > 0);
};

const getChapterContext = (course: any, chapterIndex: number) => {
  const chapter = Array.isArray(course?.content) ? course.content[chapterIndex] : null;
  const attrs = chapter?.attrs && typeof chapter.attrs === "object" ? chapter.attrs : {};

  const title =
    typeof attrs.title === "string" && attrs.title.trim()
      ? attrs.title.trim()
      : `Chapter ${chapterIndex + 1} - ${course.title}`;

  const description =
    typeof attrs.description === "string" && attrs.description.trim()
      ? attrs.description.trim()
      : course.description;

  const sourceQuestionPrompts = Array.isArray(attrs.questions)
    ? attrs.questions
        .map((question: any) =>
          typeof question?.question === "string" ? question.question.trim() : "",
        )
        .filter((question: string) => question.length > 0)
    : [];

  const sourceQuestionCount = Array.isArray(attrs.questions)
    ? attrs.questions.length
    : 0;

  return {
    title,
    description,
    tags: normalizeTags(attrs.tags),
    sourceQuestionPrompts,
    sourceQuestionCount,
  };
};

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
    const { chapterIndex, quizScore, isAdaptiveAttempt } = req.body;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ msg: "Unauthorized" });

    const courseId = req.params.courseId;
    const numericChapterIndex = Number.parseInt(String(chapterIndex), 10);
    const hasValidChapterIndex =
      Number.isInteger(numericChapterIndex) && numericChapterIndex >= 0;
    const rawQuizScore = toFiniteNumber(quizScore);
    const hasQuizScore = rawQuizScore !== null;
    const normalizedQuizScore = hasQuizScore ? clampScore(rawQuizScore) : null;
    const adaptiveAttempt = isAdaptiveAttempt === true;

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
      hasValidChapterIndex &&
      !progress.completedChapters.includes(numericChapterIndex)
    ) {
      progress.completedChapters.push(numericChapterIndex);
    }

    if (hasQuizScore && normalizedQuizScore !== null && hasValidChapterIndex) {
      progress.quizScores.push({
        blockIndex: numericChapterIndex,
        score: normalizedQuizScore,
        passed: normalizedQuizScore >= PASSING_SCORE,
      });
    }

    // Check if course is completed
    const course = await Course.findById(courseId).populate("educatorId");
    if (!course) return res.status(404).json({ msg: "Course not found" });

    let adaptiveQuiz: AdaptiveQuizPayload | null = null;
    if (
      hasQuizScore &&
      normalizedQuizScore !== null &&
      hasValidChapterIndex &&
      !adaptiveAttempt
    ) {
      const chapterScores = progress.quizScores
        .filter((entry) => entry.blockIndex === numericChapterIndex)
        .map((entry) => clampScore(entry.score))
        .filter((score) => Number.isFinite(score));

      const attempts = chapterScores.length;
      const latestScore =
        attempts > 0 ? chapterScores[attempts - 1] : normalizedQuizScore;
      const averageScore =
        attempts > 0
          ? chapterScores.reduce((sum, score) => sum + score, 0) / attempts
          : normalizedQuizScore;
      const mode = getAdaptiveMode(latestScore, averageScore);

      if (mode) {
        const chapterContext = getChapterContext(course, numericChapterIndex);
        const tagSet = new Set<string>(chapterContext.tags);
        tagSet.add(mode === "remedial" ? "remedial-practice" : "follow-up-practice");

        const focusLine =
          chapterContext.sourceQuestionPrompts.length > 0
            ? `Focus especially on these concepts from previous attempts: ${chapterContext.sourceQuestionPrompts
                .slice(0, 3)
                .join(" | ")}.`
            : "Focus on the key concepts for this chapter.";

        const adaptiveDescription = `${chapterContext.description}
Learner performance summary for this chapter:
- Latest score: ${latestScore.toFixed(0)}%
- Average score: ${averageScore.toFixed(0)}% across ${attempts} attempt${attempts === 1 ? "" : "s"}
Create a ${mode} quiz with concise, clear options and varied question wording.
${focusLine}`;

        const targetQuestionCount = Math.min(
          Math.max(chapterContext.sourceQuestionCount || 5, 3),
          8,
        );

        try {
          const questions = await generateQuizQuestions(
            chapterContext.title,
            adaptiveDescription,
            Array.from(tagSet),
            targetQuestionCount,
          );

          adaptiveQuiz = {
            mode,
            chapterIndex: numericChapterIndex,
            trigger: {
              latestScore: Number(latestScore.toFixed(2)),
              averageScore: Number(averageScore.toFixed(2)),
              attempts,
            },
            questions,
          };
        } catch (err) {
          console.error("Adaptive quiz generation failed:", err);
        }
      }
    }

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

    const payload = progress.toObject();
    res.json(adaptiveQuiz ? { ...payload, adaptiveQuiz } : payload);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
