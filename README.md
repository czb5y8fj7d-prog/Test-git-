# Sites statiques

Tous les projets statiques (HTML/CSS/JS, sans serveur applicatif) au même endroit, un dossier par projet.
Le fichier `projects.json` décrit ce qui est publié sur le site et sous quel nom.

| Dossier | Adresse | Contenu |
|---|---|---|
| `lumea/` | `/lumea/` | Site vitrine LUMÉA (compléments alimentaires) + quiz + bilan bien-être |
| `maison-lambert/` | `/maison-lambert/` | Site vitrine de boucherie-charcuterie-traiteur |
| `nutriglow/` | `/nutriglow/` | NutriGlow — Assistant perte de poids (un seul fichier) |
| `nutriglow-adaptive/` | `/nutriglow-adaptive/` | NutriGlow Adaptive, planificateur de repas mobile |
| `ebook/` | `/ebook/` | Éditeur d'ebook → PDF (version compilée) |
| `carte-pays/` | `/carte-pays/` | Carte du monde depuis Excel (`index.html` hors ligne, `en-ligne.html` avec CDN) |
| `ferme-haut-champ/` | `/ferme-haut-champ/` | Ferme du Haut-Champ (jeu de gestion) |
| `demiurge/` | `/demiurge/` | Démiurge (jeu bac à sable) |
| `atlas-des-mondes/` | `/atlas-des-mondes/` | Atlas des Mondes (stratégie ; l'IA conseillère ne fonctionne que dans Claude) |
| `controle-exigences/` | `/controle-exigences/` | Contrôle des exigences |
| `perf-vehicule/` | `/perf-vehicule/` | Simulateur de performances véhicule (export PDF seulement dans Claude) |
| `atelier-sysml/` | `/atelier-sysml/` | Atelier SysML (bibliothèque stockée dans le navigateur) |
| `simulateur-moteur/` | `/simulateur-moteur/` | Simulateur moteur |
| `atlas-horaire/` | `/atlas-horaire/` | Atlas horaire |
| `souffleur-cx/` | `/souffleur-cx/` | Souffleur Cx |

## Publier sur le serveur

```bash
hub sync
```

Récupère cette branche et publie chaque entrée de `projects.json`. Relancer après chaque `git push`.

## Ajouter un projet statique ici

1. Créer un dossier avec un `index.html` à sa racine (chemins **relatifs** : `assets/app.js`, pas `/assets/app.js`).
2. Ajouter une entrée dans `projects.json` (`slug`, `dir`, `title`, `desc`, `icon`, `cat`, `order`).
3. `git push`, puis `hub sync` sur le serveur.

## Pas ici

- `ebook-editor/` (code source React/Vite) : branche `claude/ebook-editor-pdf-ku4foi`.
- Applications PHP (NutriCoach, Maison Lambert avec menu admin) : elles demandent PHP et un mot de passe admin ; branches `claude/nutrition-weight-loss-app-n9278z` et `claude/showcase-site-admin-menu-yrwjxt`.

- Atelier d'ebook (artefact) : déjà couvert par `ebook/`. Aquapedia : dépend de la base de données de Claude, inutilisable hors de Claude.
- L'ordre des boutons suit `order` (le 4ᵉ est réservé à LL, ajouté par `install-hub.sh`).
