<?php
require_once __DIR__ . '/config.php';
$user = nc_require_login();
$pdo = nc_db();
$userId = (int)$user['id'];

$id = isset($_GET['id']) ? (int)$_GET['id'] : null;
$recipe = null;
if ($id) {
    $stmt = $pdo->prepare('SELECT * FROM recipes WHERE id = ?');
    $stmt->execute([$id]);
    $recipe = $stmt->fetch();
    if (!$recipe) {
        nc_flash_set("Recette introuvable.", 'error');
        header('Location: recipes.php');
        exit;
    }
}
$isOwner = $recipe && (int)$recipe['user_id'] === $userId;
$readOnly = $recipe && !$isOwner;

// Duplication d'une recette publique vers "mes recettes"
if ($readOnly && isset($_GET['duplicate'])) {
    $stmt = $pdo->prepare(
        'INSERT INTO recipes (user_id, title, category, tags, servings, prep_minutes, kcal, protein_g, carbs_g, fat_g, ingredients, instructions, is_public)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)'
    );
    $stmt->execute([
        $userId, $recipe['title'] . ' (ma version)', $recipe['category'], $recipe['tags'], $recipe['servings'],
        $recipe['prep_minutes'], $recipe['kcal'], $recipe['protein_g'], $recipe['carbs_g'], $recipe['fat_g'],
        $recipe['ingredients'], $recipe['instructions'],
    ]);
    $newId = (int)$pdo->lastInsertId();
    nc_check_badges($pdo, $userId);
    nc_flash_set('Recette copiée dans ton livre, tu peux maintenant la personnaliser !');
    header('Location: recipe_form.php?id=' . $newId);
    exit;
}

$errors = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$readOnly) {
    $title = trim($_POST['title'] ?? '');
    $category = in_array($_POST['category'], array_keys(NC_MEAL_SLOTS)) ? $_POST['category'] : 'dejeuner';
    $tags = trim($_POST['tags'] ?? '');
    $servings = max(1, (int)($_POST['servings'] ?? 1));
    $prep = max(0, (int)($_POST['prep_minutes'] ?? 0));
    $kcal = max(0, (int)($_POST['kcal'] ?? 0));
    $protein = max(0, (float)str_replace(',', '.', $_POST['protein_g'] ?? 0));
    $carbs = max(0, (float)str_replace(',', '.', $_POST['carbs_g'] ?? 0));
    $fat = max(0, (float)str_replace(',', '.', $_POST['fat_g'] ?? 0));
    $ingredients = trim($_POST['ingredients'] ?? '');
    $instructions = trim($_POST['instructions'] ?? '');

    if ($title === '') $errors[] = 'Le titre est obligatoire.';
    if ($ingredients === '') $errors[] = 'Merci de lister au moins un ingrédient (un par ligne).';

    if (!$errors) {
        if ($recipe) {
            $pdo->prepare(
                'UPDATE recipes SET title=?, category=?, tags=?, servings=?, prep_minutes=?, kcal=?, protein_g=?, carbs_g=?, fat_g=?, ingredients=?, instructions=? WHERE id=? AND user_id=?'
            )->execute([$title, $category, $tags, $servings, $prep, $kcal, $protein, $carbs, $fat, $ingredients, $instructions, $recipe['id'], $userId]);
            nc_flash_set('Recette mise à jour !');
            header('Location: recipe_form.php?id=' . $recipe['id']);
        } else {
            $pdo->prepare(
                'INSERT INTO recipes (user_id, title, category, tags, servings, prep_minutes, kcal, protein_g, carbs_g, fat_g, ingredients, instructions, is_public)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)'
            )->execute([$userId, $title, $category, $tags, $servings, $prep, $kcal, $protein, $carbs, $fat, $ingredients, $instructions]);
            $newId = (int)$pdo->lastInsertId();
            nc_add_points($pdo, $userId, 10);
            nc_check_badges($pdo, $userId);
            nc_flash_set('Recette ajoutée à ton livre ! +10 points 🎉');
            header('Location: recipe_form.php?id=' . $newId);
        }
        exit;
    }
}

$pageTitle = $recipe ? ($readOnly ? $recipe['title'] : 'Modifier ma recette') : 'Nouvelle recette';
require __DIR__ . '/header.php';
?>

<h1>📖 <?= $recipe ? nc_e($recipe['title']) : '➕ Nouvelle recette' ?></h1>

<?php foreach ($errors as $err): ?><div class="flash flash-error"><?= nc_e($err) ?></div><?php endforeach; ?>

