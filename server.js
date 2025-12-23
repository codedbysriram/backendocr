require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse/lib/pdf-parse"); 
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
    const buffer = fs.readFileSync(req.file.path);
    const pdf = await pdfParse(buffer);

    const lines = pdf.text
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 7) continue;

      const regno = parts[0];
      const subject_code = parts[1];
      const subject_title = parts[2];
      const ia = parseInt(parts[3]);
      const ea = parseInt(parts[4]);
      const total = parseInt(parts[5]);
      const result = parts[6];

      await db.promise().query(
        `
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
        `,
        [
          regno,
          "Student",
          "CT",
          1,
          2025,
          subject_code,
          subject_title,
          ia,
          ea,
          total,
          result,
        ]
      );
    }

    res.json({
      success: true,
      message: "PDF data stored in database",
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
