require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("./db");

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://ocr-frontend-ufhf.vercel.app"
    ],
    methods: ["GET", "POST"],
  })
);

app.use(express.json());

/* ================= UPLOAD CONFIG ================= */
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const upload = multer({ dest: UPLOAD_DIR });

/* ================= ROUTES ================= */
app.get("/", (req, res) => {
  res.json({ status: "Backend running" });
});

app.post("/upload-test", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded",
    });
  }

  res.json({
    success: true,
    message: "File uploaded successfully",
    file: req.file.filename,
  });
});

app.get("/results", async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query("SELECT * FROM student_results ORDER BY regno, semester");

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT);
