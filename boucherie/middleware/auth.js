function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.redirect("/admin/login");
}

function requireAdminApi(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.status(401).json({ error: "Non authentifié." });
}

function attachCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = require("crypto").randomBytes(24).toString("hex");
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function verifyCsrf(req, res, next) {
  const token = req.get("X-CSRF-Token") || req.body._csrf;
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({ error: "Jeton de sécurité invalide, recharge la page." });
  }
  next();
}

module.exports = { requireAdmin, requireAdminApi, attachCsrfToken, verifyCsrf };
