/* =========================================================
   LUMÉA — Bilan Bien-être Complet : données & logique de score
   ========================================================= */

// 8 dimensions du bilan. Certaines sont reliées à un produit LUMÉA
// (via son slug dans LUMEA_PRODUCTS) pour la recommandation finale.
const BILAN_DIMENSIONS = {
  energie: {
    label: "Énergie & Vitalité",
    icon: "zap",
    emoji: "⚡",
    productSlug: "spiruline-bio-premium",
    lowTip: "Priorise un vrai petit-déjeuner protéiné et une micro-pause de 5 minutes en début d'après-midi, avant le coup de barre plutôt qu'après.",
    highTip: "Ton énergie est un vrai moteur : continue à protéger tes nuits et tes pauses, c'est ce qui l'entretient."
  },
  sommeil: {
    label: "Sommeil & Récupération",
    icon: "moon",
    emoji: "🌙",
    productSlug: "complexe-sommeil-zen",
    lowTip: "Teste un vrai couvre-feu écran 30 minutes avant le coucher : c'est souvent le levier n°1 pour un endormissement plus rapide.",
    highTip: "Ton sommeil te porte bien : garde ce rituel régulier, c'est la base de tout le reste."
  },
  stress: {
    label: "Stress & Équilibre mental",
    icon: "leaf",
    emoji: "🧘",
    productSlug: "magnesium-marin-b6",
    lowTip: "Trois respirations profondes avant de réagir à une contrariété peuvent suffire à casser la spirale. Essaie, même si ça semble trop simple.",
    highTip: "Ton calme intérieur est une vraie force : continue à te réserver ce temps rien qu'à toi."
  },
  immunite: {
    label: "Immunité",
    icon: "shield",
    emoji: "🛡️",
    productSlug: "curcuma-poivre-noir",
    lowTip: "Le sommeil et la gestion du stress sont les deux plus gros leviers de tes défenses naturelles : regarde d'abord de ce côté.",
    highTip: "Ton corps encaisse bien les coups : de belles habitudes à préserver sur la durée."
  },
  digestion: {
    label: "Digestion & Confort intestinal",
    icon: "sprout",
    emoji: "🌱",
    productSlug: "probiotiques-10-souches",
    lowTip: "Manger plus lentement et mastiquer davantage peut, à lui seul, réduire une bonne partie de l'inconfort après les repas.",
    highTip: "Ton confort digestif est solide : une belle base pour bien assimiler le reste."
  },
  beaute: {
    label: "Beauté & Éclat",
    icon: "sparkle",
    emoji: "✨",
    productSlug: "collagene-marin-vitamine-c",
    lowTip: "La peau et les cheveux sont souvent les premiers à refléter le manque de sommeil et d'hydratation : ce sont tes deux meilleurs alliés beauté gratuits.",
    highTip: "Ça se voit : ton hygiène de vie nourrit aussi ton éclat naturel."
  },
  hydratation: {
    label: "Hydratation",
    icon: "sun",
    emoji: "💧",
    productSlug: null,
    lowTip: "Garde une bouteille d'eau toujours en vue (bureau, sac, table de chevet) : on boit presque toujours plus quand l'eau est sous les yeux.",
    highTip: "Le réflexe est là : ton corps te remercie à chaque verre."
  },
  activite: {
    label: "Mouvement & Activité",
    icon: "target",
    emoji: "🏃",
    productSlug: null,
    lowTip: "Pas besoin de salle de sport : 10 minutes de marche rapide par jour suffisent déjà à changer la donne sur l'énergie et l'humeur.",
    highTip: "Le mouvement fait clairement partie de ta routine : c'est un des piliers les plus puissants du bien-être global."
  }
};

