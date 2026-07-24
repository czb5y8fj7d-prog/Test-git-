<?php
require_once __DIR__ . '/config.php';
$user = nc_require_login();
$pdo = nc_db();
$userId = (int)$user['id'];
$profile = nc_get_profile($pdo, $userId);
$today = date('Y-m-d');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['daily_check'])) {
    $water = max(0, min(20, (int)$_POST['water_glasses']));
    $exercise = isset($_POST['exercise_done']) ? 1 : 0;
    $sleep = max(0, min(24, (float)str_replace(',', '.', $_POST['sleep_hours'] ?? 0)));

    $pdo->prepare(
        'INSERT INTO daily_checks (user_id, log_date, water_glasses, exercise_done, sleep_hours) VALUES (?,?,?,?,?)
         ON CONFLICT(user_id, log_date) DO UPDATE SET water_glasses=excluded.water_glasses,
         exercise_done=excluded.exercise_done, sleep_hours=excluded.sleep_hours'
    )->execute([$userId, $today, $water, $exercise, $sleep]);
    nc_add_points($pdo, $userId, 2);
    nc_flash_set('Suivi du jour enregistré ! +2 points 🎉');
    header('Location: dashboard.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['complete_challenge'])) {
    $weekStart = nc_week_start();
    $challenge = nc_weekly_challenge();
    $stmt = $pdo->prepare('INSERT OR IGNORE INTO challenge_completions (user_id, week_start, challenge_code) VALUES (?,?,?)');
    $stmt->execute([$userId, $weekStart, $challenge['code']]);
    if ($stmt->rowCount() > 0) {
        nc_add_points($pdo, $userId, $challenge['points']);
        nc_flash_set('Défi relevé ! +' . $challenge['points'] . ' points 🏆');
    }
    header('Location: dashboard.php');
    exit;
}

$summary = nc_build_profile_summary($profile);

$stmt = $pdo->prepare('SELECT log_date, weight_kg FROM weight_logs WHERE user_id=? ORDER BY log_date ASC');
$stmt->execute([$userId]);
$weightHistory = $stmt->fetchAll();
$recentWeights = array_slice($weightHistory, -14);

$stmt = $pdo->prepare('SELECT * FROM daily_checks WHERE user_id=? AND log_date=?');
$stmt->execute([$userId, $today]);
$todayCheck = $stmt->fetch() ?: ['water_glasses' => 0, 'exercise_done' => 0, 'sleep_hours' => ''];

$points = nc_get_points($pdo, $userId);
$level = intdiv($points, 100) + 1;
$levelProgress = $points % 100;

$badges = nc_user_badges($pdo, $userId);
$earnedCodes = array_column($badges, 'code');

$challenge = nc_weekly_challenge();
$weekStart = nc_week_start();
$stmt = $pdo->prepare('SELECT 1 FROM challenge_completions WHERE user_id=? AND week_start=? AND challenge_code=?');
$stmt->execute([$userId, $weekStart, $challenge['code']]);
$challengeDone = (bool)$stmt->fetch();

$coachTip = nc_coach_tip($profile, $recentWeights);

$weightDelta = null;
if ($profile['start_weight_kg'] && $profile['current_weight_kg']) {
    $weightDelta = (float)$profile['current_weight_kg'] - (float)$profile['start_weight_kg'];
}

$pageTitle = 'Tableau de bord';
require __DIR__ . '/includes/header.php';
?>

<h1>🏠 Bonjour <?= nc_e($user['name']) ?> !</h1>

<div class="grid cols-4">
  <div class="stat-tile">
    <span class="value"><?= $profile['current_weight_kg'] ? nc_e((string)$profile['current_weight_kg']) . ' kg' : '—' ?></span>
    <span class="label">Poids actuel</span>
  </div>
  <div class="stat-tile orange">
    <span class="value"><?= $weightDelta !== null ? ($weightDelta <= 0 ? '' : '+') . number_format($weightDelta, 1) . ' kg' : '—' ?></span>
    <span class="label">Depuis le départ</span>
  </div>
  <div class="stat-tile">
    <span class="value"><?= $summary ? $summary['calories'] : '—' ?></span>
    <span class="label">kcal / jour cible</span>
  </div>
  <div class="stat-tile orange">
    <span class="value">Niv. <?= $level ?></span>
    <span class="label"><?= $points ?> points</span>
  </div>
</div>

<div class="card" style="margin-top:1.25rem">
  <div class="progress-bar"><div class="fill" style="width: <?= $levelProgress ?>%"></div></div>
  <p class="help" style="margin-top:0.4rem"><?= 100 - $levelProgress ?> points avant le niveau <?= $level + 1 ?> 🚀</p>
</div>

<div class="grid cols-2" style="margin-top:0.25rem">
  <div class="card">
    <h2>💡 Le conseil du coach</h2>
    <div class="tip-of-day"><?= nc_e($coachTip) ?></div>

    <h3 style="margin-top:1.4rem">🏅 Défi de la semaine</h3>
    <div class="challenge-box">
      <div><?= nc_e($challenge['label']) ?> <strong>(+<?= $challenge['points'] ?> pts)</strong></div>
      <?php if ($challengeDone): ?>
        <span class="badge-pill">✅ Réalisé</span>
      <?php else: ?>
        <form method="post"><button class="btn small" type="submit" name="complete_challenge" value="1">Marquer comme fait</button></form>
      <?php endif; ?>
    </div>
  </div>

  <div class="card">
    <h2>📋 Suivi du jour</h2>
    <form method="post">
      <label for="water_glasses">💧 Verres d'eau bus</label>
      <input type="number" id="water_glasses" name="water_glasses" min="0" max="20" value="<?= (int)$todayCheck['water_glasses'] ?>">

      <label for="sleep_hours">😴 Heures de sommeil (nuit dernière)</label>
      <input type="number" step="0.5" id="sleep_hours" name="sleep_hours" min="0" max="24" value="<?= nc_e((string)$todayCheck['sleep_hours']) ?>">

      <label style="display:flex;align-items:center;gap:0.5rem;margin-top:1rem">
        <input type="checkbox" name="exercise_done" value="1" <?= $todayCheck['exercise_done'] ? 'checked' : '' ?> style="width:auto">
        🏃 Activité physique effectuée aujourd'hui
      </label>

      <button type="submit" class="btn" name="daily_check" value="1">Enregistrer (+2 pts)</button>
    </form>
  </div>
</div>

<div class="card">
  <h2>🏆 Mes badges</h2>
  <div class="badge-list">
    <?php foreach (NC_BADGES as $code => $b): $earned = in_array($code, $earnedCodes); ?>
      <span class="badge-pill <?= $earned ? '' : 'locked' ?>" title="<?= nc_e($b['desc']) ?>">
        <?= $b['icon'] ?> <?= nc_e($b['label']) ?>
      </span>
    <?php endforeach; ?>
  </div>
</div>

<div class="grid cols-3">
  <a href="menu.php" class="card" style="text-decoration:none">
    <h3>🗓️ Mon planning</h3>
    <p class="help">Organise tes repas de la semaine</p>
  </a>
  <a href="shopping_list.php" class="card" style="text-decoration:none">
    <h3>🛒 Liste de courses</h3>
    <p class="help">Générée automatiquement depuis ton menu</p>
  </a>
  <a href="recipes.php" class="card" style="text-decoration:none">
    <h3>📖 Mes recettes</h3>
    <p class="help">Découvre ou ajoute tes propres recettes</p>
  </a>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
