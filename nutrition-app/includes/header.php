<?php
/**
 * @var array $user Fourni par la page appelante (nc_require_login())
 */
$currentPage = basename($_SERVER['SCRIPT_NAME']);
$flash = nc_flash_get();
$navItems = [
    'dashboard.php' => ['🏠', 'Tableau de bord'],
    'profile.php'   => ['🙋', 'Mon profil'],
    'goals.php'     => ['🎯', 'Objectifs'],
    'menu.php'      => ['🗓️', 'Planning'],
    'shopping_list.php' => ['🛒', 'Courses'],
    'recipes.php'   => ['📖', 'Recettes'],
    'weight_log.php'=> ['⚖️', 'Poids'],
    'tips.php'      => ['💡', 'Conseils & défis'],
];
?><!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= isset($pageTitle) ? nc_e($pageTitle) . ' – ' : '' ?>NutriCoach</title>
<link rel="stylesheet" href="assets/css/style.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🥗</text></svg>">
</head>
<body>
<div class="app-shell">
  <header class="topbar">
    <div class="brand">🥗 <span>NutriCoach</span></div>
    <?php if (!empty($user)): ?>
    <button class="nav-toggle" id="navToggle" aria-label="Menu">☰</button>
    <nav class="mainnav" id="mainNav">
      <?php foreach ($navItems as $href => [$icon, $label]): ?>
        <a href="<?= $href ?>" class="<?= $currentPage === $href ? 'active' : '' ?>"><?= $icon ?> <?= $label ?></a>
      <?php endforeach; ?>
      <a href="logout.php" class="logout">🚪 Déconnexion</a>
    </nav>
    <?php endif; ?>
  </header>

  <main class="content">
    <?php if ($flash): ?>
      <div class="flash flash-<?= nc_e($flash['type']) ?>"><?= nc_e($flash['message']) ?></div>
    <?php endif; ?>
