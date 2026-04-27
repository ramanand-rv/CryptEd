import Course from "../models/Course.js";
import Progress, { IProgress } from "../models/Progress.js";
import User from "../models/User.js";
import { mintCourseCompletionNFT } from "./metaplex.js";
import { distributeReward } from "./reward.js";
import {
  asCourseIdString,
  hasCertificateForCourse,
} from "./certificates.js";

interface CompletionResult {
  progress: IProgress;
  completedNow: boolean;
  certificateMinted: boolean;
}

export async function ensureCourseCompletionAndCertificates(
  courseId: string,
  userId: string,
  progressInput?: IProgress | null,
): Promise<CompletionResult> {
  const progress =
    progressInput ||
    (await Progress.findOne({
      courseId,
      userId,
    }));

  if (!progress) {
    throw new Error("Progress not found");
  }

  const course = await Course.findById(courseId).populate("educatorId");
  if (!course) {
    throw new Error("Course not found");
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
  if (!learner) {
    throw new Error("User not found");
  }

  let shouldPersistLearner = false;
  let certificateMinted = false;

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
      certificateMinted = true;
    } catch (err) {
      console.error("NFT minting failed:", err);
    }
  }

  if (shouldPersistLearner) {
    await learner.save();
  }

  return {
    progress,
    completedNow: isCompletedNow,
    certificateMinted,
  };
}
