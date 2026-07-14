// NutriGlow Adaptive — logique de l'application (état local + rendu)

const STORAGE_KEY = "nutriglow_adaptive_v1";
const ALL_LABEL = "Peu importe";

function uid() { return Date.now() + Math.floor(Math.random() * 1000); }

function normalize(str) {
  return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function defaultState() {
  const planning = {};
  const suivi = {};
  NG_DAYS.forEach(d => {
    planning[d] = { ...(NG_SEED_PLANNING[d] || { "Petit-déjeuner": "", "Déjeuner": "", "Dîner": "", "Collation": "" }) };
    suivi[d] = { energie: null, sommeil: "", repas: "", note: "" };
  });
  return {
    onboarded: false,
    profile: { name: "", goal: NG_GOALS[0], activity: "Modéré", diet: "Omnivore", weight: 65, proteinGoal: 100 },
    library: NG_SEED_RECIPES.map(r => ({ ...r, custom: false })),
    today: {
      filters: { type: ALL_LABEL, quick: ALL_LABEL, diet: ALL_LABEL, craving: ALL_LABEL },
      journal: { "Petit-déjeuner": "", "Déjeuner": "", "Dîner": "", "Collation": "" }
    },
    planning,
    shoppingChecked: {},
    suivi,
    libraryFilter: { type: ALL_LABEL, diet: ALL_LABEL, search: "" }
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    return { ...base, ...parsed, profile: { ...base.profile, ...(parsed.profile || {}) }, today: { ...base.today, ...(parsed.today || {}), filters: { ...base.today.filters, ...(parsed.today && parsed.today.filters || {}) } } };
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------------------------------------------------------------
// Toast
// ---------------------------------------------------------------
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

// ---------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------
function openOverlay(id) { document.getElementById(id).classList.add("open"); document.body.style.overflow = "hidden"; }
function closeOverlay(id) {
  document.getElementById(id).classList.remove("open");
  const anyOpen = document.querySelector(".overlay.open");
  if (!anyOpen) document.body.style.overflow = "";
}
function closeAllOverlays() {
  document.querySelectorAll(".overlay.open").forEach(o => o.classList.remove("open"));
  document.body.style.overflow = "";
}

document.addEventListener("click", (e) => {
  if (e.target.classList && e.target.classList.contains("overlay")) {
    e.target.classList.remove("open");
    document.body.style.overflow = "";
  }
});
document.querySelectorAll("[data-close-overlay]").forEach(btn => {
  btn.addEventListener("click", () => btn.closest(".overlay").classList.remove("open"));
});

// ---------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------
function goToView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.nav === name));
  document.getElementById("fab-add-recipe").style.display = name === "library" ? "flex" : "none";
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => goToView(btn.dataset.nav));
});

// ---------------------------------------------------------------
// Select helpers
// ---------------------------------------------------------------
function fillSelect(selectEl, options, selected) {
  selectEl.innerHTML = options.map(o => `<option value="${o}" ${o === selected ? "selected" : ""}>${o}</option>`).join("");
}

function recipeOptionsMarkup(selected, includeEmpty) {
  let html = includeEmpty ? `<option value="">— choisir —</option>` : "";
  NG_MEAL_TYPES.forEach(type => {
    const items = state.library.filter(r => r.type === type);
    if (!items.length) return;
    html += `<optgroup label="${type}">`;
    items.forEach(r => {
      html += `<option value="${escapeAttr(r.name)}" ${r.name === selected ? "selected" : ""}>${escapeHtml(r.name)}</option>`;
    });
    html += `</optgroup>`;
  });
  return html;
}

