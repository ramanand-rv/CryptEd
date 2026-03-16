import express, { Request, Response } from "express";
import auth from "../middleware/auth.js";
import Course, { ICourse } from "../models/Course.js";
import User from "../models/User.js";
import { generateQuizQuestions } from "../services/ai.js";
import Purchase from "../models/Purchase.js";

const router = express.Router();

// Extend Request to include user from auth middleware
interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

// Create a course (educator only)
router.post("/", auth, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== "educator") {
      return res.status(403).json({ msg: "Only educators can create courses" });
    }

    const { title, description, price, content, nftMetadataUri, rewardPool } =
      req.body;

    const course = new Course({
      title,
      description,
      educatorId: req.user.userId,
      price,
      content,
      nftMetadataUri,
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
    const courses = await Course.find().populate("educatorId", "name email");
    res.json(courses);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/generate-quiz", auth, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, numQuestions } = req.body;
    if (!title || !description) {
      return res
        .status(400)
        .json({ msg: "Title and description are required" });
    }
    const questions = await generateQuizQuestions(
      title,
      description,
      numQuestions || 5,
    );
    res.json({ questions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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

    const { title, description, price, content, nftMetadataUri, rewardPool } =
      req.body;

    course.title = title || course.title;
    course.description = description || course.description;
    course.price = price !== undefined ? price : course.price;
    course.content = content || course.content;
    course.nftMetadataUri = nftMetadataUri || course.nftMetadataUri;
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
