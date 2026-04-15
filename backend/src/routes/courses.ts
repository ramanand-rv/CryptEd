import express, { Request, Response } from "express";
import auth from "../middleware/auth.js";
import Course, { ICourse } from "../models/Course.js";
import User from "../models/User.js";
import { generateQuizQuestions } from "../services/ai.js";
import Purchase from "../models/Purchase.js";
import LessonDiscussion from "../models/LessonDiscussion.js";

const router = express.Router();

// Extend Request to include user from auth middleware
interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

interface LessonBlock {
  type?: string;
  attrs?: {
    lessonId?: string;
  };
}

const getConnectedWalletAddress = (req: AuthRequest) => {
  const raw = req.header("x-wallet-address");
  return typeof raw === "string" ? raw.trim() : "";
};

const ensureWalletConnectedAndVerified = async (
  req: AuthRequest,
  res: Response,
) => {
  const educator = await User.findById(req.user?.userId);
  if (!educator?.walletAddress || !educator.walletVerifiedAt) {
    res.status(400).json({
      msg: "Verify your wallet before creating or publishing courses.",
    });
    return null;
  }

  const connectedWallet = getConnectedWalletAddress(req);
  if (!connectedWallet) {
    res.status(400).json({
      msg: "Connect your verified wallet before creating or publishing courses.",
    });
    return null;
  }

  if (connectedWallet !== educator.walletAddress) {
    res.status(400).json({
      msg: "Connected wallet must match your verified wallet.",
    });
    return null;
  }

  return educator;
};

const getLessonIds = (course: ICourse) => {
  const blocks = Array.isArray(course.content)
    ? (course.content as LessonBlock[])
    : [];

  return blocks
    .filter((block) => block?.type === "lesson")
    .map((block) => block?.attrs?.lessonId?.trim() || "")
    .filter((lessonId) => lessonId.length > 0);
};

const isValidLessonForCourse = (course: ICourse, lessonId: string) => {
  const normalizedLessonId = lessonId.trim();
  if (!normalizedLessonId) return false;

  const lessonIds = getLessonIds(course);
  if (lessonIds.length > 0) {
    return lessonIds.includes(normalizedLessonId);
  }

  const match = /^chapter-(\d+)$/.exec(normalizedLessonId);
  if (!match) return false;
  const chapterIndex = Number.parseInt(match[1], 10);
  if (!Number.isInteger(chapterIndex) || chapterIndex < 0) return false;
  return chapterIndex < (course.content?.length || 0);
};

const canAccessLessonDiscussions = async (req: AuthRequest, course: ICourse) => {
  const userId = req.user?.userId;
  const role = req.user?.role;

  if (!userId || !role) {
    return { allowed: false, status: 401, msg: "Unauthorized" };
  }

  if (role === "educator") {
    const isOwner = String(course.educatorId) === userId;
    if (!isOwner) {
      return { allowed: false, status: 403, msg: "Not authorized" };
    }
    return { allowed: true, status: 200 };
  }

  if (role !== "learner") {
    return { allowed: false, status: 403, msg: "Not authorized" };
  }

  if (course.status !== "published") {
    return {
      allowed: false,
      status: 403,
      msg: "Course discussions are available after publishing.",
    };
  }

  if ((course.price || 0) <= 0) {
    return { allowed: true, status: 200 };
  }

  const hasPurchased = await Purchase.exists({
    userId,
    courseId: course._id,
  });
  if (!hasPurchased) {
    return {
      allowed: false,
      status: 403,
      msg: "Purchase required to join lesson discussions.",
    };
  }

  return { allowed: true, status: 200 };
};

const toDiscussionResponse = (discussion: any) => ({
  _id: discussion._id,
  courseId: discussion.courseId,
  lessonId: discussion.lessonId,
  question: discussion.question,
  status: discussion.status,
  askedBy: {
    id: discussion.askedById,
    name: discussion.askedByName,
    role: discussion.askedByRole,
  },
  replies: (discussion.replies || []).map((reply: any) => ({
    _id: reply._id,
    message: reply.message,
    author: {
      id: reply.authorId,
      name: reply.authorName,
      role: reply.authorRole,
    },
    createdAt: reply.createdAt,
    updatedAt: reply.updatedAt,
  })),
  createdAt: discussion.createdAt,
  updatedAt: discussion.updatedAt,
});

