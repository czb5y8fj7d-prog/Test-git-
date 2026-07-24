# Maison Lambert — site vitrine + menu admin (PHP)

Site vitrine dynamique en PHP pur (aucune dépendance à installer) avec un
menu d'administration protégé par mot de passe pour éditer soi-même : infos
& coordonnées, textes, couleurs (apparence) et produits/services — sans
toucher au code.

## Structure

Volontairement minimale — un seul point d'entrée, tout le reste tient dans 3 fichiers :

```
boucherie/
  index.php            point d'entrée : routeur + page publique
  admin.php              menu admin (connexion, tableau de bord, API)
  functions.php           base de données SQLite + helpers, inclus par les deux
  config.sample.php        à copier en config.php avant le 1er lancement
  .htaccess                 redirige tout vers index.php + protège la base
  assets/                    style.css, admin.css, main.js, admin.js
  uploads/                    images de produits envoyées depuis l'admin
  data/                        site.db (créé automatiquement, non versionné)
```

Aucun `npm install`, aucune dépendance : juste PHP (8+) avec l'extension
`pdo_sqlite`, activée par défaut chez la quasi-totalité des hébergeurs PHP,
Ionos compris.

## Mettre en ligne sur Ionos (hébergement PHP mutualisé)

1. Copie `config.sample.php` en `config.php` et renseigne un identifiant et
   mot de passe admin de départ :
   ```php
   <?php
   return [
       'admin_username' => 'admin',
       'admin_password' => 'un-mot-de-passe-fort',
   ];
   ```
2. Envoie **tout le contenu du dossier `boucherie/`** (y compris les fichiers
   cachés `.htaccess` et `.gitignore` n'a pas besoin d'être envoyé) à la
   racine de ton espace Ionos, via FTP/SFTP ou le gestionnaire de fichiers
   de l'espace client.
3. Vérifie que les dossiers `data/` et `uploads/` sont **accessibles en
   écriture** (permissions 755 ou 775 — c'est le cas par défaut sur la
   plupart des hébergements Ionos).
4. Va sur `https://tondomaine.fr/` : le site s'affiche directement. La base
   `data/site.db` est créée automatiquement au premier chargement, pré-remplie
   avec le contenu actuel.
5. Va sur `https://tondomaine.fr/admin`, connecte-toi avec les identifiants
   définis dans `config.php`, puis change immédiatement le mot de passe dans
   l'onglet **Mon compte**. `config.php` ne sert plus après la création du
   premier compte — tu peux même le supprimer une fois connecté (il sera
   régénéré au besoin en le recopiant depuis `config.sample.php`).

C'est tout : pas de build, pas de process à garder actif, pas de base de
données externe à créer. Ionos exécute `index.php`/`admin.php` comme
n'importe quel script PHP classique.

### Tester en local avant l'envoi (optionnel)

```bash
cd boucherie
cp config.sample.php config.php   # puis éditer config.php
php -S localhost:8000
```

Le serveur de développement intégré de PHP ne lit pas `.htaccess` : pour
tester exactement le même routage qu'en production, utilise plutôt un
routeur minimal :

```bash
php -S localhost:8000 -t . router.php
```

avec un `router.php` du style :

```php
<?php
$path = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
if ($path !== '/' && file_exists(__DIR__ . $path) && !is_dir(__DIR__ . $path)) {
    return false;
}
require __DIR__ . '/index.php';
```

(pas nécessaire sur Ionos, qui utilise Apache + `.htaccess` directement)

### Sauvegardes

Toutes les données éditées depuis le menu admin vivent dans
`data/site.db`. Télécharge ce fichier régulièrement (FTP) pour le
sauvegarder — c'est la seule chose à sauvegarder, tout le reste est
statique.

## Menu admin — ce qui est éditable

- **Infos & coordonnées** : nom, téléphone, e-mail, adresse, horaires, réseaux sociaux
- **Textes du site** : titres et paragraphes de chaque section, SEO (titre/description)
- **Apparence** : couleur principale, couleur accent, fond, texte
- **Produits & services** : cartes de la section « Nos viandes » (titre, étiquette, description, liste de points, image, ordre, publié/masqué)
- **Chiffres clés** : les 4 chiffres sous la bannière d'accueil
- **Mon compte** : changement du mot de passe admin
