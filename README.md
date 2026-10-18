# LocalLM

Chat avec un LLM, en local dans le navigateur (WebGPU / WASM) ou sur votre propre serveur (Ollama).
Application statique : `index.html`, `app.js`, `style.css`, `models.js`, `sw.js`, `manifest.json`.

## Déploiement sur un VPS (Ubuntu / Debian)

```bash
curl -fsSLo install-app.sh https://raw.githubusercontent.com/czb5y8fj7d-prog/test-git-/locallm/server/install-app.sh && bash install-app.sh
```

Le script installe Caddy (HTTPS automatique), récupère l'app dans `/var/www/locallm` et protège l'API Ollama par une clé.
Pour mettre à jour après un `git push` : relancer la même commande, ou `sudo git -C /var/www/locallm pull`.

Aucune clé n'est stockée dans ce dépôt.
