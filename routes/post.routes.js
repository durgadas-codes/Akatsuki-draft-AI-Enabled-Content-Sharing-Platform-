import express from "express";
import {
  createPost,
  getApprovedPosts,
  getPostById,
  getMyPosts,
  updatePost,
  deletePost,
} from "../controllers/post.controller.js";
import { authMiddleware, optionalAuth } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";
import { validateObjectId } from "../middleware/validate.middleware.js";

const router = express.Router();

// 1. Create a post or draft (Authenticated, optional image upload)
router.post("/", authMiddleware, upload.single("image"), createPost);

// 2. View all approved public posts (Public)
router.get("/", getApprovedPosts);

// 3. View user's own posts and drafts (Authenticated)
// NOTE: MUST be defined BEFORE /:id to prevent route collision
router.get("/my-posts", authMiddleware, getMyPosts);

// 4. View post by ID (Public for approved, owner/admin for unapproved)
router.get("/:id", optionalAuth, validateObjectId("id"), getPostById);

// 5. Update owner's post (Authenticated, optional image upload)
router.patch("/:id", authMiddleware, validateObjectId("id"), upload.single("image"), updatePost);

// 6. Delete owner's post (Authenticated)
router.delete("/:id", authMiddleware, validateObjectId("id"), deletePost);

export default router;
