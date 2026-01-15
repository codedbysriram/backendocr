console.log("SERVER VERSION: 2025-OK");

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const db = require("./db");

const app = express();

/* ================= BASIC MIDDLEWARE ================= */
app.use(express.json());

/* ================= CORS ================= */
const allowedOrigins = [
  "http://localhost:5173",
  "https://ocr-frontend-8x3m.vercel.app",
];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked"));
    },
  })
);

/* ================= UPLOAD CONFIG ================= */
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
});

/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.json({ status: "Backend running" });
});

/* ==================================================
   📄 UPLOAD PDF → PARSE → STORE (FIXED)
================================================== */
app.post("/upload-test", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  try {
    const buffer = fs.readFileSync(req.file.path);
    const parsed = await pdfParse(buffer);

    const lines = parsed.text
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean);

    let currentRegNo = null;
    let currentName = null;

    for (const line of lines) {
      /* ===== STUDENT HEADER ===== */
      const studentMatch = line.match(
        /^(\w+)\s+Name\s*:\s*(.+)$/
      );

      if (studentMatch) {
        currentRegNo = studentMatch[1];
        currentName = studentMatch[2].trim();
        continue;
      }

      /* ===== IGNORE NON-SUBJECT LINES ===== */
      if (!/^\d+\s+[A-Z0-9-]+/.test(line)) continue;
      if (!currentRegNo) continue;

      /* ===== TOKEN-BASED PARSING ===== */
      const parts = line.split(/\s+/);

      const semester = Number(parts.shift());
      const subject_code = parts.shift();

      const result = parts.pop();
      const totalRaw = parts.pop();
      const eaRaw = parts.pop();
      const iaRaw = parts.pop();
      const creditsRaw = parts.pop();

      const subject_title = parts.join(" ")
        .replace(/^:/, "")
        .trim();

      const credits = isNaN(Number(creditsRaw)) ? null : Number(creditsRaw);
      const ia = isNaN(Number(iaRaw)) ? null : Number(iaRaw);
      const ea = isNaN(Number(eaRaw)) ? null : Number(eaRaw);
      const total = isNaN(Number(totalRaw)) ? null : Number(totalRaw);

      await db.promise().query(
        `
        INSERT INTO student_results
        (regno, name, department, year, semester,
         subject_code, subject_title, credits,
         ia, ea, total, result)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          credits = VALUES(credits),
          ia = VALUES(ia),
          ea = VALUES(ea),
          total = VALUES(total),
          result = VALUES(result)
        `,
        [
          currentRegNo,
          currentName,
          "CT",
          1,
          semester,
          subject_code,
          subject_title,
          credits,
          ia,
          ea,
          total,
          result,
        ]
      );
    }

    res.json({
      success: true,
      message: "PDF results parsed and stored successfully",
    });

  } catch (err) {
    console.error("❌ UPLOAD ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ==================================================
   📊 FETCH RESULTS
================================================== */
app.get("/api/results", async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT
        regno,
        name,
        semester,
        subject_code,
        subject_title,
        credits,
        ia,
        ea,
        total,
        result
      FROM student_results
      ORDER BY regno, semester, subject_code
    `);

    res.json(rows);
  } catch (err) {
    console.error("❌ FETCH RESULTS ERROR:", err.code || err.message);

    if (err.code === "ECONNRESET") {
      return res.status(503).json({
        error: "Database connection reset. Try again.",
      });
    }

    res.status(500).json({ error: "Database error" });
  }
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
