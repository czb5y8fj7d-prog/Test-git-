<?php
// Connexion SQLite + installation automatique du schéma (aucun réglage requis côté hébergeur)

function nc_db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $dbFile = __DIR__ . '/nutricoach.sqlite';
    $needsInstall = !file_exists($dbFile);

    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON');

    if ($needsInstall) {
        $schema = file_get_contents(__DIR__ . '/schema.sql');
        $pdo->exec($schema);
        require_once __DIR__ . '/seed.php';
        nc_seed_public_recipes($pdo);
        require_once __DIR__ . '/functions.php';
        nc_seed_demo_account($pdo);
    }

    return $pdo;
}
