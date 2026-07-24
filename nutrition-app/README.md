# NutriCoach 🥗

Application web de coaching nutrition et perte de poids : profil personnalisé,
calcul de calories/macros, recettes, planning de repas hebdomadaire, liste de
courses automatique, suivi de poids, objectifs et défis ludiques avec points/badges.

100% PHP + SQLite, **aucune dépendance externe, aucun build, aucune configuration
serveur particulière**. Compatible avec l'hébergement mutualisé IONOS "en natif".

## Déploiement sur IONOS (hébergement mutualisé)

1. Dans l'espace client IONOS, vérifie que la **version de PHP est 8.0 ou
   supérieure** (Hébergement → Configurer PHP). C'est un simple réglage dans
   le panneau, sans configuration serveur avancée.
2. Récupère tous les fichiers de ce zip (en conservant l'arborescence) et
   envoie-les via FTP/SFTP (FileZilla, ou le gestionnaire de fichiers IONOS)
   dans le dossier de ton domaine (souvent `/`, ou un sous-dossier si tu veux
   l'installer sur `tondomaine.fr/nutricoach`).
3. Assure-toi que le dossier `data/` est bien présent et **accessible en
   écriture** par PHP (c'est le cas par défaut chez IONOS). C'est là que la
   base SQLite sera créée automatiquement au premier accès.
4. Ouvre `https://tondomaine.fr/` (ou `/nutricoach/`) dans un navigateur :
   la base de données et les recettes de démarrage sont créées automatiquement
   dès la première visite. Il ne reste plus qu'à créer ton compte !

Aucune base MySQL, aucun panneau d'administration à configurer : tout est
autonome dans le dossier de l'application.

## Structure du projet

```
nutrition-app/
├── config.php              Point d'entrée commun (session, includes)
├── schema.sql               Structure de la base SQLite
├── includes/
│   ├── db.php                Connexion + installation automatique de la base
│   ├── seed.php               Recettes publiques pré-chargées
│   ├── auth.php                Inscription / connexion / session
│   ├── functions.php            Fonctions communes (points, badges, listes de courses...)
│   ├── nutrition_engine.php      Calculs caloriques (Mifflin-St Jeor) et conseils
│   ├── header.php / footer.php    Gabarit de page
├── assets/
│   ├── css/style.css          Design (aucune dépendance externe)
│   └── js/app.js               Petites interactions (menu mobile, auto-validation)
├── data/                     Base SQLite (créée automatiquement, protégée par .htaccess)
├── index.php, login.php, register.php, logout.php
├── dashboard.php             Tableau de bord (stats, coach du jour, défi, suivi du jour)
├── profile.php               Profil + calcul calories/macros personnalisés
├── goals.php                 Objectifs de poids + objectifs personnels
├── recipes.php, recipe_form.php, recipe_delete.php   Livre de recettes (public + personnel)
├── menu.php, menu_autogenerate.php                    Planning hebdomadaire + génération auto
├── shopping_list.php         Liste de courses agrégée depuis le planning
├── weight_log.php            Suivi de poids + graphique SVG
└── tips.php                   Conseils du jour + défis hebdomadaires
```

## Fonctionnement multi-utilisateurs

Chaque utilisateur dispose de son propre compte (mot de passe haché avec
`password_hash`), de son profil, ses recettes personnelles, son planning, sa
liste de courses et son historique de poids — totalement isolés des autres
comptes. Une bibliothèque de recettes publiques est partagée par tous et peut
être copiée et personnalisée par chacun.

## Personnalisation

- **Recettes de base** : modifie `includes/seed.php` avant le premier lancement
  (avant que le fichier `data/nutricoach.sqlite` soit créé) pour changer la
  bibliothèque de recettes de démarrage.
- **Couleurs / style** : tout est dans `assets/css/style.css` (variables CSS
  en haut de fichier).
- **Règles de calcul caloriques** : `includes/nutrition_engine.php`.

## Sauvegarde

La base de données est le fichier unique `data/nutricoach.sqlite`. Pour
sauvegarder toutes les données de tous les utilisateurs, il suffit de
télécharger ce fichier régulièrement via FTP.
