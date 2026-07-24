const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif"]);
const EXT_BY_TYPE = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/gif": ".gif",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = EXT_BY_TYPE[file.mimetype] || path.extname(file.originalname) || "";
    cb(null, crypto.randomBytes(16).toString("hex") + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return cb(new Error("Format d'image non supporté (jpg, png, webp, gif, svg uniquement)."));
    }
    cb(null, true);
  },
});

module.exports = { upload, UPLOAD_DIR };
