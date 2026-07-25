<?php
require_once __DIR__ . '/config.php';
$user = nc_require_login();
$pdo = nc_db();
$userId = (int)$user['id'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['add_weight'])) {
        $date = $_POST['log_date'] ?: date('Y-m-d');
        $weight = (float)str_replace(',', '.', $_POST['weight_kg'] ?? '0');
        $note = trim($_POST['note'] ?? '');
        if ($weight > 0) {
            $pdo->prepare(
                'INSERT INTO weight_logs (user_id, log_date, weight_kg, note) VALUES (?,?,?,?)
                 ON CONFLICT(user_id, log_date) DO UPDATE SET weight_kg=excluded.weight_kg, note=excluded.note'
            )->execute([$userId, $date, $weight, $note]);

            $profile = nc_get_profile($pdo, $userId);
            $startWeight = $profile['start_weight_kg'] ?: $weight;
            $pdo->prepare('UPDATE profiles SET current_weight_kg=?, start_weight_kg=? WHERE user_id=?')
                ->execute([$weight, $startWeight, $userId]);

            nc_add_points($pdo, $userId, 5);
            $newBadges = nc_check_badges($pdo, $userId);
            nc_flash_set('Pesée enregistrée ! +5 points' . ($newBadges ? ' 🏅 Nouveau badge débloqué !' : ''));
        }
    } elseif (isset($_POST['delete_id'])) {
        $pdo->prepare('DELETE FROM weight_logs WHERE id=? AND user_id=?')->execute([(int)$_POST['delete_id'], $userId]);
        nc_flash_set('Pesée supprimée.');
    }
    header('Location: weight_log.php');
    exit;
}

$stmt = $pdo->prepare('SELECT * FROM weight_logs WHERE user_id=? ORDER BY log_date ASC');
$stmt->execute([$userId]);
$history = $stmt->fetchAll();
$profile = nc_get_profile($pdo, $userId);

// --- Génération du graphique SVG (sans dépendance externe) ---
$chartSvg = '';
if (count($history) >= 2) {
    $values = array_column($history, 'weight_kg');
    $min = min($values);
    $max = max($values);
    if ($profile['target_weight_kg']) {
        $min = min($min, (float)$profile['target_weight_kg']);
        $max = max($max, (float)$profile['target_weight_kg']);
    }
    $range = max(0.1, $max - $min);
    $pad = $range * 0.15;
    $min -= $pad;
    $max += $pad;

    $w = 700; $h = 240; $left = 45; $right = 20; $top = 15; $bottom = 30;
    $plotW = $w - $left - $right;
    $plotH = $h - $top - $bottom;
    $n = count($history);

    $points = [];
    foreach ($history as $i => $row) {
        $x = $left + ($n > 1 ? $i / ($n - 1) * $plotW : $plotW / 2);
        $y = $top + $plotH - (($row['weight_kg'] - $min) / ($max - $min)) * $plotH;
        $points[] = round($x, 1) . ',' . round($y, 1);
    }

    $targetLine = '';
    if ($profile['target_weight_kg']) {
        $ty = $top + $plotH - (((float)$profile['target_weight_kg'] - $min) / ($max - $min)) * $plotH;
        $targetLine = '<line x1="' . $left . '" y1="' . round($ty, 1) . '" x2="' . ($w - $right) . '" y2="' . round($ty, 1)
            . '" stroke="#ff9f45" stroke-width="2" stroke-dasharray="6,5" />'
            . '<text x="' . ($w - $right) . '" y="' . (round($ty, 1) - 6) . '" font-size="11" text-anchor="end" fill="#b9631a">Objectif</text>';
    }

    $dots = '';
    foreach ($points as $i => $p) {
        [$x, $y] = explode(',', $p);
        $dots .= '<circle cx="' . $x . '" cy="' . $y . '" r="3.5" fill="#2f9e6f" />';
    }

    $firstLabel = nc_e(date('d/m', strtotime($history[0]['log_date'])));
    $lastLabel = nc_e(date('d/m', strtotime($history[$n - 1]['log_date'])));

    $chartSvg = '<svg class="weight-chart" viewBox="0 0 ' . $w . ' ' . $h . '" width="100%" style="max-width:700px">'
        . '<polyline points="' . implode(' ', $points) . '" fill="none" stroke="#2f9e6f" stroke-width="3" />'
        . $dots . $targetLine
        . '<text x="' . $left . '" y="' . ($h - 8) . '" font-size="11" fill="#6b7b73">' . $firstLabel . '</text>'
        . '<text x="' . ($w - $right) . '" y="' . ($h - 8) . '" font-size="11" text-anchor="end" fill="#6b7b73">' . $lastLabel . '</text>'
        . '</svg>';
}

$pageTitle = 'Suivi du poids';
require __DIR__ . '/header.php';
?>

<h1>⚖️ Suivi de poids</h1>

<div class="grid cols-2">
  <div class="card">
    <h2>Nouvelle pesée</h2>
    <form method="post">
      <label for="log_date">Date</label>
      <input type="date" id="log_date" name="log_date" value="<?= date('Y-m-d') ?>" max="<?= date('Y-m-d') ?>">

      <label for="weight_kg">Poids (kg)</label>
      <input type="number" step="0.1" id="weight_kg" name="weight_kg" required>

      <label for="note">Note (optionnel)</label>
      <input type="text" id="note" name="note" placeholder="Forme, ressenti...">

      <button type="submit" class="btn" name="add_weight" value="1">Enregistrer (+5 pts)</button>
    </form>
  </div>

  <div class="card">
    <h2>Évolution</h2>
    <?php if ($chartSvg): ?>
      <div class="chart-wrap"><?= $chartSvg ?></div>
    <?php else: ?>
      <div class="empty-state">Ajoute au moins 2 pesées pour voir ton graphique d'évolution 📈</div>
    <?php endif; ?>
  </div>
</div>

<div class="card">
  <h2>Historique</h2>
  <?php if (!$history): ?>
    <div class="empty-state">Aucune pesée enregistrée pour l'instant.</div>
  <?php else: ?>
    <table class="simple-table">
      <tr><th>Date</th><th>Poids</th><th>Note</th><th></th></tr>
      <?php foreach (array_reverse($history) as $row): ?>
        <tr>
          <td><?= nc_e(date('d/m/Y', strtotime($row['log_date']))) ?></td>
          <td><?= nc_e((string)$row['weight_kg']) ?> kg</td>
          <td><?= nc_e($row['note']) ?></td>
          <td>
            <form method="post" onsubmit="return confirm('Supprimer cette pesée ?');">
              <input type="hidden" name="delete_id" value="<?= $row['id'] ?>">
              <button type="submit" class="btn small secondary">✕</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
    </table>
  <?php endif; ?>
</div>

<?php require __DIR__ . '/footer.php'; ?>
