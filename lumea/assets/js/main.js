/* =========================================================
   LUMÉA — Comportements partagés (nav, animations, UI)
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initYear();
  initMobileNav();
  initHeaderScroll();
  initScrollReveal();
  initCounters();
  initBackToTop();
  initAnnouncementBar();
  initNewsletterForms();
  initAccordions();
  initTestimonialCarousel();
  initHeroParticles();
  initCustomCursor();
  initTilt();
});

/* ---------- Footer year ---------- */
function initYear() {
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
}

/* ---------- Mobile nav ---------- */
function initMobileNav() {
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-menu");
  const overlay = document.querySelector(".nav-overlay");
  if (!toggle || !menu) return;

  const close = () => {
    toggle.classList.remove("active");
    menu.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
    document.body.classList.remove("no-scroll");
  };

  toggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("open");
    toggle.classList.toggle("active", isOpen);
    if (overlay) overlay.classList.toggle("open", isOpen);
    document.body.classList.toggle("no-scroll", isOpen);
  });

  if (overlay) overlay.addEventListener("click", close);
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
}

/* ---------- Header shrink + progress on scroll ---------- */
function initHeaderScroll() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  let lastY = window.scrollY;

  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle("scrolled", y > 40);
    lastY = y;

    const progress = document.querySelector(".scroll-progress");
    if (progress) {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const pct = height > 0 ? (y / height) * 100 : 0;
      progress.style.width = pct + "%";
    }
  };
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* ---------- Scroll reveal via IntersectionObserver ---------- */
function initScrollReveal() {
  const targets = document.querySelectorAll("[data-reveal]");
  if (!targets.length) return;

  if (!("IntersectionObserver" in window)) {
    targets.forEach((t) => t.classList.add("revealed"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const delay = entry.target.dataset.revealDelay || 0;
          setTimeout(() => entry.target.classList.add("revealed"), Number(delay));
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
  );

  targets.forEach((t) => observer.observe(t));
}

/* ---------- Animated counters ---------- */
function initCounters() {
  const counters = document.querySelectorAll("[data-counter]");
  if (!counters.length) return;

  const animate = (el) => {
    const target = parseFloat(el.dataset.counter);
    const decimals = el.dataset.counter.includes(".") ? el.dataset.counter.split(".")[1].length : 0;
    const duration = 1600;
    const start = performance.now();

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = target * eased;
      el.textContent = value.toFixed(decimals).replace(".", ",");
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toFixed(decimals).replace(".", ",");
    };
    requestAnimationFrame(step);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );
  counters.forEach((c) => observer.observe(c));
}

/* ---------- Back to top ---------- */
function initBackToTop() {
  const btn = document.querySelector(".back-to-top");
  if (!btn) return;
  document.addEventListener(
    "scroll",
    () => btn.classList.toggle("show", window.scrollY > 600),
    { passive: true }
  );
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

/* ---------- Announcement bar dismiss ---------- */
function initAnnouncementBar() {
  const bar = document.querySelector(".announcement-bar");
  if (!bar) return;
  if (sessionStorage.getItem("lumea_announcement_closed")) {
    bar.style.display = "none";
    document.body.classList.remove("has-announcement");
    return;
  }
  const closeBtn = bar.querySelector(".announcement-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      bar.style.maxHeight = "0px";
      bar.style.opacity = "0";
      document.body.classList.remove("has-announcement");
      sessionStorage.setItem("lumea_announcement_closed", "1");
      setTimeout(() => (bar.style.display = "none"), 300);
    });
  }
}

/* ---------- Newsletter forms ---------- */
function initNewsletterForms() {
  document.querySelectorAll("[data-newsletter-form]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const success = form.querySelector(".form-success");
      const isValid = input && input.value.includes("@") && input.value.includes(".");

      if (!isValid) {
        input.classList.add("shake");
        setTimeout(() => input.classList.remove("shake"), 500);
        return;
      }

      form.classList.add("submitted");
      if (success) success.textContent = "Merci ! Votre code -10% : LUMEA10";
      input.value = "";
    });
  });
}

/* ---------- Accordions (FAQ, product tabs) ---------- */
function initAccordions() {
  document.querySelectorAll("[data-accordion]").forEach((group) => {
    const items = group.querySelectorAll(".accordion-item");
    items.forEach((item) => {
      const trigger = item.querySelector(".accordion-trigger");
      const panel = item.querySelector(".accordion-panel");
      if (!trigger || !panel) return;
      trigger.addEventListener("click", () => {
        const isOpen = item.classList.contains("open");
        if (group.dataset.accordion === "single") {
          items.forEach((i) => {
            i.classList.remove("open");
            i.querySelector(".accordion-panel").style.maxHeight = null;
          });
        }
        if (!isOpen) {
          item.classList.add("open");
          panel.style.maxHeight = panel.scrollHeight + "px";
        } else {
          item.classList.remove("open");
          panel.style.maxHeight = null;
        }
      });
    });
  });
}