function escapeHtml(s) { return (s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function escapeAttr(s) { return escapeHtml(s); }

function findRecipeByName(name) { return state.library.find(r => r.name === name); }

// =================================================================
// AUJOURD'HUI
// =================================================================
function renderTodayFilters() {
  fillSelect(document.getElementById("f-type"), [ALL_LABEL, ...NG_MEAL_TYPES], state.today.filters.type);
  fillSelect(document.getElementById("f-quick"), [ALL_LABEL, "Oui", "Non"], state.today.filters.quick);
  fillSelect(document.getElementById("f-diet"), [ALL_LABEL, ...NG_DIETS], state.today.filters.diet);
  fillSelect(document.getElementById("f-craving"), [ALL_LABEL, ...NG_CRAVINGS], state.today.filters.craving);
}

["f-type", "f-quick", "f-diet", "f-craving"].forEach(id => {
  document.getElementById(id).addEventListener("change", (e) => {
    const map = { "f-type": "type", "f-quick": "quick", "f-diet": "diet", "f-craving": "craving" };
    state.today.filters[map[id]] = e.target.value;
    saveState();
    renderSuggestions();
  });
});

function matchesFilters(r) {
  const f = state.today.filters;
  if (f.type !== ALL_LABEL && r.type !== f.type) return false;
  if (f.quick !== ALL_LABEL && (r.quick ? "Oui" : "Non") !== f.quick) return false;
  if (f.diet !== ALL_LABEL && r.diet !== f.diet) return false;
  if (f.craving !== ALL_LABEL && r.craving !== f.craving) return false;
  return true;
}

function renderSuggestions() {
  const wrap = document.getElementById("suggestions-list");
  const matches = state.library.filter(matchesFilters).slice(0, 3);
  if (!matches.length) {
    wrap.innerHTML = `<div class="empty-state"><span>🌾</span>— élargissez vos filtres —</div>`;
    return;
  }
  wrap.innerHTML = matches.map((r, i) => `
    <div class="suggestion-card">
      <span class="suggestion-rank">${i + 1}</span>
      <h4>${escapeHtml(r.name)}</h4>
      <div class="suggestion-meta">⏱ ${r.time} min · ${r.protein} g de protéines</div>
      <div class="recipe-badges">
        <span class="badge">${r.type}</span>
        <span class="badge b-craving">${r.craving}</span>
        ${r.quick ? '<span class="badge b-quick">⚡ Rapide</span>' : ""}
      </div>
      ${r.tip ? `<div class="suggestion-tip">💡 ${escapeHtml(r.tip)}</div>` : ""}
    </div>
  `).join("");
}

const JOURNAL_SLOTS = ["Petit-déjeuner", "Déjeuner", "Dîner", "Collation"];

function renderJournal() {
  const wrap = document.getElementById("journal-rows");
  wrap.innerHTML = JOURNAL_SLOTS.map(slot => `
    <div class="journal-row">
      <label>${slot}</label>
      <select class="control" data-journal-slot="${slot}">${recipeOptionsMarkup(state.today.journal[slot], true)}</select>
      <span class="journal-protein" data-journal-protein="${slot}"></span>
    </div>
  `).join("");
  wrap.querySelectorAll("[data-journal-slot]").forEach(sel => {
    sel.addEventListener("change", (e) => {
      state.today.journal[sel.dataset.journalSlot] = e.target.value;
      saveState();
      updateJournalTotals();
    });
  });
  updateJournalTotals();
}

function updateJournalTotals() {
  let total = 0;
  JOURNAL_SLOTS.forEach(slot => {
    const name = state.today.journal[slot];
    const recipe = name ? findRecipeByName(name) : null;
    const p = recipe ? recipe.protein : 0;
    if (recipe) total += p;
    const cell = document.querySelector(`[data-journal-protein="${slot}"]`);
    if (cell) cell.textContent = recipe ? `${p} g` : "";
  });
  const goal = Number(state.profile.proteinGoal) || 0;
  const remaining = Math.max(goal - total, 0);
  const pct = goal > 0 ? Math.min((total / goal) * 100, 100) : 0;
  document.getElementById("journal-total").textContent = `${total} g`;
  document.getElementById("journal-remaining").textContent = goal > 0 ? `objectif ${goal} g · reste ${remaining} g` : "définissez un objectif dans votre profil";
  document.getElementById("journal-progress-fill").style.width = pct + "%";
}

document.getElementById("btn-reset-journal").addEventListener("click", () => {
  state.today.journal = { "Petit-déjeuner": "", "Déjeuner": "", "Dîner": "", "Collation": "" };
  saveState();
  renderJournal();
  showToast("Nouveau jour — journal réinitialisé");
});

// =================================================================
// BIBLIOTHÈQUE DE REPAS
// =================================================================
function renderLibraryFilters() {
  const typeWrap = document.getElementById("lib-type-filters");
  typeWrap.innerHTML = [ALL_LABEL, ...NG_MEAL_TYPES].map(t =>
    `<button class="chip ${state.libraryFilter.type === t ? "active" : ""}" data-lib-type="${t}">${t}</button>`
  ).join("");
  typeWrap.querySelectorAll("[data-lib-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.libraryFilter.type = btn.dataset.libType;
      renderLibraryFilters();
      renderRecipeList();
    });
  });

  const dietWrap = document.getElementById("lib-diet-filters");
  dietWrap.innerHTML = [ALL_LABEL, ...NG_DIETS].map(t =>
    `<button class="chip ${state.libraryFilter.diet === t ? "active" : ""}" data-lib-diet="${t}">${t}</button>`
  ).join("");
  dietWrap.querySelectorAll("[data-lib-diet]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.libraryFilter.diet = btn.dataset.libDiet;
      renderLibraryFilters();
      renderRecipeList();
    });
  });
}

