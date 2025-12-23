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
      "https://ocr-frontend-ufhf.vercel.app",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.get("/", (req, res) => {
  res.json({ status: "Backend running" });
});

app.post("/upload-test", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded",
    });
  }

  try {
    const sql = `
      INSERT INTO student_results (
        regno,
        name,
        department,
        semester,
        year,
        subject_code,
        subject_title,
        ia,
        ea,
        total,
        result
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        ia = VALUES(ia),
        ea = VALUES(ea),
        total = VALUES(total),
        result = VALUES(result)
    `;

    await db.promise().query(sql, [
      "CT202501",
      "Student Name",
      "CT",
      1,
      2025,
      "CT101",
      "Mathematics",
      25,
      60,
      85,
      "PASS",
    ]);

    res.json({
      success: true,
      message: "File uploaded and data stored successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.get("/results", async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query(
        "SELECT * FROM student_results ORDER BY regno, semester, subject_code"
      );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT);
