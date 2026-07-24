const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "boucherie.db"));
db.pragma("journal_mode = WAL");

const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
db.exec(schema);

const DEFAULT_SETTINGS = {
  brand_name: "Maison Lambert",
  brand_tagline: "Boucher · Charcutier · Traiteur",
  site_title: "Maison Lambert — Boucher · Charcutier · Traiteur depuis 1958",
  site_description:
    "Maison Lambert, boucherie artisanale depuis 1958. Viandes maturées, charcuterie faite main et service traiteur sur mesure pour vos réceptions.",

  phone_display: "04 78 12 34 56",
  phone_link: "+330478123456",
  email: "contact@maison-lambert.fr",
  address: "12 Place du Marché, 24 Villeneuve-sur-Auvézère",

  hours_1_label: "Mardi – Vendredi",
  hours_1_value: "7h30 – 12h45 · 15h30 – 19h30",
  hours_2_label: "Samedi",
  hours_2_value: "7h00 – 19h30 (non-stop)",
  hours_3_label: "Dimanche",
  hours_3_value: "7h30 – 13h00",
  hours_4_label: "Lundi",
  hours_4_value: "Fermé",

  social_instagram: "#",
  social_facebook: "#",

  hero_eyebrow: "Artisan boucher depuis 1958 — Villeneuve-sur-Auvézère",
  hero_title: "L'art de la belle pièce,\ndepuis trois générations",
  hero_lede:
    "Une boucherie de famille où chaque pièce est choisie chez l'éleveur, maturée en cave et travaillée au couteau, dans le respect du produit, du geste et du temps.",

  philosophy_eyebrow: "Notre philosophie",
  philosophy_title: "Le respect du produit, avant tout",
  philosophy_lede:
    "Chez Maison Lambert, une belle pièce ne s'improvise pas. Elle se choisit à la ferme, se patiente en cave, et se travaille à la main — sans raccourci. C'est ce savoir-faire, transmis depuis 1958, que nous mettons chaque jour dans votre assiette.",

  meat_eyebrow: "Le comptoir",
  meat_title: "Nos viandes d'exception",
  meat_lede:
    "Une sélection resserrée, choisie pour sa qualité plutôt que sa quantité. Toutes nos viandes sont fermières, tracées depuis l'élevage, et préparées à la commande.",
  meat_note:
    "Gibier de saison disponible selon arrivages — demandez conseil à votre boucher au comptoir.",

  traiteur_eyebrow: "Service traiteur",
  traiteur_title: "Recevez sans compromis",
  traiteur_lede:
    "Mariage, fête de famille, réception d'entreprise ou simple dimanche entre amis : notre atelier traiteur compose avec vous un menu à base de belles pièces, dans le même souci du détail que notre boucherie.",
  traiteur_cta_title: "Un événement à préparer ?",
  traiteur_cta_text:
    "Parlez-nous de votre projet — nombre de convives, budget, envies — et recevez un devis personnalisé sous 48h.",

  contact_eyebrow: "Nous rencontrer",
  contact_title: "Venez pousser la porte",
  contact_lede:
    "Notre équipe vous accueille au comptoir pour vous conseiller sur la pièce du jour, ou pour construire ensemble votre commande traiteur.",

  footer_tagline: "Boucher · Charcutier · Traiteur — artisan depuis 1958.",

  color_primary: "#601a20",
  color_accent: "#b8925a",
  color_background: "#f6efe1",
  color_text: "#241d17",
};

const DEFAULT_STATS = [
  { number: "1958", label: "Année de fondation" },
  { number: "21 j", label: "Maturation moyenne en cave" },
  { number: "12", label: "Éleveurs partenaires en circuit court" },
  { number: "100%", label: "Découpe artisanale, faite main" },
];

const DEFAULT_PRODUCTS = [
  {
    tag: "Pièce signature",
    tag_style: "default",
    title: "Bœuf maturé",
    description:
      "Races à viande françaises — Salers, Aubrac, Charolaise. Maturation de 21 à 45 jours en cave.",
    items: ["Côte de bœuf & Tomahawk", "Chateaubriand & filet", "Entrecôte, bavette, onglet"],
  },
  {
    tag: "",
    tag_style: "default",
    title: "Agneau fermier",
    description: "Agneau de lait et agneau fermier élevé en plein air, à la chair fine et délicate.",
    items: ["Gigot & épaule", "Carré et côtelettes", "Souris confites"],
  },
  {
    tag: "",
    tag_style: "default",
    title: "Veau sous la mère",
    description: "Veau fermier élevé sous la mère, pour une viande claire, tendre et savoureuse.",
    items: ["Côtes & escalopes", "Rôti & blanquette", "Ris de veau (sur commande)"],
  },
  {
    tag: "",
    tag_style: "default",
    title: "Porc fermier",
    description: "Porc élevé en plein air et nourri sans OGM, pour une chair persillée et goûteuse.",
    items: ["Côtes & filet mignon", "Poitrine & travers", "Rôti farci maison"],
  },
  {
    tag: "",
    tag_style: "default",
    title: "Volailles fermières",
    description: "Volailles Label Rouge élevées en plein air 81 jours minimum, chair ferme et parfumée.",
    items: ["Chapon & poularde", "Pintade & canard", "Volaille farcie sur commande"],
  },
  {
    tag: "Fait maison",
    tag_style: "alt",
    title: "Charcuterie d'atelier",
    description: "Terrines, pâtés et salaisons préparés chaque semaine dans notre atelier, sans additif.",
    items: ["Terrines & pâtés en croûte", "Saucisson sec & jambon sec", "Rillettes & boudin maison"],
  },
];

