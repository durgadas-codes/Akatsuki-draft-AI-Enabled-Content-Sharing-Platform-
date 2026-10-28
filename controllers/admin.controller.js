import Post from "../models/post.model.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

/**
 * List all posts awaiting approval
 * GET /api/admin/posts/pending or GET /admin/posts/pending
 */
export const getPendingPosts = async (req, res, next) => {
  try {
    const pendingPosts = await Post.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email role");

    return sendSuccess(
      res,
      "Pending posts retrieved successfully",
      {
        count: pendingPosts.length,
        posts: pendingPosts,
      },
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Approve a pending post
 * PATCH /api/admin/posts/approve/:id or PATCH /admin/posts/approve/:id
 * Only pending posts can be approved.
 */
export const approvePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);

    if (!post) {
      return sendError(res, "Post not found", 404);
    }

    // State transition validation: only pending posts can be approved
    if (post.status !== "pending") {
      return sendError(
        res,
        `Invalid state transition: Only posts with 'pending' status can be approved. Current status is '${post.status}'.`,
        400
      );
    }

    post.status = "approved";
    await post.save();

    const updatedPost = await Post.findById(post._id).populate(
      "createdBy",
      "name email role"
    );

    return sendSuccess(
      res,
      "Post approved successfully and is now publicly visible",
      { post: updatedPost },
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Reject a pending post
 * PATCH /api/admin/posts/reject/:id or PATCH /admin/posts/reject/:id
 * Only pending posts can be rejected.
 */
export const rejectPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);

    if (!post) {
      return sendError(res, "Post not found", 404);
    }

    // State transition validation: only pending posts can be rejected
    if (post.status !== "pending") {
      return sendError(
        res,
        `Invalid state transition: Only posts with 'pending' status can be rejected. Current status is '${post.status}'.`,
        400
      );
    }

    post.status = "rejected";
    await post.save();

    const updatedPost = await Post.findById(post._id).populate(
      "createdBy",
      "name email role"
    );

    return sendSuccess(
      res,
      "Post rejected successfully",
      { post: updatedPost },
      200
    );
  } catch (error) {
    next(error);
  }
};