document.getElementById("lib-search").addEventListener("input", (e) => {
  state.libraryFilter.search = e.target.value;
  renderRecipeList();
});

function renderRecipeList() {
  const wrap = document.getElementById("recipe-list");
  const { type, diet, search } = state.libraryFilter;
  const q = normalize(search);
  const items = state.library.filter(r => {
    if (type !== ALL_LABEL && r.type !== type) return false;
    if (diet !== ALL_LABEL && r.diet !== diet) return false;
    if (q && !normalize(r.name + " " + r.ingredients).includes(q)) return false;
    return true;
  });
  if (!items.length) {
    wrap.innerHTML = `<div class="empty-state"><span>📚</span>Aucune recette ne correspond — essayez d'autres filtres.</div>`;
    return;
  }
  wrap.innerHTML = items.map(r => `
    <div class="recipe-card" data-recipe-id="${r.id}">
      <div class="recipe-card-top">
        <h4>${escapeHtml(r.name)}${r.custom ? '<span class="recipe-custom-tag">· perso</span>' : ""}</h4>
        <div class="recipe-protein"><strong>${r.protein}g</strong><span>protéines</span></div>
      </div>
      <div class="recipe-badges">
        <span class="badge">${r.type}</span>
        <span class="badge b-time">⏱ ${r.time} min</span>
        <span class="badge b-craving">${r.craving}</span>
        <span class="badge">${r.diet}</span>
        ${r.quick ? '<span class="badge b-quick">⚡ Rapide</span>' : ""}
      </div>
      <p class="recipe-ingredients">${escapeHtml(r.ingredients)}</p>
    </div>
  `).join("");
  wrap.querySelectorAll("[data-recipe-id]").forEach(card => {
    card.addEventListener("click", () => openRecipeDetail(Number(card.dataset.recipeId)));
  });
}

let activeRecipeId = null;

function openRecipeDetail(id) {
  const r = state.library.find(x => x.id === id);
  if (!r) return;
  activeRecipeId = id;
  document.getElementById("rd-name").textContent = r.name;
  document.getElementById("rd-badges").innerHTML = `
    <span class="badge">${r.type}</span>
    <span class="badge b-time">⏱ ${r.time} min</span>
    <span class="badge b-craving">${r.craving}</span>
    <span class="badge">${r.diet}</span>
    ${r.quick ? '<span class="badge b-quick">⚡ Rapide</span>' : ""}
    <span class="badge" style="background:var(--coral-tint);color:var(--coral-deep)">${r.protein} g protéines</span>
  `;
  document.getElementById("rd-ingredients").textContent = r.ingredients;
  document.getElementById("rd-tip-wrap").style.display = r.tip ? "" : "none";
  document.getElementById("rd-tip").textContent = r.tip || "";
  openOverlay("overlay-recipe-detail");
}

document.getElementById("rd-edit-btn").addEventListener("click", () => {
  closeOverlay("overlay-recipe-detail");
  openRecipeForm(activeRecipeId);
});

document.getElementById("rd-delete-btn").addEventListener("click", () => {
  const r = state.library.find(x => x.id === activeRecipeId);
  if (!r) return;
  if (!confirm(`Supprimer « ${r.name} » de votre bibliothèque ?`)) return;
  state.library = state.library.filter(x => x.id !== activeRecipeId);
  saveState();
  closeOverlay("overlay-recipe-detail");
  renderRecipeList();
  renderSuggestions();
  renderJournal();
  renderPlanningDays();
  renderShopping();
  showToast("Recette supprimée");
});

