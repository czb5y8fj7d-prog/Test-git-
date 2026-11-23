# Tanger — profils de trajets pour voiture électrique

Page interactive (`index.html`) : carte, profil d'élévation, pentes et surcoût énergétique d'une voiture électrique sur des trajets types et extrêmes à Tanger.

## État actuel

- Les 6 trajets intégrés à la page sont des **estimations** (altitudes ±20–30 m, tracés = points de passage, pas la route exacte).
- La page sait charger de **vrais GPX** : bouton « Charger un vrai tracé GPX », ou automatiquement depuis `routes/` (voir plus bas).
- Fond de carte : littoral et grands axes Natural Earth (peu détaillé, pas de rues).

## Pour obtenir les vrais tracés

### Option A — GPX faits à la main (le plus simple)
1. Trace chaque itinéraire en mode voiture sur onthegomap.com ou gpx.studio.
2. Exporte en `.gpx` avec altitudes.
3. Dépose les fichiers dans `routes/` et liste leurs noms dans `routes/index.json`, par exemple :
   ```json
   ["corniche-port.gpx", "centre-aeroport.gpx", "centre-cap-spartel.gpx"]
   ```
4. Ouvre `index.html` : les tracés sont chargés automatiquement.

### Option B — calcul automatique (données à fournir)
Dépose ces deux fichiers :
- `data/osm/` : extraction OpenStreetMap de la zone Tanger–Tétouan–Chefchaouen (`.osm.pbf`), depuis export.hotosm.org ou Geofabrik, découpée sur la zone (lon −6,1 à −5,0 ; lat 35,0 à 36,0).
- `data/srtm/` : dalle d'altitude `N35W006.hgt` (1 arc-seconde ≈ 30 m de préférence ; 3 arc-secondes ≈ 90 m adoucit les pentes urbaines).

Puis :
```bash
pip install pyrosm networkx numpy scipy
python scripts/build_routes.py data/osm/<fichier>.osm.pbf data/srtm/N35W006.hgt
```
Le script calcule l'itinéraire routier le plus court entre les points de passage de chaque trajet, échantillonne l'altitude SRTM, écrit un GPX par trajet dans `routes/` et met à jour `routes/index.json`.

> `scripts/build_routes.py` n'a pas encore été testé sur de vraies données.

Limite GitHub : 100 Mo par fichier.

## Modèle énergétique (dans la page)
Énergie de montée = m·g·Δh / 0,9, moins la part récupérée en descente (régénération réglable). Vitesse, vent, climatisation et température ne sont pas pris en compte.

## Sources
- Natural Earth (domaine public) : littoral et routes principales.
- NREL, impact de la pente sur la consommation : https://www.nrel.gov/news/program/2014/10332.html
