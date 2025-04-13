require("dotenv").config();
const express = require("express");
const multer = require("multer");
const bcrypt = require("bcrypt");
const path = require("path");
const db = require("./models/db");

const app = express();
const upload = multer({ dest: "uploads" });

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("index", { fileLink: null });
});

app.post("/upload", upload.single("file"), async (req, res) => {
  const { path: filePath, originalname } = req.file;
  const password = req.body.password;

  let hashedPassword = null;
  if (password) {
    hashedPassword = await bcrypt.hash(password, 10);
  }

  const sql = "INSERT INTO files (path, original_name, password) VALUES (?, ?, ?)";
  db.query(sql, [filePath, originalname, hashedPassword], (err, result) => {
    if (err) {
      console.error("Error inserting file:", err);
      return res.status(500).send("Server error");
    }

    const fileLink = `${req.headers.origin}/file/${encodeURIComponent(originalname)}`;
    res.render("index", { fileLink });
  });
});

app.route("/file/:filename").get(handleDownload).post(handleDownload);

function handleDownload(req, res) {
  const filename = decodeURIComponent(req.params.filename);

  const sql = "SELECT * FROM files WHERE original_name = ?";
  db.query(sql, [filename], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).send("File not found");
    }

    const file = results[0];

    if (file.password) {
      if (req.method === "GET") {
        return res.render("password", { error: false, filename });
      }

      if (!req.body || !req.body.password) {
        return res.render("password", { error: false, filename });
      }

      const validPassword = await bcrypt.compare(req.body.password, file.password);
      if (!validPassword) {
        return res.render("password", { error: true, filename });
      }
    }

    db.query("UPDATE files SET download_count = download_count + 1 WHERE original_name = ?", [filename]);
    res.download(file.path, file.original_name);
  });
}

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
});
