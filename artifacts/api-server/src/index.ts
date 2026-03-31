require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// =====================
// CRASH HANDLING (CRITICAL)
// =====================
process.on("uncaughtException", err => {
  console.error("CRASH:", err);
});

process.on("unhandledRejection", err => {
  console.error("REJECTION:", err);
});

// =====================
// MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json());

// =====================
// HEALTH CHECK (IMPORTANT)
// =====================
app.get("/", (req, res) => {
  res.status(200).send("MBIOPAY API RUNNING");
});

// =====================
// DB CONNECTION (SAFE)
// =====================
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log("✅ DB CONNECTED");
  } catch (err) {
    console.error("❌ DB FAILED:", err.message);
  }
}

// =====================
// START SERVER SAFELY
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log("🚀 SERVER RUNNING ON PORT", PORT);
  await connectDB();
});
