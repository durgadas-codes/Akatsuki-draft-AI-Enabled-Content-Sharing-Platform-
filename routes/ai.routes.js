import express from "express";
import { improvePost } from "../controllers/ai.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { validateObjectId } from "../middleware/validate.middleware.js";

const router = express.Router();

// Enforce JWT authentication
router.use(authMiddleware);

// AI Content Improvement endpoint
// POST /api/ai/improve/:postId or POST /ai/improve/:postId
router.post("/improve/:postId", validateObjectId("postId"), improvePost);

export default router;
