<?php
// Connexion SQLite + installation automatique du schéma (aucun réglage requis côté hébergeur)

function nc_db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $dataDir = __DIR__ . '/../data';
    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0775, true);
    }
    $dbFile = $dataDir . '/nutricoach.sqlite';
    $needsInstall = !file_exists($dbFile);

    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON');

    if ($needsInstall) {
        $schema = file_get_contents(__DIR__ . '/../schema.sql');
        $pdo->exec($schema);
        require_once __DIR__ . '/seed.php';
        nc_seed_public_recipes($pdo);
    }

    return $pdo;
}
