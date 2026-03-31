require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors({
  origin: [
    "https://mbiopay.com",
    "https://www.mbiopay.com",
    "https://app.mbiopay.com",
    "https://admin.mbiopay.com",
    "https://remittance-ui-production-92dd.up.railway.app",
    "https://app-ui-production-5cdb.up.railway.app",
    "https://admin-ui-production-1660.up.railway.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002"
  ],
  credentials: true
}));

process.on("uncaughtException", err => {
  console.error("❌ UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", err => {
  console.error("❌ UNHANDLED REJECTION:", err);
});

app.get("/", (req, res) => {
  res.json({ 
    status: "WORKING", 
    service: "MBIOPAY API",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get("/healthz", (req, res) => {
  res.json({ 
    status: "ok", 
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ API Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
});
