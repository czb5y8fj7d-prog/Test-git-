# Moteur Tycoon

Moteur réutilisable pour jeux de gestion, extrait de **Plan de Vol**. Voir **[ENGINE.md](ENGINE.md)**.

```bash
node build.mjs ecurie            # → dist/ecurie.html (jeu de démo, fichier unique)
node tests/sim.test.mjs          # tests du noyau (sans DOM)
npm i jsdom && node tests/ui.test.mjs   # test d'interface
```
