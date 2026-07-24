<?php
require_once __DIR__ . '/config.php';
$user = nc_require_login();
$pdo = nc_db();
$userId = (int)$user['id'];

$weekStart = nc_week_start($_POST['week'] ?? null);
$profile = nc_get_profile($pdo, $userId);
$summary = nc_build_profile_summary($profile);
$dailyCalories = $summary['calories'] ?? 2000;

$mealShare = ['petit-dej' => 0.25, 'dejeuner' => 0.35, 'diner' => 0.30, 'collation' => 0.10];

$allergyWords = array_filter(array_map('trim', explode(',', mb_strtolower($profile['allergies'] ?? ''))));
$dietWords = array_filter(array_map('trim', explode(',', mb_strtolower($profile['diet_pref'] ?? ''))));

$stmt = $pdo->prepare('SELECT * FROM recipes WHERE user_id = ? OR is_public = 1');
$stmt->execute([$userId]);
$allRecipes = $stmt->fetchAll();

function nc_recipe_matches_diet(array $recipe, array $dietWords): bool
{
    if (!$dietWords) return true;
    $haystack = mb_strtolower($recipe['tags']);
    foreach ($dietWords as $w) {
        if ($w !== '' && str_contains($haystack, $w)) return true;
    }
    return false;
}

function nc_recipe_has_allergen(array $recipe, array $allergyWords): bool
{
    $haystack = mb_strtolower($recipe['ingredients'] . ' ' . $recipe['title']);
    foreach ($allergyWords as $w) {
        if ($w !== '' && str_contains($haystack, $w)) return true;
    }
    return false;
}

$byCategory = [];
foreach ($allRecipes as $r) {
    if (nc_recipe_has_allergen($r, $allergyWords)) continue;
    $byCategory[$r['category']][] = $r;
}

$upsert = $pdo->prepare(
    'INSERT INTO menu_plan (user_id, week_start, day_of_week, meal_slot, recipe_id, custom_text)
     VALUES (?,?,?,?,?, \'\')
     ON CONFLICT(user_id, week_start, day_of_week, meal_slot)
     DO UPDATE SET recipe_id = excluded.recipe_id, custom_text = \'\''
);

$missingSlots = [];
foreach (range(0, 6) as $day) {
    foreach (array_keys(NC_MEAL_SLOTS) as $slot) {
        $candidates = $byCategory[$slot] ?? [];
        if (!$candidates) {
            $missingSlots[$slot] = true;
            continue;
        }
        $dietMatches = array_values(array_filter($candidates, fn($r) => nc_recipe_matches_diet($r, $dietWords)));
        $pool = $dietMatches ?: $candidates;

        $target = $dailyCalories * ($mealShare[$slot] ?? 0.25);
        usort($pool, fn($a, $b) => abs($a['kcal'] - $target) <=> abs($b['kcal'] - $target));
        $shortlist = array_slice($pool, 0, max(3, (int)(count($pool) / 2)));
        $chosen = $shortlist[array_rand($shortlist)];

        $upsert->execute([$userId, $weekStart, $day, $slot, $chosen['id']]);
    }
}

if (!$missingSlots) {
    if (nc_award_badge($pdo, $userId, 'week_planned')) {
        nc_add_points($pdo, $userId, 20);
    }
}

if ($missingSlots) {
    nc_flash_set(
        'Menu généré ! Ajoute des recettes pour ces catégories pour un menu encore plus varié : '
        . implode(', ', array_map(fn($s) => NC_MEAL_SLOTS[$s], array_keys($missingSlots))),
        'error'
    );
} else {
    nc_flash_set('Menu de la semaine généré automatiquement selon ton profil ! ✨');
}

header('Location: menu.php?week=' . $weekStart);
exit;
