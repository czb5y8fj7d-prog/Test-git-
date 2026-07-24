<?php
/**
 * Maison Lambert — couche données + auth + helpers.
 * Seul fichier "moteur" du site, inclus par index.php et admin.php.
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

define('BASE_DIR', __DIR__);
define('DATA_DIR', BASE_DIR . '/data');
define('UPLOAD_DIR', BASE_DIR . '/uploads');

// ---------- Config (admin initial) ----------

function app_config(): array
{
    static $config = null;
    if ($config !== null) return $config;
    $defaults = ['admin_username' => 'admin', 'admin_password' => 'change-moi'];
    $custom = file_exists(BASE_DIR . '/config.php') ? require BASE_DIR . '/config.php' : [];
    $config = array_merge($defaults, is_array($custom) ? $custom : []);
    return $config;
}

// ---------- Connexion + schéma + seed ----------

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0775, true);
    $isNew = !file_exists(DATA_DIR . '/site.db');

    $pdo = new PDO('sqlite:' . DATA_DIR . '/site.db');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode = WAL');

    $pdo->exec('CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ""
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS stats (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        number   TEXT NOT NULL,
        label    TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS products (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        tag         TEXT NOT NULL DEFAULT "",
        tag_style   TEXT NOT NULL DEFAULT "default",
        title       TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT "",
        items       TEXT NOT NULL DEFAULT "[]",
        image_url   TEXT NOT NULL DEFAULT "",
        position    INTEGER NOT NULL DEFAULT 0,
        published   INTEGER NOT NULL DEFAULT 1
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS admin_users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL
    )');

    if ($isNew) seed_database($pdo);

    return $pdo;
}

function default_settings(): array
{
    return [
        'brand_name' => 'Maison Lambert',
        'brand_tagline' => 'Boucher · Charcutier · Traiteur',
        'site_title' => 'Maison Lambert — Boucher · Charcutier · Traiteur depuis 1958',
        'site_description' => "Maison Lambert, boucherie artisanale depuis 1958. Viandes maturées, charcuterie faite main et service traiteur sur mesure pour vos réceptions.",

        'phone_display' => '04 78 12 34 56',
        'phone_link' => '+330478123456',
        'email' => 'contact@maison-lambert.fr',
        'address' => '12 Place du Marché, 24 Villeneuve-sur-Auvézère',

        'hours_1_label' => 'Mardi – Vendredi',
        'hours_1_value' => '7h30 – 12h45 · 15h30 – 19h30',
        'hours_2_label' => 'Samedi',
        'hours_2_value' => '7h00 – 19h30 (non-stop)',
        'hours_3_label' => 'Dimanche',
        'hours_3_value' => '7h30 – 13h00',
        'hours_4_label' => 'Lundi',
        'hours_4_value' => 'Fermé',

        'social_instagram' => '#',
        'social_facebook' => '#',

        'hero_eyebrow' => 'Artisan boucher depuis 1958 — Villeneuve-sur-Auvézère',
        'hero_title' => "L'art de la belle pièce,\ndepuis trois générations",
        'hero_lede' => "Une boucherie de famille où chaque pièce est choisie chez l'éleveur, maturée en cave et travaillée au couteau, dans le respect du produit, du geste et du temps.",

        'philosophy_title' => 'Le respect du produit, avant tout',
        'philosophy_lede' => "Chez Maison Lambert, une belle pièce ne s'improvise pas. Elle se choisit à la ferme, se patiente en cave, et se travaille à la main — sans raccourci. C'est ce savoir-faire, transmis depuis 1958, que nous mettons chaque jour dans votre assiette.",

        'meat_eyebrow' => 'Le comptoir',
        'meat_title' => "Nos viandes d'exception",
        'meat_lede' => "Une sélection resserrée, choisie pour sa qualité plutôt que sa quantité. Toutes nos viandes sont fermières, tracées depuis l'élevage, et préparées à la commande.",
        'meat_note' => "Gibier de saison disponible selon arrivages — demandez conseil à votre boucher au comptoir.",

        'traiteur_eyebrow' => 'Service traiteur',
        'traiteur_title' => 'Recevez sans compromis',
        'traiteur_lede' => "Mariage, fête de famille, réception d'entreprise ou simple dimanche entre amis : notre atelier traiteur compose avec vous un menu à base de belles pièces, dans le même souci du détail que notre boucherie.",
        'traiteur_cta_title' => 'Un événement à préparer ?',
        'traiteur_cta_text' => "Parlez-nous de votre projet — nombre de convives, budget, envies — et recevez un devis personnalisé sous 48h.",

        'contact_eyebrow' => 'Nous rencontrer',
        'contact_title' => 'Venez pousser la porte',
        'contact_lede' => "Notre équipe vous accueille au comptoir pour vous conseiller sur la pièce du jour, ou pour construire ensemble votre commande traiteur.",

        'footer_tagline' => 'Boucher · Charcutier · Traiteur — artisan depuis 1958.',

        'color_primary' => '#601a20',
        'color_accent' => '#b8925a',
        'color_background' => '#f6efe1',
        'color_text' => '#241d17',
    ];
}

function seed_database(PDO $pdo): void
{
    $insertSetting = $pdo->prepare('INSERT INTO settings (key, value) VALUES (:k, :v)');
    foreach (default_settings() as $key => $value) {
        $insertSetting->execute(['k' => $key, 'v' => $value]);
    }

    $stats = [
        ['1958', 'Année de fondation'],
        ['21 j', 'Maturation moyenne en cave'],
        ['12', 'Éleveurs partenaires en circuit court'],
        ['100%', 'Découpe artisanale, faite main'],
    ];
    $insertStat = $pdo->prepare('INSERT INTO stats (number, label, position) VALUES (?, ?, ?)');
    foreach ($stats as $i => $s) $insertStat->execute([$s[0], $s[1], $i]);

    $products = [
        ['Pièce signature', 'default', 'Bœuf maturé', 'Races à viande françaises — Salers, Aubrac, Charolaise. Maturation de 21 à 45 jours en cave.', ['Côte de bœuf & Tomahawk', 'Chateaubriand & filet', 'Entrecôte, bavette, onglet']],
        ['', 'default', 'Agneau fermier', 'Agneau de lait et agneau fermier élevé en plein air, à la chair fine et délicate.', ['Gigot & épaule', 'Carré et côtelettes', 'Souris confites']],
        ['', 'default', 'Veau sous la mère', 'Veau fermier élevé sous la mère, pour une viande claire, tendre et savoureuse.', ['Côtes & escalopes', 'Rôti & blanquette', 'Ris de veau (sur commande)']],
        ['', 'default', 'Porc fermier', 'Porc élevé en plein air et nourri sans OGM, pour une chair persillée et goûteuse.', ['Côtes & filet mignon', 'Poitrine & travers', 'Rôti farci maison']],
        ['', 'default', 'Volailles fermières', 'Volailles Label Rouge élevées en plein air 81 jours minimum, chair ferme et parfumée.', ['Chapon & poularde', 'Pintade & canard', 'Volaille farcie sur commande']],
        ['Fait maison', 'alt', "Charcuterie d'atelier", 'Terrines, pâtés et salaisons préparés chaque semaine dans notre atelier, sans additif.', ['Terrines & pâtés en croûte', 'Saucisson sec & jambon sec', 'Rillettes & boudin maison']],
    ];
    $insertProduct = $pdo->prepare('INSERT INTO products (tag, tag_style, title, description, items, image_url, position, published) VALUES (?, ?, ?, ?, ?, "", ?, 1)');
    foreach ($products as $i => $p) {
        $insertProduct->execute([$p[0], $p[1], $p[2], $p[3], json_encode($p[4], JSON_UNESCAPED_UNICODE), $i]);
    }

    $config = app_config();
    $pdo->prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)')
        ->execute([$config['admin_username'], password_hash($config['admin_password'], PASSWORD_DEFAULT)]);
}

// ---------- Settings ----------

function get_all_settings(): array
{
    $rows = db()->query('SELECT key, value FROM settings')->fetchAll(PDO::FETCH_KEY_PAIR);
    return $rows;
}

function set_settings(array $entries): void
{
    $allowed = default_settings();
    $stmt = db()->prepare('INSERT INTO settings (key, value) VALUES (:k, :v)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    foreach ($entries as $key => $value) {
        if (!array_key_exists($key, $allowed)) continue;
        $stmt->execute(['k' => $key, 'v' => (string) $value]);
    }
}

// ---------- Stats ----------

function get_stats(): array
{
    return db()->query('SELECT * FROM stats ORDER BY position ASC, id ASC')->fetchAll(PDO::FETCH_ASSOC);
}

function set_stats(array $stats): void
{
    $pdo = db();
    $pdo->exec('DELETE FROM stats');
    $stmt = $pdo->prepare('INSERT INTO stats (number, label, position) VALUES (?, ?, ?)');
    foreach (array_values($stats) as $i => $s) {
        $stmt->execute([(string) ($s['number'] ?? ''), (string) ($s['label'] ?? ''), $i]);
    }
}

// ---------- Products ----------

function parse_product(array $row): array
{
    $row['items'] = json_decode($row['items'], true) ?: [];
    $row['published'] = (int) $row['published'];
    return $row;
}

function get_all_products(): array
{
    $rows = db()->query('SELECT * FROM products ORDER BY position ASC, id ASC')->fetchAll(PDO::FETCH_ASSOC);
    return array_map('parse_product', $rows);
}

function get_published_products(): array
{
    $rows = db()->query('SELECT * FROM products WHERE published = 1 ORDER BY position ASC, id ASC')->fetchAll(PDO::FETCH_ASSOC);
    return array_map('parse_product', $rows);
}

function create_product(array $data): int
{
    $pdo = db();
    $maxPos = (int) $pdo->query('SELECT COALESCE(MAX(position), -1) FROM products')->fetchColumn();
    $stmt = $pdo->prepare('INSERT INTO products (tag, tag_style, title, description, items, image_url, position, published)
        VALUES (:tag, :tag_style, :title, :description, :items, :image_url, :position, :published)');
    $stmt->execute([
        'tag' => $data['tag'] ?? '',
        'tag_style' => $data['tag_style'] ?? 'default',
        'title' => $data['title'] ?? '',
        'description' => $data['description'] ?? '',
        'items' => json_encode($data['items'] ?? [], JSON_UNESCAPED_UNICODE),
        'image_url' => $data['image_url'] ?? '',
        'position' => $maxPos + 1,
        'published' => !empty($data['published']) ? 1 : 0,
    ]);
    return (int) $pdo->lastInsertId();
}

function update_product(int $id, array $data): void
{
    $stmt = db()->prepare('UPDATE products SET tag = :tag, tag_style = :tag_style, title = :title,
        description = :description, items = :items, image_url = :image_url, published = :published WHERE id = :id');
    $stmt->execute([
        'tag' => $data['tag'] ?? '',
        'tag_style' => $data['tag_style'] ?? 'default',
        'title' => $data['title'] ?? '',
        'description' => $data['description'] ?? '',
        'items' => json_encode($data['items'] ?? [], JSON_UNESCAPED_UNICODE),
        'image_url' => $data['image_url'] ?? '',
        'published' => !empty($data['published']) ? 1 : 0,
        'id' => $id,
    ]);
}

function delete_product(int $id): void
{
    db()->prepare('DELETE FROM products WHERE id = ?')->execute([$id]);
}

function reorder_products(array $ids): void
{
    $stmt = db()->prepare('UPDATE products SET position = ? WHERE id = ?');
    foreach (array_values($ids) as $i => $id) $stmt->execute([$i, (int) $id]);
}

// ---------- Admin / auth ----------

function find_admin_by_username(string $username): ?array
{
    $stmt = db()->prepare('SELECT * FROM admin_users WHERE username = ?');
    $stmt->execute([$username]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function update_admin_password(int $id, string $passwordHash): void
{
    db()->prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?')->execute([$passwordHash, $id]);
}

function is_logged_in(): bool
{
    return !empty($_SESSION['admin_id']);
}

function require_admin_page(): void
{
    if (!is_logged_in()) {
        header('Location: admin.php');
        exit;
    }
}

function require_admin_api(): void
{
    if (!is_logged_in()) {
        json_response(['error' => 'Non authentifié.'], 401);
    }
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(24));
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf(): void
{
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['_csrf'] ?? '');
    if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], (string) $sent)) {
        json_response(['error' => 'Jeton de sécurité invalide, recharge la page.'], 403);
    }
}

// ---------- Helpers HTTP / texte ----------

function json_response($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function e(?string $str): string
{
    return htmlspecialchars((string) $str, ENT_QUOTES, 'UTF-8');
}

function nl2br_e(?string $str): string
{
    return nl2br(e($str));
}
