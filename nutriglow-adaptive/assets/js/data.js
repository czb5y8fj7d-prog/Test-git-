// NutriGlow Adaptive — données de référence (issues du classeur Excel d'origine)

const NG_MEAL_TYPES = ["Petit-déjeuner", "Déjeuner", "Dîner", "Collation"];
const NG_DIETS = ["Omnivore", "Végétarien", "Végan"];
const NG_CRAVINGS = ["Léger", "Protéiné", "Réconfortant", "Sucré"];
const NG_DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const NG_GOALS = ["Énergie & vitalité", "Confiance en soi", "Habitudes plus stables", "Perte de poids en douceur"];
const NG_ACTIVITY = ["Sédentaire", "Modéré", "Actif"];
const NG_FOLLOWED = ["Oui", "Partiellement", "Non"];

const NG_SEED_RECIPES = [
  { id: 1, name: "Porridge banane-cannelle", type: "Petit-déjeuner", time: 8, quick: true, diet: "Végan", craving: "Sucré", ingredients: "Flocons d'avoine, lait végétal, banane, cannelle", protein: 10, tip: "Préparez-le la veille au frigo, façon overnight oats." },
  { id: 2, name: "Omelette aux légumes", type: "Petit-déjeuner", time: 12, quick: true, diet: "Végétarien", craving: "Protéiné", ingredients: "Œufs, poivron, épinards, fromage râpé", protein: 20, tip: "Ajoutez les légumes déjà cuits pour aller plus vite." },
  { id: 3, name: "Bol yaourt grec, fruits, granola", type: "Petit-déjeuner", time: 5, quick: true, diet: "Végétarien", craving: "Léger", ingredients: "Yaourt grec, fruits de saison, granola, miel", protein: 15, tip: "Idéal si vous manquez de temps le matin." },
  { id: 4, name: "Tartines avocat-œuf poché", type: "Petit-déjeuner", time: 15, quick: false, diet: "Végétarien", craving: "Protéiné", ingredients: "Pain complet, avocat, œuf, citron", protein: 14, tip: "Écrasez l'avocat avec du citron pour éviter qu'il noircisse." },
  { id: 5, name: "Salade de quinoa, poulet, légumes", type: "Déjeuner", time: 20, quick: false, diet: "Omnivore", craving: "Protéiné", ingredients: "Quinoa, poulet, concombre, tomates, feta", protein: 35, tip: "Se prépare très bien à l'avance pour le lendemain." },
  { id: 6, name: "Wrap au houmous et falafels", type: "Déjeuner", time: 15, quick: true, diet: "Végan", craving: "Léger", ingredients: "Tortilla, houmous, falafels, crudités", protein: 14, tip: "Bon aussi froid, parfait pour un lunch box." },
  { id: 7, name: "Poke bowl saumon", type: "Déjeuner", time: 18, quick: false, diet: "Omnivore", craving: "Protéiné", ingredients: "Riz, saumon, avocat, edamame, sauce soja", protein: 30, tip: "Remplacez le saumon par du tofu fumé en version végé." },
  { id: 8, name: "Soupe de lentilles corail", type: "Déjeuner", time: 25, quick: false, diet: "Végan", craving: "Réconfortant", ingredients: "Lentilles corail, carotte, oignon, lait de coco", protein: 18, tip: "Se congèle très bien en portions individuelles." },
  { id: 9, name: "Pâtes complètes, brocolis, parmesan", type: "Déjeuner", time: 15, quick: true, diet: "Végétarien", craving: "Réconfortant", ingredients: "Pâtes complètes, brocolis, ail, parmesan", protein: 16, tip: "Cuisson des pâtes et brocolis en même temps, une casserole." },
  { id: 10, name: "Curry de pois chiches", type: "Dîner", time: 25, quick: false, diet: "Végan", craving: "Réconfortant", ingredients: "Pois chiches, lait de coco, épices, riz", protein: 15, tip: "Encore meilleur réchauffé le lendemain." },
  { id: 11, name: "Saumon rôti, légumes verts", type: "Dîner", time: 22, quick: false, diet: "Omnivore", craving: "Protéiné", ingredients: "Saumon, brocolis, courgettes, citron", protein: 32, tip: "Une seule plaque de cuisson, peu de vaisselle." },
  { id: 12, name: "Soupe miso, tofu, légumes", type: "Dîner", time: 15, quick: true, diet: "Végan", craving: "Léger", ingredients: "Bouillon miso, tofu, algues, champignons", protein: 12, tip: "Parfait les soirs où vous voulez manger léger." },
  { id: 13, name: "Chili sin carne", type: "Dîner", time: 30, quick: false, diet: "Végan", craving: "Réconfortant", ingredients: "Haricots rouges, tomates, maïs, épices", protein: 20, tip: "Préparez une grande quantité, ça se congèle bien." },
  { id: 14, name: "Poulet rôti, patates douces", type: "Dîner", time: 35, quick: false, diet: "Omnivore", craving: "Réconfortant", ingredients: "Poulet, patates douces, romarin, huile d'olive", protein: 38, tip: "Idéal pour un repas du dimanche, restes pour la semaine." },
  { id: 15, name: "Salade caprese", type: "Dîner", time: 10, quick: true, diet: "Végétarien", craving: "Léger", ingredients: "Tomates, mozzarella, basilic, huile d'olive", protein: 16, tip: "Un dîner d'été sans cuisson." },
  { id: 16, name: "Houmous et bâtonnets de légumes", type: "Collation", time: 5, quick: true, diet: "Végan", craving: "Léger", ingredients: "Houmous, carotte, concombre, céleri", protein: 6, tip: "À préparer en portions dès le début de semaine." },
  { id: 17, name: "Poignée d'amandes et fruit", type: "Collation", time: 2, quick: true, diet: "Végan", craving: "Léger", ingredients: "Amandes, pomme ou banane", protein: 6, tip: "Le réflexe simple quand vous manquez de temps." },
  { id: 18, name: "Yaourt grec, miel, noix", type: "Collation", time: 3, quick: true, diet: "Végétarien", craving: "Sucré", ingredients: "Yaourt grec, miel, noix concassées", protein: 12, tip: "Bon équilibre entre plaisir et satiété." },
  { id: 19, name: "Toast au beurre de cacahuète", type: "Collation", time: 4, quick: true, diet: "Végétarien", craving: "Sucré", ingredients: "Pain complet, beurre de cacahuète, banane", protein: 10, tip: "Une collation qui cale bien avant le sport." },
  { id: 20, name: "Chocolat noir et fruits secs", type: "Collation", time: 1, quick: true, diet: "Végan", craving: "Sucré", ingredients: "Carré de chocolat noir, abricots secs", protein: 3, tip: "Pour l'envie sucrée du goûter, sans culpabiliser." },
  { id: 21, name: "Pancakes flocons d'avoine, myrtilles", type: "Petit-déjeuner", time: 15, quick: false, diet: "Végétarien", craving: "Sucré", ingredients: "Flocons d'avoine, œuf, lait, myrtilles", protein: 16, tip: "Préparez la pâte la veille pour gagner du temps le matin." },
  { id: 22, name: "Buddha bowl falafels, houmous", type: "Déjeuner", time: 20, quick: false, diet: "Végan", craving: "Léger", ingredients: "Riz complet, falafels, houmous, crudités variées", protein: 16, tip: "Composez-le avec les restes de légumes de la semaine." },
  { id: 23, name: "Dahl de lentilles, riz basmati", type: "Dîner", time: 28, quick: false, diet: "Végan", craving: "Réconfortant", ingredients: "Lentilles corail, tomates, épices, riz basmati", protein: 17, tip: "Un classique réconfortant, très bon réchauffé." },
  { id: 24, name: "Bowl cottage cheese, fruits rouges", type: "Collation", time: 3, quick: true, diet: "Végétarien", craving: "Protéiné", ingredients: "Cottage cheese, fruits rouges, un filet de miel", protein: 18, tip: "Bonne option protéinée pour l'après-sport." },
  { id: 25, name: "Tofu grillé, riz, brocolis", type: "Dîner", time: 20, quick: true, diet: "Végan", craving: "Protéiné", ingredients: "Tofu, riz, brocolis, sauce soja, gingembre", protein: 22, tip: "Pressez bien le tofu avant cuisson pour qu'il dore mieux." }
];

// Planning de démonstration (comme dans le classeur d'origine)
const NG_SEED_PLANNING = {
  Lundi: { "Petit-déjeuner": "Porridge banane-cannelle", "Déjeuner": "Salade de quinoa, poulet, légumes", "Dîner": "Curry de pois chiches", "Collation": "Poignée d'amandes et fruit" },
  Mardi: { "Petit-déjeuner": "Omelette aux légumes", "Déjeuner": "Wrap au houmous et falafels", "Dîner": "Saumon rôti, légumes verts", "Collation": "Yaourt grec, miel, noix" }
};
