# Éditeur d'ebook → PDF

Application 100% front-end (React + Vite + TypeScript) pour composer un livre en chapitres/sections avec un éditeur riche, en prévisualiser la mise en page paginée, et l'exporter en PDF.

## Démarrage local

```bash
cd ebook-editor
npm install
npm run dev
```

Ouvrez ensuite l'URL affichée (par défaut http://localhost:5173).

## Build de production

```bash
npm run build
npm run preview
```

## Fonctionnement

- **Arborescence (gauche)** : chapitres et sections, glisser-déposer pour réordonner, boutons pour ajouter/renommer/supprimer. La page de garde (titre, sous-titre, auteur) est éditable via l'entrée dédiée en haut de l'arborescence.
- **Éditeur (centre)** : éditeur riche [Tiptap](https://tiptap.dev/) — gras/italique/souligné, titres H1-H3, listes, citations, séparateurs, alignement, insertion d'images redimensionnables avec légende, choix de police/taille en surbrillance locale.
- **Réglages (droite, onglet "Réglages")** : format de page (A4/A5), marges, style typographique global du livre, avec possibilité de le surcharger par chapitre ou par section.
- **Aperçu (droite, onglet "Aperçu")** : rendu paginé fidèle au PDF final, généré avec [Paged.js](https://pagedjs.org/), incluant page de garde, table des matières automatique (avec numéros de page) et sauts de page entre chapitres.
- **Export PDF** : le bouton "Exporter en PDF" bascule sur l'aperçu paginé et ouvre la boîte d'impression du navigateur — choisissez "Enregistrer au format PDF" comme destination. Cette approche (Paged.js + impression navigateur) garantit un PDF vectoriel, fidèle à l'aperçu, sans dépendre d'un serveur.
- **Sauvegarde** : le projet est automatiquement sauvegardé dans IndexedDB à chaque modification. Les boutons "Importer"/"Exporter JSON" permettent une sauvegarde manuelle portable (fichier `.json`).

## Choix techniques

- **Tiptap** (ProseMirror) pour l'édition riche : extensible, JSON sérialisable, pas de réinvention d'un éditeur WYSIWYG.
- **Paged.js** pour la pagination : polyfill CSS Paged Media qui pagine le HTML directement dans le navigateur (mêmes règles `@page`, sauts de page, `target-counter()` pour la table des matières), puis `window.print()` produit un PDF vectoriel fidèle sans backend.
- **Zustand** pour l'état global, **@dnd-kit** pour le glisser-déposer, **idb** pour la persistance IndexedDB, **@fontsource** pour embarquer les polices en local.
