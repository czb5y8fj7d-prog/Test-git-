<?php
require_once __DIR__ . '/config.php';
$user = nc_require_login();
$pdo = nc_db();
$profile = nc_get_profile($pdo, (int)$user['id']);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $sex = $_POST['sex'] === 'H' ? 'H' : 'F';
    $age = max(10, min(100, (int)$_POST['age']));
    $height = max(100, min(250, (float)str_replace(',', '.', $_POST['height_cm'])));
    $weight = max(30, min(300, (float)str_replace(',', '.', $_POST['current_weight_kg'])));
    $target = $_POST['target_weight_kg'] !== '' ? max(30, min(300, (float)str_replace(',', '.', $_POST['target_weight_kg']))) : null;
    $activity = in_array($_POST['activity_level'], array_keys(NC_ACTIVITY_FACTORS)) ? $_POST['activity_level'] : 'modere';
    $goal = in_array($_POST['goal'], array_keys(NC_GOAL_LABELS)) ? $_POST['goal'] : 'perte';
    $dietPref = trim($_POST['diet_pref'] ?? '');
    $allergies = trim($_POST['allergies'] ?? '');
    $startWeight = $profile['start_weight_kg'] ?: $weight;

    $stmt = $pdo->prepare(
        'UPDATE profiles SET sex=?, age=?, height_cm=?, current_weight_kg=?, start_weight_kg=?, target_weight_kg=?,
         activity_level=?, goal=?, diet_pref=?, allergies=?, updated_at=datetime("now") WHERE user_id=?'
    );
    $stmt->execute([$sex, $age, $height, $weight, $startWeight, $target, $activity, $goal, $dietPref, $allergies, $user['id']]);

    // Historise aussi dans le suivi de poids si aucune pesée n'existe pour aujourd'hui
    $today = date('Y-m-d');
    $exists = $pdo->prepare('SELECT 1 FROM weight_logs WHERE user_id=? AND log_date=?');
    $exists->execute([$user['id'], $today]);
    if (!$exists->fetch()) {
        $pdo->prepare('INSERT INTO weight_logs (user_id, log_date, weight_kg) VALUES (?, ?, ?)')
            ->execute([$user['id'], $today, $weight]);
        nc_check_badges($pdo, (int)$user['id']);
    }

    nc_flash_set('Profil mis à jour !');
    header('Location: profile.php');
    exit;
}

$summary = nc_build_profile_summary($profile);
$pageTitle = 'Mon profil';
require __DIR__ . '/header.php';
?>

<h1>🙋 Mon profil <?= nc_e($user['name']) ?></h1>
<?php if (!empty($_GET['welcome'])): ?>
  <div class="flash flash-success">Bienvenue sur NutriCoach ! Complète ton profil pour obtenir tes objectifs personnalisés 🎯</div>
<?php endif; ?>

<div class="grid cols-2">
  <div class="card">
    <h2>Mes informations</h2>
    <form method="post">
      <div class="field-row">
        <div>
          <label for="sex">Sexe</label>
          <select id="sex" name="sex">
            <option value="F" <?= $profile['sex'] === 'F' ? 'selected' : '' ?>>Femme</option>
            <option value="H" <?= $profile['sex'] === 'H' ? 'selected' : '' ?>>Homme</option>
          </select>
        </div>
        <div>
          <label for="age">Âge</label>
          <input type="number" id="age" name="age" min="10" max="100" required value="<?= nc_e((string)($profile['age'] ?? '')) ?>">
        </div>
      </div>

      <div class="field-row">
        <div>
          <label for="height_cm">Taille (cm)</label>
          <input type="number" step="0.1" id="height_cm" name="height_cm" required value="<?= nc_e((string)($profile['height_cm'] ?? '')) ?>">
        </div>
        <div>
          <label for="current_weight_kg">Poids actuel (kg)</label>
          <input type="number" step="0.1" id="current_weight_kg" name="current_weight_kg" required value="<?= nc_e((string)($profile['current_weight_kg'] ?? '')) ?>">
        </div>
      </div>

      <label for="target_weight_kg">Poids objectif (kg)</label>
      <input type="number" step="0.1" id="target_weight_kg" name="target_weight_kg" value="<?= nc_e((string)($profile['target_weight_kg'] ?? '')) ?>">

      <label for="activity_level">Niveau d'activité</label>
      <select id="activity_level" name="activity_level">
        <?php foreach (NC_ACTIVITY_LABELS as $key => $label): ?>
          <option value="<?= $key ?>" <?= $profile['activity_level'] === $key ? 'selected' : '' ?>><?= nc_e($label) ?></option>
        <?php endforeach; ?>
      </select>

      <label for="goal">Objectif</label>
      <select id="goal" name="goal">
        <?php foreach (NC_GOAL_LABELS as $key => $label): ?>
          <option value="<?= $key ?>" <?= $profile['goal'] === $key ? 'selected' : '' ?>><?= nc_e($label) ?></option>
        <?php endforeach; ?>
      </select>

      <label for="diet_pref">Préférences alimentaires</label>
      <input type="text" id="diet_pref" name="diet_pref" placeholder="Végétarien, sans gluten..." value="<?= nc_e($profile['diet_pref'] ?? '') ?>">

      <label for="allergies">Allergies / aliments à éviter</label>
      <input type="text" id="allergies" name="allergies" placeholder="Arachides, lactose..." value="<?= nc_e($profile['allergies'] ?? '') ?>">

      <button type="submit" class="btn">Enregistrer mon profil</button>
    </form>
  </div>

  <div>
    <?php if ($summary): ?>
      <div class="card">
        <h2>🎯 Tes objectifs personnalisés</h2>
        <div class="grid cols-2">
          <div class="stat-tile">
            <span class="value"><?= $summary['calories'] ?></span>
            <span class="label">kcal / jour conseillées</span>
          </div>
          <div class="stat-tile orange">
            <span class="value"><?= $summary['tdee'] ?></span>
            <span class="label">dépense (TDEE) estimée</span>
          </div>
        </div>
        <h3 style="margin-top:1.2rem">Répartition des macros</h3>
        <table class="simple-table">
          <tr><th>Protéines</th><td><?= $summary['macros']['protein_g'] ?> g</td></tr>
          <tr><th>Glucides</th><td><?= $summary['macros']['carbs_g'] ?> g</td></tr>
          <tr><th>Lipides</th><td><?= $summary['macros']['fat_g'] ?> g</td></tr>
        </table>
        <?php if ($summary['weeks_to_goal'] !== null): ?>
          <p style="margin-top:1rem">
            <?php if ($summary['weeks_to_goal'] === 0): ?>
              🎉 Tu es déjà à ton poids objectif !
            <?php else: ?>
              À un rythme raisonnable, ton objectif est atteignable en environ
              <strong><?= $summary['weeks_to_goal'] ?> semaines</strong>.
            <?php endif; ?>
          </p>
        <?php endif; ?>
      </div>
    <?php else: ?>
      <div class="card empty-state">Complète tes informations pour découvrir tes besoins caloriques personnalisés 👈</div>
    <?php endif; ?>
  </div>
</div>

<?php require __DIR__ . '/footer.php'; ?>