<?php if ($readOnly): ?>
  <div class="card">
    <div>
      <span class="tag"><?= nc_e(NC_MEAL_SLOTS[$recipe['category']] ?? $recipe['category']) ?></span>
      <?php foreach (array_filter(array_map('trim', explode(',', $recipe['tags']))) as $t): ?>
        <span class="tag"><?= nc_e($t) ?></span>
      <?php endforeach; ?>
    </div>
    <div class="recipe-macros" style="margin-top:0.8rem">
      <span>🔥 <?= (int)$recipe['kcal'] ?> kcal</span>
      <span>🥩 <?= (float)$recipe['protein_g'] ?>g protéines</span>
      <span>🍞 <?= (float)$recipe['carbs_g'] ?>g glucides</span>
      <span>🥑 <?= (float)$recipe['fat_g'] ?>g lipides</span>
    </div>
    <p class="help">⏱️ <?= (int)$recipe['prep_minutes'] ?> min · 🍽️ <?= (int)$recipe['servings'] ?> portion(s)</p>

    <div class="grid cols-2" style="margin-top:1rem">
      <div>
        <h3>Ingrédients</h3>
        <pre style="white-space:pre-wrap;font-family:inherit"><?= nc_e($recipe['ingredients']) ?></pre>
      </div>
      <div>
        <h3>Préparation</h3>
        <pre style="white-space:pre-wrap;font-family:inherit"><?= nc_e($recipe['instructions']) ?></pre>
      </div>
    </div>

    <a href="recipe_form.php?id=<?= $recipe['id'] ?>&duplicate=1" class="btn">📋 Copier dans mes recettes</a>
  </div>
<?php else: ?>
  <div class="card">
    <form method="post">
      <label for="title">Titre de la recette</label>
      <input type="text" id="title" name="title" required value="<?= nc_e($recipe['title'] ?? '') ?>">

      <div class="field-row">
        <div>
          <label for="category">Catégorie</label>
          <select id="category" name="category">
            <?php foreach (NC_MEAL_SLOTS as $key => $label): ?>
              <option value="<?= $key ?>" <?= (($recipe['category'] ?? 'dejeuner') === $key) ? 'selected' : '' ?>><?= nc_e($label) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div>
          <label for="tags">Tags (séparés par une virgule)</label>
          <input type="text" id="tags" name="tags" placeholder="végétarien, rapide..." value="<?= nc_e($recipe['tags'] ?? '') ?>">
        </div>
      </div>

      <div class="field-row">
        <div>
          <label for="servings">Portions</label>
          <input type="number" id="servings" name="servings" min="1" value="<?= nc_e((string)($recipe['servings'] ?? 1)) ?>">
        </div>
        <div>
          <label for="prep_minutes">Temps de préparation (min)</label>
          <input type="number" id="prep_minutes" name="prep_minutes" min="0" value="<?= nc_e((string)($recipe['prep_minutes'] ?? 15)) ?>">
        </div>
      </div>

      <div class="field-row" style="grid-template-columns:repeat(4,1fr)">
        <div>
          <label for="kcal">Kcal / portion</label>
          <input type="number" id="kcal" name="kcal" min="0" value="<?= nc_e((string)($recipe['kcal'] ?? 0)) ?>">
        </div>
        <div>
          <label for="protein_g">Protéines (g)</label>
          <input type="number" step="0.1" id="protein_g" name="protein_g" min="0" value="<?= nc_e((string)($recipe['protein_g'] ?? 0)) ?>">
        </div>
        <div>
          <label for="carbs_g">Glucides (g)</label>
          <input type="number" step="0.1" id="carbs_g" name="carbs_g" min="0" value="<?= nc_e((string)($recipe['carbs_g'] ?? 0)) ?>">
        </div>
        <div>
          <label for="fat_g">Lipides (g)</label>
          <input type="number" step="0.1" id="fat_g" name="fat_g" min="0" value="<?= nc_e((string)($recipe['fat_g'] ?? 0)) ?>">
        </div>
      </div>

      <label for="ingredients">Ingrédients (un par ligne, ex : "200g riz complet")</label>
      <textarea id="ingredients" name="ingredients" required><?= nc_e($recipe['ingredients'] ?? '') ?></textarea>

      <label for="instructions">Préparation</label>
      <textarea id="instructions" name="instructions"><?= nc_e($recipe['instructions'] ?? '') ?></textarea>

      <button type="submit" class="btn"><?= $recipe ? 'Mettre à jour' : 'Ajouter la recette (+10 pts)' ?></button>
    </form>
    <?php if ($recipe): ?>
      <form method="post" action="recipe_delete.php" onsubmit="return confirm('Supprimer cette recette ?');" style="margin-top:0.75rem">
        <input type="hidden" name="id" value="<?= $recipe['id'] ?>">
        <button type="submit" class="btn danger">Supprimer cette recette</button>
      </form>
    <?php endif; ?>
  </div>
<?php endif; ?>

<?php require __DIR__ . '/footer.php'; ?>
