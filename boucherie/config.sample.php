<?php
// Copie ce fichier en config.php (même dossier) et adapte les valeurs
// avant le tout premier lancement du site.
//
// admin_username / admin_password ne servent qu'à la création du tout
// premier compte admin, quand data/site.db n'existe pas encore. Change
// ensuite le mot de passe depuis l'onglet "Mon compte" du menu admin.

return [
    'admin_username' => 'admin',
    'admin_password' => 'change-moi',
];
