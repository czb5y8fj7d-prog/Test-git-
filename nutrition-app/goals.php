<?php
require_once __DIR__ . '/config.php';
$user = nc_require_login();
$pdo = nc_db();
$userId = (int)$user['id'];
$profile = nc_get_profile($pdo, $userId);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['add_goal'])) {
        $label = trim($_POST['label'] ?? '');
        if ($label !== '') {
            $pdo->prepare('INSERT INTO user_goals (user_id, label) VALUES (?, ?)')->execute([$userId, $label]);
        }
    } elseif (isset($_POST['toggle_id'])) {
        $done = isset($_POST['done']) ? 1 : 0;
        $pdo->prepare('UPDATE user_goals SET done=? WHERE id=? AND user_id=?')->execute([$done, (int)$_POST['toggle_id'], $userId]);
        if ($done) nc_add_points($pdo, $userId, 5);
    } elseif (isset($_POST['delete_id'])) {
        $pdo->prepare('DELETE FROM user_goals WHERE id=? AND user_id=?')->execute([(int)$_POST['delete_id'], $userId]);
    }
    header('Location: goals.php');
    exit;
}

$stmt = $pdo->prepare('SELECT * FROM user_goals WHERE user_id=? ORDER BY done ASC, created_at DESC');
$stmt->execute([$userId]);
$goals = $stmt->fetchAll();

$summary = nc_build_profile_summary($profile);

$progressPct = null;
if ($profile['start_weight_kg'] && $profile['target_weight_kg'] && $profile['current_weight_kg']) {
    $start = (float)$profile['start_weight_kg'];
    $target = (float)$profile['target_weight_kg'];
    $current = (float)$profile['current_weight_kg'];
    $totalDelta = $start - $target;
    if (abs($totalDelta) > 0.01) {
        $progressPct = max(0, min(100, (($start - $current) / $totalDelta) * 100));
    }
}

$stmt = $pdo->prepare('SELECT COUNT(*) FROM weight_logs WHERE user_id=?');
$stmt->execute([$userId]);
$weighCount = (int)$stmt->fetchColumn();

$pageTitle = 'Mes objectifs';
require __DIR__ . '/includes/header.php';
?>

<h1>🎯 Mes objectifs</h1>

<div class="grid cols-2">
  <div class="card">
    <h2>Objectif de poids</h2>
    <?php if ($profile['target_weight_kg'] && $profile['current_weight_kg']): ?>
      <p>
        Départ : <strong><?= nc_e((string)$profile['start_weight_kg']) ?> kg</strong> →
        Actuel : <strong><?= nc_e((string)$profile['current_weight_kg']) ?> kg</strong> →
        Objectif : <strong><?= nc_e((string)$profile['target_weight_kg']) ?> kg</strong>
      </p>
      <?php if ($progressPct !== null): ?>
        <div class="progress-bar"><div class="fill" style="width: <?= round($progressPct) ?>%"></div></div>
        <p class="help" style="margin-top:0.4rem"><?= round($progressPct) ?>% du chemin parcouru 🚀</p>
      <?php endif; ?>
      <?php if ($summary && $summary['weeks_to_goal'] !== null): ?>
        <p class="help">
          <?= $summary['weeks_to_goal'] === 0 ? "Objectif atteint 🎉" : 'Estimation : encore ' . $summary['weeks_to_goal'] . ' semaines à un rythme raisonnable.' ?>
        </p>
      <?php endif; ?>
    <?php else: ?>
      <p class="help">Renseigne ton poids de départ et ton poids objectif dans <a href="profile.php">ton profil</a> pour suivre ta progression.</p>
    <?php endif; ?>
    <p class="help">📊 <?= $weighCount ?> pesée(s) enregistrée(s) au total.</p>
  </div>

  <div class="card">
    <h2>Besoins caloriques</h2>
    <?php if ($summary): ?>
      <table class="simple-table">
        <tr><th>Objectif</th><td><?= nc_e(NC_GOAL_LABELS[$profile['goal']] ?? $profile['goal']) ?></td></tr>
        <tr><th>Calories / jour</th><td><?= $summary['calories'] ?> kcal</td></tr>
        <tr><th>Protéines</th><td><?= $summary['macros']['protein_g'] ?> g</td></tr>
        <tr><th>Glucides</th><td><?= $summary['macros']['carbs_g'] ?> g</td></tr>
        <tr><th>Lipides</th><td><?= $summary['macros']['fat_g'] ?> g</td></tr>
      </table>
    <?php else: ?>
      <p class="help">Complète ton <a href="profile.php">profil</a> pour voir tes besoins caloriques.</p>
    <?php endif; ?>
  </div>
</div>

<div class="card">
  <h2>🗒️ Mes objectifs personnels</h2>
  <p class="help">Ajoute tes propres défis : "Courir 5km", "Cuisiner 3 nouvelles recettes"...</p>
  <form method="post" class="btn-row" style="margin-bottom:1rem">
    <input type="text" name="label" placeholder="Nouvel objectif..." required style="max-width:320px">
    <button type="submit" name="add_goal" value="1" class="btn small">Ajouter</button>
  </form>

  <?php if (!$goals): ?>
    <div class="empty-state">Aucun objectif pour l'instant.</div>
  <?php else: ?>
    <ul class="shopping-list">
      <?php foreach ($goals as $g): ?>
        <li class="<?= $g['done'] ? 'checked' : '' ?>">
          <form method="post" class="autosubmit" style="display:flex;align-items:center;gap:0.6rem;flex:1">
            <input type="hidden" name="toggle_id" value="<?= $g['id'] ?>">
            <input type="checkbox" name="done" value="1" id="goal<?= $g['id'] ?>" <?= $g['done'] ? 'checked' : '' ?>>
            <label for="goal<?= $g['id'] ?>" style="flex:1;margin:0;font-weight:normal"><?= nc_e($g['label']) ?></label>
          </form>
          <form method="post">
            <input type="hidden" name="delete_id" value="<?= $g['id'] ?>">
            <button type="submit" class="btn small secondary" title="Supprimer">✕</button>
          </form>
        </li>
      <?php endforeach; ?>
    </ul>
  <?php endif; ?>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
