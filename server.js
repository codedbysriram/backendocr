require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const db = require("./db");

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: "https://ocr-frontend-59ov.vercel.app",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.options("*", cors());

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const upload = multer({ dest: UPLOAD_DIR });

app.get("/", (req, res) => {
  res.json({ status: "Backend running" });
});

app.post("/upload-test", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false });

  try {
    const buffer = fs.readFileSync(req.file.path);

    const parsed =
      typeof pdfParse === "function"
        ? await pdfParse(buffer)
        : await pdfParse.default(buffer);

    const lines = parsed.text.split("\n").map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      const p = line.split(/\s+/);
      if (p.length < 7) continue;

      await db.promise().query(
        `INSERT INTO student_results
        (regno,name,department,semester,year,subject_code,subject_title,ia,ea,total,result)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
        ia=VALUES(ia),ea=VALUES(ea),total=VALUES(total),result=VALUES(result)`,
        [p[0], "Student", "CT", 1, 2025, p[1], p[2], p[3], p[4], p[5], p[6]]
      );
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get("/results", async (req, res) => {
  const [rows] = await db.promise().query("SELECT * FROM student_results");
  res.json(rows);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT);
