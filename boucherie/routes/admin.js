const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

const {
  getAllSettings,
  setSettings,
  getStats,
  setStats,
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  reorderProducts,
  findAdminByUsername,
  updateAdminPassword,
} = require("../db");
const { requireAdmin, requireAdminApi, attachCsrfToken, verifyCsrf } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

router.use(attachCsrfToken);

// ---------- Auth ----------

router.get("/login", (req, res) => {
  if (req.session.adminId) return res.redirect("/admin");
  res.render("admin/login", { error: null });
});

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = findAdminByUsername((username || "").trim());
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).render("admin/login", { error: "Identifiants incorrects." });
  }
  req.session.regenerate((err) => {
    if (err) return res.status(500).render("admin/login", { error: "Erreur serveur, réessaie." });
    req.session.adminId = user.id;
    req.session.adminUsername = user.username;
    res.redirect("/admin");
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
});

// ---------- Dashboard ----------

router.get("/", requireAdmin, (req, res) => {
  res.render("admin/dashboard", {
    settings: getAllSettings(),
    stats: getStats(),
    products: getAllProducts(),
    adminUsername: req.session.adminUsername,
  });
});

router.get("/api/data", requireAdminApi, (req, res) => {
  res.json({
    settings: getAllSettings(),
    stats: getStats(),
    products: getAllProducts(),
  });
});

// ---------- Settings (infos, textes, apparence) ----------

router.post("/api/settings", requireAdminApi, verifyCsrf, (req, res) => {
  const entries = req.body || {};
  if (typeof entries !== "object" || Array.isArray(entries)) {
    return res.status(400).json({ error: "Format invalide." });
  }
  setSettings(entries);
  res.json({ ok: true, settings: getAllSettings() });
});

// ---------- Stats (chiffres clés) ----------

router.post("/api/stats", requireAdminApi, verifyCsrf, (req, res) => {
  const stats = Array.isArray(req.body.stats) ? req.body.stats : null;
  if (!stats) return res.status(400).json({ error: "Format invalide." });
  setStats(stats);
  res.json({ ok: true, stats: getStats() });
});

// ---------- Products (produits / services) ----------

router.post("/api/products", requireAdminApi, verifyCsrf, (req, res) => {
  const { tag, tag_style, title, description, items, image_url, published } = req.body;
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: "Le titre du produit est obligatoire." });
  }
  const id = createProduct({
    tag,
    tag_style,
    title,
    description,
    items: Array.isArray(items) ? items : [],
    image_url,
    published,
  });
  res.json({ ok: true, id, products: getAllProducts() });
});

router.put("/api/products/:id", requireAdminApi, verifyCsrf, (req, res) => {
  const { tag, tag_style, title, description, items, image_url, published } = req.body;
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: "Le titre du produit est obligatoire." });
  }
  updateProduct(req.params.id, {
    tag,
    tag_style,
    title,
    description,
    items: Array.isArray(items) ? items : [],
    image_url,
    published,
  });
  res.json({ ok: true, products: getAllProducts() });
});

router.delete("/api/products/:id", requireAdminApi, verifyCsrf, (req, res) => {
  deleteProduct(req.params.id);
  res.json({ ok: true, products: getAllProducts() });
});

router.post("/api/products/reorder", requireAdminApi, verifyCsrf, (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : null;
  if (!ids) return res.status(400).json({ error: "Format invalide." });
  reorderProducts(ids);
  res.json({ ok: true, products: getAllProducts() });
});

// ---------- Image upload ----------

router.post("/api/upload", requireAdminApi, verifyCsrf, (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu." });
    res.json({ ok: true, url: "/uploads/" + req.file.filename });
  });
});

// ---------- Change password ----------

router.post("/api/change-password", requireAdminApi, verifyCsrf, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = findAdminByUsername(req.session.adminUsername);
  if (!user || !bcrypt.compareSync(currentPassword || "", user.password_hash)) {
    return res.status(401).json({ error: "Mot de passe actuel incorrect." });
  }
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "Le nouveau mot de passe doit faire au moins 8 caractères." });
  }
  updateAdminPassword(user.id, bcrypt.hashSync(newPassword, 10));
  res.json({ ok: true });
});

module.exports = router;
