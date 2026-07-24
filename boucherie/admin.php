<?php
require_once __DIR__ . '/functions.php';

// ---------- Routage interne (robuste que ce fichier soit inclus depuis
// index.php via /admin, ou atteint directement en /admin.php) ----------

$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');
$requestPath = (string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$full = substr($requestPath, strlen($scriptDir));
if ($full === '' || $full === false) $full = '/';
if ($full !== '/') $full = rtrim($full, '/');

if (strpos($full, '/admin.php') === 0) {
    $adminPath = substr($full, strlen('/admin.php'));
} elseif (strpos($full, '/admin') === 0) {
    $adminPath = substr($full, strlen('/admin'));
} else {
    $adminPath = '';
}
if ($adminPath === '' || $adminPath === false) $adminPath = '/';

$method = $_SERVER['REQUEST_METHOD'];

// ---------- Auth ----------

if ($adminPath === '/login') {
    if ($method === 'POST') {
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        $user = find_admin_by_username($username);
        if (!$user || !password_verify($password, $user['password_hash'])) {
            render_login_page('Identifiants incorrects.');
            exit;
        }
        session_regenerate_id(true);
        $_SESSION['admin_id'] = $user['id'];
        $_SESSION['admin_username'] = $user['username'];
        header('Location: ' . base_path() . '/admin');
        exit;
    }
    if (is_logged_in()) {
        header('Location: ' . base_path() . '/admin');
        exit;
    }
    render_login_page(null);
    exit;
}

if ($adminPath === '/logout' && $method === 'POST') {
    $_SESSION = [];
    session_destroy();
    header('Location: ' . base_path() . '/admin/login');
    exit;
}

if ($adminPath === '/' || $adminPath === '') {
    require_admin_page();
    render_dashboard();
    exit;
}

// ---------- API (JSON) ----------

if (strpos($adminPath, '/api/') === 0) {
    require_admin_api();

    // GET /admin/api/data
    if ($adminPath === '/api/data' && $method === 'GET') {
        json_response([
            'settings' => get_all_settings(),
            'stats' => get_stats(),
            'products' => get_all_products(),
        ]);
    }

    // POST /admin/api/settings
    if ($adminPath === '/api/settings' && $method === 'POST') {
        verify_csrf();
        set_settings(read_json_body());
        json_response(['ok' => true, 'settings' => get_all_settings()]);
    }

    // POST /admin/api/stats
    if ($adminPath === '/api/stats' && $method === 'POST') {
        verify_csrf();
        $body = read_json_body();
        if (!isset($body['stats']) || !is_array($body['stats'])) {
            json_response(['error' => 'Format invalide.'], 400);
        }
        set_stats($body['stats']);
        json_response(['ok' => true, 'stats' => get_stats()]);
    }

    // POST /admin/api/products
    if ($adminPath === '/api/products' && $method === 'POST') {
        verify_csrf();
        $body = read_json_body();
        if (empty(trim($body['title'] ?? ''))) {
            json_response(['error' => 'Le titre du produit est obligatoire.'], 400);
        }
        $id = create_product($body);
        json_response(['ok' => true, 'id' => $id, 'products' => get_all_products()]);
    }

    // POST /admin/api/products/reorder
    if ($adminPath === '/api/products/reorder' && $method === 'POST') {
        verify_csrf();
        $body = read_json_body();
        if (!isset($body['ids']) || !is_array($body['ids'])) {
            json_response(['error' => 'Format invalide.'], 400);
        }
        reorder_products($body['ids']);
        json_response(['ok' => true, 'products' => get_all_products()]);
    }

    // PUT/DELETE /admin/api/products/{id}
    if (preg_match('#^/api/products/(\d+)$#', $adminPath, $m)) {
        $id = (int) $m[1];
        if ($method === 'PUT') {
            verify_csrf();
            $body = read_json_body();
            if (empty(trim($body['title'] ?? ''))) {
                json_response(['error' => 'Le titre du produit est obligatoire.'], 400);
            }
            update_product($id, $body);
            json_response(['ok' => true, 'products' => get_all_products()]);
        }
        if ($method === 'DELETE') {
            verify_csrf();
            delete_product($id);
            json_response(['ok' => true, 'products' => get_all_products()]);
        }
    }

    // POST /admin/api/upload
    if ($adminPath === '/api/upload' && $method === 'POST') {
        verify_csrf();
        json_response(handle_upload());
    }

    // POST /admin/api/change-password
    if ($adminPath === '/api/change-password' && $method === 'POST') {
        verify_csrf();
        $body = read_json_body();
        $user = find_admin_by_username($_SESSION['admin_username']);
        if (!$user || !password_verify($body['currentPassword'] ?? '', $user['password_hash'])) {
            json_response(['error' => 'Mot de passe actuel incorrect.'], 401);
        }
        $newPassword = (string) ($body['newPassword'] ?? '');
        if (strlen($newPassword) < 8) {
            json_response(['error' => 'Le nouveau mot de passe doit faire au moins 8 caractères.'], 400);
        }
        update_admin_password((int) $user['id'], password_hash($newPassword, PASSWORD_DEFAULT));
        json_response(['ok' => true]);
    }

    json_response(['error' => 'Route inconnue.'], 404);
}

http_response_code(404);
echo 'Page introuvable.';
exit;

// =====================================================================
// Rendu HTML
// =====================================================================

function handle_upload(): array
{
    if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        return ['error' => 'Aucun fichier reçu.'];
    }
    $file = $_FILES['image'];
    if ($file['size'] > 5 * 1024 * 1024) {
        http_response_code(400);
        return ['error' => "L'image dépasse la taille maximale de 5 Mo."];
    }
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    $extByType = [
        'image/jpeg' => '.jpg',
        'image/png' => '.png',
        'image/webp' => '.webp',
        'image/gif' => '.gif',
        'image/svg+xml' => '.svg',
    ];
    if (!isset($extByType[$mime])) {
        http_response_code(400);
        return ['error' => "Format d'image non supporté (jpg, png, webp, gif, svg uniquement)."];
    }
    if (!is_dir(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0775, true);
    $filename = bin2hex(random_bytes(16)) . $extByType[$mime];
    move_uploaded_file($file['tmp_name'], UPLOAD_DIR . '/' . $filename);
    return ['ok' => true, 'url' => base_path() . '/uploads/' . $filename];
}

function render_login_page(?string $error): void
{
    $base = base_path();
    ?><!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Connexion admin — Maison Lambert</title>
<link rel="stylesheet" href="<?= e($base) ?>/assets/admin.css">
</head>
<body class="admin-login-body">
  <main class="login-card">
    <h1>Espace admin</h1>
    <p class="login-sub">Maison Lambert — gestion du site</p>
    <?php if ($error): ?>
      <p class="login-error"><?= e($error) ?></p>
    <?php endif; ?>
    <form method="POST" action="<?= e($base) ?>/admin/login" class="login-form">
      <label for="username">Identifiant</label>
      <input type="text" id="username" name="username" autocomplete="username" required autofocus>

      <label for="password">Mot de passe</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required>

      <button type="submit" class="btn-primary">Se connecter</button>
    </form>
    <a class="back-link" href="<?= e($base) ?>/">← Retour au site</a>
  </main>
</body>
</html>
<?php
}

function render_dashboard(): void
{
    $data = [
        'settings' => get_all_settings(),
        'stats' => get_stats(),
        'products' => get_all_products(),
    ];
    $csrf = csrf_token();
    $adminUsername = $_SESSION['admin_username'] ?? '';
    $base = base_path();
    ?><!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Menu admin — Maison Lambert</title>
<link rel="stylesheet" href="<?= e($base) ?>/assets/admin.css">
</head>
<body>

<header class="admin-topbar">
  <h1>Maison Lambert — Menu admin</h1>
  <div class="topbar-right">
    <span>Connecté : <?= e($adminUsername) ?></span>
    <a href="<?= e($base) ?>/" target="_blank" rel="noopener">Voir le site ↗</a>
    <form method="POST" action="<?= e($base) ?>/admin/logout" style="margin:0;">
      <button type="submit">Déconnexion</button>
    </form>
  </div>
</header>

<div class="admin-shell">
  <nav class="admin-nav">
    <button type="button" class="tab-btn active" data-tab="infos">Infos &amp; coordonnées</button>
    <button type="button" class="tab-btn" data-tab="textes">Textes du site</button>
    <button type="button" class="tab-btn" data-tab="apparence">Apparence</button>
    <button type="button" class="tab-btn" data-tab="produits">Produits &amp; services</button>
    <button type="button" class="tab-btn" data-tab="chiffres">Chiffres clés</button>
    <button type="button" class="tab-btn" data-tab="compte">Mon compte</button>
  </nav>

  <main class="admin-main">

    <!-- ===== INFOS ===== -->
    <section class="admin-panel active" id="panel-infos">
      <h2>Infos &amp; coordonnées</h2>
      <p class="panel-hint">Nom, contact, adresse, horaires et réseaux sociaux affichés sur le site.</p>
      <form class="card" id="form-infos">
        <div class="field-grid">
          <div class="field"><label>Nom de l'établissement</label><input type="text" name="brand_name"></div>
          <div class="field"><label>Sous-titre / activité</label><input type="text" name="brand_tagline"></div>
          <div class="field"><label>Téléphone affiché</label><input type="text" name="phone_display" placeholder="04 78 12 34 56"></div>
          <div class="field"><label>Téléphone (lien tel:)<span class="hint"> — format international</span></label><input type="text" name="phone_link" placeholder="+330478123456"></div>
          <div class="field"><label>E-mail</label><input type="email" name="email"></div>
          <div class="field"><label>Adresse</label><input type="text" name="address"></div>
          <div class="field"><label>Instagram (lien complet)</label><input type="text" name="social_instagram" placeholder="https://instagram.com/..."></div>
          <div class="field"><label>Facebook (lien complet)</label><input type="text" name="social_facebook" placeholder="https://facebook.com/..."></div>
        </div>

        <h3 style="margin-top:1.4rem;">Horaires d'ouverture</h3>
        <div class="field-grid">
          <div class="field"><label>Ligne 1 — jours</label><input type="text" name="hours_1_label"></div>
          <div class="field"><label>Ligne 1 — horaires</label><input type="text" name="hours_1_value"></div>
          <div class="field"><label>Ligne 2 — jours</label><input type="text" name="hours_2_label"></div>
          <div class="field"><label>Ligne 2 — horaires</label><input type="text" name="hours_2_value"></div>
          <div class="field"><label>Ligne 3 — jours</label><input type="text" name="hours_3_label"></div>
          <div class="field"><label>Ligne 3 — horaires</label><input type="text" name="hours_3_value"></div>
          <div class="field"><label>Ligne 4 — jours</label><input type="text" name="hours_4_label"></div>
          <div class="field"><label>Ligne 4 — horaires</label><input type="text" name="hours_4_value"></div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn">Enregistrer</button>
          <span class="status-msg" data-status-for="form-infos"></span>
        </div>
      </form>
    </section>

    <!-- ===== TEXTES ===== -->
    <section class="admin-panel" id="panel-textes">
      <h2>Textes du site</h2>
      <p class="panel-hint">Les titres et paragraphes de chaque section de la page d'accueil.</p>
      <form class="card" id="form-textes">
        <h3>Référencement</h3>
        <div class="field-grid single">
          <div class="field"><label>Titre de la page (onglet navigateur / SEO)</label><input type="text" name="site_title"></div>
          <div class="field"><label>Description (SEO)</label><textarea name="site_description" rows="2"></textarea></div>
        </div>

        <h3 style="margin-top:1.2rem;">Section d'accueil (hero)</h3>
        <div class="field-grid single">
          <div class="field"><label>Petite phrase au-dessus du titre</label><input type="text" name="hero_eyebrow"></div>
          <div class="field"><label>Titre principal<span class="hint"> — une ligne par retour à la ligne</span></label><textarea name="hero_title" rows="2"></textarea></div>
          <div class="field"><label>Paragraphe d'introduction</label><textarea name="hero_lede" rows="2"></textarea></div>
        </div>

        <h3 style="margin-top:1.2rem;">Savoir-faire</h3>
        <div class="field-grid single">
          <div class="field"><label>Titre</label><input type="text" name="philosophy_title"></div>
          <div class="field"><label>Paragraphe</label><textarea name="philosophy_lede" rows="2"></textarea></div>
        </div>

        <h3 style="margin-top:1.2rem;">Nos viandes</h3>
        <div class="field-grid single">
          <div class="field"><label>Petite phrase</label><input type="text" name="meat_eyebrow"></div>
          <div class="field"><label>Titre</label><input type="text" name="meat_title"></div>
          <div class="field"><label>Paragraphe</label><textarea name="meat_lede" rows="2"></textarea></div>
          <div class="field"><label>Note de bas de section</label><input type="text" name="meat_note"></div>
        </div>

        <h3 style="margin-top:1.2rem;">Traiteur</h3>
        <div class="field-grid single">
          <div class="field"><label>Petite phrase</label><input type="text" name="traiteur_eyebrow"></div>
          <div class="field"><label>Titre</label><input type="text" name="traiteur_title"></div>
          <div class="field"><label>Paragraphe</label><textarea name="traiteur_lede" rows="2"></textarea></div>
          <div class="field"><label>Titre de l'encart devis</label><input type="text" name="traiteur_cta_title"></div>
          <div class="field"><label>Texte de l'encart devis</label><textarea name="traiteur_cta_text" rows="2"></textarea></div>
        </div>

        <h3 style="margin-top:1.2rem;">Contact</h3>
        <div class="field-grid single">
          <div class="field"><label>Petite phrase</label><input type="text" name="contact_eyebrow"></div>
          <div class="field"><label>Titre</label><input type="text" name="contact_title"></div>
          <div class="field"><label>Paragraphe</label><textarea name="contact_lede" rows="2"></textarea></div>
        </div>

        <h3 style="margin-top:1.2rem;">Pied de page</h3>
        <div class="field-grid single">
          <div class="field"><label>Phrase sous le nom</label><input type="text" name="footer_tagline"></div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn">Enregistrer</button>
          <span class="status-msg" data-status-for="form-textes"></span>
        </div>
      </form>
    </section>

    <!-- ===== APPARENCE ===== -->
    <section class="admin-panel" id="panel-apparence">
      <h2>Apparence</h2>
      <p class="panel-hint">Les couleurs principales du site. Les variantes claires/foncées sont calculées automatiquement.</p>
      <form class="card" id="form-apparence">
        <div class="field-grid">
          <div class="field">
            <label>Couleur principale</label>
            <div class="color-field">
              <input type="color" data-pair="color_primary">
              <input type="text" name="color_primary">
            </div>
          </div>
          <div class="field">
            <label>Couleur accent / or</label>
            <div class="color-field">
              <input type="color" data-pair="color_accent">
              <input type="text" name="color_accent">
            </div>
          </div>
          <div class="field">
            <label>Couleur de fond</label>
            <div class="color-field">
              <input type="color" data-pair="color_background">
              <input type="text" name="color_background">
            </div>
          </div>
          <div class="field">
            <label>Couleur du texte</label>
            <div class="color-field">
              <input type="color" data-pair="color_text">
              <input type="text" name="color_text">
            </div>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn">Enregistrer</button>
          <a class="btn btn-secondary" href="<?= e($base) ?>/" target="_blank" rel="noopener">Prévisualiser le site</a>
          <span class="status-msg" data-status-for="form-apparence"></span>
        </div>
      </form>
    </section>

    <!-- ===== PRODUITS ===== -->
    <section class="admin-panel" id="panel-produits">
      <h2>Produits &amp; services</h2>
      <p class="panel-hint">Les cartes affichées dans la section « Nos viandes ». Utilise les flèches pour changer l'ordre d'affichage.</p>
      <div class="form-actions" style="margin-bottom:1rem;">
        <button type="button" class="btn" id="btn-add-product">+ Ajouter un produit</button>
        <span class="status-msg" data-status-for="products"></span>
      </div>
      <div class="product-list" id="product-list"></div>
    </section>

    <!-- ===== CHIFFRES ===== -->
    <section class="admin-panel" id="panel-chiffres">
      <h2>Chiffres clés</h2>
      <p class="panel-hint">Les 4 chiffres affichés juste sous la bannière d'accueil.</p>
      <form class="card" id="form-chiffres">
        <div id="stats-fields" class="field-grid"></div>
        <div class="form-actions">
          <button type="submit" class="btn">Enregistrer</button>
          <span class="status-msg" data-status-for="form-chiffres"></span>
        </div>
      </form>
    </section>

    <!-- ===== COMPTE ===== -->
    <section class="admin-panel" id="panel-compte">
      <h2>Mon compte</h2>
      <p class="panel-hint">Changer le mot de passe d'accès au menu admin.</p>
      <form class="card" id="form-password">
        <div class="field-grid">
          <div class="field"><label>Mot de passe actuel</label><input type="password" name="currentPassword" autocomplete="current-password" required></div>
          <div class="field"><label>Nouveau mot de passe<span class="hint"> — 8 caractères minimum</span></label><input type="password" name="newPassword" autocomplete="new-password" required minlength="8"></div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn">Changer le mot de passe</button>
          <span class="status-msg" data-status-for="form-password"></span>
        </div>
      </form>
    </section>

  </main>
</div>

<!-- ===== Modal produit ===== -->
<div class="modal-overlay" id="product-modal">
  <div class="modal">
    <h3 id="product-modal-title">Ajouter un produit</h3>
    <form id="product-form">
      <input type="hidden" name="id">
      <div class="field-grid single">
        <div class="field"><label>Titre</label><input type="text" name="title" required></div>
        <div class="field">
          <label>Étiquette (optionnel, ex. "Fait maison")</label>
          <input type="text" name="tag">
        </div>
        <div class="field">
          <label>Style de l'étiquette</label>
          <select name="tag_style">
            <option value="default">Bordeaux (par défaut)</option>
            <option value="alt">Or</option>
          </select>
        </div>
        <div class="field"><label>Description</label><textarea name="description" rows="2"></textarea></div>
        <div class="field items-editor">
          <label>Liste de points<span class="hint"> — un élément par ligne</span></label>
          <textarea name="items"></textarea>
        </div>
        <div class="field">
          <label>Image</label>
          <div class="image-picker">
            <img class="product-image-preview" style="display:none;">
            <div class="ph product-image-ph"></div>
            <input type="file" accept="image/*" data-upload-for="products">
          </div>
          <input type="hidden" name="image_url">
        </div>
        <div class="field">
          <label><input type="checkbox" name="published" checked style="width:auto;"> Publié sur le site</label>
        </div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn">Enregistrer</button>
        <button type="button" class="btn btn-secondary" id="btn-cancel-product">Annuler</button>
        <span class="status-msg" data-status-for="product-form"></span>
      </div>
    </form>
  </div>
</div>

<script>
  window.__ADMIN_DATA__ = <?= json_encode($data, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
  window.__CSRF__ = <?= json_encode($csrf) ?>;
  window.__BASE__ = <?= json_encode($base) ?>;
</script>
<script src="<?= e($base) ?>/assets/admin.js"></script>
</body>
</html>
<?php
}
