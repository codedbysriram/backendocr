console.log("SERVER VERSION: 2025-OK");

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const supabase = require("./supabaseClient");

const app = express();

/* ================= BASIC MIDDLEWARE ================= */
app.use(express.json());

/* ================= CORS ================= */
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://ocr-frontend-8x3m.vercel.app"
];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // Postman / curl
      if (allowedOrigins.includes(origin)) return cb(null, true);

      console.error("❌ CORS BLOCKED:", origin);
      return cb(new Error("CORS blocked"));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
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
   📄 UPLOAD PDF → PARSE → STORE
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

    console.log("TOTAL LINES PARSED:", lines.length);
    console.log("FIRST 10 LINES:", lines.slice(0, 10));

    let currentRegNo = null;
    let currentName = null;

    for (const line of lines) {
      const studentMatch = line.match(/^(\w+)\s+Name\s*:\s*(.+)$/);

      if (studentMatch) {
        currentRegNo = studentMatch[1];
        currentName = studentMatch[2].trim();
        continue;
      }

      if (!/^\d+\s+[A-Z0-9-]+/.test(line)) continue;
      if (!currentRegNo) continue;

      const parts = line.split(/\s+/);

      const semester = Number(parts.shift());
      const subject_code = parts.shift();

      const result = parts.pop();
      const totalRaw = parts.pop();
      const eaRaw = parts.pop();
      const iaRaw = parts.pop();
      const creditsRaw = parts.pop();

      const subject_title = parts.join(" ").replace(/^:/, "").trim();

      const ia = isNaN(Number(iaRaw)) ? null : Number(iaRaw);
      const ea = isNaN(Number(eaRaw)) ? null : Number(eaRaw);
      const total = isNaN(Number(totalRaw)) ? null : Number(totalRaw);

      console.log("Inserting record for:", currentRegNo, subject_code, semester);

      const resultInsert = await supabase
        .from("student_results")
        .upsert({
          regno: currentRegNo,
          name: currentName,
          department: "CT",
          year: 1,
          semester: semester,

          subject_code: subject_code,
          subject_title: subject_title,

          ia: ia,
          ea: ea,
          total: total,

          result: result
        });

      console.log("SUPABASE RESPONSE:", resultInsert);

      if (resultInsert.error) {
        console.error("❌ SUPABASE INSERT ERROR:", resultInsert.error);
        throw new Error(resultInsert.error.message);
      }
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
    const { data, error } = await supabase
      .from("student_results")
      .select("*")
      .order("regno", { ascending: true });

    if (error) throw error;

    res.json(data);

  } catch (err) {
    console.error("❌ FETCH RESULTS ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