function openRecipeForm(id) {
  const form = document.getElementById("recipe-form");
  form.reset();
  fillSelect(document.getElementById("rf-type"), NG_MEAL_TYPES, NG_MEAL_TYPES[0]);
  fillSelect(document.getElementById("rf-diet"), NG_DIETS, NG_DIETS[0]);
  fillSelect(document.getElementById("rf-craving"), NG_CRAVINGS, NG_CRAVINGS[0]);

  if (id) {
    const r = state.library.find(x => x.id === id);
    document.getElementById("rf-title").textContent = "Modifier la recette";
    document.getElementById("rf-id").value = r.id;
    document.getElementById("rf-name").value = r.name;
    document.getElementById("rf-type").value = r.type;
    document.getElementById("rf-time").value = r.time;
    document.getElementById("rf-quick").value = r.quick ? "true" : "false";
    document.getElementById("rf-protein").value = r.protein;
    document.getElementById("rf-diet").value = r.diet;
    document.getElementById("rf-craving").value = r.craving;
    document.getElementById("rf-ingredients").value = r.ingredients;
    document.getElementById("rf-tip").value = r.tip || "";
  } else {
    document.getElementById("rf-title").textContent = "Nouvelle recette";
    document.getElementById("rf-id").value = "";
  }
  openOverlay("overlay-recipe-form");
}

document.getElementById("fab-add-recipe").addEventListener("click", () => openRecipeForm(null));

document.getElementById("recipe-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("rf-id").value;
  const data = {
    name: document.getElementById("rf-name").value.trim(),
    type: document.getElementById("rf-type").value,
    time: Number(document.getElementById("rf-time").value) || 0,
    quick: document.getElementById("rf-quick").value === "true",
    protein: Number(document.getElementById("rf-protein").value) || 0,
    diet: document.getElementById("rf-diet").value,
    craving: document.getElementById("rf-craving").value,
    ingredients: document.getElementById("rf-ingredients").value.trim(),
    tip: document.getElementById("rf-tip").value.trim()
  };
  if (!data.name) return;

  if (id) {
    const idx = state.library.findIndex(x => x.id === Number(id));
    if (idx > -1) state.library[idx] = { ...state.library[idx], ...data };
  } else {
    state.library.push({ id: uid(), custom: true, ...data });
  }
  saveState();
  closeOverlay("overlay-recipe-form");
  renderRecipeList();
  renderSuggestions();
  renderJournal();
  renderPlanningDays();
  renderShopping();
  showToast(id ? "Recette mise à jour" : "Recette ajoutée à la bibliothèque");
});

// =================================================================
// PLANNING SEMAINE
// =================================================================
const FR_DAY_INDEX = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
function todayDayName() { return FR_DAY_INDEX[new Date().getDay()]; }

let openDay = todayDayName();

function renderPlanningDays() {
  const wrap = document.getElementById("planning-days");
  wrap.innerHTML = NG_DAYS.map(day => {
    const plan = state.planning[day];
    const filled = JOURNAL_SLOTS.filter(s => plan[s]).length;
    const isOpen = openDay === day;
    return `
    <div class="day-card ${isOpen ? "open" : ""}" data-day="${day}">
      <div class="day-card-head" data-day-toggle="${day}">
        <div>
          <h4>${day}${day === todayDayName() ? " · aujourd'hui" : ""}</h4>
          <div class="day-card-summary">${filled}/4 repas planifiés</div>
        </div>
        <svg class="chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </div>
      <div class="day-card-body">
        <div class="day-card-body-inner">
          ${JOURNAL_SLOTS.map(slot => `
            <div class="slot-field">
              <label>${slot}</label>
              <select class="control" data-plan-day="${day}" data-plan-slot="${slot}">${recipeOptionsMarkup(plan[slot], true)}</select>
            </div>
          `).join("")}
        </div>
      </div>
    </div>`;
  }).join("");

  wrap.querySelectorAll("[data-day-toggle]").forEach(head => {
    head.addEventListener("click", () => {
      const day = head.dataset.dayToggle;
      openDay = openDay === day ? null : day;
      renderPlanningDays();
    });
  });
  wrap.querySelectorAll("[data-plan-day]").forEach(sel => {
    sel.addEventListener("change", (e) => {
      state.planning[sel.dataset.planDay][sel.dataset.planSlot] = e.target.value;
      saveState();
      renderPlanningDays();
      renderShopping();
    });
  });
}

