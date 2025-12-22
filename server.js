require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend running OK");
});

app.get("/results", async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT 1");
    res.json({ db: "connected" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT);
