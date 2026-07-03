/* =========================================================
   LUMÉA — Données produits & contenu partagé
   ========================================================= */

const LUMEA_PRODUCTS = [
  {
    id: 1,
    slug: "spiruline-bio-premium",
    name: "Spiruline Bio Premium",
    category: "energie",
    categoryLabel: "Énergie",
    tagline: "Le concentré de vitalité des micro-algues",
    price: 24.9,
    oldPrice: 29.9,
    rating: 4.8,
    reviews: 312,
    badges: ["Bio", "Vegan", "Sans additif"],
    theme: "green",
    format: "180 gélules · 3 mois",
    description:
      "Cultivée en circuit fermé et séchée à basse température pour préserver ses nutriments, notre spiruline est la source naturelle de vitalité la plus dense qui existe. Un allié quotidien pour l'énergie, la concentration et le tonus.",
    benefits: [
      "Soutient l'énergie naturelle et réduit la fatigue",
      "Riche en fer, protéines et antioxydants",
      "Renforce les défenses naturelles",
      "Favorise la clarté mentale"
    ],
    composition: [
      { name: "Spiruline bio (Arthrospira platensis)", value: "1500 mg / jour" },
      { name: "Fer naturel", value: "28 mg / 100g" },
      { name: "Phycocyanine", value: "haute concentration" },
      { name: "Sans excipient ni agent d'écoulement", value: "" }
    ],
    usage: "3 gélules par jour avec un grand verre d'eau, de préférence le matin.",
    quizTags: ["energie", "concentration", "sport"]
  },
  {
    id: 2,
    slug: "complexe-sommeil-zen",
    name: "Sommeil Zen",
    category: "sommeil",
    categoryLabel: "Sommeil",
    tagline: "L'endormissement naturel, sans accoutumance",
    price: 27.9,
    oldPrice: null,
    rating: 4.9,
    reviews: 587,
    badges: ["100% naturel", "Sans mélatonine de synthèse", "Vegan"],
    theme: "indigo",
    format: "60 gélules · 1 mois",
    description:
      "Une synergie douce de plantes reconnues pour leur action apaisante : camomille, passiflore, magnésium marin et griffonia. Pensé pour retrouver un sommeil réparateur, nuit après nuit, sans dépendance.",
    benefits: [
      "Favorise un endormissement naturel",
      "Réduit le temps d'endormissement",
      "Apaise le système nerveux",
      "Sommeil plus profond et réparateur"
    ],
    composition: [
      { name: "Magnésium marin", value: "300 mg" },
      { name: "Passiflore bio", value: "200 mg" },
      { name: "Camomille bio", value: "150 mg" },
      { name: "Griffonia (5-HTP naturel)", value: "100 mg" }
    ],
    usage: "2 gélules, 30 minutes avant le coucher.",
    quizTags: ["sommeil", "stress", "relaxation"]
  },
  {
    id: 3,
    slug: "magnesium-marin-b6",
    name: "Magnésium Marin + B6",
    category: "stress",
    categoryLabel: "Anti-stress",
    tagline: "Le bouclier naturel contre le stress du quotidien",
    price: 21.9,
    oldPrice: 25.9,
    rating: 4.7,
    reviews: 421,
    badges: ["Haute absorption", "Sans additif"],
    theme: "terracotta",
    format: "90 gélules · 1,5 mois",
    description:
      "Extrait de l'eau de mer, notre magnésium marin est associé à la vitamine B6 pour une absorption optimale. Il contribue à réduire la fatigue et à maintenir un fonctionnement psychologique normal.",
    benefits: [
      "Réduit la fatigue physique et mentale",
      "Contribue à l'équilibre nerveux",
      "Favorise la détente musculaire",
      "Absorption optimisée grâce à la B6"
    ],
    composition: [
      { name: "Magnésium marin", value: "400 mg" },
      { name: "Vitamine B6", value: "2 mg" },
      { name: "Taurine naturelle", value: "50 mg" }
    ],
    usage: "3 gélules par jour au cours des repas.",
    quizTags: ["stress", "energie", "relaxation"]
  },
  {
    id: 4,
    slug: "curcuma-poivre-noir",
    name: "Curcuma & Poivre Noir",
    category: "immunite",
    categoryLabel: "Immunité",
    tagline: "L'or d'Asie au service de votre vitalité",
    price: 22.9,
    oldPrice: null,
    rating: 4.6,
    reviews: 268,
    badges: ["Bio", "Curcumine 95%", "Vegan"],
    theme: "gold",
    format: "120 gélules · 2 mois",
    description:
      "Un curcuma bio hautement dosé en curcumine, associé à la pipérine du poivre noir pour multiplier son absorption par 20. Un geste simple pour soutenir vos défenses naturelles et votre confort articulaire.",
    benefits: [
      "Puissant soutien antioxydant",
      "Favorise le confort articulaire",
      "Renforce l'immunité naturelle",
      "Absorption x20 grâce à la pipérine"
    ],
    composition: [
      { name: "Curcuma bio (95% curcumine)", value: "500 mg" },
      { name: "Extrait de poivre noir (pipérine)", value: "5 mg" }
    ],
    usage: "2 gélules par jour pendant les repas.",
    quizTags: ["immunite", "digestion", "sport"]
  },
  {
    id: 5,
    slug: "probiotiques-10-souches",
    name: "Probiotiques 10 Souches",
    category: "digestion",
    categoryLabel: "Digestion",
    tagline: "Le confort digestif retrouvé, naturellement",
    price: 29.9,
    oldPrice: 34.9,
    rating: 4.8,
    reviews: 194,
    badges: ["10 milliards UFC", "Gastro-résistant", "Vegan"],
    theme: "green",
    format: "30 gélules · 1 mois",
    description:
      "Un complexe de 10 souches de probiotiques sélectionnées, encapsulées dans une gélule gastro-résistante qui protège les ferments de l'acidité de l'estomac pour une efficacité maximale au niveau intestinal.",
    benefits: [
      "Rééquilibre la flore intestinale",
      "Améliore le confort digestif",
      "Soutient l'immunité intestinale",
      "10 milliards d'UFC garantis jusqu'à péremption"
    ],
    composition: [
      { name: "Complexe 10 souches probiotiques", value: "10 Mds UFC" },
      { name: "Inuline (fibre prébiotique)", value: "100 mg" }
    ],
    usage: "1 gélule par jour, à jeun le matin.",
    quizTags: ["digestion", "immunite"]
  },
  {
    id: 6,
    slug: "collagene-marin-vitamine-c",
    name: "Collagène Marin + Vit. C",
    category: "beaute",
    categoryLabel: "Beauté",
    tagline: "La beauté qui vient de l'intérieur",
    price: 32.9,
    oldPrice: null,
    rating: 4.9,
    reviews: 456,
    badges: ["Peptides marins", "Peau, cheveux, ongles", "Sans arôme artificiel"],
    theme: "terracotta",
    format: "300g · 1 mois",
    description:
      "Un collagène marin hydrolysé à faible poids moléculaire pour une absorption optimale, enrichi en vitamine C naturelle d'acérola pour stimuler la production de collagène endogène. Peau repulpée, cheveux fortifiés.",
    benefits: [
      "Réduit l'apparence des rides",
      "Renforce cheveux et ongles",
      "Stimule le collagène naturel",
      "Peptides marins bio-disponibles"
    ],
    composition: [
      { name: "Collagène marin hydrolysé", value: "10 g" },
      { name: "Vitamine C (acérola)", value: "80 mg" }
    ],
    usage: "1 dosette par jour dans un liquide froid ou tiède.",
    quizTags: ["beaute", "energie"]
  }
];

