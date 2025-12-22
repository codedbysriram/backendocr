require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const upload = multer({ dest: UPLOAD_DIR });

app.get("/", (req, res) => {
  res.send("Backend running OK");
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

app.post("/upload-test", upload.single("file"), (req, res) => {
  res.json({
    uploaded: true,
    filename: req.file.filename,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT);
