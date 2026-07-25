<?php
require_once __DIR__ . '/db.php';

function nc_e(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

const NC_DEMO_EMAIL = 'demo@nutricoach.app';
const NC_DEMO_PASSWORD = 'demo';

const NC_BADGES = [
    'first_recipe'   => ['icon' => '🍳', 'label' => 'Chef en herbe',        'desc' => 'Première recette ajoutée'],
    'recipes_10'     => ['icon' => '📚', 'label' => 'Livre de recettes',    'desc' => '10 recettes ajoutées'],
    'first_weigh'    => ['icon' => '⚖️', 'label' => 'Premier pas',          'desc' => 'Première pesée enregistrée'],
    'streak_7'       => ['icon' => '🔥', 'label' => 'Série de 7',           'desc' => '7 jours de suivi consécutifs'],
    'week_planned'   => ['icon' => '🗓️', 'label' => 'Semaine parfaite',     'desc' => 'Une semaine de menus planifiée'],
    'shopping_master'=> ['icon' => '🛒', 'label' => 'Prêt à faire les courses', 'desc' => 'Première liste de courses générée'],
    'goal_reached'   => ['icon' => '🏆', 'label' => 'Objectif atteint',     'desc' => "Objectif de poids atteint !"],
];

function nc_add_points(PDO $pdo, int $userId, int $points): void
{
    $pdo->prepare('INSERT INTO points (user_id, total_points) VALUES (?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET total_points = total_points + excluded.total_points')
        ->execute([$userId, $points]);
}

function nc_get_points(PDO $pdo, int $userId): int
{
    $stmt = $pdo->prepare('SELECT total_points FROM points WHERE user_id = ?');
    $stmt->execute([$userId]);
    return (int)($stmt->fetchColumn() ?: 0);
}

function nc_award_badge(PDO $pdo, int $userId, string $code): bool
{
    try {
        $pdo->prepare('INSERT INTO badges (user_id, code) VALUES (?, ?)')->execute([$userId, $code]);
        return true;
    } catch (PDOException $e) {
        return false; // déjà obtenu
    }
}

function nc_user_badges(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare('SELECT code, earned_at FROM badges WHERE user_id = ? ORDER BY earned_at DESC');
    $stmt->execute([$userId]);
    return $stmt->fetchAll();
}

/** Vérifie et attribue les badges éligibles ; retourne les codes nouvellement obtenus. */
function nc_check_badges(PDO $pdo, int $userId): array
{
    $newly = [];

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM recipes WHERE user_id = ?');
    $stmt->execute([$userId]);
    $recipeCount = (int)$stmt->fetchColumn();
    if ($recipeCount >= 1 && nc_award_badge($pdo, $userId, 'first_recipe')) $newly[] = 'first_recipe';
    if ($recipeCount >= 10 && nc_award_badge($pdo, $userId, 'recipes_10')) $newly[] = 'recipes_10';

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM weight_logs WHERE user_id = ?');
    $stmt->execute([$userId]);
    $weighCount = (int)$stmt->fetchColumn();
    if ($weighCount >= 1 && nc_award_badge($pdo, $userId, 'first_weigh')) $newly[] = 'first_weigh';

    // Série de 7 jours consécutifs de pesée
    $stmt = $pdo->prepare('SELECT log_date FROM weight_logs WHERE user_id = ? ORDER BY log_date DESC LIMIT 30');
    $stmt->execute([$userId]);
    $dates = $stmt->fetchAll(PDO::FETCH_COLUMN);
    if (nc_has_streak($dates, 7) && nc_award_badge($pdo, $userId, 'streak_7')) $newly[] = 'streak_7';

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM shopping_items WHERE user_id = ?');
    $stmt->execute([$userId]);
    if ((int)$stmt->fetchColumn() > 0 && nc_award_badge($pdo, $userId, 'shopping_master')) $newly[] = 'shopping_master';

    $profile = nc_get_profile($pdo, $userId);
    if ($profile['target_weight_kg'] && $profile['current_weight_kg']
        && abs((float)$profile['current_weight_kg'] - (float)$profile['target_weight_kg']) < 0.5) {
        if (nc_award_badge($pdo, $userId, 'goal_reached')) $newly[] = 'goal_reached';
    }

    return $newly;
}

function nc_has_streak(array $isoDates, int $length): bool
{
    if (count($isoDates) < $length) {
        return false;
    }
    sort($isoDates);
    $streak = 1;
    for ($i = 1; $i < count($isoDates); $i++) {
        $diff = (strtotime($isoDates[$i]) - strtotime($isoDates[$i - 1])) / 86400;
        $streak = ($diff == 1) ? $streak + 1 : 1;
        if ($streak >= $length) {
            return true;
        }
    }
    return false;
}

function nc_get_profile(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare('SELECT * FROM profiles WHERE user_id = ?');
    $stmt->execute([$userId]);
    $profile = $stmt->fetch();
    if (!$profile) {
        $pdo->prepare('INSERT INTO profiles (user_id) VALUES (?)')->execute([$userId]);
        $stmt->execute([$userId]);
        $profile = $stmt->fetch();
    }
    return $profile;
}

/** Lundi de la semaine ISO courante ou d'une date donnée, format Y-m-d. */
function nc_week_start(?string $date = null): string
{
    $ts = $date ? strtotime($date) : time();
    $dow = (int)date('N', $ts); // 1 (lundi) - 7 (dimanche)
    return date('Y-m-d', strtotime('-' . ($dow - 1) . ' days', $ts));
}

const NC_MEAL_SLOTS = [
    'petit-dej' => 'Petit-déjeuner',
    'dejeuner'  => 'Déjeuner',
    'diner'     => 'Dîner',
    'collation' => 'Collation',
];

const NC_DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/** Construit la liste de courses agrégée à partir des recettes planifiées d'une semaine. */
function nc_build_ingredient_list(PDO $pdo, int $userId, string $weekStart): array
{
    $stmt = $pdo->prepare(
        "SELECT r.ingredients FROM menu_plan mp
         JOIN recipes r ON r.id = mp.recipe_id
         WHERE mp.user_id = ? AND mp.week_start = ? AND mp.recipe_id IS NOT NULL"
    );
    $stmt->execute([$userId, $weekStart]);

    $lines = [];
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $ingredientsBlock) {
        foreach (preg_split('/\r\n|\r|\n/', trim($ingredientsBlock)) as $line) {
            $line = trim($line);
            if ($line !== '') {
                $lines[] = $line;
            }
        }
    }
    return $lines;
}

function nc_flash_set(string $message, string $type = 'success'): void
{
    $_SESSION['flash'] = ['message' => $message, 'type' => $type];
}

function nc_flash_get(): ?array
{
    if (empty($_SESSION['flash'])) {
        return null;
    }
    $flash = $_SESSION['flash'];
    unset($_SESSION['flash']);
    return $flash;
}