const LUMEA_TESTIMONIALS = [
  {
    name: "Camille R.",
    role: "Cliente depuis 2 ans",
    text: "Après des années de fatigue chronique, la spiruline LUMÉA a changé mon quotidien. Je sens vraiment la différence dès la deuxième semaine.",
    rating: 5,
    product: "Spiruline Bio Premium"
  },
  {
    name: "Thomas L.",
    role: "Client vérifié",
    text: "Le complexe sommeil est bluffant : je m'endors en 10 minutes sans effet groggy le matin. Enfin un produit naturel qui tient ses promesses.",
    rating: 5,
    product: "Sommeil Zen"
  },
  {
    name: "Élodie M.",
    role: "Cliente depuis 1 an",
    text: "La transparence sur les ingrédients et l'origine m'a convaincue. Le magnésium marin m'aide énormément à gérer le stress au travail.",
    rating: 5,
    product: "Magnésium Marin + B6"
  },
  {
    name: "Julien P.",
    role: "Client vérifié",
    text: "Livraison rapide, packaging soigné et surtout des résultats concrets sur ma digestion depuis que je prends les probiotiques.",
    rating: 4,
    product: "Probiotiques 10 Souches"
  },
  {
    name: "Sarah K.",
    role: "Cliente depuis 3 ans",
    text: "Ma peau n'a jamais été aussi belle depuis que j'ai intégré le collagène marin à ma routine. Un vrai coup de cœur.",
    rating: 5,
    product: "Collagène Marin + Vit. C"
  }
];

