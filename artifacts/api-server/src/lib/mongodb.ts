import mongoose from "mongoose";
import { logger } from "./logger";

let connected = false;

export async function connectMongo(): Promise<void> {
  if (connected) return;

  const uri = process.env["MONGODB_URI"];
  if (!uri) {
    logger.warn("MONGODB_URI not set — MongoDB features disabled");
    return;
  }

  try {
    await mongoose.connect(uri, {
      dbName: "mbio",
      serverSelectionTimeoutMS: 5000,
    });
    connected = true;
    logger.info("MongoDB connected");
  } catch (err) {
    logger.error({ err }, "MongoDB connection failed — continuing without it");
  }
}

export function isMongoConnected(): boolean {
  return connected && mongoose.connection.readyState === 1;
}
