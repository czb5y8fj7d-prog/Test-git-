const express = require("express");
const router = express.Router();
const { getAllSettings, getStats, getPublishedProducts } = require("../db");
const { nl2br } = require("../utils/text");

router.get("/", (req, res) => {
  const settings = getAllSettings();
  const stats = getStats();
  const products = getPublishedProducts();
  res.render("index", { settings, stats, products, nl2br });
});

module.exports = router;
