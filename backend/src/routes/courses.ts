import express, { Request, Response } from "express";
import auth from "../middleware/auth.js";
import Course, { ICourse } from "../models/Course.js";
import User from "../models/User.js";
import { generateQuizQuestions } from "../services/ai.js";

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

// Get all courses (public)
router.get("/", async (req: Request, res: Response) => {
  try {
    const courses = await Course.find().populate("educatorId", "name email");
    res.json(courses);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single course by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const course = await Course.findById(req.params.id).populate(
      "educatorId",
      "name email",
    );
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

export default router;
