import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URL, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    // If not in test environment, allow connection retry or throw
    if (process.env.NODE_ENV !== "test") {
      console.warn("[MongoDB] Please verify MONGODB_URL in your .env file.");
    }
    throw error;
  }
};

export default connectDB;
