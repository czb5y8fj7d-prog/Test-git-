/* =========================================================
   LUMÉA — Logique boutique (produits.html)
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("shopGrid");
  const noResults = document.getElementById("noResults");
  const resultsCount = document.getElementById("resultsCount");
  const sortSelect = document.getElementById("sortSelect");
  const filterChips = document.querySelectorAll(".filter-chip");
  if (!grid) return;

  const params = new URLSearchParams(window.location.search);
  let activeFilter = params.get("cat") || "all";
  let activeSort = "popular";

  function cardMarkup(p, i) {
    return `
      <div class="product-card" data-reveal data-reveal-delay="${(i % 3) * 90}">
        <div class="product-visual theme-${p.theme}">
          <div class="product-badges-float">
            ${p.badges.slice(0, 2).map((b) => `<span class="badge">${b}</span>`).join("")}
            ${p.oldPrice ? '<span class="badge sale">Promo</span>' : ""}
          </div>
          <div class="product-jar" data-letter="${p.name.charAt(0)}"></div>
          <button class="quick-add" data-add-id="${p.id}" aria-label="Ajouter au panier">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
        <div class="product-body">
          <p class="product-category">${p.categoryLabel}</p>
          <h3 class="product-name"><a href="produit.html?slug=${p.slug}">${p.name}</a></h3>
          <p class="product-tagline">${p.tagline}</p>
          <div class="product-rating"><span class="stars">★★★★★</span> ${p.rating} (${p.reviews} avis)</div>
          <div class="product-footer">
            <div class="product-price">${lumeaFormatPrice(p.price)} ${p.oldPrice ? `<span class="old">${lumeaFormatPrice(p.oldPrice)}</span>` : ""}</div>
          </div>
        </div>
      </div>`;
  }

  function render() {
    let list = LUMEA_PRODUCTS.filter((p) => activeFilter === "all" || p.category === activeFilter);

    switch (activeSort) {
      case "price-asc":
        list = list.slice().sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list = list.slice().sort((a, b) => b.price - a.price);
        break;
      case "rating":
        list = list.slice().sort((a, b) => b.rating - a.rating);
        break;
      default:
        list = list.slice().sort((a, b) => b.reviews - a.reviews);
    }

    grid.style.opacity = "0";
    setTimeout(() => {
      grid.innerHTML = list.map(cardMarkup).join("");
      grid.style.opacity = "1";

      grid.querySelectorAll("[data-add-id]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          LumeaCart.add(Number(btn.dataset.addId));
        });
      });

      resultsCount.textContent = `${list.length} produit${list.length > 1 ? "s" : ""} trouvé${list.length > 1 ? "s" : ""}`;
      noResults.style.display = list.length === 0 ? "block" : "none";
      initScrollReveal();
    }, 180);
  }

  grid.style.transition = "opacity 0.25s ease";

  filterChips.forEach((chip) => {
    if (chip.dataset.filter === activeFilter) chip.classList.add("active");
    else chip.classList.remove("active");
    chip.addEventListener("click", () => {
      activeFilter = chip.dataset.filter;
      filterChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      render();
    });
  });

  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      activeSort = sortSelect.value;
      render();
    });
  }

  render();
});
