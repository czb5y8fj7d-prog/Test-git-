# Tycoon Engine — guide du moteur

Moteur de jeux de gestion « tycoon » (compagnie aérienne, écurie F1, constructeur auto, élevage de chevaux, club de foot, chaîne TV…), extrait de **Plan de Vol**. Zéro dépendance, zéro build obligatoire : JavaScript pur, tout tient dans **un seul fichier HTML** (artifact, VPS statique, GitHub Pages).

> **Principe** : le moteur fournit tout ce qui est commun à ces jeux. Un nouveau jeu n'est qu'un fichier `games/<nom>/game.js` qui décrit **ses données** et **ses règles**. Ne jamais réécrire le moteur : on donne `ENGINE.md` + `engine/core.js` + `games/ecurie/game.js` (exemple) à l'IA, et on lui demande un nouveau `game.js`.

## Arborescence
```
engine/core.js      noyau sans DOM : temps, aléa, grand livre, crédit, marché, événements, IA, sauvegardes
engine/ui.js        kit d'interface : coque, onglets, fenêtres, rendu incrémental, graphiques, curseurs, départ
engine/style.css    design tokens + composants (surchargeables par def.theme)
games/ecurie/       jeu de démo complet (F1) — ~250 lignes
games/_modele/      squelette à copier pour un nouveau jeu
build.mjs           node build.mjs <jeu>  →  dist/<jeu>.html (autonome)
tests/              sim.test.mjs (noyau, sans DOM) · ui.test.mjs (interface sous jsdom)
```

## Ce que le moteur fait déjà (ne pas recoder)
| Domaine | API |
|---|---|
| Temps | 1 tick = 1 jour ; vitesses II / > / >> / >>> ; pause auto quand une fenêtre est ouverte ; `def.autoPause(G)` |
| Aléa reproductible | `TE.rng() TE.rand(a,b) TE.randInt TE.pick TE.pickW` (graine dans `G.seed`, parties rejouables) |
| Grand livre | `TE.earn(a,cat,v)` `TE.spend(a,cat,v)` `TE.accrue` → compte de résultat mensuel automatique (`a.last`) |
| Crédit | `TE.creditLimit TE.rating TE.loanRate TE.borrow TE.repay TE.companyValue` (plafond selon `def.assets(a)` + bénéfices) |
| Marché | `TE.splitMarket(demande, [{price,quality,cap}])` : logit prix/qualité + débordement quand la capacité est saturée |
| Modificateurs | `TE.addMod({tag,scope,mult,until})` + `TE.modFactor(tag,scope)` : booms, crises, saisons |
| Événements | `def.events.random` (tirage pondéré) et `def.events.scheduled` (annoncés N jours avant, appliqués ensuite) |
| Personnel | `def.staff` + `TE.hire TE.wagesMonth TE.avgMorale` (moral, niveaux de salaire) |
| Rivales IA | profils, décision hebdo à tour de rôle (`def.ai.week`), faillites, **nouveaux entrants** automatiques |
| Objectifs | `def.goals` → choix au départ, barre de progression, victoire |
| Sauvegardes | auto + précédente + 3 emplacements, export/import fichier, **migrations de version** (`def.migrate`) |
| Interface | onglets, fenêtres, toasts, curseurs de montant, tuiles, tableaux, courbes, barres, jauges, écran de départ généré |
| Panneaux prêts à l'emploi | `'@finance'` (résultat, emprunts, notation) · `'@ranking'` · `'@news'` |

## Contrat d'un jeu (`TE.boot(DEF)`)
```js
DEF = {
  id, title, icon, subtitle, lede, currency, theme:{accent,flap,board…}, calendar:{startYear, ticksPerMonth, months},
  setup:[{k:'name'|'color'|…, type:'text|color|select|range|checkbox', label, def, adv?}],   // écran de départ
  presets:[{label, cash, rich, aggr}],            // niveaux de difficulté
  rivals:[{name,profile,color,cash,…}], entrants:[…], profiles:{ id:{appetite,reserve,…} }, maxRivals,
  staff:{ metier:{label,sal,hire} }, credit:{base,assetsMult,bankruptFloor,graceDays},
  ledger:{in:{cat:'Libellé'}, out:{…}},  assets:(a)=>valeur,  goals:{ id:{label,unit,def,value:(a)=>n,fmt} },

  init(G), initActor(G,a,R|null,opts),            // monde + état de départ de chaque acteur (joueur : R===null)
  onTick(G), onWeek(G), onMonth(G,a), onYear(G),  // simulation ; onMonth tourne pour CHAQUE acteur (mêmes règles joueur/IA)
  ai:{ week(G,a,profil) },  events:{rate, random:[{w,when?,run(G)}], scheduled:[{id,name,from,to,lead,tag,mult}]},
  kpis:[{label,get:(p,G)=>…,cls?}], tabs:[{id,label,icon,render:(G,p,UI)=>html | '@finance'|'@ranking'|'@news'}],
  modals:{ kind:(M,G,p)=>html },  actions:{ nom(d,ctx,el){…} },     // <button data-act="nom" data-x="1">
  rankingCols, rankingSort, endText, saveMeta, migrate:{ 1:(g)=>g }, autoPause, afterMonth, checkEnd, map:{draw}
}
```
**Règles d'or**
1. **L'état est du JSON pur** (`G` et les acteurs) : pas de classes, pas de fonctions, pas de `Map`/`Set`. C'est ce qui rend la sauvegarde gratuite.
2. **Joueur et IA utilisent les mêmes fonctions** (`invest(a,…)`, pas `invest(player,…)`). L'IA ne triche pas, et on n'écrit les règles qu'une fois.
3. **Tout aléa passe par `TE.rng()`** (jamais `Math.random()` dans la simulation) → déterminisme, tests reproductibles.
4. **Toute recette/dépense passe par `TE.earn/spend`** → le compte de résultat, le crédit et le classement marchent sans code en plus.
5. Les onglets renvoient du **HTML en chaîne** ; les boutons portent `data-act` ; le rendu est « morphé » (pas de scintillement, curseurs préservés).
6. Changer le format de `G` ⇒ incrémenter `def.version` et fournir `def.migrate[ancienneVersion]`.

