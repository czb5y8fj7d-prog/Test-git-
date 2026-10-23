# Hub de projets

Page d'accueil avec un bouton par projet. Chaque projet vit sous son propre chemin
(`https://domaine/llm/`, `https://domaine/mon-projet/`…), servi par Caddy.

## Installation sur le VPS (Ubuntu / Debian)

```bash
curl -fsSLo install-hub.sh https://raw.githubusercontent.com/czb5y8fj7d-prog/test-git-/hub/server/install-hub.sh && bash install-hub.sh geokolis.tech
```

Installe Caddy, la page d'accueil, la commande `hub`, et publie LocalLM sur `/llm/`.
L'API Ollama reste protégée par la même clé d'accès (reprise de la config existante).

## Menu admin (sur le site)

En bas de l'accueil, **Admin** (ou directement `https://domaine/#admin`) : connexion avec le mot de passe
de `ll-auth passwd`, puis :

- **+ Ajouter** un bouton (titre, description, icône, catégorie, lien vers `/un-chemin/` ou `https://…`) ;
- **✎** renommer / modifier, **↑ ↓** changer l'ordre ;
- **🗑** retirer de l'accueil : le bouton passe dans « Retirés de l'accueil », d'où on peut le remettre (↺)
  ou l'effacer (✕). Le projet lui-même reste en ligne sur son chemin (`hub remove` pour le dépublier).

Les boutons modifiés depuis le menu ne sont plus réécrits par `hub sync` / `hub update` ;
un `hub add nom …` explicite reprend la main sur ce projet.
Le menu modifie seulement les boutons : installer un nouveau projet sur le serveur se fait toujours avec `hub add`.

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
