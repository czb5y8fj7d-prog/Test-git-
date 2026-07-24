<?php
require_once __DIR__ . '/config.php';
$user = nc_require_login();
$pdo = nc_db();
$userId = (int)$user['id'];
$profile = nc_get_profile($pdo, $userId);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['complete_challenge'])) {
    $weekStart = nc_week_start();
    $challenge = nc_weekly_challenge();
    $stmt = $pdo->prepare('INSERT OR IGNORE INTO challenge_completions (user_id, week_start, challenge_code) VALUES (?,?,?)');
    $stmt->execute([$userId, $weekStart, $challenge['code']]);
    if ($stmt->rowCount() > 0) {
        nc_add_points($pdo, $userId, $challenge['points']);
        nc_flash_set('Défi relevé ! +' . $challenge['points'] . ' points 🏆');
    }
    header('Location: tips.php');
    exit;
}

$stmt = $pdo->prepare('SELECT log_date, weight_kg FROM weight_logs WHERE user_id=? ORDER BY log_date ASC');
$stmt->execute([$userId]);
$recentWeights = array_slice($stmt->fetchAll(), -14);
$coachTip = nc_coach_tip($profile, $recentWeights);

$challenge = nc_weekly_challenge();
$weekStart = nc_week_start();
$stmt = $pdo->prepare('SELECT 1 FROM challenge_completions WHERE user_id=? AND week_start=? AND challenge_code=?');
$stmt->execute([$userId, $weekStart, $challenge['code']]);
$challengeDone = (bool)$stmt->fetch();

$categories = [
    '💧 Hydratation' => [
        "Bois un verre d'eau au réveil pour relancer ton métabolisme.",
        "Vise 1,5 à 2L d'eau par jour ; les tisanes et eaux infusées comptent aussi.",
        "La soif est parfois confondue avec la faim : bois avant de grignoter.",
    ],
    '🍽️ Habitudes alimentaires' => [
        "Mange dans une assiette plutôt que dans l'emballage pour mieux visualiser les portions.",
        "Compose ton assiette avec 1/2 légumes, 1/4 protéines, 1/4 féculents complets.",
        "Évite de manger devant un écran : ça favorise les excès sans t'en rendre compte.",
        "Fais 3 repas structurés + 1 collation si besoin, plutôt que du grignotage permanent.",
    ],
    '🏃 Activité physique' => [
        "30 minutes de marche rapide par jour suffisent à faire une vraie différence.",
        "Le renforcement musculaire aide à préserver le muscle pendant une perte de poids.",
        "Prends les escaliers, descends un arrêt de bus plus tôt : le mouvement du quotidien compte.",
    ],
    '😴 Sommeil & stress' => [
        "Le manque de sommeil augmente la ghréline, l'hormone de la faim.",
        "Le stress chronique favorise le stockage abdominal : la respiration profonde peut aider.",
        "Une routine du soir régulière améliore la qualité du sommeil.",
    ],
    '🛒 Courses & organisation' => [
        "Ne fais jamais tes courses le ventre vide : tu achèteras plus de superflu.",
        "Prépare ta liste de courses à partir de ton planning de repas pour éviter le gaspillage.",
        "Fais des lots de préparation (batch cooking) le week-end pour gagner du temps en semaine.",
    ],
];

$pageTitle = 'Conseils & défis';
require __DIR__ . '/includes/header.php';
?>

<h1>💡 Conseils & défis</h1>

<div class="card">
  <h2>Le conseil du jour</h2>
  <div class="tip-of-day"><?= nc_e($coachTip) ?></div>
</div>

<div class="card">
  <h2>🏅 Défi de la semaine</h2>
  <div class="challenge-box">
    <div style="font-size:1.05rem"><?= nc_e($challenge['label']) ?> <strong>(+<?= $challenge['points'] ?> pts)</strong></div>
    <?php if ($challengeDone): ?>
      <span class="badge-pill">✅ Réalisé cette semaine</span>
    <?php else: ?>
      <form method="post"><button class="btn" type="submit" name="complete_challenge" value="1">Je relève le défi !</button></form>
    <?php endif; ?>
  </div>
</div>

<div class="grid cols-2">
  <?php foreach ($categories as $cat => $tips): ?>
    <div class="card">
      <h3><?= nc_e($cat) ?></h3>
      <ul>
        <?php foreach ($tips as $t): ?><li><?= nc_e($t) ?></li><?php endforeach; ?>
      </ul>
    </div>
  <?php endforeach; ?>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
