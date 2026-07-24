(function () {
  "use strict";

  var state = window.__ADMIN_DATA__ || { settings: {}, stats: [], products: [] };
  var CSRF = window.__CSRF__ || "";
  var BASE = window.__BASE__ || "";

  // ---------- helpers ----------

  function api(url, method, body) {
    var opts = {
      method: method || "GET",
      headers: { "X-CSRF-Token": CSRF },
    };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return fetch(BASE + url, opts).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || "Une erreur est survenue.");
        return data;
      });
    });
  }

  function showStatus(key, message, isError) {
    var el = document.querySelector('[data-status-for="' + key + '"]');
    if (!el) return;
    el.textContent = message;
    el.className = "status-msg " + (isError ? "error" : "ok");
    if (!isError) {
      setTimeout(function () {
        if (el.textContent === message) el.textContent = "";
      }, 3000);
    }
  }

  function populateForm(form, data) {
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || !(el.name in data)) return;
      if (el.type === "checkbox") el.checked = !!data[el.name];
      else el.value = data[el.name] == null ? "" : data[el.name];
    });
  }

  function serializeForm(form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.type === "checkbox") out[el.name] = el.checked;
      else if (el.type !== "file") out[el.name] = el.value;
    });
    return out;
  }

  // ---------- tabs ----------

  var tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      tabBtns.forEach(function (b) { b.classList.remove("active"); });
      document.querySelectorAll(".admin-panel").forEach(function (p) { p.classList.remove("active"); });
      btn.classList.add("active");
      document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
    });
  });

  // ---------- infos & textes (plain settings forms) ----------

  ["form-infos", "form-textes"].forEach(function (id) {
    var form = document.getElementById(id);
    if (!form) return;
    populateForm(form, state.settings);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      api("/admin/api/settings", "POST", serializeForm(form))
        .then(function (data) {
          state.settings = data.settings;
          showStatus(id, "Enregistré ✓", false);
        })
        .catch(function (err) { showStatus(id, err.message, true); });
    });
  });

  // ---------- apparence ----------

  (function initAppearance() {
    var form = document.getElementById("form-apparence");
    if (!form) return;
    populateForm(form, state.settings);

    form.querySelectorAll("[data-pair]").forEach(function (colorInput) {
      var key = colorInput.dataset.pair;
      var textInput = form.querySelector('input[type="text"][name="' + key + '"]');
      if (state.settings[key]) colorInput.value = state.settings[key];
      colorInput.addEventListener("input", function () { textInput.value = colorInput.value; });
      textInput.addEventListener("input", function () {
        if (/^#[0-9a-fA-F]{6}$/.test(textInput.value)) colorInput.value = textInput.value;
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      api("/admin/api/settings", "POST", serializeForm(form))
        .then(function (data) {
          state.settings = data.settings;
          showStatus("form-apparence", "Enregistré ✓", false);
        })
        .catch(function (err) { showStatus("form-apparence", err.message, true); });
    });
  })();

  // ---------- chiffres clés ----------

  (function initStats() {
    var container = document.getElementById("stats-fields");
    var form = document.getElementById("form-chiffres");
    if (!container || !form) return;

    function render() {
      container.innerHTML = "";
      var stats = state.stats.length ? state.stats : [{}, {}, {}, {}];
      stats.forEach(function (stat, i) {
        var wrap = document.createElement("div");
        wrap.className = "field";
        wrap.innerHTML =
          '<label>Chiffre ' + (i + 1) + '</label>' +
          '<input type="text" data-stat-number="' + i + '" placeholder="ex. 1958">' +
          '<label style="margin-top:.4rem;">Légende ' + (i + 1) + '</label>' +
          '<input type="text" data-stat-label="' + i + '" placeholder="ex. Année de fondation">';
        container.appendChild(wrap);
        wrap.querySelector("[data-stat-number]").value = stat.number || "";
        wrap.querySelector("[data-stat-label]").value = stat.label || "";
      });
    }
    render();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var stats = [];
      var count = Math.max(state.stats.length, 4);
      for (var i = 0; i < count; i++) {
        var numberEl = container.querySelector('[data-stat-number="' + i + '"]');
        var labelEl = container.querySelector('[data-stat-label="' + i + '"]');
        if (!numberEl) continue;
        stats.push({ number: numberEl.value, label: labelEl.value });
      }
      api("/admin/api/stats", "POST", { stats: stats })
        .then(function (data) {
          state.stats = data.stats;
          showStatus("form-chiffres", "Enregistré ✓", false);
        })
        .catch(function (err) { showStatus("form-chiffres", err.message, true); });
    });
  })();

  // ---------- produits ----------

  (function initProducts() {
    var list = document.getElementById("product-list");
    var modalOverlay = document.getElementById("product-modal");
    var productForm = document.getElementById("product-form");
    var modalTitle = document.getElementById("product-modal-title");
    if (!list || !modalOverlay) return;

    function renderList() {
      list.innerHTML = "";
      if (!state.products.length) {
        list.innerHTML = '<p class="panel-hint">Aucun produit pour le moment.</p>';
        return;
      }
      state.products.forEach(function (p, index) {
        var row = document.createElement("div");
        row.className = "product-row" + (p.published ? "" : " unpublished");
        row.innerHTML =
          (p.image_url
            ? '<img src="' + p.image_url + '" alt="">'
            : '<div class="ph"></div>') +
          '<div class="info"><strong></strong><span></span></div>' +
          '<span class="badge">' + (p.published ? "Publié" : "Masqué") + '</span>' +
          '<div class="product-actions">' +
          '<button type="button" data-act="up" title="Monter">↑</button>' +
          '<button type="button" data-act="down" title="Descendre">↓</button>' +
          '<button type="button" data-act="edit" title="Modifier">✎</button>' +
          '<button type="button" data-act="delete" title="Supprimer">✕</button>' +
          "</div>";
        row.querySelector(".info strong").textContent = p.title;
        row.querySelector(".info span").textContent = p.description || "";

        row.querySelector('[data-act="up"]').disabled = index === 0;
        row.querySelector('[data-act="down"]').disabled = index === state.products.length - 1;

        row.querySelector('[data-act="up"]').addEventListener("click", function () { move(index, -1); });
        row.querySelector('[data-act="down"]').addEventListener("click", function () { move(index, 1); });
        row.querySelector('[data-act="edit"]').addEventListener("click", function () { openModal(p); });
        row.querySelector('[data-act="delete"]').addEventListener("click", function () { removeProduct(p); });

        list.appendChild(row);
      });
    }
    renderList();

    function move(index, dir) {
      var target = index + dir;
      if (target < 0 || target >= state.products.length) return;
      var ids = state.products.map(function (p) { return p.id; });
      var tmp = ids[index];
      ids[index] = ids[target];
      ids[target] = tmp;
      api("/admin/api/products/reorder", "POST", { ids: ids })
        .then(function (data) {
          state.products = data.products;
          renderList();
        })
        .catch(function (err) { showStatus("products", err.message, true); });
    }

    function removeProduct(p) {
      if (!confirm('Supprimer "' + p.title + '" ?')) return;
      api("/admin/api/products/" + p.id, "DELETE")
        .then(function (data) {
          state.products = data.products;
          renderList();
          showStatus("products", "Produit supprimé", false);
        })
        .catch(function (err) { showStatus("products", err.message, true); });
    }

    function openModal(product) {
      productForm.reset();
      var preview = productForm.querySelector(".product-image-preview");
      var ph = productForm.querySelector(".product-image-ph");
      modalTitle.textContent = product ? "Modifier le produit" : "Ajouter un produit";
      productForm.elements.id.value = product ? product.id : "";
      productForm.elements.title.value = product ? product.title : "";
      productForm.elements.tag.value = product ? product.tag : "";
      productForm.elements.tag_style.value = product ? product.tag_style : "default";
      productForm.elements.description.value = product ? product.description : "";
      productForm.elements.items.value = product && product.items ? product.items.join("\n") : "";
      productForm.elements.image_url.value = product ? product.image_url || "" : "";
      productForm.elements.published.checked = product ? !!product.published : true;

      if (productForm.elements.image_url.value) {
        preview.src = productForm.elements.image_url.value;
        preview.style.display = "";
        ph.style.display = "none";
      } else {
        preview.style.display = "none";
        ph.style.display = "";
      }
      modalOverlay.classList.add("open");
    }

    function closeModal() {
      modalOverlay.classList.remove("open");
    }

    document.getElementById("btn-add-product").addEventListener("click", function () { openModal(null); });
    document.getElementById("btn-cancel-product").addEventListener("click", closeModal);
    modalOverlay.addEventListener("click", function (e) {
      if (e.target === modalOverlay) closeModal();
    });

    var uploadInput = productForm.querySelector('[data-upload-for="products"]');
    uploadInput.addEventListener("change", function () {
      var file = uploadInput.files[0];
      if (!file) return;
      var formData = new FormData();
      formData.append("image", file);
      fetch(BASE + "/admin/api/upload", {
        method: "POST",
        headers: { "X-CSRF-Token": CSRF },
        body: formData,
      })
        .then(function (res) { return res.json().then(function (d) { if (!res.ok) throw new Error(d.error); return d; }); })
        .then(function (data) {
          productForm.elements.image_url.value = data.url;
          var preview = productForm.querySelector(".product-image-preview");
          var ph = productForm.querySelector(".product-image-ph");
          preview.src = data.url;
          preview.style.display = "";
          ph.style.display = "none";
        })
        .catch(function (err) { showStatus("product-form", err.message, true); });
    });

    productForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = productForm.elements.id.value;
      var payload = {
        title: productForm.elements.title.value,
        tag: productForm.elements.tag.value,
        tag_style: productForm.elements.tag_style.value,
        description: productForm.elements.description.value,
        items: productForm.elements.items.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean),
        image_url: productForm.elements.image_url.value,
        published: productForm.elements.published.checked,
      };
      var req = id ? api("/admin/api/products/" + id, "PUT", payload) : api("/admin/api/products", "POST", payload);
      req
        .then(function (data) {
          state.products = data.products;
          renderList();
          closeModal();
          showStatus("products", "Enregistré ✓", false);
        })
        .catch(function (err) { showStatus("product-form", err.message, true); });
    });
  })();

  // ---------- mot de passe ----------

  (function initPassword() {
    var form = document.getElementById("form-password");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      api("/admin/api/change-password", "POST", serializeForm(form))
        .then(function () {
          form.reset();
          showStatus("form-password", "Mot de passe mis à jour ✓", false);
        })
        .catch(function (err) { showStatus("form-password", err.message, true); });
    });
  })();
})();