// =================================================================
// LISTE DE COURSES
// =================================================================
function renderShopping() {
  const listWrap = document.getElementById("shopping-list");
  const detailWrap = document.getElementById("shopping-detail");

  const plannedMeals = [];
  NG_DAYS.forEach(day => {
    JOURNAL_SLOTS.forEach(slot => {
      const name = state.planning[day][slot];
      if (!name) return;
      const recipe = findRecipeByName(name);
      plannedMeals.push({ day, slot, name, ingredients: recipe ? recipe.ingredients : "" });
    });
  });

  if (!plannedMeals.length) {
    listWrap.innerHTML = `<div class="empty-state"><span>🛒</span>Planifiez vos repas de la semaine pour générer votre liste de courses.</div>`;
    document.getElementById("shopping-detail-wrap").style.display = "none";
    return;
  }
  document.getElementById("shopping-detail-wrap").style.display = "";

  const seen = new Map();
  plannedMeals.forEach(m => {
    m.ingredients.split(",").map(s => s.trim()).filter(Boolean).forEach(ing => {
      const key = normalize(ing);
      if (!seen.has(key)) seen.set(key, ing);
    });
  });
  const items = [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], "fr"));

  listWrap.innerHTML = items.map(([key, label]) => {
    const checked = !!state.shoppingChecked[key];
    return `
    <div class="shop-item">
      <div class="shop-check ${checked ? "checked" : ""}" data-shop-key="${escapeAttr(key)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="m5 12 5 5L20 7"/></svg>
      </div>
      <span class="shop-label ${checked ? "checked" : ""}" data-shop-label="${escapeAttr(key)}">${escapeHtml(label)}</span>
    </div>`;
  }).join("");

  listWrap.querySelectorAll("[data-shop-key]").forEach(box => {
    box.addEventListener("click", () => {
      const key = box.dataset.shopKey;
      state.shoppingChecked[key] = !state.shoppingChecked[key];
      saveState();
      box.classList.toggle("checked");
      const label = listWrap.querySelector(`[data-shop-label="${CSS.escape(key)}"]`);
      if (label) label.classList.toggle("checked");
    });
  });

  detailWrap.innerHTML = NG_DAYS.map(day => {
    const meals = plannedMeals.filter(m => m.day === day);
    if (!meals.length) return "";
    return `
    <div class="day-detail">
      <h5>${day}</h5>
      ${meals.map(m => `<div class="day-detail-meal"><strong>${m.slot} :</strong> ${escapeHtml(m.name)} — ${escapeHtml(m.ingredients)}</div>`).join("")}
    </div>`;
  }).join("");
}

// =================================================================
// PROFIL & OBJECTIFS
// =================================================================
function renderProfile() {
  document.getElementById("p-name").value = state.profile.name || "";
  fillSelect(document.getElementById("p-goal"), NG_GOALS, state.profile.goal);
  fillSelect(document.getElementById("p-activity"), NG_ACTIVITY, state.profile.activity);
  fillSelect(document.getElementById("p-diet"), NG_DIETS, state.profile.diet);
  document.getElementById("p-weight").value = state.profile.weight;
  document.getElementById("p-protein").value = state.profile.proteinGoal;
  updateProfileDerived();
}

function updateProfileDerived() {
  const w = Number(state.profile.weight) || 0;
  document.getElementById("p-benchmark").textContent = w > 0 ? `${Math.round(w * 1.2)} à ${Math.round(w * 1.6)} g` : "—";
  const avatar = document.getElementById("profile-avatar");
  avatar.textContent = state.profile.name ? state.profile.name.trim().charAt(0).toUpperCase() : "🌸";
}

function bindProfileField(id, key, isNumber) {
  document.getElementById(id).addEventListener("input", (e) => {
    state.profile[key] = isNumber ? Number(e.target.value) : e.target.value;
    saveState();
    updateProfileDerived();
    updateJournalTotals();
  });
}
bindProfileField("p-name", "name", false);
bindProfileField("p-weight", "weight", true);
bindProfileField("p-protein", "proteinGoal", true);
["p-goal", "p-activity", "p-diet"].forEach(id => {
  const key = { "p-goal": "goal", "p-activity": "activity", "p-diet": "diet" }[id];
  document.getElementById(id).addEventListener("change", (e) => {
    state.profile[key] = e.target.value;
    saveState();
  });
});

