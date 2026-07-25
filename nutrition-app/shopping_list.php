<?php
require_once __DIR__ . '/config.php';
$user = nc_require_login();
$pdo = nc_db();
$userId = (int)$user['id'];

$weekStart = nc_week_start($_GET['week'] ?? $_POST['week'] ?? null);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['regenerate'])) {
        $pdo->prepare('DELETE FROM shopping_items WHERE user_id=? AND week_start=? AND is_manual=0')
            ->execute([$userId, $weekStart]);

        $lines = nc_build_ingredient_list($pdo, $userId, $weekStart);
        $counts = [];
        foreach ($lines as $line) {
            $key = mb_strtolower($line);
            $counts[$key] = ($counts[$key] ?? ['label' => $line, 'n' => 0]);
            $counts[$key]['n']++;
        }
        $insert = $pdo->prepare('INSERT INTO shopping_items (user_id, week_start, label, quantity_text, is_manual) VALUES (?,?,?,?,0)');
        foreach ($counts as $c) {
            $label = $c['label'];
            $qty = $c['n'] > 1 ? '× ' . $c['n'] : '';
            $insert->execute([$userId, $weekStart, $label, $qty]);
        }
        if ($lines && nc_award_badge($pdo, $userId, 'shopping_master')) {
            nc_add_points($pdo, $userId, 10);
        }
        nc_flash_set($lines ? 'Liste de courses régénérée depuis ton planning !' : "Aucune recette planifiée cette semaine, planifie ton menu d'abord.");
    } elseif (isset($_POST['add_manual'])) {
        $label = trim($_POST['label'] ?? '');
        $qty = trim($_POST['quantity_text'] ?? '');
        if ($label !== '') {
            $pdo->prepare('INSERT INTO shopping_items (user_id, week_start, label, quantity_text, is_manual) VALUES (?,?,?,?,1)')
                ->execute([$userId, $weekStart, $label, $qty]);
        }
    } elseif (isset($_POST['toggle_id'])) {
        $itemId = (int)$_POST['toggle_id'];
        $checked = isset($_POST['checked']) ? 1 : 0;
        $pdo->prepare('UPDATE shopping_items SET checked=? WHERE id=? AND user_id=?')->execute([$checked, $itemId, $userId]);
    } elseif (isset($_POST['delete_id'])) {
        $pdo->prepare('DELETE FROM shopping_items WHERE id=? AND user_id=?')->execute([(int)$_POST['delete_id'], $userId]);
    } elseif (isset($_POST['clear_checked'])) {
        $pdo->prepare('DELETE FROM shopping_items WHERE user_id=? AND week_start=? AND checked=1')->execute([$userId, $weekStart]);
    }
    header('Location: shopping_list.php?week=' . $weekStart);
    exit;
}

$stmt = $pdo->prepare('SELECT * FROM shopping_items WHERE user_id=? AND week_start=? ORDER BY checked ASC, is_manual ASC, id ASC');
$stmt->execute([$userId, $weekStart]);
$items = $stmt->fetchAll();

$prevWeek = date('Y-m-d', strtotime($weekStart . ' -7 days'));
$nextWeek = date('Y-m-d', strtotime($weekStart . ' +7 days'));

$pageTitle = 'Liste de courses';
require __DIR__ . '/header.php';
?>

<h1>🛒 Liste de courses</h1>

<div class="week-nav">
  <a href="?week=<?= $prevWeek ?>" class="btn small secondary">← Semaine précédente</a>
  <strong><?= date('d/m/Y', strtotime($weekStart)) ?> — <?= date('d/m/Y', strtotime($weekStart . ' +6 days')) ?></strong>
  <a href="?week=<?= $nextWeek ?>" class="btn small secondary">Semaine suivante →</a>
</div>

<div class="btn-row" style="justify-content:center;margin-bottom:1.25rem">
  <form method="post"><input type="hidden" name="week" value="<?= $weekStart ?>">
    <button type="submit" name="regenerate" value="1" class="btn">🔄 Régénérer depuis mon planning</button>
  </form>
  <form method="post"><input type="hidden" name="week" value="<?= $weekStart ?>">
    <button type="submit" name="clear_checked" value="1" class="btn secondary">🧹 Retirer les articles cochés</button>
  </form>
</div>

<div class="card">
  <form method="post" class="btn-row">
    <input type="hidden" name="week" value="<?= $weekStart ?>">
    <input type="text" name="label" placeholder="Ajouter un article..." required style="max-width:260px">
    <input type="text" name="quantity_text" placeholder="Quantité (optionnel)" style="max-width:160px">
    <button type="submit" name="add_manual" value="1" class="btn small">Ajouter</button>
  </form>
</div>

<div class="card">
  <?php if (!$items): ?>
    <div class="empty-state">Ta liste est vide. Planifie ton menu de la semaine puis clique sur "Régénérer" 👆</div>
  <?php else: ?>
    <ul class="shopping-list">
      <?php foreach ($items as $item): ?>
        <li class="<?= $item['checked'] ? 'checked' : '' ?>">
          <form method="post" class="autosubmit" style="display:flex;align-items:center;gap:0.6rem;flex:1">
            <input type="hidden" name="week" value="<?= $weekStart ?>">
            <input type="hidden" name="toggle_id" value="<?= $item['id'] ?>">
            <input type="checkbox" name="checked" value="1" id="item<?= $item['id'] ?>" <?= $item['checked'] ? 'checked' : '' ?>>
            <label for="item<?= $item['id'] ?>" style="flex:1;margin:0;font-weight:normal">
              <?= nc_e($item['label']) ?> <?php if ($item['quantity_text']): ?><span class="help"><?= nc_e($item['quantity_text']) ?></span><?php endif; ?>
            </label>
          </form>
          <form method="post">
            <input type="hidden" name="week" value="<?= $weekStart ?>">
            <input type="hidden" name="delete_id" value="<?= $item['id'] ?>">
            <button type="submit" class="btn small secondary" title="Supprimer">✕</button>
          </form>
        </li>
      <?php endforeach; ?>
    </ul>
  <?php endif; ?>
</div>

<?php require __DIR__ . '/footer.php'; ?>
