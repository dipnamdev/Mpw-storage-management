import { Router } from "express";
import multer from "multer";
import path from "path";
import { authMiddleware } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

// Store uploads in memory (base64 URL for simplicity — in production use S3/storage)
const storage = multer.diskStorage({
  destination: "/tmp/uploads",
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images allowed"));
    }
  },
});

// Ensure upload directory exists
import fs from "fs";
try {
  fs.mkdirSync("/tmp/uploads", { recursive: true });
} catch (_e) {}

router.post("/v1/upload/image", authMiddleware, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  logger.info({ filename: req.file.filename }, "Image uploaded");
  // Return a path-based URL accessible via the API
  const url = `/api/v1/uploads/${req.file.filename}`;
  res.json({ url });
});

// Serve uploaded files
router.get("/v1/uploads/:filename", (req, res): void => {
  const raw = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
  const safeName = path.basename(raw);
  res.sendFile(`/tmp/uploads/${safeName}`);
});

export default router;
