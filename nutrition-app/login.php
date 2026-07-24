<?php
require_once __DIR__ . '/config.php';

if (nc_current_user()) {
    header('Location: dashboard.php');
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    [$ok, $error] = nc_login(trim($_POST['email'] ?? ''), (string)($_POST['password'] ?? ''));
    if ($ok) {
        header('Location: dashboard.php');
        exit;
    }
}

$pageTitle = 'Connexion';
require __DIR__ . '/includes/header.php';
?>
<div class="auth-wrap">
  <div class="auth-card">
    <div class="auth-hero">🥑</div>
    <h1>Bon retour !</h1>
    <?php if ($error): ?><div class="flash flash-error"><?= nc_e($error) ?></div><?php endif; ?>
    <form method="post">
      <label for="email">E-mail</label>
      <input type="email" id="email" name="email" required value="<?= nc_e($_POST['email'] ?? '') ?>">

      <label for="password">Mot de passe</label>
      <input type="password" id="password" name="password" required>

      <button type="submit" class="btn" style="width:100%">Se connecter</button>
    </form>
    <p style="text-align:center;margin-top:1.2rem">Pas encore de compte ? <a href="register.php">Créer un compte</a></p>
  </div>
</div>
<?php require __DIR__ . '/includes/footer.php'; ?>