// =================================================================
// SUIVI HEBDO
// =================================================================
function renderSuivi() {
  const wrap = document.getElementById("suivi-days");
  wrap.innerHTML = NG_DAYS.map(day => {
    const d = state.suivi[day];
    return `
    <div class="card" style="margin-top:12px" data-suivi-day="${day}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h4 style="font-size:0.95rem">${day}</h4>
      </div>
      <div class="field">
        <label>Énergie (1-5)</label>
        <div class="energy-row" data-suivi-energy="${day}">
          ${[1, 2, 3, 4, 5].map(n => `<div class="energy-dot ${d.energie === n ? "active" : ""}" data-val="${n}">${n}</div>`).join("")}
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Sommeil (h)</label>
          <input class="control" type="number" min="0" max="14" step="0.5" data-suivi-sommeil="${day}" value="${d.sommeil}" />
        </div>
        <div class="field">
          <label>Repas suivis</label>
          <select class="control" data-suivi-repas="${day}">${["", ...NG_FOLLOWED].map(o => `<option value="${o}" ${o === d.repas ? "selected" : ""}>${o || "—"}</option>`).join("")}</select>
        </div>
      </div>
      <div class="field">
        <label>Note</label>
        <input class="control" type="text" placeholder="Un ressenti, une remarque…" data-suivi-note="${day}" value="${escapeAttr(d.note)}" />
      </div>
    </div>`;
  }).join("");

  wrap.querySelectorAll("[data-suivi-energy]").forEach(row => {
    row.addEventListener("click", (e) => {
      const dot = e.target.closest(".energy-dot");
      if (!dot) return;
      const day = row.dataset.suiviEnergy;
      const val = Number(dot.dataset.val);
      state.suivi[day].energie = state.suivi[day].energie === val ? null : val;
      saveState();
      renderSuivi();
      renderSparkline();
    });
  });
  wrap.querySelectorAll("[data-suivi-sommeil]").forEach(inp => {
    inp.addEventListener("input", (e) => {
      state.suivi[inp.dataset.suiviSommeil].sommeil = e.target.value;
      saveState();
    });
  });
  wrap.querySelectorAll("[data-suivi-repas]").forEach(sel => {
    sel.addEventListener("change", (e) => {
      state.suivi[sel.dataset.suiviRepas].repas = e.target.value;
      saveState();
    });
  });
  wrap.querySelectorAll("[data-suivi-note]").forEach(inp => {
    inp.addEventListener("input", (e) => {
      state.suivi[inp.dataset.suiviNote].note = e.target.value;
      saveState();
    });
  });

  renderSparkline();
}

const DAY_INITIALS = { Lundi: "L", Mardi: "M", Mercredi: "M", Jeudi: "J", Vendredi: "V", Samedi: "S", Dimanche: "D" };

function renderSparkline() {
  const wrap = document.getElementById("week-sparkline");
  wrap.innerHTML = NG_DAYS.map(day => {
    const val = state.suivi[day].energie;
    const heightPct = val ? (val / 5) * 100 : 6;
    return `
    <div class="spark-bar-wrap" title="${day}${val ? " · énergie " + val + "/5" : ""}">
      <div class="spark-bar ${val ? "has-value" : ""}" style="height:${heightPct}%"></div>
      <span class="spark-label">${DAY_INITIALS[day]}</span>
    </div>`;
  }).join("");
}

// =================================================================
// WELCOME / ONBOARDING
// =================================================================
document.getElementById("btn-welcome-start").addEventListener("click", () => {
  state.onboarded = true;
  saveState();
  closeOverlay("overlay-welcome");
  goToView("profile");
  setTimeout(() => document.getElementById("p-name").focus(), 300);
});
document.getElementById("btn-welcome-skip").addEventListener("click", () => {
  state.onboarded = true;
  saveState();
  closeOverlay("overlay-welcome");
});
document.querySelector("[data-open-welcome]").addEventListener("click", () => openOverlay("overlay-welcome"));
document.querySelector("[data-open-help]").addEventListener("click", () => openOverlay("overlay-help"));

// =================================================================
// INIT
// =================================================================
function renderAll() {
  renderTodayFilters();
  renderSuggestions();
  renderJournal();
  renderLibraryFilters();
  renderRecipeList();
  renderPlanningDays();
  renderShopping();
  renderProfile();
  renderSuivi();
}

renderAll();
if (!state.onboarded) {
  openOverlay("overlay-welcome");
}
