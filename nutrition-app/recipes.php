<?php
require_once __DIR__ . '/config.php';
$user = nc_require_login();
$pdo = nc_db();
$userId = (int)$user['id'];

$category = $_GET['cat'] ?? 'all';
$source = $_GET['src'] ?? 'all'; // all | mine | public
$search = trim($_GET['q'] ?? '');

$sql = 'SELECT * FROM recipes WHERE (user_id = ? OR is_public = 1)';
$params = [$userId];

if ($source === 'mine') {
    $sql = 'SELECT * FROM recipes WHERE user_id = ?';
    $params = [$userId];
} elseif ($source === 'public') {
    $sql = 'SELECT * FROM recipes WHERE is_public = 1';
    $params = [];
}

if ($category !== 'all' && isset(NC_MEAL_SLOTS[$category])) {
    $sql .= ' AND category = ?';
    $params[] = $category;
}
if ($search !== '') {
    $sql .= ' AND (title LIKE ? OR tags LIKE ?)';
    $params[] = '%' . $search . '%';
    $params[] = '%' . $search . '%';
}
$sql .= ' ORDER BY title ASC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$recipes = $stmt->fetchAll();

$pageTitle = 'Recettes';
require __DIR__ . '/header.php';
?>

<h1>📖 Recettes</h1>
<div class="btn-row" style="margin-bottom:1rem">
  <a href="recipe_form.php" class="btn">+ Ajouter ma recette</a>
</div>

<form method="get" class="btn-row" style="margin-bottom:1rem">
  <input type="text" name="q" placeholder="Rechercher une recette ou un tag..." value="<?= nc_e($search) ?>" style="max-width:280px">
  <input type="hidden" name="cat" value="<?= nc_e($category) ?>">
  <input type="hidden" name="src" value="<?= nc_e($source) ?>">
  <button type="submit" class="btn secondary small">Rechercher</button>
</form>

<div class="recipe-filters">
  <a href="?cat=all&src=<?= $source ?>&q=<?= urlencode($search) ?>" class="<?= $category === 'all' ? 'active' : '' ?>">Toutes catégories</a>
  <?php foreach (NC_MEAL_SLOTS as $key => $label): ?>
    <a href="?cat=<?= $key ?>&src=<?= $source ?>&q=<?= urlencode($search) ?>" class="<?= $category === $key ? 'active' : '' ?>"><?= nc_e($label) ?></a>
  <?php endforeach; ?>
</div>
<div class="recipe-filters">
  <a href="?cat=<?= $category ?>&src=all&q=<?= urlencode($search) ?>" class="<?= $source === 'all' ? 'active' : '' ?>">Toutes les recettes</a>
  <a href="?cat=<?= $category ?>&src=mine&q=<?= urlencode($search) ?>" class="<?= $source === 'mine' ? 'active' : '' ?>">Mes recettes</a>
  <a href="?cat=<?= $category ?>&src=public&q=<?= urlencode($search) ?>" class="<?= $source === 'public' ? 'active' : '' ?>">Bibliothèque NutriCoach</a>
</div>

<?php if (!$recipes): ?>
  <div class="card empty-state">Aucune recette trouvée. Essaie un autre filtre, ou <a href="recipe_form.php">ajoute la tienne</a> !</div>
<?php else: ?>
<div class="grid cols-3">
  <?php foreach ($recipes as $r): ?>
    <div class="card recipe-card">
      <h3><?= nc_e($r['title']) ?></h3>
      <div>
        <span class="tag"><?= nc_e(NC_MEAL_SLOTS[$r['category']] ?? $r['category']) ?></span>
        <?php foreach (array_filter(array_map('trim', explode(',', $r['tags']))) as $t): ?>
          <span class="tag"><?= nc_e($t) ?></span>
        <?php endforeach; ?>
      </div>
      <div class="recipe-macros">
        <span>🔥 <?= (int)$r['kcal'] ?> kcal</span>
        <span>🥩 <?= (float)$r['protein_g'] ?>g</span>
        <span>🍞 <?= (float)$r['carbs_g'] ?>g</span>
        <span>🥑 <?= (float)$r['fat_g'] ?>g</span>
      </div>
      <p class="help">⏱️ <?= (int)$r['prep_minutes'] ?> min · 🍽️ <?= (int)$r['servings'] ?> portion(s)</p>
      <div class="btn-row" style="margin-top:auto">
        <a href="recipe_form.php?id=<?= $r['id'] ?>" class="btn small secondary">Voir <?= $r['user_id'] == $userId ? '/ modifier' : '' ?></a>
      </div>
    </div>
  <?php endforeach; ?>
</div>
<?php endif; ?>

<?php require __DIR__ . '/footer.php'; ?>