// 20 questions, 4 réponses chacune, score de 0 (à travailler) à 3 (excellent).
const BILAN_QUESTIONS = [
  {
    id: "e1", dim: "energie",
    question: "Comment décrirais-tu ton réveil, la plupart des matins ?",
    subtitle: "Sois honnête, on ne juge pas ☕",
    options: [
      { label: "Je rampe jusqu'au café, mode zombie", emoji: "😵", score: 0 },
      { label: "Ça démarre doucement, faut le temps", emoji: "😐", score: 1 },
      { label: "Plutôt correct, je suis vite opérationnel·le", emoji: "🙂", score: 2 },
      { label: "Je bondis du lit prêt·e à tout", emoji: "🤩", score: 3 }
    ]
  },
  {
    id: "e2", dim: "energie",
    question: "Vers 15h-16h, ton énergie c'est plutôt…",
    subtitle: "Le fameux coup de barre de l'après-midi",
    options: [
      { label: "Un mur, je m'effondre littéralement", emoji: "😩", score: 0 },
      { label: "Petite baisse, un café me relance", emoji: "☕", score: 1 },
      { label: "Ça tient sans trop d'efforts", emoji: "🙂", score: 2 },
      { label: "Stable, je ne sens presque rien", emoji: "🚀", score: 3 }
    ]
  },
  {
    id: "e3", dim: "energie",
    question: "Combien de fois par semaine te sens-tu vraiment « en forme » ?",
    subtitle: "Sur une semaine type",
    options: [
      { label: "Rarement, voire jamais", emoji: "😞", score: 0 },
      { label: "1 à 2 jours", emoji: "🙁", score: 1 },
      { label: "3 à 4 jours", emoji: "🙂", score: 2 },
      { label: "Presque tous les jours", emoji: "😄", score: 3 }
    ]
  },
  {
    id: "s1", dim: "sommeil",
    question: "Combien d'heures dors-tu en moyenne par nuit ?",
    subtitle: "En vrai, pas en théorie",
    options: [
      { label: "Moins de 5h, le strict minimum", emoji: "😴", score: 0 },
      { label: "5 à 6h, ça pourrait aller mieux", emoji: "😪", score: 1 },
      { label: "7 à 8h, plutôt bien loti·e", emoji: "🙂", score: 2 },
      { label: "8h et plus, je me sens récupéré·e", emoji: "😌", score: 3 }
    ]
  },
  {
    id: "s2", dim: "sommeil",
    question: "L'endormissement, pour toi, c'est plutôt…",
    subtitle: "",
    options: [
      { label: "Une bataille de plus d'une heure", emoji: "🌀", score: 0 },
      { label: "20-30 minutes à tourner en rond", emoji: "😑", score: 1 },
      { label: "Je m'endors assez vite en général", emoji: "🙂", score: 2 },
      { label: "Je m'endors quasi instantanément", emoji: "💤", score: 3 }
    ]
  },
  {
    id: "s3", dim: "sommeil",
    question: "Au réveil, tu te sens…",
    subtitle: "",
    options: [
      { label: "Épuisé·e, comme si je n'avais pas dormi", emoji: "🥱", score: 0 },
      { label: "Fatigué·e, il me faut du temps", emoji: "😐", score: 1 },
      { label: "Plutôt reposé·e", emoji: "🙂", score: 2 },
      { label: "Frais·che et dispo immédiatement", emoji: "✨", score: 3 }
    ]
  },
  {
    id: "st1", dim: "stress",
    question: "Quand une contrariété arrive, tu…",
    subtitle: "",
    options: [
      { label: "Rumines des heures, ça t'obsède", emoji: "😖", score: 0 },
      { label: "Ça te travaille un bon moment", emoji: "😕", score: 1 },
      { label: "Tu retrouves ton calme assez vite", emoji: "🙂", score: 2 },
      { label: "Tu relativises presque instantanément", emoji: "😌", score: 3 }
    ]
  },
  {
    id: "st2", dim: "stress",
    question: "Tensions musculaires (nuque, mâchoire, épaules) : ton quotidien c'est…",
    subtitle: "",
    options: [
      { label: "En permanence noué·e", emoji: "😣", score: 0 },
      { label: "Souvent tendu·e", emoji: "😐", score: 1 },
      { label: "De temps en temps", emoji: "🙂", score: 2 },
      { label: "Rarement, je suis plutôt détendu·e", emoji: "😊", score: 3 }
    ]
  },
  {
    id: "st3", dim: "stress",
    question: "Ton dernier moment « 100% pour toi », sans écran ni to-do list, c'était…",
    subtitle: "",
    options: [
      { label: "Je ne m'en souviens même plus", emoji: "🫠", score: 0 },
      { label: "Il y a plus d'une semaine", emoji: "😕", score: 1 },
      { label: "Cette semaine, ça arrive", emoji: "🙂", score: 2 },
      { label: "Hier ou aujourd'hui, c'est régulier", emoji: "🌿", score: 3 }
    ]
  },
  {
    id: "i1", dim: "immunite",
    question: "Sur les 12 derniers mois, tu as été malade (rhume, coup de fatigue…)",
    subtitle: "",
    options: [
      { label: "Souvent, à répétition", emoji: "🤒", score: 0 },
      { label: "2-3 fois, le classique", emoji: "🙁", score: 1 },
      { label: "Une fois, rien de grave", emoji: "🙂", score: 2 },
      { label: "Presque jamais, mon corps tient bon", emoji: "💪", score: 3 }
    ]
  },
  {
    id: "i2", dim: "immunite",
    question: "Après un coup de fatigue ou un petit rhume, tu récupères…",
    subtitle: "",
    options: [
      { label: "Très lentement, ça traîne", emoji: "🐌", score: 0 },
      { label: "Doucement, en quelques semaines", emoji: "😐", score: 1 },
      { label: "Assez vite en général", emoji: "🙂", score: 2 },
      { label: "En un rien de temps", emoji: "⚡", score: 3 }
    ]
  },
  {
    id: "d1", dim: "digestion",
    question: "Après les repas, ton ventre c'est plutôt…",
    subtitle: "",
    options: [
      { label: "Ballonné·e, lourd·e, inconfortable", emoji: "😖", score: 0 },
      { label: "Ça dépend des jours, pas toujours net", emoji: "😕", score: 1 },
      { label: "Globalement tranquille", emoji: "🙂", score: 2 },
      { label: "Aucun souci, digestion facile", emoji: "😊", score: 3 }
    ]
  },
  {
    id: "d2", dim: "digestion",
    question: "Ton transit, tu dirais qu'il est…",
    subtitle: "",
    options: [
      { label: "Franchement capricieux", emoji: "😬", score: 0 },
      { label: "Irrégulier", emoji: "😕", score: 1 },
      { label: "Plutôt régulier", emoji: "🙂", score: 2 },
      { label: "Régulier comme une horloge", emoji: "⏰", score: 3 }
    ]
  },
  {
    id: "b1", dim: "beaute",
    question: "Peau, cheveux, ongles : en ce moment, ton constat c'est…",
    subtitle: "",
    options: [
      { label: "Ternes, cassants, ça se voit", emoji: "😞", score: 0 },
      { label: "Pas au top, un coup de mou", emoji: "😕", score: 1 },
      { label: "Plutôt en bonne santé", emoji: "🙂", score: 2 },
      { label: "Éclatants, je rayonne", emoji: "✨", score: 3 }
    ]
  },
  {
    id: "b2", dim: "beaute",
    question: "Le matin, avant de sortir, face au miroir, tu te sens…",
    subtitle: "",
    options: [
      { label: "Pas terrible, j'évite de trop regarder", emoji: "🙈", score: 0 },
      { label: "Moyen, un bon concealer sauve la mise", emoji: "😐", score: 1 },
      { label: "Plutôt confiant·e", emoji: "🙂", score: 2 },
      { label: "Prêt·e à conquérir le monde", emoji: "🌟", score: 3 }
    ]
  },
  {
    id: "h1", dim: "hydratation",
    question: "Combien de verres d'eau bois-tu par jour, environ ?",
    subtitle: "",
    options: [
      { label: "Moins de 3, je n'y pense jamais", emoji: "🌵", score: 0 },
      { label: "3 à 5", emoji: "🥤", score: 1 },
      { label: "6 à 8", emoji: "🙂", score: 2 },
      { label: "8 et plus, bouteille toujours sur moi", emoji: "💧", score: 3 }
    ]
  },
  {
    id: "h2", dim: "hydratation",
    question: "Café, thé, sodas... tu remplaces l'eau par ces boissons…",
    subtitle: "",
    options: [
      { label: "Très souvent, l'eau c'est rare", emoji: "☕", score: 0 },
      { label: "Assez souvent", emoji: "😐", score: 1 },
      { label: "Occasionnellement", emoji: "🙂", score: 2 },
      { label: "Rarement, l'eau reste ma boisson n°1", emoji: "💧", score: 3 }
    ]
  },
  {
    id: "a1", dim: "activite",
    question: "Le sport ou le mouvement dans ta semaine, c'est…",
    subtitle: "",
    options: [
      { label: "Zéro, je suis plutôt sédentaire", emoji: "🛋️", score: 0 },
      { label: "Une séance de temps en temps", emoji: "😐", score: 1 },
      { label: "1 à 3 fois par semaine", emoji: "🙂", score: 2 },
      { label: "4 fois ou plus, c'est un rituel", emoji: "🏃", score: 3 }
    ]
  },
  {
    id: "a2", dim: "activite",
    question: "Après une journée assise (bureau, trajets), ton corps te dit…",
    subtitle: "",
    options: [
      { label: "Raideurs et douleurs partout", emoji: "😖", score: 0 },
      { label: "Un peu de raideur", emoji: "😕", score: 1 },
      { label: "Ça va, rien de flagrant", emoji: "🙂", score: 2 },
      { label: "Aucune gêne, je me sens bien", emoji: "😊", score: 3 }
    ]
  },
  {
    id: "a3", dim: "activite",
    question: "Escaliers ou ascenseur : ton réflexe naturel, c'est…",
    subtitle: "",
    options: [
      { label: "Ascenseur, toujours", emoji: "🛗", score: 0 },
      { label: "Ça dépend de mon humeur", emoji: "😐", score: 1 },
      { label: "Escaliers si c'est pas trop haut", emoji: "🙂", score: 2 },
      { label: "Escaliers, systématiquement", emoji: "🏃", score: 3 }
    ]
  }
];

