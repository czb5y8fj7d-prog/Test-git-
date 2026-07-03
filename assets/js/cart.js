/* =========================================================
   LUMÉA — Panier (localStorage) + tiroir panier + toasts
   ========================================================= */

const LumeaCart = (() => {
  const STORAGE_KEY = "lumea_cart_v1";

  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function write(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    renderAll();
  }

  function add(productId, qty = 1) {
    const items = read();
    const existing = items.find((i) => i.id === productId);
    if (existing) {
      existing.qty += qty;
    } else {
      items.push({ id: productId, qty });
    }
    write(items);
    const product = lumeaGetProductById(productId);
    if (product) showToast(`${product.name} ajouté au panier`);
    openDrawer();
  }

  function updateQty(productId, qty) {
    let items = read();
    if (qty <= 0) {
      items = items.filter((i) => i.id !== productId);
    } else {
      const existing = items.find((i) => i.id === productId);
      if (existing) existing.qty = qty;
    }
    write(items);
  }

  function remove(productId) {
    const items = read().filter((i) => i.id !== productId);
    write(items);
  }

  function clear() {
    write([]);
  }

  function count() {
    return read().reduce((sum, i) => sum + i.qty, 0);
  }

  function subtotal() {
    return read().reduce((sum, i) => {
      const p = lumeaGetProductById(i.id);
      return p ? sum + p.price * i.qty : sum;
    }, 0);
  }

  function showToast(message) {
    let toast = document.querySelector(".lumea-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "lumea-toast";
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span class="lumea-toast-icon">✓</span><span>${message}</span>`;
    toast.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function openDrawer() {
    const drawer = document.getElementById("cartDrawer");
    const overlay = document.getElementById("cartOverlay");
    if (drawer && overlay) {
      drawer.classList.add("open");
      overlay.classList.add("open");
      document.body.classList.add("no-scroll");
    }
  }

  function closeDrawer() {
    const drawer = document.getElementById("cartDrawer");
    const overlay = document.getElementById("cartOverlay");
    if (drawer && overlay) {
      drawer.classList.remove("open");
      overlay.classList.remove("open");
      document.body.classList.remove("no-scroll");
    }
  }

  function renderBadge() {
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      const c = count();
      el.textContent = c;
      el.classList.toggle("show", c > 0);
    });
  }

  function renderDrawer() {
    const body = document.getElementById("cartDrawerBody");
    const footer = document.getElementById("cartDrawerFooter");
    if (!body) return;
    const items = read();

    if (items.length === 0) {
      body.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-icon">🌿</div>
          <p>Votre panier est vide pour le moment.</p>
          <a href="produits.html" class="btn btn-primary">Découvrir nos produits</a>
        </div>`;
      if (footer) footer.style.display = "none";
      return;
    }

    if (footer) footer.style.display = "block";

    body.innerHTML = items
      .map((item) => {
        const p = lumeaGetProductById(item.id);
        if (!p) return "";
        return `
        <div class="cart-item" data-id="${p.id}">
          <div class="cart-item-visual theme-${p.theme}"><span>${p.name.charAt(0)}</span></div>
          <div class="cart-item-info">
            <p class="cart-item-name">${p.name}</p>
            <p class="cart-item-format">${p.format}</p>
            <div class="cart-item-controls">
              <button class="qty-btn" data-action="dec" aria-label="Diminuer la quantité">−</button>
              <span class="qty-value">${item.qty}</span>
              <button class="qty-btn" data-action="inc" aria-label="Augmenter la quantité">+</button>
              <button class="cart-item-remove" data-action="remove" aria-label="Retirer">Retirer</button>
            </div>
          </div>
          <div class="cart-item-price">${lumeaFormatPrice(p.price * item.qty)}</div>
        </div>`;
      })
      .join("");

    body.querySelectorAll(".cart-item").forEach((row) => {
      const id = Number(row.dataset.id);
      const item = items.find((i) => i.id === id);
      row.querySelector('[data-action="inc"]').addEventListener("click", () => updateQty(id, item.qty + 1));
      row.querySelector('[data-action="dec"]').addEventListener("click", () => updateQty(id, item.qty - 1));
      row.querySelector('[data-action="remove"]').addEventListener("click", () => remove(id));
    });

    const subtotalEls = document.querySelectorAll("[data-cart-subtotal]");
    subtotalEls.forEach((el) => (el.textContent = lumeaFormatPrice(subtotal())));

    const shippingNote = document.getElementById("cartShippingNote");
    if (shippingNote) {
      const remaining = 49 - subtotal();
      if (remaining > 0) {
        shippingNote.innerHTML = `Ajoutez <strong>${lumeaFormatPrice(remaining)}</strong> pour la livraison offerte 🌿`;
      } else {
        shippingNote.innerHTML = `🎉 Vous bénéficiez de la <strong>livraison offerte</strong> !`;
      }
    }
  }

  function renderAll() {
    renderBadge();
    renderDrawer();
  }

  function initUI() {
    document.querySelectorAll("[data-cart-open]").forEach((btn) => btn.addEventListener("click", openDrawer));
    document.querySelectorAll("[data-cart-close]").forEach((btn) => btn.addEventListener("click", closeDrawer));
    const overlay = document.getElementById("cartOverlay");
    if (overlay) overlay.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDrawer();
    });
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", initUI);

  return { add, updateQty, remove, clear, count, subtotal, openDrawer, closeDrawer, showToast, read };
})();
