import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Post title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Post description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    content: {
      type: String,
      required: [true, "Post content is required"],
    },
    image: {
      type: String,
      default: null,
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Post category is required"],
      trim: true,
      default: "General",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Author (createdBy) reference is required"],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ["draft", "pending", "approved", "rejected"],
        message: "{VALUE} is not a valid post status",
      },
      default: "draft",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Helpful compound index for fast querying of approved posts by category and creation date
postSchema.index({ status: 1, createdAt: -1 });
postSchema.index({ createdBy: 1, createdAt: -1 });

const Post = mongoose.model("Post", postSchema);

export default Post;
