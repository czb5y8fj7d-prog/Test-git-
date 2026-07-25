<?php
require_once __DIR__ . '/config.php';

if (nc_current_user()) {
    header('Location: dashboard.php');
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    [$ok, $error] = nc_register(
        trim($_POST['name'] ?? ''),
        trim($_POST['email'] ?? ''),
        (string)($_POST['password'] ?? '')
    );
    if ($ok) {
        header('Location: profile.php?welcome=1');
        exit;
    }
}

$pageTitle = 'Créer un compte';
require __DIR__ . '/header.php';
?>
<div class="auth-wrap">
  <div class="auth-card">
    <div class="auth-hero">🥗🎉</div>
    <h1>Rejoindre NutriCoach</h1>
    <?php if ($error): ?><div class="flash flash-error"><?= nc_e($error) ?></div><?php endif; ?>
    <form method="post">
      <label for="name">Prénom</label>
      <input type="text" id="name" name="name" required value="<?= nc_e($_POST['name'] ?? '') ?>">

      <label for="email">E-mail</label>
      <input type="email" id="email" name="email" required value="<?= nc_e($_POST['email'] ?? '') ?>">

      <label for="password">Mot de passe</label>
      <input type="password" id="password" name="password" minlength="6" required>
      <p class="help">6 caractères minimum.</p>

      <button type="submit" class="btn" style="width:100%">Créer mon compte</button>
    </form>
    <p style="text-align:center;margin-top:1.2rem">Déjà inscrit(e) ? <a href="login.php">Se connecter</a></p>
    <p style="text-align:center;margin-top:0.6rem"><a href="index.php">← Retour à l'accueil</a></p>
  </div>
</div>
<?php require __DIR__ . '/footer.php'; ?>
