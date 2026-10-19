/* =========================================================
   LUMÉA — Quiz bien-être interactif
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const stepsWrap = document.getElementById("quizSteps");
  const progressFill = document.getElementById("quizProgressFill");
  if (!stepsWrap) return;

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

  const answers = {};
  let currentStep = 0;
  const totalSteps = LUMEA_QUIZ.length + 1; // + result step

  function iconSvg(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.leaf}</svg>`;
  }

  function buildQuestionStep(q, index) {
    const step = document.createElement("div");
    step.className = "quiz-step";
    step.dataset.step = index;
    step.innerHTML = `
      <p class="quiz-step-label">Question ${index + 1} / ${LUMEA_QUIZ.length}</p>
      <h2 class="quiz-question">${q.question}</h2>
      <p class="quiz-subtitle">${q.subtitle}</p>
      <div class="quiz-options">
        ${q.options
          .map(
            (opt) => `
          <button class="quiz-option" data-value="${opt.value}" data-qid="${q.id}">
            <span class="quiz-option-icon">${iconSvg(opt.icon)}</span>
            <span>${opt.label}</span>
          </button>`
          )
          .join("")}
      </div>
      <div class="quiz-nav">
        <button class="quiz-back" data-back>← Retour</button>
        <div class="quiz-dots">${LUMEA_QUIZ.map((_, i) => `<span class="${i === index ? "active" : ""}"></span>`).join("")}</div>
        ${q.multi ? `<button class="btn btn-primary btn-sm" data-next-multi>Continuer →</button>` : `<span style="width:60px"></span>`}
      </div>
    `;
    return step;
  }

  function render() {
    stepsWrap.innerHTML = "";
    LUMEA_QUIZ.forEach((q, i) => stepsWrap.appendChild(buildQuestionStep(q, i)));

    const resultStep = document.createElement("div");
    resultStep.className = "quiz-step";
    resultStep.dataset.step = LUMEA_QUIZ.length;
    resultStep.innerHTML = `<div class="quiz-result" id="quizResultContent"></div>`;
    stepsWrap.appendChild(resultStep);

    attachEvents();
    goToStep(0);
  }

  function attachEvents() {
    stepsWrap.querySelectorAll(".quiz-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        const qid = btn.dataset.qid;
        const question = LUMEA_QUIZ.find((q) => q.id === qid);

        if (question.multi) {
          btn.classList.toggle("selected");
          const selected = Array.from(
            btn.closest(".quiz-options").querySelectorAll(".quiz-option.selected")
          ).map((b) => b.dataset.value);
          answers[qid] = selected;
        } else {
          btn.closest(".quiz-options").querySelectorAll(".quiz-option").forEach((b) => b.classList.remove("selected"));
          btn.classList.add("selected");
          answers[qid] = [btn.dataset.value];
          setTimeout(() => goToStep(currentStep + 1), 350);
        }
      });
    });

    stepsWrap.querySelectorAll("[data-next-multi]").forEach((btn) => {
      btn.addEventListener("click", () => goToStep(currentStep + 1));
    });

    stepsWrap.querySelectorAll("[data-back]").forEach((btn) => {
      btn.addEventListener("click", () => goToStep(currentStep - 1));
    });
  }

  function goToStep(index) {
    if (index < 0) return;
    currentStep = index;
    const steps = stepsWrap.querySelectorAll(".quiz-step");
    steps.forEach((s) => s.classList.remove("active"));
    steps[index].classList.add("active");

    const backBtn = steps[index].querySelector("[data-back]");
    if (backBtn) backBtn.classList.toggle("show", index > 0);

    progressFill.style.width = `${((index + 1) / totalSteps) * 100}%`;

    if (index === LUMEA_QUIZ.length) {
      showResult();
    }
  }

  function computeResult() {
    const allTags = Object.values(answers).flat();
    const scores = LUMEA_PRODUCTS.map((p) => {
      const score = p.quizTags.reduce((sum, tag) => sum + (allTags.includes(tag) ? 1 : 0), 0);
      return { product: p, score };
    });
    scores.sort((a, b) => b.score - a.score || b.product.rating - a.product.rating);
    return scores[0].product;
  }

  function showResult() {
    const product = computeResult();
    const content = document.getElementById("quizResultContent");
    content.innerHTML = `
      <div class="quiz-result-icon">🌿</div>
      <h3>Votre complément idéal a été trouvé !</h3>
      <p>D'après vos réponses, voici la formule LUMÉA la plus adaptée à vos besoins.</p>
      <div class="quiz-result-card">
        <div class="quiz-result-visual theme-${product.theme}" style="background:${
      product.theme === "green" ? "#3f8f8a" : product.theme === "indigo" ? "#3d6478" : product.theme === "gold" ? "#cea968" : "#e0855f"
    }">${product.name.charAt(0)}</div>
        <div class="quiz-result-info">
          <h4>${product.name}</h4>
          <p>${product.tagline}</p>
          <div class="quiz-result-price">${lumeaFormatPrice(product.price)}</div>
        </div>
      </div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center">
        <button class="btn btn-primary" id="quizAddToCart">Ajouter au panier</button>
        <a href="produit.html?slug=${product.slug}" class="btn btn-secondary">Voir la fiche produit</a>
      </div>
      <button class="quiz-restart" id="quizRestart">Recommencer le quiz</button>
    `;

    document.getElementById("quizAddToCart").addEventListener("click", () => LumeaCart.add(product.id));
    document.getElementById("quizRestart").addEventListener("click", () => {
      Object.keys(answers).forEach((k) => delete answers[k]);
      render();
    });
  }

  render();
});
