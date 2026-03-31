import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("WORKING");
});

process.on("uncaughtException", err => {
  console.error("CRASH:", err);
});

process.on("unhandledRejection", err => {
  console.error("REJECTION:", err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("API Server running on port", PORT);
});