/* ---------- Testimonial carousel ---------- */
function initTestimonialCarousel() {
  const track = document.querySelector("[data-testimonial-track]");
  if (!track) return;

  track.innerHTML = LUMEA_TESTIMONIALS.map(
    (t) => `
    <article class="testimonial-card">
      <div class="testimonial-stars">${"★".repeat(t.rating)}${"☆".repeat(5 - t.rating)}</div>
      <p class="testimonial-text">« ${t.text} »</p>
      <div class="testimonial-author">
        <div class="testimonial-avatar">${t.name.charAt(0)}</div>
        <div>
          <p class="testimonial-name">${t.name}</p>
          <p class="testimonial-role">${t.role} · ${t.product}</p>
        </div>
      </div>
    </article>`
  ).join("");

  const dotsWrap = document.querySelector("[data-testimonial-dots]");
  let index = 0;
  const total = LUMEA_TESTIMONIALS.length;

  if (dotsWrap) {
    dotsWrap.innerHTML = LUMEA_TESTIMONIALS.map((_, i) => `<button class="carousel-dot" data-i="${i}" aria-label="Avis ${i + 1}"></button>`).join("");
  }

  function update() {
    const card = track.querySelector(".testimonial-card");
    const cardWidth = card ? card.getBoundingClientRect().width + 24 : 0;
    track.style.transform = `translateX(-${index * cardWidth}px)`;
    if (dotsWrap) {
      dotsWrap.querySelectorAll(".carousel-dot").forEach((d, i) => d.classList.toggle("active", i === index));
    }
  }

  function go(delta) {
    index = (index + delta + total) % total;
    update();
  }

  document.querySelector("[data-testimonial-prev]")?.addEventListener("click", () => go(-1));
  document.querySelector("[data-testimonial-next]")?.addEventListener("click", () => go(1));
  dotsWrap?.addEventListener("click", (e) => {
    const btn = e.target.closest(".carousel-dot");
    if (btn) {
      index = Number(btn.dataset.i);
      update();
    }
  });

  window.addEventListener("resize", update);

  let autoplay = setInterval(() => go(1), 5500);
  const carousel = document.querySelector(".testimonials-carousel");
  if (carousel) {
    carousel.addEventListener("mouseenter", () => clearInterval(autoplay));
    carousel.addEventListener("mouseleave", () => (autoplay = setInterval(() => go(1), 5500)));
  }

  // swipe support
  let startX = 0;
  track.addEventListener("touchstart", (e) => (startX = e.touches[0].clientX), { passive: true });
  track.addEventListener(
    "touchend",
    (e) => {
      const diff = e.changedTouches[0].clientX - startX;
      if (diff > 50) go(-1);
      else if (diff < -50) go(1);
    },
    { passive: true }
  );

  setTimeout(update, 100);
}

/* ---------- Hero particles (floating natural motes) ---------- */
function initHeroParticles() {
  const canvas = document.getElementById("heroParticles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let particles = [];
  let width, height;
  let animationId;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = canvas.width = rect.width * devicePixelRatio;
    height = canvas.height = rect.height * devicePixelRatio;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
  }

  function createParticles() {
    const count = Math.min(46, Math.floor((width * height) / 60000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: (Math.random() * 2 + 1) * devicePixelRatio,
      speedY: (Math.random() * 0.35 + 0.1) * devicePixelRatio,
      speedX: (Math.random() - 0.5) * 0.25 * devicePixelRatio,
      opacity: Math.random() * 0.5 + 0.15,
      hue: Math.random() > 0.5 ? "224,133,95" : "79,168,174"
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    particles.forEach((p) => {
      p.y -= p.speedY;
      p.x += p.speedX;
      if (p.y < -10) {
        p.y = height + 10;
        p.x = Math.random() * width;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.hue}, ${p.opacity})`;
      ctx.fill();
    });
    animationId = requestAnimationFrame(draw);
  }

  resize();
  createParticles();
  if (!prefersReducedMotion) draw();
  else {
    draw();
    cancelAnimationFrame(animationId);
  }

  window.addEventListener("resize", () => {
    resize();
    createParticles();
  });
}

/* ---------- Custom cursor (desktop, hover-capable devices only) ---------- */
function initCustomCursor() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const dot = document.createElement("div");
  dot.className = "cursor-dot";
  document.body.appendChild(dot);

  let mx = 0,
    my = 0,
    cx = 0,
    cy = 0;
  document.addEventListener("mousemove", (e) => {
    mx = e.clientX;
    my = e.clientY;
    dot.classList.add("active");
  });

  function loop() {
    cx += (mx - cx) * 0.18;
    cy += (my - cy) * 0.18;
    dot.style.transform = `translate(${cx}px, ${cy}px)`;
    requestAnimationFrame(loop);
  }
  loop();

  document.querySelectorAll("a, button, .tilt, input, textarea, .quiz-option").forEach((el) => {
    el.addEventListener("mouseenter", () => dot.classList.add("grow"));
    el.addEventListener("mouseleave", () => dot.classList.remove("grow"));
  });
}

/* ---------- Subtle 3D tilt on product visuals ---------- */
function initTilt() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  document.querySelectorAll(".tilt").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `perspective(800px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateZ(10px)`;
    });
    el.addEventListener("mouseleave", () => {
      el.style.transform = "";
    });
  });
}
