const mysql = require("mysql2");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 1,
  queueLimit: 0,
  connectTimeout: 30000,
});

// Safe startup connection test (WILL NOT CRASH APP)
pool.getConnection((err, conn) => {
  if (err) {
    console.error("MySQL connection error:", err.message);
  } else {
    console.log("MySQL connected");
    conn.release();
  }
});

// Handle runtime pool errors safely
pool.on("error", (err) => {
  console.error("MySQL pool error:", err.message);
});

module.exports = pool;
