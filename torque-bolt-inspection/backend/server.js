// backend/server.js
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// Setting up storage for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});

const upload = multer({ storage });

// Create SQLite database
const db = new sqlite3.Database("inspection.db", (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
    }
    db.run(
        `CREATE TABLE IF NOT EXISTS inspections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            imagePath TEXT,
            result TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    );
});

// API to store inspection results
app.post("/upload", upload.single("image"), (req, res) => {
    const imagePath = req.file.path;
    const result = req.body.result; // Passed from frontend (aligned/misaligned/no-mark)

    const query = "INSERT INTO inspections (imagePath, result) VALUES (?, ?)";
    db.run(query, [imagePath, result], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID });
    });
});

// API to fetch inspection results
app.get("/inspections", (req, res) => {
    const query = "SELECT * FROM inspections ORDER BY timestamp DESC";
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ inspections: rows });
    });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
