import Post from "../models/post.model.js";
import { improvePostContent, GeminiServiceError } from "../services/gemini.service.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

/**
 * AI Content Improvement endpoint
 * POST /api/ai/improve/:postId or POST /ai/improve/:postId
 *
 * Requirements:
 * 1. Only the owner of the post may request an improvement.
 * 2. Uses the existing post's title, description, and content as input.
 * 3. Improves grammar, clarity, readability, structure, and writing quality while preserving original meaning.
 * 4. Returns the improved content in a structured response.
 * 5. Saves the improved version as a NEW post with a new MongoDB ID, owned by the same user.
 * 6. Saves the new version as a draft.
 * 7. Preserves the original post completely.
 * 8. Never automatically approves AI-generated content.
 * 9. Reads Gemini API key from GEMINI_API_KEY.
 * 10. Handles missing API keys, API errors, rate limits, and empty responses gracefully.
 */
export const improvePost = async (req, res, next) => {
  try {
    const { postId } = req.params;

    const originalPost = await Post.findById(postId);
    if (!originalPost) {
      return sendError(res, "Original post not found", 404);
    }

    // Ownership check: only post owner can request improvement
    if (originalPost.createdBy.toString() !== req.user._id.toString()) {
      return sendError(
        res,
        "Access denied: You can only request AI improvements for your own posts",
        403
      );
    }

    // Call Gemini AI service
    let aiResult;
    try {
      aiResult = await improvePostContent({
        title: originalPost.title,
        description: originalPost.description,
        content: originalPost.content,
      });
    } catch (aiError) {
      if (aiError instanceof GeminiServiceError) {
        return sendError(res, aiError.message, aiError.statusCode, {
          code: aiError.code,
        });
      }
      return sendError(
        res,
        `Gemini AI service error: ${aiError.message}`,
        502
      );
    }

    // Create a NEW post with a new MongoDB ID, owned by the same user, saved as a draft
    const newImprovedDraft = await Post.create({
      title: aiResult.improvedTitle,
      description: aiResult.improvedDescription,
      content: aiResult.improvedContent,
      category: originalPost.category,
      image: originalPost.image, // Preserve original image if present
      createdBy: req.user._id,
      status: "draft", // Strictly draft: never automatically approve AI-generated content
    });

    const populatedDraft = await Post.findById(newImprovedDraft._id).populate(
      "createdBy",
      "name email role"
    );

    return sendSuccess(
      res,
      "Content successfully improved with Gemini AI and saved as a new draft",
      {
        originalPostId: originalPost._id,
        improvedPost: populatedDraft,
        summaryOfChanges: aiResult.summaryOfChanges,
        modelUsed: aiResult.modelUsed,
      },
      201
    );
  } catch (error) {
    next(error);
  }
};
