require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config-status", (req, res) => {
  res.json({
    acrConfigured: Boolean(
      process.env.ACR_HOST &&
        process.env.ACR_ACCESS_KEY &&
        process.env.ACR_ACCESS_SECRET
    ),
  });
});

app.post("/api/recognize", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file uploaded." });
  }

  if (
    !process.env.ACR_HOST ||
    !process.env.ACR_ACCESS_KEY ||
    !process.env.ACR_ACCESS_SECRET
  ) {
    return res.status(503).json({
      error: "ACRCloud credentials are not configured yet.",
    });
  }

  return res.status(501).json({
    error: "ACRCloud humming recognition integration is not implemented yet.",
  });
});

app.listen(port, () => {
  console.log(`Song Finder server listening at http://localhost:${port}`);
});
