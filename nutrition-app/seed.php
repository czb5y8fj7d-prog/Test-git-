<?php
// Bibliothèque de recettes publiques pré-chargées, disponible pour tous les utilisateurs.

function nc_seed_public_recipes(PDO $pdo): void
{
    $recipes = [
        ['Porridge avoine banane', 'petit-dej', 'végétarien,rapide', 1, 8, 340, 12, 55, 8,
            "40g flocons d'avoine\n200ml lait demi-écrémé (ou végétal)\n1 banane\n1 c.à.c miel\n1 pincée de cannelle",
            "Faire chauffer le lait, ajouter les flocons d'avoine et cuire 5 min à feu doux en remuant.\nVerser dans un bol, ajouter la banane coupée, le miel et la cannelle."],
        ['Œufs brouillés & avocat', 'petit-dej', 'protéiné,sans gluten', 1, 10, 380, 22, 12, 26,
            "2 œufs\n1/2 avocat\n1 tranche de pain complet\nSel, poivre, ciboulette",
            "Brouiller les œufs à feu doux avec sel et poivre.\nÉcraser l'avocat sur le pain grillé, ajouter les œufs et la ciboulette."],
        ['Bowl yaourt grec & fruits rouges', 'petit-dej', 'rapide,sans cuisson', 1, 5, 290, 20, 30, 8,
            "200g yaourt grec nature\n100g fruits rouges (frais ou surgelés)\n20g granola\n1 c.à.c graines de chia",
            "Mélanger le yaourt avec les graines de chia.\nAjouter les fruits rouges et le granola sur le dessus."],
        ['Pain complet, fromage blanc & miel', 'petit-dej', 'rapide', 1, 5, 310, 16, 42, 7,
            "2 tranches de pain complet\n100g fromage blanc 0-20%\n1 c.à.c miel\nQuelques amandes",
            "Tartiner le fromage blanc sur le pain, arroser de miel, parsemer d'amandes concassées."],
        ['Smoothie vert énergisant', 'petit-dej', 'végétalien,sans cuisson', 1, 5, 250, 8, 42, 5,
            "1 banane\n1 poignée d'épinards\n200ml lait d'amande\n1 c.à.s flocons d'avoine\nGlaçons",
            "Mixer tous les ingrédients jusqu'à obtenir une texture lisse."],
        ['Poulet grillé, riz complet & brocolis', 'dejeuner', 'protéiné,sans gluten', 1, 25, 520, 42, 55, 12,
            "150g blanc de poulet\n80g riz complet (poids cru)\n150g brocolis\n1 c.à.s huile d'olive\nAil, épices",
            "Cuire le riz complet dans l'eau bouillante salée.\nGriller le poulet mariné aux épices.\nCuire les brocolis à la vapeur, assaisonner le tout avec l'huile d'olive."],
        ['Salade de quinoa, pois chiches & feta', 'dejeuner', 'végétarien,sans gluten', 1, 20, 480, 18, 52, 20,
            "80g quinoa (poids cru)\n100g pois chiches cuits\n50g feta\nTomates cerises, concombre\nCitron, huile d'olive",
            "Cuire le quinoa puis laisser refroidir.\nMélanger avec les pois chiches, les légumes coupés et la feta émiettée.\nAssaisonner de citron et huile d'olive."],
        ['Wrap poulet crudités', 'dejeuner', 'rapide', 1, 15, 430, 30, 40, 15,
            "1 tortilla complète\n100g poulet cuit émincé\nSalade, tomate, carotte râpée\n1 c.à.s sauce yaourt-citron",
            "Garnir la tortilla de crudités et de poulet.\nAjouter la sauce, rouler fermement et couper en deux."],
        ['Pâtes complètes au thon et légumes', 'dejeuner', 'rapide', 1, 20, 500, 32, 60, 12,
            "80g pâtes complètes (poids cru)\n1 boîte de thon au naturel\nCourgette, poivron, oignon\nHuile d'olive, basilic",
            "Cuire les pâtes.\nFaire revenir les légumes, ajouter le thon égoutté.\nMélanger avec les pâtes et le basilic frais."],
        ['Buddha bowl saumon avocat', 'dejeuner', 'sans gluten', 1, 20, 560, 34, 45, 26,
            "120g saumon\n80g riz complet (poids cru)\n1/2 avocat\nÉdamame, carotte, chou rouge\nSauce soja légère",
            "Cuire le riz et le saumon au four 12 min.\nDresser tous les éléments dans un bol, arroser de sauce soja."],
        ['Soupe de légumes maison', 'diner', 'végétalien,léger', 2, 30, 180, 6, 28, 3,
            "2 carottes\n1 poireau\n2 pommes de terre\n1 oignon\nBouillon de légumes",
            "Éplucher et couper les légumes.\nCuire 25 min dans le bouillon puis mixer."],
        ['Filet de poisson blanc, courgettes vapeur', 'diner', 'léger,sans gluten', 1, 20, 320, 32, 15, 12,
            "150g filet de poisson blanc (cabillaud, colin...)\n200g courgettes\n1 c.à.s huile d'olive\nCitron, aneth",
            "Cuire le poisson à la vapeur ou au four 15 min.\nCuire les courgettes à la vapeur, assaisonner avec huile d'olive, citron et aneth."],
        ['Omelette aux champignons et salade verte', 'diner', 'végétarien,rapide,sans gluten', 1, 15, 340, 22, 8, 24,
            "3 œufs\n100g champignons\nSalade verte\n1 c.à.c huile d'olive\nVinaigrette légère",
            "Faire revenir les champignons, ajouter les œufs battus et cuire en omelette.\nServir avec la salade assaisonnée."],
        ['Tofu sauté aux légumes et riz', 'diner', 'végétalien,sans gluten', 1, 20, 420, 22, 48, 14,
            "150g tofu ferme\n150g mélange de légumes (poivron, brocoli, carotte)\n60g riz complet (poids cru)\nSauce soja, gingembre",
            "Cuire le riz.\nFaire sauter le tofu coupé en dés puis les légumes avec gingembre et sauce soja.\nServir sur le riz."],
        ['Salade de lentilles et légumes rôtis', 'diner', 'végétalien,sans gluten', 1, 25, 380, 18, 50, 10,
            "100g lentilles cuites\nCourge, poivron, oignon rouge\n1 c.à.s huile d'olive\nVinaigre balsamique",
            "Rôtir les légumes au four 20 min.\nMélanger avec les lentilles, assaisonner d'huile d'olive et vinaigre balsamique."],
        ['Poêlée de crevettes et légumes croquants', 'diner', 'sans gluten,rapide', 1, 15, 310, 28, 18, 12,
            "150g crevettes décortiquées\nPoivron, pois gourmands, carotte\n1 c.à.s huile de sésame\nGingembre, ail",
            "Faire revenir les légumes à feu vif, ajouter les crevettes en fin de cuisson avec ail et gingembre."],
        ['Yaourt nature et amandes', 'collation', 'rapide,sans cuisson', 1, 2, 150, 9, 8, 9,
            "1 yaourt nature\n10 amandes",
            "Servir le yaourt avec les amandes concassées."],
        ['Pomme et beurre de cacahuète', 'collation', 'sans cuisson', 1, 3, 190, 5, 22, 9,
            "1 pomme\n1 c.à.s beurre de cacahuète",
            "Couper la pomme en tranches et tartiner de beurre de cacahuète."],
        ['Barres énergétiques maison', 'collation', 'végétalien', 6, 15, 140, 4, 18, 6,
            "100g flocons d'avoine\n80g dattes dénoyautées\n40g amandes\n1 c.à.s miel",
            "Mixer les dattes et amandes, ajouter l'avoine et le miel.\nTasser dans un moule, réfrigérer 1h puis découper en barres."],
        ['Œuf dur et bâtonnets de légumes', 'collation', 'sans gluten,rapide', 1, 5, 160, 10, 6, 10,
            "1 œuf\nCarotte, concombre\nSel, poivre",
            "Faire cuire l'œuf dur 9 minutes.\nServir avec les bâtonnets de légumes crus."],
        ['Smoothie protéiné cacao', 'collation', 'rapide,sans cuisson', 1, 5, 220, 18, 22, 5,
            "200ml lait\n1 mesure protéine en poudre (ou 2 c.à.s cacao maigre + banane)\nGlaçons",
            "Mixer tous les ingrédients ensemble jusqu'à texture lisse."],
        ['Fromage blanc, noix et miel', 'collation', 'rapide', 1, 3, 180, 12, 14, 8,
            "150g fromage blanc\n5 cerneaux de noix\n1 c.à.c miel",
            "Mélanger le fromage blanc avec le miel, parsemer de noix concassées."],
        ['Houmous et bâtonnets de légumes', 'collation', 'végétalien,sans gluten', 2, 5, 170, 6, 16, 9,
            "100g houmous\nCarotte, concombre, poivron",
            "Couper les légumes en bâtonnets et servir avec le houmous."],
        ['Chia pudding vanille', 'collation', 'végétalien,sans cuisson', 1, 5, 200, 7, 20, 9,
            "3 c.à.s graines de chia\n200ml lait végétal\n1/2 c.à.c vanille\nFruits au choix",
            "Mélanger le chia avec le lait et la vanille.\nLaisser reposer au frais 3h minimum, ajouter les fruits avant de servir."],
    ];

    $stmt = $pdo->prepare(
        'INSERT INTO recipes (user_id, title, category, tags, servings, prep_minutes, kcal, protein_g, carbs_g, fat_g, ingredients, instructions, is_public)
         VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)'
    );

    foreach ($recipes as $r) {
        $stmt->execute($r);
    }
}

