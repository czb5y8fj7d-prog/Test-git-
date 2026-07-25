<?php
require_once __DIR__ . '/config.php';

if (nc_current_user()) {
    header('Location: dashboard.php');
    exit;
}

$pageTitle = 'Ton coach nutrition personnel';
require __DIR__ . '/header.php';
?>

<section class="hero">
  <div class="hero-emoji">🥗🎯⚖️</div>
  <h1>Perds du poids <em>durablement</em>,<br>sans te compliquer la vie.</h1>
  <p class="hero-sub">
    NutriCoach calcule tes besoins caloriques, te propose des recettes et un
    planning de repas adaptés à toi, génère ta liste de courses automatiquement
    et t'accompagne au quotidien avec des conseils, des défis et des badges.
  </p>
  <div class="btn-row" style="justify-content:center">
    <a href="register.php" class="btn" style="font-size:1.05rem">🚀 Créer mon compte gratuit</a>
    <a href="login.php" class="btn secondary" style="font-size:1.05rem">J'ai déjà un compte</a>
  </div>
  <form method="post" action="login.php" style="margin-top:0.9rem">
    <input type="hidden" name="email" value="<?= nc_e(NC_DEMO_EMAIL) ?>">
    <input type="hidden" name="password" value="<?= nc_e(NC_DEMO_PASSWORD) ?>">
    <button type="submit" class="link-btn">👀 Ou visite la démo sans inscription</button>
  </form>
</section>

<section>
  <h2 class="section-title">Tout ce qu'il faut pour un vrai programme santé</h2>
  <div class="grid cols-3">
    <div class="card feature-card">
      <div class="feature-icon">🎯</div>
      <h3>Profil 100% personnalisé</h3>
      <p class="help">Calories, protéines, glucides et lipides calculés précisément selon ton sexe, ton âge, ton poids et ton niveau d'activité.</p>
    </div>
    <div class="card feature-card">
      <div class="feature-icon">📖</div>
      <h3>Recettes & planning</h3>
      <p class="help">Une bibliothèque de recettes saines prête à l'emploi, tes propres recettes, et un planning hebdomadaire généré en un clic.</p>
    </div>
    <div class="card feature-card">
      <div class="feature-icon">🛒</div>
      <h3>Liste de courses automatique</h3>
      <p class="help">Fini le casse-tête : ta liste de courses se construit toute seule à partir de ton planning de la semaine.</p>
    </div>
    <div class="card feature-card">
      <div class="feature-icon">⚖️</div>
      <h3>Suivi de poids visuel</h3>
      <p class="help">Enregistre tes pesées et visualise ta progression avec un graphique clair vers ton objectif.</p>
    </div>
    <div class="card feature-card">
      <div class="feature-icon">🏅</div>
      <h3>Points, badges & défis</h3>
      <p class="help">Chaque bonne action rapporte des points. Débloque des badges et relève un défi ludique chaque semaine.</p>
    </div>
    <div class="card feature-card">
      <div class="feature-icon">💡</div>
      <h3>Un coach au quotidien</h3>
      <p class="help">Un conseil personnalisé chaque jour, qui s'adapte à ta progression et à ton objectif.</p>
    </div>
  </div>
</section>

<section>
  <h2 class="section-title">Comment ça marche</h2>
  <div class="grid cols-3">
    <div class="card" style="text-align:center">
      <div class="feature-icon">1️⃣</div>
      <h3>Crée ton profil</h3>
      <p class="help">Renseigne tes infos, on calcule tes besoins caloriques en quelques secondes.</p>
    </div>
    <div class="card" style="text-align:center">
      <div class="feature-icon">2️⃣</div>
      <h3>Planifie ta semaine</h3>
      <p class="help">Choisis tes recettes ou laisse NutriCoach générer ton menu automatiquement.</p>
    </div>
    <div class="card" style="text-align:center">
      <div class="feature-icon">3️⃣</div>
      <h3>Suis ta progression</h3>
      <p class="help">Pèse-toi, coche tes objectifs, gagne des points : la motivation vient toute seule.</p>
    </div>
  </div>
</section>

<section class="cta-banner">
  <h2>Prêt(e) à commencer ton programme ?</h2>
  <p>Gratuit, sans engagement, sans publicité.</p>
  <a href="register.php" class="btn" style="font-size:1.05rem">Créer mon compte maintenant</a>
</section>

<?php require __DIR__ . '/footer.php'; ?>
