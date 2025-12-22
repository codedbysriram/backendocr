require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const extractText = require("./ocr");
const parseResult = require("./parser");
const convertPdfToImages = require("./pdfToImage");
const db = require("./db");

const app = express();

/* ================= CORS ================= */
/* allow frontend + localhost */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "ocr-frontend-murex.vercel.app",
    ],
    methods: ["GET", "POST"],
  })
);

app.use(express.json());

/* ================= UPLOADS FOLDER ================= */
const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

/* serve uploads if needed */
app.use("/uploads", express.static(UPLOAD_DIR));

/* ================= MULTER ================= */
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/* ================= CLEAR OLD IMAGES ================= */
function clearOldImages() {
  fs.readdirSync(UPLOAD_DIR).forEach((file) => {
    if (file.endsWith(".png")) {
      fs.unlinkSync(path.join(UPLOAD_DIR, file));
    }
  });
}

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
  res.json({ status: "OCR Backend running ✅" });
});

/* =====================================================
   UPLOAD + OCR + STORE RESULTS
===================================================== */
app.post("/api/ocr/upload", upload.single("file"), async (req, res) => {
  try {
    console.log("📤 OCR UPLOAD HIT");

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    let text = "";

    /* ---------- PDF ---------- */
    if (req.file.mimetype === "application/pdf") {
      clearOldImages();
      await convertPdfToImages(req.file.path);

      const images = fs
        .readdirSync(UPLOAD_DIR)
        .filter((f) => f.endsWith(".png"));

      for (const img of images) {
        text += "\n" + (await extractText(path.join(UPLOAD_DIR, img)));
      }
    }
    /* ---------- IMAGE ---------- */
    else {
      text = await extractText(req.file.path);
    }

    const students = parseResult(text);

    if (!students || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No student data detected",
      });
    }

    /* ---------- INSERT INTO DB ---------- */
    for (const s of students) {
      for (const sub of s.subjects) {
        const semester = Number(sub.semester) || 1;
        const year = semester <= 2 ? 1 : semester <= 4 ? 2 : 3;

        await db.promise().query(
          `INSERT INTO student_results
          (regno, name, department, semester, year,
           subject_code, subject_title, ia, ea, total, result)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            ia = VALUES(ia),
            ea = VALUES(ea),
            total = VALUES(total),
            result = VALUES(result)`,
          [
            s.regno,
            s.name,
            "CT",
            semester,
            year,
            sub.code,
            sub.title,
            sub.ia,
            sub.ea,
            sub.total,
            sub.result,
          ]
        );
      }
    }

    res.json({
      success: true,
      studentsCount: students.length,
      message: "Results stored successfully",
    });
  } catch (err) {
    console.error("❌ OCR ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/* ================= PUBLIC RESULTS API ================= */
app.get("/results", async (req, res) => {
  try {
    const [rows] = await db
      .promise()
      .query("SELECT * FROM student_results ORDER BY regno, semester");
    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ OCR Backend running on port ${PORT}`);
});
