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

## Service LL (connexion, recherche web)

`install-hub.sh` installe aussi `ll-server` (service systemd, `127.0.0.1:8787`, derrière Caddy sous `/_ll/`).
Il vérifie chaque requête vers l'API (clé d'accès **ou** session par mot de passe) et fournit la recherche web et la lecture de pages pour LL.

```bash
ll-auth passwd       # définir / changer le mot de passe (déconnecte les appareils)
ll-auth rotate-key   # nouvelle clé d'accès
ll-auth logout-all   # déconnecter tous les appareils
ll-auth status
```

### Réponses persistantes
Avec le service à jour, la réponse du modèle est lue par `ll-server` (`/_ll/chat`, sondage long) et non par l'app : si l'iPhone met l'app en veille, la génération continue et le texte est récupéré au retour (reprise au bon décalage, aussi après un rechargement de la page). Les tâches sont gardées 2 h en mémoire. Un serveur plus ancien est détecté (`capabilities`) et l'app retombe sur le flux direct.

## Images (FLUX.1 schnell)

`server/install-images.sh` installe stable-diffusion.cpp et FLUX.1 schnell (Q8, ≈ 19 Go) dans `/opt/ll/sd`.
`ll-server` le détecte seul : le bouton 🎨 apparaît dans LL. Le modèle texte est déchargé pendant le dessin.

## Administration de l'accueil (`/admin/`)

`https://<hôte>/admin/` permet de modifier la page d'accueil sans toucher au serveur : textes (titre, surtitre, accroche, pied de page), titre / description / icône / catégorie de chaque carte, masquer ou réordonner, ajouter ou supprimer des liens externes.

- Connexion : mot de passe défini par `ll-auth passwd` (la clé d'accès ne suffit pas).
- Les modifications sont enregistrées dans `$LL_STATE/site.json` (sauvegarde `.bak` à chaque écriture) et **superposées** à `/var/lib/hub/projects.json` (`HUB_DATA`, fichier géré par la commande `hub`) : `hub sync` / `hub update` n'écrasent donc pas vos retouches.
- Publier ou retirer un vrai projet reste le rôle de `hub add` / `hub remove` ; l'admin peut le renommer, le masquer, le réordonner.
- Mise à jour d'une installation existante : `hub update`, puis `sudo bash /var/www/hub/server/install-hub.sh <hôte>` (nouvelle route Caddy `/_hub/site.json`), puis `sudo systemctl restart ll-server`.
- `admin` est un nom de projet réservé.
