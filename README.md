# Hub de projets

Page d'accueil avec un bouton par projet. Chaque projet vit sous son propre chemin
(`https://domaine/llm/`, `https://domaine/mon-projet/`…), servi par Caddy.

## Installation sur le VPS (Ubuntu / Debian)

```bash
curl -fsSLo install-hub.sh https://raw.githubusercontent.com/czb5y8fj7d-prog/test-git-/hub/server/install-hub.sh && bash install-hub.sh geokolis.tech
```

Installe Caddy, la page d'accueil, la commande `hub`, et publie LocalLM sur `/llm/`.
L'API Ollama reste protégée par la même clé d'accès (reprise de la config existante).

## Ajouter un projet

Un projet = une branche du dépôt, avec `index.html` à la racine de la branche.

```bash
hub add mon-projet --titre "Mon projet" --desc "Ce qu'il fait" --icone "🚀" --branche ma-branche
```

- `--branche` : branche GitHub à publier (par défaut : le nom du projet)
- `--depot` : autre dépôt GitHub (par défaut : ce dépôt)

Autres commandes : `hub list`, `hub update` (git pull de tout), `hub remove nom` (dépublie, garde les fichiers).

## Règles pour un projet

- Chemins **relatifs** (`./app.js`, `style.css`), jamais `/app.js` : le projet est servi sous `/nom/`.
- Tous les projets partagent la même origine : préfixer les clés `localStorage` / bases IndexedDB
  par le nom du projet (ex. `locallm.settings`).
- `/api/*`, `/v1/*` et `/projects.json` sont réservés (API Ollama et liste des boutons).

## Organisation sur le serveur

| Chemin | Rôle |
|---|---|
| `/var/www/hub/` | cette branche (page d'accueil et scripts) |
| `/var/www/projects/<nom>/` | un projet |
| `/etc/caddy/projects/<nom>.caddy` | le routage d'un projet (créé par `hub add`) |
| `/var/lib/hub/projects.json` | la liste des boutons |
