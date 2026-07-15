/* =========================================================
   LUMÉA — Bilan Bien-être Complet : moteur du questionnaire
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const introEl = document.getElementById("bilanIntro");
  const quizSection = document.getElementById("bilanQuizSection");
  const stepsWrap = document.getElementById("bilanSteps");
  const progressFill = document.getElementById("bilanProgressFill");
  const resultsSection = document.getElementById("bilanResultsSection");
  const startBtn = document.getElementById("bilanStartBtn");
  if (!stepsWrap || !startBtn) return;

  const ICONS = {
    zap: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/>',
    moon: '<path d="M21 12.5A8.5 8.5 0 1 1 11.5 3 7 7 0 0 0 21 12.5Z"/>',
    leaf: '<path d="M12 21c-4-2-7-6-7-11a7 7 0 0 1 14 0c0 5-3 9-7 11Z"/><path d="M12 21V9"/>',
    sprout: '<path d="M7 20h10"/><path d="M12 20v-8"/><path d="M12 12c0-4-3-6-7-6 0 4 3 6 7 6Z"/><path d="M12 10c0-3 2.5-5 6-5 0 3-2.5 5-6 5Z"/>',
    shield: '<path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4Z"/>',
    sparkle: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.6"/>'
  };
  function iconSvg(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.leaf}</svg>`;
  }

  const DIM_ORDER = Object.keys(BILAN_DIMENSIONS);
  const TOTAL_Q = BILAN_QUESTIONS.length;

  // Construit le déroulé : questions + interstitiels d'encouragement.
  const flow = [];
  BILAN_QUESTIONS.forEach((q, i) => {
    flow.push({ type: "question", q, qNumber: i + 1 });
    if (BILAN_CHECKPOINTS[i + 1]) {
      flow.push({ type: "checkpoint", message: BILAN_CHECKPOINTS[i + 1] });
    }
  });

  const answers = {}; // { qid: { dim, score } }
  let current = 0;

  function buildQuestionStep(q, qNumber) {
    const step = document.createElement("div");
    step.className = "quiz-step";
    step.innerHTML = `
      <p class="quiz-step-label">Question ${qNumber} / ${TOTAL_Q}</p>
      <h2 class="quiz-question">${q.question}</h2>
      <p class="quiz-subtitle">${q.subtitle || ""}</p>
      <div class="quiz-options">
        ${q.options
          .map(
            (opt, oi) => `
          <button class="quiz-option" data-qid="${q.id}" data-score="${opt.score}">
            <span class="quiz-option-icon" style="font-size:20px">${opt.emoji}</span>
            <span>${opt.label}</span>
          </button>`
          )
          .join("")}
      </div>
      <div class="quiz-nav">
        <button class="quiz-back" data-back>← Retour</button>
        <span></span>
        <span style="width:60px"></span>
      </div>
    `;
    return step;
  }

  function buildCheckpointStep(message) {
    const step = document.createElement("div");
    step.className = "quiz-step";
    step.innerHTML = `
      <div class="bilan-checkpoint">
        <span class="bc-emoji">🎉</span>
        <p>${message}</p>
        <button class="btn btn-primary" data-checkpoint-next>Continuer →</button>
      </div>
    `;
    return step;
  }

  function render() {
    stepsWrap.innerHTML = "";
    flow.forEach((item) => {
      const el = item.type === "question" ? buildQuestionStep(item.q, item.qNumber) : buildCheckpointStep(item.message);
      stepsWrap.appendChild(el);
    });
    attachEvents();
    current = 0;
    goToStep(0);
  }

  function attachEvents() {
    stepsWrap.querySelectorAll(".quiz-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        const question = BILAN_QUESTIONS.find((q) => q.id === btn.dataset.qid);
        btn.closest(".quiz-options").querySelectorAll(".quiz-option").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        answers[btn.dataset.qid] = { dim: question.dim, score: Number(btn.dataset.score) };
        setTimeout(() => goToStep(current + 1), 320);
      });
    });
    stepsWrap.querySelectorAll("[data-checkpoint-next]").forEach((btn) => {
      btn.addEventListener("click", () => goToStep(current + 1));
    });
    stepsWrap.querySelectorAll("[data-back]").forEach((btn) => {
      btn.addEventListener("click", () => goToStep(current - 1));
    });
  }

  function answeredCount() {
    return Object.keys(answers).length;
  }

  function goToStep(index) {
    if (index < 0) return;
    if (index >= flow.length) {
      showResults();
      return;
    }
    current = index;
    const steps = stepsWrap.querySelectorAll(".quiz-step");
    steps.forEach((s) => s.classList.remove("active"));
    steps[index].classList.add("active");
    const backBtn = steps[index].querySelector("[data-back]");
    if (backBtn) backBtn.classList.toggle("show", index > 0);
    progressFill.style.width = `${(answeredCount() / TOTAL_Q) * 100}%`;
    if (quizSection.style.display !== "none") {
      quizSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* ---------------- Scoring ---------------- */
  function computeResults() {
    const dimScores = {};
    DIM_ORDER.forEach((d) => (dimScores[d] = { sum: 0, count: 0 }));
    Object.values(answers).forEach((a) => {
      dimScores[a.dim].sum += a.score;
      dimScores[a.dim].count += 1;
    });
    const dimPct = {};
    DIM_ORDER.forEach((d) => {
      const { sum, count } = dimScores[d];
      dimPct[d] = count ? Math.round((sum / (count * 3)) * 100) : 0;
    });
    const overall = Math.round(DIM_ORDER.reduce((s, d) => s + dimPct[d], 0) / DIM_ORDER.length);
    return { dimPct, overall };
  }

  function ringOffset(pct) {
    const C = 2 * Math.PI * 60;
    return C - (C * Math.max(0, Math.min(100, pct))) / 100;
  }

  function animateNumber(el, to, duration) {
    const start = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(eased * to);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function showResults() {
    quizSection.style.display = "none";
    resultsSection.classList.add("show");

    const { dimPct, overall } = computeResults();
    const profile = bilanProfileFor(overall);
    const C = 2 * Math.PI * 60;

    // Dimensions triées pour identifier les priorités (score le plus bas d'abord)
    const sortedDims = [...DIM_ORDER].sort((a, b) => dimPct[a] - dimPct[b]);
    const priorityDims = sortedDims.filter((d) => dimPct[d] < 60).slice(0, 3);

    resultsSection.innerHTML = `
      <div class="bilan-profile-card">
        <span class="bilan-profile-emoji">${profile.emoji}</span>
        <h2>${profile.name}</h2>
        <p class="bilan-profile-tagline">${profile.tagline}</p>
        <div class="bilan-score-ring-wrap">
          <div class="bilan-score-ring">
            <svg viewBox="0 0 140 140" width="148" height="148">
              <circle cx="70" cy="70" r="60" fill="none" stroke="#e7ede9" stroke-width="12"/>
              <circle id="bilanRingCircle" cx="70" cy="70" r="60" fill="none" stroke="#1c5866" stroke-width="12"
                stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"
                style="transition:stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)"/>
            </svg>
            <div class="bilan-score-ring-label">
              <span class="num" id="bilanRingNum">0</span>
              <span class="txt">score global</span>
            </div>
          </div>
        </div>
        <p class="bilan-profile-desc">${profile.description}</p>
      </div>

      <h3 class="bilan-dims-title">Le détail par dimension</h3>
      <div class="bilan-dim-list">
        ${DIM_ORDER.map((d) => {
          const dim = BILAN_DIMENSIONS[d];
          const pct = dimPct[d];
          const status = bilanStatusFor(pct);
          return `
          <div class="bilan-dim-row">
            <div class="bilan-dim-icon">${iconSvg(dim.icon)}</div>
            <div class="bilan-dim-name">${dim.label}</div>
            <div class="bilan-dim-bar-outer"><div class="bilan-dim-bar-inner ${status.css}" data-target="${pct}"></div></div>
            <div class="bilan-dim-right">
              <span class="status-chip ${status.css}">${status.label}</span>
              <span class="bilan-dim-pct">${pct}%</span>
            </div>
          </div>`;
        }).join("")}
      </div>

      ${
        priorityDims.length
          ? `<div class="bilan-priority">
              <h3>🎯 Tes priorités du moment</h3>
              ${priorityDims
                .map((d) => {
                  const dim = BILAN_DIMENSIONS[d];
                  return `<div class="bilan-priority-item">
                    <span class="em">${dim.emoji}</span>
                    <div><strong>${dim.label}</strong><p>${dim.lowTip}</p></div>
                  </div>`;
                })
                .join("")}
            </div>`
          : `<div class="bilan-priority" style="background:var(--sage-light);border-color:var(--sage)">
              <h3 style="color:var(--forest-dark)">🎉 Rien à signaler en priorité</h3>
              <p style="margin:0;color:var(--ink-soft)">Tous tes indicateurs sont au vert ou presque : continue sur cette lancée, c'est déjà très solide.</p>
            </div>`
      }

      <h3 class="bilan-advice-title">Tous les conseils, dimension par dimension</h3>
      <div class="accordion-list" data-accordion="single">
        ${DIM_ORDER.map((d, i) => {
          const dim = BILAN_DIMENSIONS[d];
          const pct = dimPct[d];
          const tip = pct < 60 ? dim.lowTip : dim.highTip;
          return `
          <div class="accordion-item${i === 0 ? " open" : ""}">
            <button class="accordion-trigger">
              <span>${dim.emoji} ${dim.label} — ${pct}%</span>
              <span class="plus"></span>
            </button>
            <div class="accordion-panel" style="${i === 0 ? "" : "max-height:0"}">
              <p>${tip}</p>
            </div>
          </div>`;
        }).join("")}
      </div>

      ${buildProductSection(priorityDims.length ? priorityDims : sortedDims.slice(0, 3))}

      <div class="bilan-actions">
        <button class="btn btn-secondary" id="bilanCopyBtn">📋 Copier mon résultat</button>
        <button class="btn btn-primary" id="bilanRestartBtn">🔄 Refaire le bilan</button>
      </div>
      <p class="bilan-disclaimer">Ce bilan est ludique et informatif : il ne pose aucun diagnostic et ne remplace jamais l'avis d'un professionnel de santé. Écoute toujours ton corps en priorité.</p>
      <div class="bilan-copied-toast" id="bilanToast">Résultat copié ✅</div>
    `;

    // Anime la barre de progression circulaire + le chiffre
    requestAnimationFrame(() => {
      document.getElementById("bilanRingCircle").setAttribute("stroke-dashoffset", ringOffset(overall).toFixed(1));
      animateNumber(document.getElementById("bilanRingNum"), overall, 1100);
      resultsSection.querySelectorAll(".bilan-dim-bar-inner").forEach((bar) => {
        const target = bar.dataset.target;
        setTimeout(() => (bar.style.width = target + "%"), 150);
      });
    });

    if (typeof initAccordions === "function") initAccordions();

    document.getElementById("bilanRestartBtn").addEventListener("click", restart);
    document.getElementById("bilanCopyBtn").addEventListener("click", () => copyResult(profile, overall, dimPct));

    resultsSection.querySelectorAll("[data-add-cart]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (typeof LumeaCart !== "undefined") LumeaCart.add(Number(btn.dataset.addCart));
      });
    });

    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function buildProductSection(dims) {
    if (typeof LUMEA_PRODUCTS === "undefined") return "";
    const products = dims
      .map((d) => BILAN_DIMENSIONS[d].productSlug)
      .filter(Boolean)
      .map((slug) => LUMEA_PRODUCTS.find((p) => p.slug === slug))
      .filter(Boolean)
      .slice(0, 3);
    if (!products.length) return "";
    const colorFor = { green: "#3f8f8a", indigo: "#3d6478", gold: "#cea968", terracotta: "#e0855f" };
    return `
      <h3 class="bilan-products-title">Nos produits qui peuvent t'accompagner</h3>
      <p class="bilan-products-sub">En lien avec tes priorités du moment — 100% facultatif, ton bilan reste valable sans rien acheter 🌿</p>
      <div class="bilan-product-grid">
        ${products
          .map(
            (p) => `
          <div class="bilan-product-card">
            <div class="bilan-product-visual" style="background:${colorFor[p.theme] || "#4fa8ae"}">${p.name.charAt(0)}</div>
            <div class="tag">${p.categoryLabel}</div>
            <h4>${p.name}</h4>
            <p class="desc">${p.tagline}</p>
            <div class="price">${typeof lumeaFormatPrice === "function" ? lumeaFormatPrice(p.price) : p.price + " €"}</div>
            <div style="display:flex;gap:8px;flex-direction:column">
              <button class="btn btn-primary btn-sm btn-block" data-add-cart="${p.id}">Ajouter au panier</button>
              <a href="produit.html?slug=${p.slug}" class="btn btn-secondary btn-sm btn-block">Voir la fiche</a>
            </div>
          </div>`
          )
          .join("")}
      </div>
    `;
  }

  function copyResult(profile, overall, dimPct) {
    const lines = [
      `Mon Bilan Bien-être LUMÉA : ${profile.emoji} ${profile.name} (${overall}/100)`,
      ...DIM_ORDER.map((d) => `• ${BILAN_DIMENSIONS[d].label} : ${dimPct[d]}%`),
      "Fais ton bilan sur le site LUMÉA 🌿"
    ];
    const text = lines.join("\n");
    const toast = document.getElementById("bilanToast");
    const show = () => {
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(show).catch(show);
    } else {
      show();
    }
  }

  function restart() {
    Object.keys(answers).forEach((k) => delete answers[k]);
    resultsSection.classList.remove("show");
    resultsSection.innerHTML = "";
    quizSection.style.display = "";
    render();
    introEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  startBtn.addEventListener("click", () => {
    introEl.style.display = "none";
    quizSection.style.display = "";
    render();
  });

  // On reste sur l'écran d'intro tant que l'utilisateur n'a pas cliqué "Commencer".
  quizSection.style.display = "none";
  render();
});
