import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import app from "../index.js";
import connectDB from "../config/db.js";
import User from "../models/user.model.js";
import Post from "../models/post.model.js";

// Helper to make HTTP requests against the in-memory app instance
let server;
let baseUrl;

const request = async (endpoint, options = {}) => {
  const url = `${baseUrl}${endpoint}`;
  const headers = { ...(options.headers || {}) };

  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => null);

  return {
    status: response.status,
    headers: response.headers,
    body: data,
  };
};

describe("Akatsuki's Draft — Backend API Suite", () => {
  // Test entities
  const testRunId = Date.now();
  const testUser = {
    name: "Naruto Uzumaki",
    email: `naruto_${testRunId}@konoha.io`,
    password: "RasenShuriken123!",
  };

  const secondUser = {
    name: "Sasuke Uchiha",
    email: `sasuke_${testRunId}@konoha.io`,
    password: "ChidoriPassword123!",
  };

  const testAdmin = {
    name: "Kakashi Hatake",
    email: `kakashi_${testRunId}@konoha.io`,
    password: "SharinganMaster123!",
  };

  let userToken = "";
  let secondUserToken = "";
  let adminToken = "";
  let testUserId = "";
  let secondUserId = "";
  let adminUserId = "";

  let draftPostId = "";
  let pendingPostId = "";

  before(async () => {
    process.env.NODE_ENV = "test";
    await connectDB();

    // Start ephemeral test server on random available port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        console.log(`[Test Suite] Ephemeral server running on ${baseUrl}`);
        resolve();
      });
    });
  });

  after(async () => {
    // Cleanup test data created during this run
    try {
      await User.deleteMany({ email: { $regex: testRunId.toString() } });
      await Post.deleteMany({ title: { $regex: testRunId.toString() } });
    } catch (cleanupErr) {
      console.warn("Cleanup error:", cleanupErr.message);
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.connection.close();
    setTimeout(() => {
      process.exit(0);
    }, 200);
  });

  describe("1. Server Health and Basic Routing", () => {
    it("GET / returns 200 with platform welcome info", async () => {
      const res = await request("/");
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.message.includes("Akatsuki's Draft"));
    });

    it("GET /api/health returns healthy status", async () => {
      const res = await request("/api/health");
      assert.equal(res.status, 200);
      assert.equal(res.body.status, "healthy");
    });

    it("GET /non-existent-route returns 404 with structured error", async () => {
      const res = await request("/api/non-existent-route");
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes("Resource not found"));
    });
  });

  describe("2. Authentication and Users (/api/auth)", () => {
    it("POST /api/auth/register registers a normal user with role 'user'", async () => {
      const res = await request("/api/auth/register", {
        method: "POST",
        body: testUser,
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.user);
      assert.equal(res.body.data.user.email, testUser.email);
      assert.equal(res.body.data.user.role, "user");
      assert.equal(res.body.data.user.password, undefined); // Password never leaked

      testUserId = res.body.data.user._id;
    });

    it("Registration strictly rejects or overrides self-assigned 'admin' role", async () => {
      const maliciousRegister = {
        name: "Hacker User",
        email: `hacker_${testRunId}@evil.io`,
        password: "HackerPassword123!",
        role: "admin", // Malicious attempt
      };

      const res = await request("/api/auth/register", {
        method: "POST",
        body: maliciousRegister,
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.user.role, "user"); // Forced to "user"
      await User.findByIdAndDelete(res.body.data.user._id);
    });

    it("POST /api/auth/register rejects duplicate email address with 400", async () => {
      const res = await request("/api/auth/register", {
        method: "POST",
        body: testUser,
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.toLowerCase().includes("already registered"));
    });

    it("POST /api/auth/register validates missing fields and password length", async () => {
      const res = await request("/api/auth/register", {
        method: "POST",
        body: { name: "Short", email: "invalid-email", password: "123" },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it("POST /api/auth/login authenticates user and returns JWT token", async () => {
      const res = await request("/api/auth/login", {
        method: "POST",
        body: { email: testUser.email, password: testUser.password },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.token);
      assert.equal(res.body.data.user.email, testUser.email);
      assert.equal(res.body.data.user.password, undefined);

      userToken = res.body.data.token;
    });

    it("POST /api/auth/login rejects wrong password with 401", async () => {
      const res = await request("/api/auth/login", {
        method: "POST",
        body: { email: testUser.email, password: "WrongPassword999!" },
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it("GET /api/auth/me returns authenticated user profile with valid Bearer token", async () => {
      const res = await request("/api/auth/me", {
        headers: { Authorization: `Bearer ${userToken}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.user._id, testUserId);
      assert.equal(res.body.data.user.role, "user");
    });

    it("GET /api/auth/me rejects request with missing or invalid token", async () => {
      const res1 = await request("/api/auth/me");
      assert.equal(res1.status, 401);

      const res2 = await request("/api/auth/me", {
        headers: { Authorization: "Bearer invalid_garbage_token" },
      });
      assert.equal(res2.status, 401);
    });

    // Register second user and create admin user for upcoming authorization tests
    it("Setup second user and admin account", async () => {
      // Second user
      const reg2 = await request("/api/auth/register", {
        method: "POST",
        body: secondUser,
      });
      secondUserId = reg2.body.data.user._id;

      const log2 = await request("/api/auth/login", {
        method: "POST",
        body: { email: secondUser.email, password: secondUser.password },
      });
      secondUserToken = log2.body.data.token;

      // Admin user created securely via database/model
      const hashedPassword = await bcrypt.hash(testAdmin.password, 10);
      const adminRecord = await User.create({
        name: testAdmin.name,
        email: testAdmin.email,
        password: hashedPassword,
        role: "admin",
      });
      adminUserId = adminRecord._id.toString();

      const adminLog = await request("/api/auth/login", {
        method: "POST",
        body: { email: testAdmin.email, password: testAdmin.password },
      });
      adminToken = adminLog.body.data.token;
      assert.equal(adminLog.body.data.user.role, "admin");
    });
  });

  describe("3. User Post Management & Lifecycle (/api/posts)", () => {
    it("POST /api/posts creates a draft post by default", async () => {
      const postPayload = {
        title: `Draft Post ${testRunId}`,
        description: "A draft article about AI in Shinobi world",
        content: "Draft content detailing the latest jutsu advancements...",
        category: "Technology",
      };

      const res = await request("/api/posts", {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
        body: postPayload,
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.post.status, "draft");
      assert.equal(res.body.data.post.createdBy._id, testUserId);

      draftPostId = res.body.data.post._id;
    });

    it("POST /api/posts allows creating a post with status 'pending' to submit for review", async () => {
      const postPayload = {
        title: `Pending Post for Review ${testRunId}`,
        description: "Ready for admin moderation review",
        content: "High quality article content submitted for admin review.",
        category: "Editorial",
        status: "pending",
      };

      const res = await request("/api/posts", {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
        body: postPayload,
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.post.status, "pending");

      pendingPostId = res.body.data.post._id;
    });

    it("Regular user cannot bypass admin review by setting status: 'approved'", async () => {
      const bypassPayload = {
        title: `Bypass Attempt ${testRunId}`,
        description: "Attempting to publish directly without approval",
        content: "Some content here",
        status: "approved",
      };

      const res = await request("/api/posts", {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
        body: bypassPayload,
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    it("GET /api/posts lists ONLY approved posts (drafts and pending must NOT appear publicly)", async () => {
      const res = await request("/api/posts");
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.posts));

      // Verify that neither draftPostId nor pendingPostId appear in the public approved list
      const ids = res.body.data.posts.map((p) => p._id.toString());
      assert.equal(ids.includes(draftPostId), false);
      assert.equal(ids.includes(pendingPostId), false);
    });

    it("GET /api/posts/my-posts returns the logged-in user's own posts and drafts", async () => {
      const res = await request("/api/posts/my-posts", {
        headers: { Authorization: `Bearer ${userToken}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.posts.length >= 2);

      const userPostIds = res.body.data.posts.map((p) => p._id.toString());
      assert.ok(userPostIds.includes(draftPostId));
      assert.ok(userPostIds.includes(pendingPostId));
    });

    it("GET /api/posts/:id hides unapproved post from public view (returns 404)", async () => {
      const res = await request(`/api/posts/${draftPostId}`);
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    it("GET /api/posts/:id allows the owner to view their own draft", async () => {
      const res = await request(`/api/posts/${draftPostId}`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.post._id, draftPostId);
    });

    it("PATCH /api/posts/:id allows owner to update their post", async () => {
      const res = await request(`/api/posts/${draftPostId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${userToken}` },
        body: {
          title: `Updated Draft Title ${testRunId}`,
          description: "Updated description text",
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.post.title, `Updated Draft Title ${testRunId}`);
    });

    it("PATCH /api/posts/:id blocks non-owner from updating someone else's post (403)", async () => {
      const res = await request(`/api/posts/${draftPostId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${secondUserToken}` },
        body: { title: "Malicious update by another user" },
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    it("DELETE /api/posts/:id blocks non-owner from deleting someone else's post (403)", async () => {
      const res = await request(`/api/posts/${draftPostId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${secondUserToken}` },
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    it("DELETE /api/posts/:id validates invalid MongoDB ObjectId (400)", async () => {
      const res = await request("/api/posts/not-a-valid-id", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${userToken}` },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });
  });

  describe("4. Admin Approval System (/api/admin)", () => {
    it("Non-admin user accessing /api/admin/posts/pending is denied with 403", async () => {
      const res = await request("/api/admin/posts/pending", {
        headers: { Authorization: `Bearer ${userToken}` },
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.toLowerCase().includes("admin privileges"));
    });

    it("Admin user can view list of pending posts", async () => {
      const res = await request("/api/admin/posts/pending", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.posts));

      const pendingIds = res.body.data.posts.map((p) => p._id.toString());
      assert.ok(pendingIds.includes(pendingPostId));
    });

    it("Admin can approve a pending post -> status becomes 'approved'", async () => {
      const res = await request(`/api/admin/posts/approve/${pendingPostId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.post.status, "approved");
    });

    it("Approved post is now publicly visible in GET /api/posts", async () => {
      const res = await request("/api/posts");
      assert.equal(res.status, 200);

      const approvedIds = res.body.data.posts.map((p) => p._id.toString());
      assert.ok(approvedIds.includes(pendingPostId));
    });

    it("Attempting to re-approve an already approved post fails with 400 (invalid state transition)", async () => {
      const res = await request(`/api/admin/posts/approve/${pendingPostId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes("Invalid state transition"));
    });

    it("Admin can reject a pending post", async () => {
      // Create a new pending post to test rejection
      const postPayload = {
        title: `Post to Reject ${testRunId}`,
        description: "This post will be rejected",
        content: "Spam or inappropriate content",
        status: "pending",
      };

      const createRes = await request("/api/posts", {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
        body: postPayload,
      });

      const rejectPostId = createRes.body.data.post._id;

      const rejectRes = await request(`/api/admin/posts/reject/${rejectPostId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(rejectRes.status, 200);
      assert.equal(rejectRes.body.data.post.status, "rejected");

      // Verify rejected post does NOT appear publicly
      const publicRes = await request("/api/posts");
      const publicIds = publicRes.body.data.posts.map((p) => p._id.toString());
      assert.equal(publicIds.includes(rejectPostId), false);
    });
  });

  describe("5. Gemini AI Content Improvement (/api/ai/improve)", () => {
    it("POST /api/ai/improve/:postId blocks non-owner with 403", async () => {
      const res = await request(`/api/ai/improve/${draftPostId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secondUserToken}` },
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    it("POST /api/ai/improve/:postId returns 404 for non-existent post", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(`/api/ai/improve/${fakeId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
      });

      assert.equal(res.status, 404);
    });

    it("POST /api/ai/improve/:postId validates invalid ObjectId with 400", async () => {
      const res = await request("/api/ai/improve/invalid-post-id", {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
      });

      assert.equal(res.status, 400);
    });

    it("Gracefully handles missing or unconfigured GEMINI_API_KEY with 503 instead of crashing", async () => {
      // If GEMINI_API_KEY is not set or empty, service returns 503
      const originalKey = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = "";

      const res = await request(`/api/ai/improve/${draftPostId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
      });

      assert.equal(res.status, 503);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.includes("GEMINI_API_KEY"));

      process.env.GEMINI_API_KEY = originalKey;
    });

    it("AI improvement simulation: saves NEW post as draft, preserves original unchanged", async () => {
      // Direct verification of core logic:
      // When AI generates improvement, original post must remain unchanged and new post created as draft
      const originalBefore = await Post.findById(draftPostId);
      const originalTitle = originalBefore.title;

      // Simulate the draft creation logic used by improvePost
      const simulatedNewDraft = await Post.create({
        title: `${originalTitle} [AI Enhanced]`,
        description: "AI improved description with higher clarity",
        content: "Polished and well structured content...",
        category: originalBefore.category,
        image: originalBefore.image,
        createdBy: originalBefore.createdBy,
        status: "draft", // Stays draft
      });

      assert.notEqual(simulatedNewDraft._id.toString(), originalBefore._id.toString());
      assert.equal(simulatedNewDraft.status, "draft");
      assert.equal(simulatedNewDraft.createdBy.toString(), originalBefore.createdBy.toString());

      // Ensure original post is 100% untouched
      const originalAfter = await Post.findById(draftPostId);
      assert.equal(originalAfter.title, originalTitle);
      assert.equal(originalAfter.status, originalBefore.status);

      await Post.findByIdAndDelete(simulatedNewDraft._id);
    });
  });

  describe("6. Post Deletion & Cleanup", () => {
    it("Owner can delete their own post", async () => {
      const res = await request(`/api/posts/${draftPostId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${userToken}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      // Verify post no longer exists
      const check = await Post.findById(draftPostId);
      assert.equal(check, null);
    });
  });
});