## Faire un nouveau jeu
1. `cp -r games/_modele games/mon-jeu`, renommer `id`, `TE.GAMES[...]`.
2. Remplir les `À FAIRE` : acteurs (`initActor`), recettes/charges (`onMonth`), un ou deux leviers pour le joueur (`actions` + un onglet), une IA simple (`ai.week`), 3–5 événements.
3. `node build.mjs mon-jeu` → `dist/mon-jeu.html`. Les tests : `node tests/sim.test.mjs` (ajouter le jeu à la liste).

### Correspondances par genre
| Jeu | Acteurs | `onMonth` / `onTick` | `splitMarket` | Leviers joueur |
|---|---|---|---|---|
| Compagnie aérienne | compagnies | recettes de lignes, carburant, loyers | demande par ligne entre compagnies | lignes, flotte, prix |
| Écurie F1 *(démo)* | écuries | sponsors, primes, logistique | — (course = classement) | R&D, pilote, effectifs |
| Constructeur auto | marques | ventes par segment, usines, garantie | demande par segment (prix/qualité/capacité) | gammes, prix, usines, R&D |
| Élevage de chevaux | écuries/haras | pensions, gains en course, vétérinaire | — (ventes aux enchères) | croisements, entraînement, engagements |
| Club de foot | clubs | billetterie, droits TV, salaires | — | transferts, tactique, centre de formation |
| Chaîne TV | chaînes | audience → pub, coût des programmes | audience par créneau entre chaînes | grille, achats de droits, prix pub |

## Ce qui est resté dans Plan de Vol (candidats à de futurs modules)
Ces systèmes sont réutilisables mais trop liés à l'aérien pour être « génériques » en l'état : **conseil d'administration** (satisfaction par parties prenantes, motions, objectifs trimestriels), **bourse / IPO / OPA / participations**, **alliances & partage de codes**, **marques filles** (low-cost, fret…), **couverture carburant**, **créneaux aéroportuaires**, **carte du monde** (canvas, projection, zoom).
À extraire à la demande en modules `engine/mod-*.js` (le plus rentable : conseil + bourse, communs à presque tous les tycoons).

## Pour une IA (prompt type)
> Lis `ENGINE.md`, `engine/core.js` (API en tête de section) et `games/ecurie/game.js` (exemple complet). Crée `games/<nom>/game.js` pour un jeu de **<description>** : acteurs, règles mensuelles, 2 leviers joueur, IA par profils, 5 événements, objectif. Respecte les règles d'or. N'écris pas dans `engine/`.

## Charte de navigation (v2)
1. **5 pôles maximum** (`def.nav`) : dock du bas sur mobile, arbre latéral sur desktop. Au-delà, fusionner des pôles.
2. **Un seul niveau de rubriques** par pôle (≤ 7). Mobile : onglets texte soulignés sous la barre haute, balayage gauche/droite. Desktop : sous-liste dépliée sous le pôle actif (accordéon façon OGame), pas de pastilles en haut.
3. **Barre haute = ressources + temps** : mobile = trésorerie, date, vitesse, recherche, sauvegarde sur une seule ligne ; desktop = tous les `def.kpis`.
4. **Une action principale par écran** : `tab.fab` → bouton flottant au-dessus du dock (mobile) ou en bas à droite (desktop).
5. **Aller à…** : bouton loupe, `/` ou ⌘K ; `tab.kw` ajoute des mots-clés. Raccourcis `1`–`5` (pôles), `[` `]` (rubriques), `Espace` (pause).
6. Badges : sur la rubrique concernée, agrégés sur le pôle. Cibles tactiles ≥ 44 px, safe-areas respectées.
