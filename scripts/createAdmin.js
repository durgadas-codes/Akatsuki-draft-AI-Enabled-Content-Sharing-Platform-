import mongoose from "mongoose";
import bcrypt from "bcrypt";
import readline from "readline";
import dotenv from "dotenv";
import User from "../models/user.model.js";
import connectDB from "../config/db.js";

dotenv.config();

/**
 * Helper to prompt in terminal if args are not passed
 */
const promptQuestion = (rl, question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
};

const createOrPromoteAdmin = async () => {
  console.log("\n==============================================");
  console.log("   Akatsuki's Draft — Admin Setup Utility    ");
  console.log("==============================================\n");

  await connectDB();

  const args = process.argv.slice(2);
  let email = args[0] || process.env.ADMIN_EMAIL;
  let password = args[1] || process.env.ADMIN_PASSWORD;
  let name = args[2] || process.env.ADMIN_NAME || "Akatsuki Administrator";

  if (!email || !password) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (!name) {
      name = await promptQuestion(rl, "Enter Admin Name: ");
    }
    if (!email) {
      email = await promptQuestion(rl, "Enter Admin Email: ");
    }
    if (!password) {
      password = await promptQuestion(rl, "Enter Admin Password (min 6 chars): ");
    }
    rl.close();
  }

  if (!email || !password || password.length < 6) {
    console.error("Error: Valid email and password (minimum 6 characters) are required.");
    await mongoose.connection.close();
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      if (existingUser.role === "admin") {
        console.log(`User '${normalizedEmail}' is already an admin.`);
      } else {
        existingUser.role = "admin";
        await existingUser.save();
        console.log(`Successfully promoted existing user '${normalizedEmail}' to admin role.`);
      }
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newAdmin = await User.create({
        name: name.trim() || "Administrator",
        email: normalizedEmail,
        password: hashedPassword,
        role: "admin",
      });
      console.log(`Admin account created successfully!`);
      console.log(`Name: ${newAdmin.name}`);
      console.log(`Email: ${newAdmin.email}`);
      console.log(`Role: ${newAdmin.role}`);
    }
  } catch (err) {
    console.error("Failed to setup admin account:", err.message);
  } finally {
    await mongoose.connection.close();
    console.log("\nDatabase connection closed. Admin setup complete.\n");
    process.exit(0);
  }
};

createOrPromoteAdmin();