// Create a course (educator only)
router.post("/", auth, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "educator") {
      return res.status(403).json({ msg: "Only educators can create courses" });
    }

    const walletReady = await ensureWalletConnectedAndVerified(req, res);
    if (!walletReady) return;

    const {
      title,
      description,
      price,
      content,
      nftMetadataUri,
      rewardPool,
      status,
    } = req.body;

    const course = new Course({
      title,
      description,
      educatorId: req.user.userId,
      price,
      content,
      nftMetadataUri,
      status: status === "published" ? "published" : "draft",
      rewardPool: rewardPool
        ? {
            totalAmount: rewardPool.totalAmount,
            remaining: rewardPool.totalAmount, // initially same as total
            winnersCount: rewardPool.winnersCount,
            winners: [],
          }
        : undefined,
    });

    await course.save();
    res.status(201).json(course);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Metrics overview for educator dashboard
router.get("/metrics/overview", auth, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "educator") {
      return res.status(403).json({ msg: "Only educators can view metrics" });
    }

    const courses = await Course.find({ educatorId: req.user.userId });
    const courseIds = courses.map((course) => course._id);

    const purchases = await Purchase.find({ courseId: { $in: courseIds } });

    const totalRevenue = purchases.reduce((sum, p) => sum + p.amount, 0);
    const totalSales = purchases.length;
    const totalViews = courses.reduce((sum, c) => sum + (c.views || 0), 0);

    const now = new Date();
    const months = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleString("default", { month: "short" }),
      };
    });

    const salesByMonth = months.map((month) => ({
      label: month.label,
      value: 0,
    }));

    purchases.forEach((purchase) => {
      const date = new Date(purchase.purchasedAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const index = months.findIndex((m) => m.key === key);
      if (index >= 0) {
        salesByMonth[index].value += 1;
      }
    });

    const viewWeights = [1, 2, 3, 4, 5, 6];
    const weightSum = viewWeights.reduce((sum, v) => sum + v, 0);
    const viewsByMonth = months.map((month, index) => ({
      label: month.label,
      value: totalViews
        ? Math.round((totalViews * viewWeights[index]) / weightSum)
        : 0,
    }));

    res.json({
      totals: {
        courses: courses.length,
        sales: totalSales,
        revenue: totalRevenue,
        views: totalViews,
      },
      salesByMonth,
      viewsByMonth,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get all courses (public)
router.get("/", async (req: Request, res: Response) => {
  try {
    const courses = await Course.find({
      $or: [{ status: "published" }, { status: { $exists: false } }],
    }).populate("educatorId", "name email");
    res.json(courses);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get educator courses (including drafts)
router.get("/educator", auth, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "educator") {
      return res.status(403).json({ msg: "Only educators can view courses" });
    }

    const courses = await Course.find({
      educatorId: req.user.userId,
    }).populate("educatorId", "name email");
    res.json(courses);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/generate-quiz", auth, async (req: AuthRequest, res: Response) => {
  try {
    const { title, topic, description, tags, numQuestions } = req.body;
    const quizTopic = topic || title;
    if (!quizTopic || !description) {
      return res
        .status(400)
        .json({ msg: "Topic and description are required" });
    }
    const parsedCount =
      typeof numQuestions === "number"
        ? numQuestions
        : Number.parseInt(numQuestions || "5", 10);
    const safeCount = Number.isFinite(parsedCount) ? parsedCount : 5;
    const count = Math.min(Math.max(safeCount, 1), 20);

    const tagList = Array.isArray(tags)
      ? tags
      : typeof tags === "string"
        ? tags.split(",")
        : [];
    const normalizedTags = tagList
      .map((tag: any) => String(tag).trim())
      .filter((tag: string) => tag.length > 0);

    const questions = await generateQuizQuestions(
      quizTopic,
      description,
      normalizedTags,
      count,
    );
    res.json({ questions });
  } catch (err: any) {
    if (err?.message === "GEMINI_API_KEY is not configured") {
      return res.status(500).json({ msg: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// Get lesson discussions
router.get(
  "/:id/lessons/:lessonId/discussions",
  auth,
  async (req: AuthRequest, res: Response) => {
    try {
      const lessonId = String(req.params.lessonId || "").trim();
      if (!lessonId) {
        return res.status(400).json({ msg: "Lesson ID is required" });
      }

      const course = await Course.findById(req.params.id);
      if (!course) return res.status(404).json({ msg: "Course not found" });

      if (!isValidLessonForCourse(course, lessonId)) {
        return res.status(404).json({ msg: "Lesson not found" });
      }

      const access = await canAccessLessonDiscussions(req, course);
      if (!access.allowed) {
        return res.status(access.status).json({ msg: access.msg });
      }

      const discussions = await LessonDiscussion.find({
        courseId: course._id,
        lessonId,
      }).sort({ createdAt: -1 });

      res.json({
        discussions: discussions.map((discussion) =>
          toDiscussionResponse(discussion),
        ),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Create a learner question in lesson discussion
router.post(
  "/:id/lessons/:lessonId/discussions",
  auth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.user?.role !== "learner") {
        return res
          .status(403)
          .json({ msg: "Only learners can post lesson questions" });
      }

      const lessonId = String(req.params.lessonId || "").trim();
      const question = String(req.body?.question || "").trim();

      if (!lessonId) {
        return res.status(400).json({ msg: "Lesson ID is required" });
      }
      if (!question) {
        return res.status(400).json({ msg: "Question is required" });
      }
      if (question.length > 1200) {
        return res
          .status(400)
          .json({ msg: "Question must be 1200 characters or fewer" });
      }

      const course = await Course.findById(req.params.id);
      if (!course) return res.status(404).json({ msg: "Course not found" });

      if (!isValidLessonForCourse(course, lessonId)) {
        return res.status(404).json({ msg: "Lesson not found" });
      }

      const access = await canAccessLessonDiscussions(req, course);
      if (!access.allowed) {
        return res.status(access.status).json({ msg: access.msg });
      }

      const user = await User.findById(req.user.userId).select("name role");
      const discussion = new LessonDiscussion({
        courseId: course._id,
        lessonId,
        question,
        askedById: req.user.userId,
        askedByName: user?.name?.trim() || "Learner",
        askedByRole: req.user.role,
        status: "open",
        replies: [],
      });

      await discussion.save();

      res.status(201).json({
        discussion: toDiscussionResponse(discussion),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Reply to a lesson discussion (educator owner only)
router.post(
  "/:id/lessons/:lessonId/discussions/:discussionId/replies",
  auth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.user?.role !== "educator") {
        return res
          .status(403)
          .json({ msg: "Only educators can reply to lesson questions" });
      }

      const lessonId = String(req.params.lessonId || "").trim();
      const discussionId = String(req.params.discussionId || "").trim();
      const message = String(req.body?.message || "").trim();

      if (!lessonId) {
        return res.status(400).json({ msg: "Lesson ID is required" });
      }
      if (!discussionId) {
        return res.status(400).json({ msg: "Discussion ID is required" });
      }
      if (!message) {
        return res.status(400).json({ msg: "Reply message is required" });
      }
      if (message.length > 1200) {
        return res
          .status(400)
          .json({ msg: "Reply must be 1200 characters or fewer" });
      }

      const course = await Course.findById(req.params.id);
      if (!course) return res.status(404).json({ msg: "Course not found" });

      if (String(course.educatorId) !== req.user.userId) {
        return res.status(403).json({ msg: "Not authorized" });
      }

      if (!isValidLessonForCourse(course, lessonId)) {
        return res.status(404).json({ msg: "Lesson not found" });
      }

      const discussion = await LessonDiscussion.findOne({
        _id: discussionId,
        courseId: course._id,
        lessonId,
      });
      if (!discussion) {
        return res.status(404).json({ msg: "Discussion thread not found" });
      }

      const user = await User.findById(req.user.userId).select("name role");

      discussion.replies.push({
        message,
        authorId: req.user.userId as any,
        authorName: user?.name?.trim() || "Educator",
        authorRole: "educator",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      discussion.status = "open";
      await discussion.save();

      res.status(201).json({
        discussion: toDiscussionResponse(discussion),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Course metrics (educator owner only)
router.get("/:id/metrics", auth, async (req: AuthRequest, res: Response) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ msg: "Course not found" });

    if (course.educatorId.toString() !== req.user?.userId) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    const purchases = await Purchase.find({ courseId: course._id });
    const revenue = purchases.reduce((sum, p) => sum + p.amount, 0);
    const sales = purchases.length;

    const ratings = course.reviews?.map((review) => review.rating) || [];
    const avgRating = ratings.length
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : 0;

    res.json({
      course: {
        id: course._id,
        title: course.title,
        description: course.description,
        price: course.price,
        status: course.status,
      },
      metrics: {
        views: course.views || 0,
        sales,
        revenue,
        reviewsCount: ratings.length,
        avgRating,
      },
      reviews: course.reviews || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single course by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true },
    ).populate("educatorId", "name email");
    if (!course) return res.status(404).json({ msg: "Course not found" });
    res.json(course);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update a course (educator owner only)
router.put("/:id", auth, async (req: AuthRequest, res: Response) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ msg: "Course not found" });

    // Check if the user is the educator who created it
    if (course.educatorId.toString() !== req.user?.userId) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    const {
      title,
      description,
      price,
      content,
      nftMetadataUri,
      rewardPool,
      status,
    } = req.body;

    const requestedStatus = status === "published" ? "published" : "draft";
    const isPublishingDraft =
      course.status !== "published" && requestedStatus === "published";
    let educator: any = null;
    if (isPublishingDraft) {
      educator = await ensureWalletConnectedAndVerified(req, res);
      if (!educator) return;
    }

    const requiresVerifiedWallet =
      Boolean(nftMetadataUri) || Boolean(rewardPool);
    if (requiresVerifiedWallet) {
      educator = educator || (await User.findById(req.user?.userId));
      if (!educator?.walletVerifiedAt) {
        return res.status(400).json({
          msg: "Verify your wallet before enabling NFT rewards.",
        });
      }
    }

    course.title = title || course.title;
    course.description = description || course.description;
    course.price = price !== undefined ? price : course.price;
    course.content = content || course.content;
    course.nftMetadataUri = nftMetadataUri || course.nftMetadataUri;
    if (status === "draft" || status === "published") {
      course.status = status;
    }
    if (rewardPool) {
      course.rewardPool = {
        totalAmount: rewardPool.totalAmount,
        remaining: rewardPool.totalAmount,
        winnersCount: rewardPool.winnersCount,
        winners: course.rewardPool?.winners || [],
      };
    }

    await course.save();
    res.json(course);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a course (educator owner only)
router.delete("/:id", auth, async (req: AuthRequest, res: Response) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ msg: "Course not found" });

    if (course.educatorId.toString() !== req.user?.userId) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    await course.deleteOne();
    res.json({ msg: "Course removed" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add a review to a course
router.post("/:id/reviews", auth, async (req: AuthRequest, res: Response) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ msg: "Rating must be between 1 and 5" });
    }

    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ msg: "Course not found" });

    const user = await User.findById(req.user?.userId);
    course.reviews = course.reviews || [];
    course.reviews.push({
      userId: user?._id,
      name: user?.name || "Anonymous",
      rating,
      comment,
      createdAt: new Date(),
    });

    await course.save();
    res.json({ success: true, reviews: course.reviews });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
