import express, { Express, Request, Response } from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js"; // .js extension even though it's TS
import courseRoutes from "./routes/courses.js";
import purchaseRoutes from "./routes/purchases.js";
import progressRoutes from "./routes/progress.js";



dotenv.config();

const app: Express = express();

app.use(
  cors({
    origin: "*", // For development only
    credentials: true,
  }),
);

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI as string;

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.get("/", (req: Request, res: Response) => {
  res.send("API running");
});

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/progress", progressRoutes);



app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
