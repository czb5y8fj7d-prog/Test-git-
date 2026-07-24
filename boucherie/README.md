# Maison Lambert — site vitrine + menu admin

Site vitrine dynamique (Node.js + Express + SQLite) avec un menu d'administration
protégé par mot de passe pour éditer soi-même : infos & coordonnées, textes,
couleurs (apparence) et produits/services — sans toucher au code.

## Structure

```
boucherie/
  server.js            point d'entrée du serveur
  db/                   base SQLite (schema, seed, accès aux données, sessions)
  routes/                routes publiques (site) et admin (login + API)
  middleware/            authentification, CSRF, upload d'images
  views/                  gabarits EJS (site public + dashboard admin)
  public/                 CSS, JS, images uploadées, servis tels quels
  data/                   fichier boucherie.db (créé automatiquement, non versionné)
```

## Lancer le site en local

Prérequis : Node.js 18+ (testé avec Node 22).

```bash
cd boucherie
cp .env.example .env     # puis éditer .env (voir ci-dessous)
npm install
npm start
```

Le site est alors accessible sur `http://localhost:3000/` et le menu admin sur
`http://localhost:3000/admin`.

### Variables d'environnement (`.env`)

| Variable         | Rôle                                                                 |
|------------------|-----------------------------------------------------------------------|
| `PORT`           | Port d'écoute du serveur (3000 par défaut)                            |
| `SESSION_SECRET` | Clé secrète qui signe les cookies de session admin — **à changer**    |
| `ADMIN_USERNAME` | Identifiant admin, utilisé **une seule fois** à la création de la base |
| `ADMIN_PASSWORD` | Mot de passe admin, utilisé **une seule fois** à la création de la base |

`ADMIN_USERNAME`/`ADMIN_PASSWORD` ne servent qu'au tout premier démarrage,
quand `data/boucherie.db` n'existe pas encore : le compte est créé avec ces
identifiants. Ensuite, change le mot de passe depuis l'onglet **Mon compte**
du menu admin — les variables d'environnement ne sont plus utilisées après.

La base de données SQLite (`data/boucherie.db`) contient tout le contenu
éditable du site. **Elle n'est pas versionnée dans Git** (voir `.gitignore`)
et doit être sauvegardée/persistée séparément sur le serveur de production.

## Déployer sur Ionos

Le site n'est plus un simple site statique : il a besoin d'un environnement
qui peut exécuter Node.js en continu. Selon l'offre Ionos que tu as :

### Option A — Hébergement Ionos avec support Node.js (Deploy Now / Webhosting Node.js)

1. Dans l'espace client Ionos, crée/configure une application Node.js et
   pointe-la vers ce dossier `boucherie/` (dépôt Git ou envoi SFTP).
2. Renseigne le **fichier de démarrage** : `server.js`.
3. Dans les **variables d'environnement** de l'app Ionos, ajoute
   `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` (et `PORT` si Ionos
   l'impose — beaucoup de plateformes injectent `PORT` automatiquement, le
   code le respecte déjà via `process.env.PORT`).
4. Ionos exécute `npm install` puis `npm start` automatiquement (ou lance
   ces commandes toi-même si l'interface le demande).
5. Vérifie que le dossier `data/` est bien sur un stockage **persistant**
   (pas effacé à chaque redéploiement), sinon le contenu édité serait perdu
   à chaque mise à jour du code.

### Option B — Serveur Ionos (VPS / Cloud Server) en SSH

```bash
# Sur le serveur, une fois connecté en SSH
sudo apt update && sudo apt install -y nodejs npm   # ou nvm si tu préfères une version précise
git clone <ton-dépôt> maison-lambert && cd maison-lambert/boucherie
cp .env.example .env && nano .env                    # renseigne les variables
npm install --omit=dev
npm install -g pm2                                    # garde le process actif
pm2 start server.js --name maison-lambert
pm2 save && pm2 startup                               # relance auto au reboot
```

Ensuite, mets un reverse proxy Nginx devant le port Node (3000 par défaut)
pour servir le site en HTTPS avec ton nom de domaine (Certbot/Let's Encrypt
pour le certificat SSL). Exemple minimal de config Nginx :

```nginx
server {
    listen 80;
    server_name tondomaine.fr;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Après la mise en ligne

1. Va sur `https://tondomaine.fr/admin`, connecte-toi avec les identifiants
   définis dans `.env`, puis change immédiatement le mot de passe dans
   **Mon compte**.
2. Édite les infos, textes, couleurs et produits depuis le menu admin — les
   changements apparaissent immédiatement sur le site public.
3. Pense à sauvegarder régulièrement le fichier `data/boucherie.db` (toutes
   les données éditées y sont stockées).

## Menu admin — ce qui est éditable

- **Infos & coordonnées** : nom, téléphone, e-mail, adresse, horaires, réseaux sociaux
- **Textes du site** : titres et paragraphes de chaque section, SEO (titre/description)
- **Apparence** : couleur principale, couleur accent, fond, texte
- **Produits & services** : cartes de la section « Nos viandes » (titre, étiquette, description, liste de points, image, ordre, publié/masqué)
- **Chiffres clés** : les 4 chiffres sous la bannière d'accueil
- **Mon compte** : changement du mot de passe admin
