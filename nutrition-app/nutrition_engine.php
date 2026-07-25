<?php
// Moteur "expert nutrition" : calculs caloriques, macros, et conseils personnalisés (règles, 100% local)

const NC_ACTIVITY_FACTORS = [
    'sedentaire' => 1.2,
    'leger'      => 1.375,
    'modere'     => 1.55,
    'actif'      => 1.725,
    'tres_actif' => 1.9,
];

const NC_ACTIVITY_LABELS = [
    'sedentaire' => 'Sédentaire (peu ou pas de sport)',
    'leger'      => 'Légèrement actif (1-3 j/semaine)',
    'modere'     => 'Modérément actif (3-5 j/semaine)',
    'actif'      => 'Actif (6-7 j/semaine)',
    'tres_actif' => 'Très actif (sport intense / physique)',
];

const NC_GOAL_LABELS = [
    'perte'     => 'Perte de poids',
    'maintien'  => 'Maintien du poids',
    'prise'     => 'Prise de masse',
];

function nc_calc_bmr(string $sex, float $weightKg, float $heightCm, int $age): float
{
    $base = 10 * $weightKg + 6.25 * $heightCm - 5 * $age;
    return $sex === 'H' ? $base + 5 : $base - 161;
}

function nc_calc_tdee(float $bmr, string $activityLevel): float
{
    $factor = NC_ACTIVITY_FACTORS[$activityLevel] ?? 1.375;
    return $bmr * $factor;
}

function nc_calc_calorie_target(float $tdee, string $goal, string $sex): int
{
    $floor = $sex === 'H' ? 1500 : 1200;
    switch ($goal) {
        case 'perte':
            $target = $tdee - 500;
            break;
        case 'prise':
            $target = $tdee + 350;
            break;
        default:
            $target = $tdee;
    }
    return (int)round(max($target, $floor));
}

function nc_calc_macros(int $calories, string $goal): array
{
    switch ($goal) {
        case 'perte':
            $split = ['protein' => 0.35, 'carbs' => 0.35, 'fat' => 0.30];
            break;
        case 'prise':
            $split = ['protein' => 0.25, 'carbs' => 0.45, 'fat' => 0.30];
            break;
        default:
            $split = ['protein' => 0.30, 'carbs' => 0.40, 'fat' => 0.30];
    }
    return [
        'protein_g' => round(($calories * $split['protein']) / 4),
        'carbs_g'   => round(($calories * $split['carbs']) / 4),
        'fat_g'     => round(($calories * $split['fat']) / 9),
    ];
}

function nc_estimate_weeks(float $current, float $target, string $goal): ?int
{
    $diff = abs($current - $target);
    if ($diff < 0.2) {
        return 0;
    }
    $weeklyRate = $goal === 'prise' ? 0.3 : 0.5; // kg/semaine, rythme raisonnable
    return (int)ceil($diff / $weeklyRate);
}

/**
 * Calcule le profil nutritionnel complet à partir d'une ligne "profiles".
 */
function nc_build_profile_summary(array $profile): ?array
{
    if (!$profile['age'] || !$profile['height_cm'] || !$profile['current_weight_kg']) {
        return null;
    }
    $bmr = nc_calc_bmr($profile['sex'], (float)$profile['current_weight_kg'], (float)$profile['height_cm'], (int)$profile['age']);
    $tdee = nc_calc_tdee($bmr, $profile['activity_level']);
    $calories = nc_calc_calorie_target($tdee, $profile['goal'], $profile['sex']);
    $macros = nc_calc_macros($calories, $profile['goal']);
    $weeks = null;
    if ($profile['target_weight_kg']) {
        $weeks = nc_estimate_weeks((float)$profile['current_weight_kg'], (float)$profile['target_weight_kg'], $profile['goal']);
    }
    return [
        'bmr' => round($bmr),
        'tdee' => round($tdee),
        'calories' => $calories,
        'macros' => $macros,
        'weeks_to_goal' => $weeks,
    ];
}

/**
 * Conseil du "coach" du jour : règles simples basées sur objectif + progression récente.
 */
function nc_coach_tip(array $profile, array $recentWeights): string
{
    $tipsGeneral = [
        "Bois un grand verre d'eau avant chaque repas : ça aide à mieux réguler l'appétit.",
        "Privilégie les féculents complets (riz, pâtes, pain complet) pour une satiété plus longue.",
        "Mâche lentement : le cerveau met ~20 minutes à ressentir la satiété.",
        "Ajoute des légumes à chaque repas pour le volume, les fibres et les micronutriments.",
        "Prépare tes repas à l'avance : c'est le meilleur allié contre les écarts impulsifs.",
        "Le sommeil influence directement la faim : vise 7-8h par nuit.",
        "Une marche de 20 minutes après le repas aide la digestion et la glycémie.",
        "Les protéines à chaque repas limitent la fonte musculaire pendant la perte de poids.",
        "Autorise-toi un écart de temps en temps : la régularité compte plus que la perfection.",
        "Pèse-toi toujours dans les mêmes conditions (matin, à jeun) pour un suivi fiable.",
    ];

    $goal = $profile['goal'] ?? 'perte';
    $dayIndex = (int)date('z');
    $tip = $tipsGeneral[$dayIndex % count($tipsGeneral)];

    if (count($recentWeights) >= 3) {
        $values = array_column($recentWeights, 'weight_kg');
        $delta = end($values) - $values[0];
        if ($goal === 'perte' && $delta >= -0.1 && $delta <= 0.1) {
            $tip = "On dirait un petit plateau ! Essaie de varier ton activité physique ou de revoir tes portions de féculents pendant quelques jours.";
        } elseif ($goal === 'perte' && $delta < -1.5) {
            $tip = "Belle dynamique de perte ! Reste vigilant(e) à ne pas descendre trop vite : vise -0.5 à -1kg/semaine pour préserver ta masse musculaire.";
        } elseif ($goal === 'perte' && $delta < 0) {
            $tip = "Bonne progression, continue ainsi ! Un déficit calorique modéré et régulier est la clé d'une perte durable.";
        }
    }

    return $tip;
}

/** Défi ludique de la semaine, basé sur le numéro de semaine ISO. */
function nc_weekly_challenge(): array
{
    $challenges = [
        ['code' => 'water_week', 'label' => "💧 Bois au moins 1,5L d'eau chaque jour cette semaine", 'points' => 30],
        ['code' => 'new_recipes', 'label' => "🍳 Ajoute 2 nouvelles recettes à ton livre de recettes", 'points' => 20],
        ['code' => 'walk_week', 'label' => "🚶 Fais au moins 5 séances d'activité physique cette semaine", 'points' => 30],
        ['code' => 'full_plan', 'label' => "🗓️ Planifie tous tes repas de la semaine à l'avance", 'points' => 25],
        ['code' => 'no_sugar', 'label' => "🍬 Réduis les sucres ajoutés / sodas cette semaine", 'points' => 25],
        ['code' => 'veggie_week', 'label' => "🥦 Ajoute des légumes à chaque déjeuner et dîner", 'points' => 20],
        ['code' => 'sleep_week', 'label' => "😴 Vise 7h de sommeil minimum chaque nuit", 'points' => 20],
    ];
    $week = (int)date('W');
    return $challenges[$week % count($challenges)];
}
