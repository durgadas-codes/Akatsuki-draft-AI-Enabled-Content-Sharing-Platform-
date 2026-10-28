import mongoose from "mongoose";
import Post from "../models/post.model.js";
import { uploadImageToCloudinary } from "../services/cloudinary.service.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

/**
 * Create a new post or draft
 * POST /api/posts or POST /posts
 * Supports optional image upload via Multer (multipart/form-data) or text-only (application/json)
 */
export const createPost = async (req, res, next) => {
  try {
    const { title, description, content, category, status } = req.body;

    if (!title || !description || !content) {
      return sendError(
        res,
        "Title, description, and content are required fields",
        400
      );
    }

    // Determine initial status: allowed values for users are "draft" or "pending"
    let postStatus = "draft";
    if (status) {
      if (status === "pending" || status === "draft") {
        postStatus = status;
      } else if (status === "approved" || status === "rejected") {
        if (req.user.role !== "admin") {
          return sendError(
            res,
            "Only administrators can set post status to approved or rejected",
            403
          );
        }
        postStatus = status;
      } else {
        return sendError(
          res,
          `Invalid status '${status}'. Must be 'draft' or 'pending'`,
          400
        );
      }
    }

    // Handle optional image upload
    let imageUrl = req.body.image || null;
    if (req.file && req.file.buffer) {
      try {
        imageUrl = await uploadImageToCloudinary(req.file.buffer);
      } catch (uploadError) {
        return sendError(res, uploadError.message, 500);
      }
    }

    const post = await Post.create({
      title: title.trim(),
      description: description.trim(),
      content: content.trim(),
      category: category ? category.trim() : "General",
      image: imageUrl,
      createdBy: req.user._id,
      status: postStatus,
    });

    const populatedPost = await Post.findById(post._id).populate(
      "createdBy",
      "name email role"
    );

    return sendSuccess(
      res,
      postStatus === "pending"
        ? "Post submitted for admin approval"
        : "Draft created successfully",
      { post: populatedPost },
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all public approved posts
 * GET /api/posts or GET /posts
 * Only returns posts with status: "approved"
 */
export const getApprovedPosts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = { status: "approved" };

    if (req.query.category && req.query.category.trim() !== "") {
      filter.category = new RegExp(`^${req.query.category.trim()}$`, "i");
    }

    if (req.query.search && req.query.search.trim() !== "") {
      const searchRegex = new RegExp(req.query.search.trim(), "i");
      filter.$or = [{ title: searchRegex }, { description: searchRegex }];
    }

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name email role"),
      Post.countDocuments(filter),
    ]);

    return sendSuccess(
      res,
      "Approved posts retrieved successfully",
      {
        posts,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get single post by ID
 * GET /api/posts/:id or GET /posts/:id
 * Public can only view approved posts.
 * Owners and admins can view their own drafts/pending/rejected posts.
 */
export const getPostById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id).populate("createdBy", "name email role");
    if (!post) {
      return sendError(res, "Post not found", 404);
    }

    // If approved, publicly accessible
    if (post.status === "approved") {
      return sendSuccess(res, "Post retrieved successfully", { post }, 200);
    }

    // If unapproved, only author or admin can view
    const currentUserId = req.user?._id?.toString();
    const authorId = post.createdBy?._id?.toString() || post.createdBy?.toString();
    const isAdmin = req.user?.role === "admin";

    if (currentUserId && (currentUserId === authorId || isAdmin)) {
      return sendSuccess(res, "Post retrieved successfully", { post }, 200);
    }

    // Hidden from public view
    return sendError(
      res,
      "Post not found or is not currently approved for public viewing",
      404
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get logged-in user's own posts and drafts
 * GET /api/posts/my-posts or GET /posts/my-posts
 */
export const getMyPosts = async (req, res, next) => {
  try {
    const filter = { createdBy: req.user._id };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email role");

    return sendSuccess(
      res,
      "User posts retrieved successfully",
      {
        count: posts.length,
        posts,
      },
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update only the owner's post
 * PATCH /api/posts/:id or PATCH /posts/:id
 */
export const updatePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);

    if (!post) {
      return sendError(res, "Post not found", 404);
    }

    // Ownership check: only owner may edit
    if (post.createdBy.toString() !== req.user._id.toString()) {
      return sendError(
        res,
        "Access denied: You are not authorized to update another user's post",
        403
      );
    }

    const { title, description, content, category, status } = req.body;

    if (title !== undefined) post.title = String(title).trim();
    if (description !== undefined) post.description = String(description).trim();
    if (content !== undefined) post.content = String(content).trim();
    if (category !== undefined) post.category = String(category).trim();

    // Status transitions
    if (status !== undefined) {
      if (status === "draft" || status === "pending") {
        post.status = status;
      } else if (status === "approved" || status === "rejected") {
        if (req.user.role !== "admin") {
          return sendError(
            res,
            "Access denied: Users cannot approve or reject posts. Submit as 'pending' for review.",
            403
          );
        }
        post.status = status;
      } else {
        return sendError(
          res,
          `Invalid status '${status}'. Must be 'draft' or 'pending'`,
          400
        );
      }
    }

    // Optional image update
    if (req.file && req.file.buffer) {
      try {
        const imageUrl = await uploadImageToCloudinary(req.file.buffer);
        if (imageUrl) {
          post.image = imageUrl;
        }
      } catch (uploadError) {
        return sendError(res, uploadError.message, 500);
      }
    } else if (req.body.image !== undefined) {
      post.image = req.body.image;
    }

    await post.save();
    const updatedPost = await Post.findById(post._id).populate(
      "createdBy",
      "name email role"
    );

    return sendSuccess(res, "Post updated successfully", { post: updatedPost }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete only the owner's post
 * DELETE /api/posts/:id or DELETE /posts/:id
 */
export const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);

    if (!post) {
      return sendError(res, "Post not found", 404);
    }

    // Ownership check: only owner can delete
    if (post.createdBy.toString() !== req.user._id.toString()) {
      return sendError(
        res,
        "Access denied: You are not authorized to delete another user's post",
        403
      );
    }

    await Post.findByIdAndDelete(id);

    return sendSuccess(res, "Post deleted successfully", null, 200);
  } catch (error) {
    next(error);
  }
};
