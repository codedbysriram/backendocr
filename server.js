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
app.use(
  cors({
    origin: [
      "http://localhost:5173", // Admin / Dashboard
      "http://localhost:5174", // OCR Frontend
    ],
    methods: ["GET", "POST"],
  })
);

app.use(express.json());

/* ================= ENSURE UPLOADS FOLDER ================= */
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

/* ================= MULTER ================= */
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/* ================= CLEAR OLD IMAGES ================= */
function clearOldImages() {
  fs.readdirSync("uploads").forEach((file) => {
    if (file.endsWith(".png")) {
      fs.unlinkSync(path.join("uploads", file));
    }
  });
}

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

    // ---------- PDF ----------
    if (req.file.mimetype === "application/pdf") {
      clearOldImages();
      await convertPdfToImages(req.file.path);

      const images = fs
        .readdirSync("uploads")
        .filter((f) => f.endsWith(".png"));

      for (const img of images) {
        text += "\n" + (await extractText(path.join("uploads", img)));
      }
    }
    // ---------- IMAGE ----------
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

    // ---------- INSERT DB ----------
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

/* ================= PUBLIC APIs ================= */

app.get("/results", async (req, res) => {
  const [rows] = await db
    .promise()
    .query("SELECT * FROM student_results ORDER BY regno, semester");
  res.json(rows);
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ OCR Backend running on port ${PORT}`);
});
