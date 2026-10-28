import express from "express";
import {
  getPendingPosts,
  approvePost,
  rejectPost,
} from "../controllers/admin.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { adminMiddleware } from "../middleware/admin.middleware.js";
import { validateObjectId } from "../middleware/validate.middleware.js";

const router = express.Router();

// Enforce both JWT authentication and Admin role for all routes in this router
router.use(authMiddleware);
router.use(adminMiddleware);

// 1. List posts awaiting approval
router.get("/posts/pending", getPendingPosts);

// 2. Approve a pending post
router.patch("/posts/approve/:id", validateObjectId("id"), approvePost);

// 3. Reject a pending post
router.patch("/posts/reject/:id", validateObjectId("id"), rejectPost);

export default router;