// Petits messages d'encouragement affichés à intervalles réguliers.
const BILAN_CHECKPOINTS = {
  5: "Tu assures ! Encore 15 questions et ton bilan complet est prêt 🚀",
  10: "Pile à mi-chemin ! Ton profil commence déjà à se dessiner ✨",
  15: "Plus que 5 questions, tu y es presque 🙌"
};

// Profils / archétypes selon le score global (0-100).
const BILAN_PROFILES = [
  {
    min: 0, max: 39,
    emoji: "🔋",
    name: "Batteries à recharger",
    tagline: "Ton corps te réclame une vraie pause — et c'est totalement OK.",
    description:
      "Ton bilan montre que plusieurs équilibres de base (sommeil, énergie, stress...) tirent un peu la sonnette d'alarme en même temps. Rien d'alarmant : c'est souvent le signe d'une période chargée, pas d'un problème de fond. La bonne nouvelle, c'est qu'en ajustant un ou deux réflexes simples, la remontée peut être rapide."
  },
  {
    min: 40, max: 59,
    emoji: "🌤️",
    name: "Équilibre en pointillés",
    tagline: "Des hauts, des bas — un joli potentiel qui ne demande qu'à s'exprimer.",
    description:
      "Tu as de vraies forces, mais aussi quelques zones grises qui grignotent ton énergie sans que tu t'en rendes toujours compte. En te concentrant sur 1 ou 2 priorités plutôt que sur tout à la fois, tu devrais sentir une différence assez vite."
  },
  {
    min: 60, max: 79,
    emoji: "🌱",
    name: "Sur la bonne voie",
    tagline: "Ta base est solide, il ne reste que quelques réglages fins.",
    description:
      "La plupart de tes habitudes jouent en ta faveur. Il reste une ou deux dimensions un peu plus fragiles, mais rien de lourd : quelques petits ajustements ciblés suffiront à passer un cap."
  },
  {
    min: 80, max: 100,
    emoji: "🌟",
    name: "Pleine Vitalité",
    tagline: "Un équilibre que beaucoup t'envieraient — bravo.",
    description:
      "Ton hygiène de vie soutient vraiment bien ton corps et ton esprit. Le mot d'ordre maintenant : entretenir ce que tu as construit, sans chercher la perfection à tout prix."
  }
];

function bilanProfileFor(score) {
  return BILAN_PROFILES.find((p) => score >= p.min && score <= p.max) || BILAN_PROFILES[0];
}

function bilanStatusFor(pct) {
  if (pct >= 80) return { label: "Excellent", css: "excellent" };
  if (pct >= 60) return { label: "Plutôt bien", css: "bien" };
  if (pct >= 40) return { label: "À chouchouter", css: "moyen" };
  return { label: "Prioritaire", css: "prioritaire" };
}
