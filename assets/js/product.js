/* =========================================================
   LUMÉA — Logique fiche produit (produit.html)
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const detailWrap = document.getElementById("productDetail");
  if (!detailWrap) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const product = lumeaGetProductBySlug(slug) || LUMEA_PRODUCTS[0];

  document.title = `${product.name} — LUMÉA`;
  document.getElementById("breadcrumbName").textContent = product.name;

  let qty = 1;
  let subscribe = false;

  function currentPrice() {
    return subscribe ? product.price * 0.9 : product.price;
  }

  function renderStars(rating) {
    const full = Math.round(rating);
    return "★".repeat(full) + "☆".repeat(5 - full);
  }

  detailWrap.innerHTML = `
    <div class="pd-gallery" data-reveal="left">
      <div class="pd-visual theme-${product.theme} tilt">
        <div class="product-jar" data-letter="${product.name.charAt(0)}" style="width:42%"></div>
      </div>
      <div class="pd-thumbs">
        ${["a", "b", "c", "d"].map((k, i) => `<div class="pd-thumb theme-${product.theme} ${i === 0 ? "active" : ""}" data-thumb="${i}"></div>`).join("")}
      </div>
    </div>
    <div class="pd-info" data-reveal="right">
      <p class="pd-category">${product.categoryLabel}</p>
      <h1 class="pd-title">${product.name}</h1>
      <p class="pd-tagline">${product.tagline}</p>
      <div class="pd-rating">
        <span class="stars">${renderStars(product.rating)}</span>
        <span>${product.rating} · ${product.reviews} avis vérifiés</span>
      </div>
      <div class="pd-price-row">
        <span class="pd-price" id="pdPrice">${lumeaFormatPrice(currentPrice())}</span>
        ${product.oldPrice ? `<span class="pd-price-old">${lumeaFormatPrice(product.oldPrice)}</span>` : ""}
        <span style="color:var(--ink-soft);font-size:0.85rem">${product.format}</span>
      </div>
      <div class="pd-badges">
        ${product.badges.map((b) => `<span class="badge">${b}</span>`).join("")}
      </div>

      <div class="purchase-options">
        <div class="purchase-option active" data-purchase="once">
          <div class="purchase-option-left">
            <span class="purchase-radio"></span>
            <div><strong>Achat unique</strong><small>Livré une fois</small></div>
          </div>
          <span>${lumeaFormatPrice(product.price)}</span>
        </div>
        <div class="purchase-option" data-purchase="subscribe">
          <div class="purchase-option-left">
            <span class="purchase-radio"></span>
            <div><strong>Abonnement mensuel</strong><small>Annulez à tout moment</small></div>
          </div>
          <div style="text-align:right">
            <span class="purchase-save">-10%</span>
            <div style="font-weight:600;margin-top:4px">${lumeaFormatPrice(product.price * 0.9)}</div>
          </div>
        </div>
      </div>

      <div class="qty-selector">
        <button class="qty-btn" id="pdQtyDec" aria-label="Diminuer">−</button>
        <span class="qty-value" id="pdQtyVal">1</span>
        <button class="qty-btn" id="pdQtyInc" aria-label="Augmenter">+</button>
      </div>

      <div class="pd-actions">
        <button class="btn btn-primary btn-block" id="pdAddBtn">Ajouter au panier — <span id="pdAddPrice">${lumeaFormatPrice(currentPrice())}</span></button>
      </div>

      <div class="pd-perks">
        <div class="pd-perk">🚚 Livraison offerte dès 49€</div>
        <div class="pd-perk">🔬 Testé en laboratoire indépendant</div>
        <div class="pd-perk">↩️ Satisfait ou remboursé 30 jours</div>
      </div>

      <div class="pd-tabs-nav">
        <button class="pd-tab-btn active" data-pdtab="desc">Description</button>
        <button class="pd-tab-btn" data-pdtab="comp">Composition</button>
        <button class="pd-tab-btn" data-pdtab="usage">Utilisation</button>
        <button class="pd-tab-btn" data-pdtab="avis">Avis (${product.reviews})</button>
      </div>
      <div class="pd-tab-panel active" data-pdpanel="desc">
        <p style="color:var(--ink-soft);margin-bottom:20px">${product.description}</p>
        <ul class="benefits-list">
          ${product.benefits.map((b) => `<li>${b}</li>`).join("")}
        </ul>
      </div>
      <div class="pd-tab-panel" data-pdpanel="comp">
        <div class="composition-list">
          ${product.composition.map((c) => `<div class="composition-row"><span>${c.name}</span><span>${c.value}</span></div>`).join("")}
        </div>
      </div>
      <div class="pd-tab-panel" data-pdpanel="usage">
        <p style="color:var(--ink-soft)">${product.usage}</p>
      </div>
      <div class="pd-tab-panel" data-pdpanel="avis">
        <div style="display:flex;flex-direction:column;gap:18px">
          ${LUMEA_TESTIMONIALS.slice(0, 3).map((t) => `
            <div style="padding-bottom:18px;border-bottom:1px solid var(--line)">
              <div class="testimonial-stars" style="margin-bottom:8px">${"★".repeat(t.rating)}${"☆".repeat(5 - t.rating)}</div>
              <p style="margin-bottom:8px">« ${t.text} »</p>
              <strong style="font-size:0.85rem">${t.name}</strong>
            </div>`).join("")}
        </div>
      </div>
    </div>
  `;

  initScrollReveal();
  initTilt();

  // Purchase option toggle
  detailWrap.querySelectorAll(".purchase-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      detailWrap.querySelectorAll(".purchase-option").forEach((o) => o.classList.remove("active"));
      opt.classList.add("active");
      subscribe = opt.dataset.purchase === "subscribe";
      updatePrice();
    });
  });

  function updatePrice() {
    document.getElementById("pdPrice").textContent = lumeaFormatPrice(currentPrice());
    document.getElementById("pdAddPrice").textContent = lumeaFormatPrice(currentPrice() * qty);
  }

  // Quantity
  document.getElementById("pdQtyInc").addEventListener("click", () => {
    qty++;
    document.getElementById("pdQtyVal").textContent = qty;
    updatePrice();
  });
  document.getElementById("pdQtyDec").addEventListener("click", () => {
    qty = Math.max(1, qty - 1);
    document.getElementById("pdQtyVal").textContent = qty;
    updatePrice();
  });

  // Tabs
  detailWrap.querySelectorAll(".pd-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      detailWrap.querySelectorAll(".pd-tab-btn").forEach((b) => b.classList.remove("active"));
      detailWrap.querySelectorAll(".pd-tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      detailWrap.querySelector(`[data-pdpanel="${btn.dataset.pdtab}"]`).classList.add("active");
    });
  });

  // Add to cart
  function addToCart() {
    LumeaCart.add(product.id, qty);
  }
  document.getElementById("pdAddBtn").addEventListener("click", addToCart);

  // Sticky add bar
  const stickyBar = document.getElementById("stickyAddBar");
  document.getElementById("stickyName").textContent = product.name;
  document.getElementById("stickyPrice").textContent = lumeaFormatPrice(product.price);
  document.getElementById("stickyJar").classList.add(`theme-${product.theme}`);
  document.getElementById("stickyJar").style.background =
    product.theme === "green" ? "#b6cba9" : product.theme === "indigo" ? "#b7bedb" : product.theme === "gold" ? "#e0bf7c" : "#e6ac7f";
  document.getElementById("stickyAddBtn").addEventListener("click", addToCart);

  const actionsBtn = document.getElementById("pdAddBtn");
  const observer = new IntersectionObserver(
    ([entry]) => stickyBar.classList.toggle("show", !entry.isIntersecting && window.scrollY > 300),
    { threshold: 0 }
  );
  observer.observe(actionsBtn);

  // Related products
  const related = LUMEA_PRODUCTS.filter((p) => p.id !== product.id && p.category === product.category);
  const fallback = LUMEA_PRODUCTS.filter((p) => p.id !== product.id && p.category !== product.category);
  const relatedList = [...related, ...fallback].slice(0, 3);

  document.getElementById("relatedProducts").innerHTML = relatedList
    .map(
      (p, i) => `
      <div class="product-card" data-reveal data-reveal-delay="${i * 100}">
        <div class="product-visual theme-${p.theme}">
          <div class="product-badges-float">${p.badges.slice(0, 1).map((b) => `<span class="badge">${b}</span>`).join("")}</div>
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
          <div class="product-footer"><div class="product-price">${lumeaFormatPrice(p.price)}</div></div>
        </div>
      </div>`
    )
    .join("");

  document.querySelectorAll("#relatedProducts [data-add-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      LumeaCart.add(Number(btn.dataset.addId));
    });
  });
  initScrollReveal();
});
