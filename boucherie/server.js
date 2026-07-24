require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");

require("./db"); // ensures DB is initialised/seeded before routes load
const SqliteSessionStore = require("./db/sessionStore");

const siteRoutes = require("./routes/site");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("trust proxy", 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    store: new SqliteSessionStore(),
    name: "ml_admin_sid",
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 8, // 8h
    },
  })
);

app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));
app.use(express.static(path.join(__dirname, "public")));

app.use("/admin", adminRoutes);
app.use("/", siteRoutes);

app.use((req, res) => {
  res.status(404).send("Page introuvable.");
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Maison Lambert — serveur démarré sur http://localhost:${PORT}`);
});