/**
 * Crée un compte de démonstration pré-rempli (profil, historique de poids,
 * recette perso, planning, liste de courses, objectifs) pour donner tout de
 * suite un aperçu concret de l'application.
 */
function nc_seed_demo_account(PDO $pdo): void
{
    $hash = password_hash(NC_DEMO_PASSWORD, PASSWORD_DEFAULT);
    $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
        ->execute(['Démo', NC_DEMO_EMAIL, $hash]);
    $userId = (int)$pdo->lastInsertId();

    $pdo->prepare(
        'INSERT INTO profiles (user_id, sex, age, height_cm, current_weight_kg, start_weight_kg, target_weight_kg, activity_level, goal, diet_pref, allergies)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([$userId, 'F', 34, 165, 68.4, 72.0, 62.0, 'modere', 'perte', '', '']);

    $pdo->prepare('INSERT INTO points (user_id, total_points) VALUES (?, ?)')->execute([$userId, 0]);

    // Historique de poids (tendance à la baisse sur ~5 semaines) pour un graphique parlant
    $weightSteps = [72.0, 71.4, 71.0, 70.3, 69.8, 69.5, 69.0, 68.7, 68.4];
    $today = new DateTime();
    $daysAgo = (count($weightSteps) - 1) * 4;
    $insertWeight = $pdo->prepare('INSERT INTO weight_logs (user_id, log_date, weight_kg) VALUES (?, ?, ?)');
    foreach ($weightSteps as $i => $weight) {
        $date = (clone $today)->modify('-' . ($daysAgo - $i * 4) . ' days')->format('Y-m-d');
        $insertWeight->execute([$userId, $date, $weight]);
    }

    // Une recette personnelle pour montrer la fonctionnalité "mes recettes"
    $pdo->prepare(
        'INSERT INTO recipes (user_id, title, category, tags, servings, prep_minutes, kcal, protein_g, carbs_g, fat_g, ingredients, instructions, is_public)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)'
    )->execute([
        $userId, 'Ma soupe de saison', 'diner', 'maison,léger', 2, 25, 210, 7, 32, 5,
        "2 carottes\n1 courgette\n1 oignon\n1 pomme de terre\nBouillon de légumes\nPersil",
        "Éplucher et couper tous les légumes.\nCuire 25 minutes dans le bouillon puis mixer.\nParsemer de persil frais avant de servir.",
    ]);

    // Planning de la semaine en cours, à partir de la bibliothèque publique
    $stmt = $pdo->query('SELECT id, category FROM recipes WHERE is_public = 1 ORDER BY id');
    $byCategory = [];
    foreach ($stmt->fetchAll() as $r) {
        $byCategory[$r['category']][] = $r['id'];
    }
    $weekStart = nc_week_start();
    $insertPlan = $pdo->prepare(
        'INSERT INTO menu_plan (user_id, week_start, day_of_week, meal_slot, recipe_id) VALUES (?, ?, ?, ?, ?)'
    );
    foreach (array_keys(NC_MEAL_SLOTS) as $slot) {
        $pool = $byCategory[$slot] ?? [];
        if (!$pool) continue;
        foreach (range(0, 6) as $day) {
            $insertPlan->execute([$userId, $weekStart, $day, $slot, $pool[$day % count($pool)]]);
        }
    }

    // Liste de courses générée à partir de ce planning
    $lines = nc_build_ingredient_list($pdo, $userId, $weekStart);
    $counts = [];
    foreach ($lines as $line) {
        $key = mb_strtolower($line);
        $counts[$key] = $counts[$key] ?? ['label' => $line, 'n' => 0];
        $counts[$key]['n']++;
    }
    $insertItem = $pdo->prepare('INSERT INTO shopping_items (user_id, week_start, label, quantity_text, checked, is_manual) VALUES (?,?,?,?,?,0)');
    $i = 0;
    foreach ($counts as $c) {
        $qty = $c['n'] > 1 ? '× ' . $c['n'] : '';
        $insertItem->execute([$userId, $weekStart, $c['label'], $qty, $i < 4 ? 1 : 0]);
        $i++;
    }

    // Objectifs personnels d'exemple
    $pdo->prepare('INSERT INTO user_goals (user_id, label, done) VALUES (?, ?, ?)')->execute([$userId, 'Boire 1,5L d\'eau chaque jour', 1]);
    $pdo->prepare('INSERT INTO user_goals (user_id, label, done) VALUES (?, ?, ?)')->execute([$userId, 'Marcher 30 minutes, 5 fois par semaine', 0]);
    $pdo->prepare('INSERT INTO user_goals (user_id, label, done) VALUES (?, ?, ?)')->execute([$userId, 'Cuisiner 2 nouvelles recettes ce mois-ci', 0]);

    // Petit suivi du jour pour illustrer le tableau de bord
    $pdo->prepare('INSERT INTO daily_checks (user_id, log_date, water_glasses, exercise_done, sleep_hours) VALUES (?,?,?,?,?)')
        ->execute([$userId, date('Y-m-d'), 5, 1, 7.5]);

    // Badges et points de démonstration
    foreach (['first_recipe', 'first_weigh', 'shopping_master'] as $code) {
        nc_award_badge($pdo, $userId, $code);
    }
    nc_add_points($pdo, $userId, 145);
}
