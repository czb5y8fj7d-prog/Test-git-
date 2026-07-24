<?php
require_once __DIR__ . '/config.php';
$user = nc_require_login();
$pdo = nc_db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $id = (int)($_POST['id'] ?? 0);
    $pdo->prepare('DELETE FROM recipes WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
    nc_flash_set('Recette supprimée.');
}
header('Location: recipes.php?src=mine');
exit;
