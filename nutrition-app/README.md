# NutriCoach 🥗

Application web de coaching nutrition et perte de poids : profil personnalisé,
calcul de calories/macros, recettes, planning de repas hebdomadaire, liste de
courses automatique, suivi de poids, objectifs et défis ludiques avec points/badges.

100% PHP + SQLite, **aucune dépendance externe, aucun build, aucune configuration
serveur particulière**. Tous les fichiers sont à la racine du dossier (pas de
sous-dossiers) pour un dépôt FTP le plus simple possible. Compatible avec
l'hébergement mutualisé IONOS "en natif".

## Déploiement sur IONOS (hébergement mutualisé)

1. Dans l'espace client IONOS, vérifie que la **version de PHP est 8.0 ou
   supérieure** (Hébergement → Configurer PHP). C'est un simple réglage dans
   le panneau, sans configuration serveur avancée.
2. Récupère tous les fichiers de ce zip et envoie-les via FTP/SFTP (FileZilla,
   ou le gestionnaire de fichiers IONOS) dans le dossier de ton domaine
   (souvent `/`, ou un sous-dossier si tu veux l'installer sur
   `tondomaine.fr/nutricoach`). Tous les fichiers vont directement dans ce
   même dossier, il n'y a aucune arborescence à recréer.
3. Assure-toi que ce dossier est **accessible en écriture** par PHP (c'est le
   cas par défaut chez IONOS). C'est là que le fichier `nutricoach.sqlite`
   sera créé automatiquement au premier accès.
4. Ouvre `https://tondomaine.fr/` (ou `/nutricoach/`) dans un navigateur :
   la base de données et les recettes de démarrage sont créées automatiquement
   dès la première visite. Il ne reste plus qu'à créer ton compte !

Aucune base MySQL, aucun panneau d'administration à configurer : tout est
autonome dans le dossier de l'application. Le fichier `.htaccess` fourni
bloque l'accès web direct aux fichiers internes (`db.php`, `auth.php`...) et
à la base de données — seules les pages de l'application restent accessibles.

## Structure du projet (tout à plat, aucun sous-dossier)

```
nutrition-app/
├── config.php              Point d'entrée commun (session, includes)
├── schema.sql               Structure de la base SQLite
├── db.php                    Connexion + installation automatique de la base
├── seed.php                   Recettes publiques pré-chargées
├── auth.php                    Inscription / connexion / session
├── functions.php                Fonctions communes (points, badges, listes de courses...)
├── nutrition_engine.php          Calculs caloriques (Mifflin-St Jeor) et conseils
├── header.php / footer.php        Gabarit de page (inclus par chaque page)
├── style.css                Design (aucune dépendance externe)
├── app.js                     Petites interactions (menu mobile, auto-validation)
├── .htaccess                Protège les fichiers internes et la base SQLite
├── index.php, login.php, register.php, logout.php
├── dashboard.php             Tableau de bord (stats, coach du jour, défi, suivi du jour)
├── profile.php               Profil + calcul calories/macros personnalisés
├── goals.php                 Objectifs de poids + objectifs personnels
├── recipes.php, recipe_form.php, recipe_delete.php   Livre de recettes (public + personnel)
├── menu.php, menu_autogenerate.php                    Planning hebdomadaire + génération auto
├── shopping_list.php         Liste de courses agrégée depuis le planning
├── weight_log.php            Suivi de poids + graphique SVG
├── tips.php                   Conseils du jour + défis hebdomadaires
└── nutricoach.sqlite         Base de données (créée automatiquement au 1er accès)
```

## Fonctionnement multi-utilisateurs

Chaque utilisateur dispose de son propre compte (mot de passe haché avec
`password_hash`), de son profil, ses recettes personnelles, son planning, sa
liste de courses et son historique de poids — totalement isolés des autres
comptes. Une bibliothèque de recettes publiques est partagée par tous et peut
être copiée et personnalisée par chacun.

## Personnalisation

- **Recettes de base** : modifie `seed.php` avant le premier lancement (avant
  que le fichier `nutricoach.sqlite` soit créé) pour changer la bibliothèque
  de recettes de démarrage.
- **Couleurs / style** : tout est dans `style.css` (variables CSS en haut de
  fichier).
- **Règles de calcul caloriques** : `nutrition_engine.php`.

## Sauvegarde

La base de données est le fichier unique `nutricoach.sqlite`, à la racine du
site. Pour sauvegarder toutes les données de tous les utilisateurs, il suffit
de télécharger ce fichier régulièrement via FTP.