function seedIfEmpty() {
  const settingsCount = db.prepare("SELECT COUNT(*) AS n FROM settings").get().n;
  if (settingsCount === 0) {
    const insert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
    const insertMany = db.transaction((entries) => {
      for (const [key, value] of entries) insert.run(key, value);
    });
    insertMany(Object.entries(DEFAULT_SETTINGS));
  }

  const statsCount = db.prepare("SELECT COUNT(*) AS n FROM stats").get().n;
  if (statsCount === 0) {
    const insert = db.prepare("INSERT INTO stats (number, label, position) VALUES (?, ?, ?)");
    const insertMany = db.transaction((rows) => {
      rows.forEach((row, i) => insert.run(row.number, row.label, i));
    });
    insertMany(DEFAULT_STATS);
  }

  const productsCount = db.prepare("SELECT COUNT(*) AS n FROM products").get().n;
  if (productsCount === 0) {
    const insert = db.prepare(
      "INSERT INTO products (tag, tag_style, title, description, items, image_url, position, published) VALUES (?, ?, ?, ?, ?, ?, ?, 1)"
    );
    const insertMany = db.transaction((rows) => {
      rows.forEach((row, i) => {
        insert.run(row.tag, row.tag_style, row.title, row.description, JSON.stringify(row.items), "", i);
      });
    });
    insertMany(DEFAULT_PRODUCTS);
  }

  const adminCount = db.prepare("SELECT COUNT(*) AS n FROM admin_users").get().n;
  if (adminCount === 0) {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "change-moi";
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)").run(username, hash);
    // eslint-disable-next-line no-console
    console.log(
      `[init] Compte admin créé : "${username}". Pense à changer le mot de passe depuis le menu admin.`
    );
  }
}

seedIfEmpty();

function getAllSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  return settings;
}

function setSettings(entries) {
  const upsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  const tx = db.transaction((pairs) => {
    for (const [key, value] of pairs) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
        upsert.run(key, String(value ?? ""));
      }
    }
  });
  tx(Object.entries(entries));
}

function getStats() {
  return db.prepare("SELECT * FROM stats ORDER BY position ASC, id ASC").all();
}

function setStats(stats) {
  const del = db.prepare("DELETE FROM stats");
  const insert = db.prepare("INSERT INTO stats (number, label, position) VALUES (?, ?, ?)");
  const tx = db.transaction((rows) => {
    del.run();
    rows.forEach((row, i) => insert.run(String(row.number || ""), String(row.label || ""), i));
  });
  tx(stats);
}

function getPublishedProducts() {
  return db
    .prepare("SELECT * FROM products WHERE published = 1 ORDER BY position ASC, id ASC")
    .all()
    .map(parseProduct);
}

function getAllProducts() {
  return db.prepare("SELECT * FROM products ORDER BY position ASC, id ASC").all().map(parseProduct);
}

function parseProduct(row) {
  let items = [];
  try {
    items = JSON.parse(row.items);
  } catch (e) {
    items = [];
  }
  return { ...row, items };
}

function createProduct(data) {
  const maxPos = db.prepare("SELECT COALESCE(MAX(position), -1) AS m FROM products").get().m;
  const info = db
    .prepare(
      "INSERT INTO products (tag, tag_style, title, description, items, image_url, position, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      data.tag || "",
      data.tag_style || "default",
      data.title || "",
      data.description || "",
      JSON.stringify(data.items || []),
      data.image_url || "",
      maxPos + 1,
      data.published ? 1 : 0
    );
  return info.lastInsertRowid;
}

function updateProduct(id, data) {
  db.prepare(
    "UPDATE products SET tag = ?, tag_style = ?, title = ?, description = ?, items = ?, image_url = ?, published = ? WHERE id = ?"
  ).run(
    data.tag || "",
    data.tag_style || "default",
    data.title || "",
    data.description || "",
    JSON.stringify(data.items || []),
    data.image_url || "",
    data.published ? 1 : 0,
    id
  );
}

function deleteProduct(id) {
  db.prepare("DELETE FROM products WHERE id = ?").run(id);
}

function reorderProducts(orderedIds) {
  const update = db.prepare("UPDATE products SET position = ? WHERE id = ?");
  const tx = db.transaction((ids) => {
    ids.forEach((id, i) => update.run(i, id));
  });
  tx(orderedIds);
}

function findAdminByUsername(username) {
  return db.prepare("SELECT * FROM admin_users WHERE username = ?").get(username);
}

function updateAdminPassword(id, passwordHash) {
  db.prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
}

module.exports = {
  db,
  DEFAULT_SETTINGS,
  getAllSettings,
  setSettings,
  getStats,
  setStats,
  getPublishedProducts,
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  reorderProducts,
  findAdminByUsername,
  updateAdminPassword,
};