const LUMEA_QUIZ = [
  {
    id: "goal",
    question: "Quel est votre objectif principal aujourd'hui ?",
    subtitle: "Choisissez ce qui vous parle le plus, on affinera ensuite.",
    options: [
      { label: "Retrouver de l'énergie", value: "energie", icon: "zap" },
      { label: "Mieux dormir", value: "sommeil", icon: "moon" },
      { label: "Gérer mon stress", value: "stress", icon: "leaf" },
      { label: "Améliorer ma digestion", value: "digestion", icon: "sprout" },
      { label: "Renforcer mon immunité", value: "immunite", icon: "shield" },
      { label: "Sublimer ma beauté", value: "beaute", icon: "sparkle" }
    ],
    multi: false
  },
  {
    id: "lifestyle",
    question: "Comment décririez-vous votre rythme de vie ?",
    subtitle: "Cela nous aide à ajuster nos recommandations.",
    options: [
      { label: "Très actif, sport régulier", value: "sport", icon: "zap" },
      { label: "Rythme intense, peu de temps pour moi", value: "stress", icon: "leaf" },
      { label: "Besoin de me recentrer", value: "relaxation", icon: "moon" },
      { label: "Assez équilibré", value: "energie", icon: "sun" }
    ],
    multi: false
  },
  {
    id: "focus",
    question: "Y a-t-il un point sur lequel vous aimeriez aussi progresser ?",
    subtitle: "Sélectionnez une ou plusieurs réponses (facultatif).",
    options: [
      { label: "Concentration", value: "concentration", icon: "target" },
      { label: "Immunité", value: "immunite", icon: "shield" },
      { label: "Digestion", value: "digestion", icon: "sprout" },
      { label: "Beauté de la peau", value: "beaute", icon: "sparkle" }
    ],
    multi: true
  },
  {
    id: "naturalness",
    question: "Qu'est-ce qui compte le plus pour vous dans un complément ?",
    subtitle: "Dernière question, promis !",
    options: [
      { label: "100% naturel, sans compromis", value: "energie", icon: "leaf" },
      { label: "Efficacité rapide et concrète", value: "stress", icon: "zap" },
      { label: "Origine et traçabilité", value: "immunite", icon: "shield" },
      { label: "Praticité au quotidien", value: "digestion", icon: "sprout" }
    ],
    multi: false
  }
];

function lumeaFormatPrice(value) {
  return value.toFixed(2).replace(".", ",") + " €";
}

function lumeaGetProductBySlug(slug) {
  return LUMEA_PRODUCTS.find((p) => p.slug === slug);
}

function lumeaGetProductById(id) {
  return LUMEA_PRODUCTS.find((p) => p.id === Number(id));
}
