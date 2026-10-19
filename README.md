# LL (LocalLM)

Chat avec un LLM, en local dans le navigateur (WebGPU / WASM) ou sur votre propre serveur (Ollama).
Application statique, sans build : `index.html`, `app.js`, `style.css`, `models.js` et les modules `md.js`
(Markdown), `docs.js` (pièces jointes), `tools.js` (outils), `voice.js` (dictée / lecture), `sw.js`, `manifest.json`.

## Fonctions

- **Rôles** : généraliste, analyste marché, traducteur, relecteur, codeur, personnalisé (menu au-dessus de la saisie).
- **Réflexion** de qwen3 : puce 🧠 (repliable dans la réponse). **Web** : puce 🌐 (recherche et lecture de pages par le serveur).
- **Markdown** complet (titres, listes, tableaux, code coloré avec bouton Copier).
- **Pièces jointes** : texte, CSV, JSON, PDF, Excel, Word (lus dans le navigateur ; extraits pertinents si le document est long) et **photos** (modèle de vision du serveur, ex. `ollama pull qwen2.5vl:7b`).
- **Outils** appelés par le modèle : calculatrice exacte, date/heure, documents joints, recherche web, lecture de page.
- **Réponses persistantes** : avec le serveur à jour, la génération continue même si l'app passe en arrière-plan ou est fermée ; le texte est récupéré au retour. Sinon, reprise d'une réponse coupée : bouton « ▶ Reprendre ».
- **Images** 🎨 : FLUX.1 schnell sur le serveur (plusieurs minutes par image, suivi en direct, annulation) ; le modèle peut aussi en créer via l'outil `generer_image`. Installation : `install-images.sh` (branche `hub`).
- **Dictée** 🎙 et **lecture à voix haute** 🔊 (selon le navigateur).
- **État du serveur** : pastille « prêt / à froid » (toucher pour précharger le modèle).
- **Connexion** par mot de passe (session révocable) ou clé d'accès.

## Déploiement sur un VPS (Ubuntu / Debian)

Voir la branche `hub` : `server/install-hub.sh` installe Caddy, la page d'accueil, LL et le service `ll-server`.
Mise à jour de l'app après un `git push` : `hub update` sur le serveur.

```bash
ll-auth passwd       # définir le mot de passe de connexion
ll-auth rotate-key   # nouvelle clé d'accès (l'ancienne cesse de marcher)
ll-auth logout-all   # déconnecter tous les appareils
```

Aucune clé n'est stockée dans ce dépôt.
