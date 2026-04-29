require("dotenv").config();

const crypto = require("crypto");
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

const buildAcrUrl = (host) => {
  const trimmedHost = host.trim().replace(/\/+$/, "");
  const baseUrl = /^https?:\/\//i.test(trimmedHost)
    ? trimmedHost
    : `https://${trimmedHost}`;

  return `${baseUrl}/v1/identify`;
};

const signAcrRequest = ({ accessKey, accessSecret, timestamp }) => {
  const stringToSign = [
    "POST",
    "/v1/identify",
    accessKey,
    "audio",
    "1",
    timestamp,
  ].join("\n");

  return crypto
    .createHmac("sha1", accessSecret)
    .update(Buffer.from(stringToSign, "utf-8"))
    .digest("base64");
};

const getTopHummingMatches = (acrResult) => {
  const hummingMatches = acrResult?.metadata?.humming || [];

  return [...hummingMatches]
    .sort((firstMatch, secondMatch) => {
      const firstScore = Number.parseFloat(firstMatch.score || "0");
      const secondScore = Number.parseFloat(secondMatch.score || "0");

      return secondScore - firstScore;
    })
    .slice(0, 5);
};

const formatSongMatch = (match) => {
  const spotifyTrackId = match.external_metadata?.spotify?.track?.id;
  const score = Number.parseFloat(match.score || "0");
  const confidenceScore = score > 0 && score <= 1 ? score * 100 : score;
  const confidence = Math.max(0, Math.min(Math.round(confidenceScore), 100));

  return {
    title: match.title || null,
    artist: (match.artists || [])
      .map((artist) => artist.name)
      .filter(Boolean)
      .join(", ") || null,
    score,
    confidence,
    spotifyUrl: spotifyTrackId
      ? `https://open.spotify.com/track/${spotifyTrackId}`
      : null,
  };
};

const identifyRecording = async (req, res) => {
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

  try {
    const accessKey = process.env.ACR_ACCESS_KEY;
    const accessSecret = process.env.ACR_ACCESS_SECRET;
    const timestamp = (Date.now() / 1000).toString();
    const signature = signAcrRequest({ accessKey, accessSecret, timestamp });
    const formData = new FormData();
    const audioBlob = new Blob([req.file.buffer], {
      type: req.file.mimetype || "application/octet-stream",
    });

    formData.append("sample", audioBlob, req.file.originalname || "recording.webm");
    formData.append("sample_bytes", req.file.size.toString());
    formData.append("access_key", accessKey);
    formData.append("data_type", "audio");
    formData.append("signature_version", "1");
    formData.append("signature", signature);
    formData.append("timestamp", timestamp);

    const acrResponse = await fetch(buildAcrUrl(process.env.ACR_HOST), {
      method: "POST",
      body: formData,
    });
    const acrText = await acrResponse.text();
    let acrResult;

    try {
      acrResult = JSON.parse(acrText);
    } catch (error) {
      return res.status(502).json({
        error: "ACRCloud returned an invalid response.",
      });
    }

    if (!acrResponse.ok || acrResult.status?.code !== 0) {
      return res.status(502).json({
        error: acrResult.status?.msg || "ACRCloud identification failed.",
        acrStatus: acrResult.status || null,
      });
    }

    const matches = getTopHummingMatches(acrResult).map(formatSongMatch);

    if (!matches.length) {
      return res.status(404).json({
        error: "No humming match found.",
      });
    }

    return res.json({
      ...matches[0],
      matches,
    });
  } catch (error) {
    return res.status(502).json({
      error: "Could not identify audio with ACRCloud.",
    });
  }
};

app.post("/identify", upload.single("audio"), identifyRecording);
app.post("/api/recognize", upload.single("audio"), identifyRecording);

app.listen(port, () => {
  console.log(`Song Finder server listening at http://localhost:${port}`);
});
