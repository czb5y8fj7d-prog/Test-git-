<?php
require_once __DIR__ . '/config.php';
$user = nc_require_login();
$pdo = nc_db();
$userId = (int)$user['id'];

$weekStart = nc_week_start($_GET['week'] ?? null);
$prevWeek = date('Y-m-d', strtotime($weekStart . ' -7 days'));
$nextWeek = date('Y-m-d', strtotime($weekStart . ' +7 days'));

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['save_plan'])) {
    $stmt = $pdo->prepare(
        'INSERT INTO menu_plan (user_id, week_start, day_of_week, meal_slot, recipe_id, custom_text)
         VALUES (?,?,?,?,?,?)
         ON CONFLICT(user_id, week_start, day_of_week, meal_slot)
         DO UPDATE SET recipe_id = excluded.recipe_id, custom_text = excluded.custom_text'
    );
    foreach (range(0, 6) as $day) {
        foreach (array_keys(NC_MEAL_SLOTS) as $slot) {
            $recipeRaw = $_POST['recipe'][$day][$slot] ?? '';
            $recipeId = $recipeRaw !== '' ? (int)$recipeRaw : null;
            $custom = trim($_POST['custom'][$day][$slot] ?? '');
            if ($recipeId === null && $custom === '') {
                $pdo->prepare('DELETE FROM menu_plan WHERE user_id=? AND week_start=? AND day_of_week=? AND meal_slot=?')
                    ->execute([$userId, $weekStart, $day, $slot]);
                continue;
            }
            $stmt->execute([$userId, $weekStart, $day, $slot, $recipeId, $custom]);
        }
    }

    // Badge "semaine parfaite" si les 7 jours x repas principaux sont remplis
    $stmt2 = $pdo->prepare(
        "SELECT COUNT(DISTINCT day_of_week || '-' || meal_slot) FROM menu_plan
         WHERE user_id=? AND week_start=? AND meal_slot IN ('petit-dej','dejeuner','diner')"
    );
    $stmt2->execute([$userId, $weekStart]);
    if ((int)$stmt2->fetchColumn() >= 21) {
        if (nc_award_badge($pdo, $userId, 'week_planned')) {
            nc_add_points($pdo, $userId, 20);
        }
    }

    nc_flash_set('Planning enregistré !');
    header('Location: menu.php?week=' . $weekStart);
    exit;
}

// Recettes disponibles, groupées par catégorie
$stmt = $pdo->prepare('SELECT id, title, category FROM recipes WHERE user_id = ? OR is_public = 1 ORDER BY title');
$stmt->execute([$userId]);
$recipesByCategory = [];
foreach ($stmt->fetchAll() as $r) {
    $recipesByCategory[$r['category']][] = $r;
}

// Plan actuel
$stmt = $pdo->prepare('SELECT * FROM menu_plan WHERE user_id = ? AND week_start = ?');
$stmt->execute([$userId, $weekStart]);
$plan = [];
foreach ($stmt->fetchAll() as $row) {
    $plan[$row['day_of_week']][$row['meal_slot']] = $row;
}

$pageTitle = 'Mon planning';
require __DIR__ . '/includes/header.php';
?>

<h1>🗓️ Planning de la semaine</h1>

<div class="week-nav">
  <a href="?week=<?= $prevWeek ?>" class="btn small secondary">← Semaine précédente</a>
  <strong><?= date('d/m/Y', strtotime($weekStart)) ?> — <?= date('d/m/Y', strtotime($weekStart . ' +6 days')) ?></strong>
  <a href="?week=<?= $nextWeek ?>" class="btn small secondary">Semaine suivante →</a>
</div>

<form method="post" class="btn-row" style="justify-content:center;margin-bottom:1rem">
  <input type="hidden" name="week" value="<?= $weekStart ?>">
  <button type="submit" formaction="menu_autogenerate.php" class="btn secondary">✨ Générer un menu automatiquement</button>
</form>

<?php if (empty($recipesByCategory)): ?>
  <div class="card empty-state">Aucune recette disponible pour le moment.</div>
<?php endif; ?>

<form method="post">
  <input type="hidden" name="week" value="<?= $weekStart ?>">
  <div class="chart-wrap">
  <table class="planner-table">
    <thead>
      <tr>
        <th>Repas</th>
        <?php foreach (NC_DAY_LABELS as $i => $label): ?>
          <th><?= $label ?><br><span class="help"><?= date('d/m', strtotime($weekStart . ' +' . $i . ' days')) ?></span></th>
        <?php endforeach; ?>
      </tr>
    </thead>
    <tbody>
      <?php foreach (NC_MEAL_SLOTS as $slotKey => $slotLabel): ?>
        <tr>
          <th><?= nc_e($slotLabel) ?></th>
          <?php foreach (range(0, 6) as $day):
            $current = $plan[$day][$slotKey] ?? null; ?>
            <td>
              <select name="recipe[<?= $day ?>][<?= $slotKey ?>]">
                <option value="">— Aucune recette —</option>
                <?php foreach (($recipesByCategory[$slotKey] ?? []) as $r): ?>
                  <option value="<?= $r['id'] ?>" <?= ($current && (int)$current['recipe_id'] === (int)$r['id']) ? 'selected' : '' ?>>
                    <?= nc_e($r['title']) ?>
                  </option>
                <?php endforeach; ?>
              </select>
              <input type="text" name="custom[<?= $day ?>][<?= $slotKey ?>]" placeholder="ou texte libre"
                     value="<?= nc_e($current['custom_text'] ?? '') ?>" style="margin-top:0.3rem;font-size:0.8rem">
            </td>
          <?php endforeach; ?>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
  </div>
  <button type="submit" name="save_plan" value="1" class="btn">💾 Enregistrer le planning</button>
</form>

<?php require __DIR__ . '/includes/footer.php'; ?>
