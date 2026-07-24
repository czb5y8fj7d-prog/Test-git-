<?php
require __DIR__ . '/functions.php';

// ---------- Routage ----------
// Toutes les requêtes passent par ce fichier (voir .htaccess). Tout ce qui
// commence par /admin est délégué à admin.php ; le reste affiche le site.

$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');
$requestPath = (string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = substr($requestPath, strlen($scriptDir));
if ($path === '' || $path === false) $path = '/';
if ($path !== '/') $path = rtrim($path, '/');

if ($path === '/admin' || strpos($path, '/admin/') === 0) {
    require __DIR__ . '/admin.php';
    exit;
}

if ($path !== '/') {
    http_response_code(404);
    echo 'Page introuvable.';
    exit;
}

// ---------- Données ----------

$settings = get_all_settings();
$stats = get_stats();
$products = get_published_products();
$base = base_path();

?><!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= e($settings['site_title']) ?></title>
<meta name="description" content="<?= e($settings['site_description']) ?>">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%23241d18%22/><text x=%2250%22 y=%2266%22 font-size=%2250%22 text-anchor=%22middle%22 fill=%22%23c9a35f%22 font-family=%22serif%22>ML</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500&family=Playfair+Display:wght@500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= e($base) ?>/assets/style.css">
<style>
:root {
  --burgundy: <?= e($settings['color_primary']) ?>;
  --burgundy-dark: color-mix(in srgb, <?= e($settings['color_primary']) ?> 80%, black);
  --burgundy-light: color-mix(in srgb, <?= e($settings['color_primary']) ?> 80%, white);
  --gold: <?= e($settings['color_accent']) ?>;
  --gold-dark: color-mix(in srgb, <?= e($settings['color_accent']) ?> 78%, black);
  --gold-light: color-mix(in srgb, <?= e($settings['color_accent']) ?> 80%, white);
  --cream: <?= e($settings['color_background']) ?>;
  --cream-2: color-mix(in srgb, <?= e($settings['color_background']) ?> 90%, black);
  --paper: color-mix(in srgb, <?= e($settings['color_background']) ?> 97%, white);
  --ink: <?= e($settings['color_text']) ?>;
  --ink-soft: color-mix(in srgb, <?= e($settings['color_text']) ?> 68%, white);
  --charcoal: <?= e($settings['color_text']) ?>;
}
</style>
</head>
<body>

<a class="skip-link" href="#main">Aller au contenu</a>

<!-- ============ HEADER ============ -->
<header class="site-header" id="site-header">
  <div class="header-inner">
    <a href="#top" class="brand">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="42" height="42">
          <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-width="1.4"/>
          <circle cx="32" cy="32" r="25" fill="none" stroke="currentColor" stroke-width="0.6"/>
          <text x="32" y="41" text-anchor="middle" font-family="Playfair Display, serif" font-size="21" fill="currentColor">ML</text>
        </svg>
      </span>
      <span class="brand-text">
        <strong><?= e($settings['brand_name']) ?></strong>
        <em><?= e($settings['brand_tagline']) ?></em>
      </span>
    </a>

    <nav class="main-nav" id="main-nav" aria-label="Navigation principale">
      <ul>
        <li><a href="#savoir-faire">Savoir-faire</a></li>
        <li><a href="#viandes">Nos viandes</a></li>
        <li><a href="#traiteur">Traiteur</a></li>
        <li><a href="#avis">Avis</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </nav>

    <div class="header-actions">
      <a href="tel:<?= e($settings['phone_link']) ?>" class="header-phone">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5c0 9 7 16 16 16l3-4-6-3-2 2c-3-1-6-4-7-7l2-2-3-6z"/></svg>
        <?= e($settings['phone_display']) ?>
      </a>
      <a href="#contact" class="btn btn-outline btn-small">Devis traiteur</a>
      <button class="nav-toggle" id="nav-toggle" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="main-nav">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>

<main id="main">

  <!-- ============ HERO ============ -->
  <section class="hero" id="top">
    <div class="hero-texture" aria-hidden="true"></div>
    <div class="hero-inner">
      <p class="eyebrow reveal"><?= e($settings['hero_eyebrow']) ?></p>
      <h1 class="reveal"><?= nl2br_e($settings['hero_title']) ?></h1>
      <p class="hero-lede reveal"><?= e($settings['hero_lede']) ?></p>
      <div class="hero-actions reveal">
        <a href="#viandes" class="btn btn-gold">Découvrir nos viandes</a>
        <a href="#traiteur" class="btn btn-ghost">Service traiteur</a>
      </div>
      <a class="scroll-cue" href="#chiffres" aria-label="Défiler vers le bas">
        <span></span>
      </a>
    </div>
  </section>

  <!-- ============ CHIFFRES / VALEURS ============ -->
  <section class="stats" id="chiffres">
    <div class="stats-inner">
      <?php foreach ($stats as $stat): ?>
      <div class="stat reveal">
        <span class="stat-number"><?= e($stat['number']) ?></span>
        <span class="stat-label"><?= e($stat['label']) ?></span>
      </div>
      <?php endforeach; ?>
    </div>
  </section>

  <!-- ============ SAVOIR-FAIRE ============ -->
  <section class="section savoir-faire" id="savoir-faire">
    <div class="section-inner">
      <div class="section-head reveal">
        <p class="eyebrow">Notre philosophie</p>
        <h2><?= e($settings['philosophy_title']) ?></h2>
        <p class="section-lede"><?= e($settings['philosophy_lede']) ?></p>
      </div>

      <div class="steps">
        <article class="step reveal">
          <span class="step-number">01</span>
          <div class="step-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48"><path d="M24 6C14 6 6 14 6 24s8 18 18 18 18-8 18-18S34 6 24 6z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M16 26c2 4 6 6 8 6s6-2 8-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="18" cy="20" r="1.6" fill="currentColor"/><circle cx="30" cy="20" r="1.6" fill="currentColor"/></svg>
          </div>
          <h3>Sélection à la ferme</h3>
          <p>Nous choisissons nos bêtes directement chez des éleveurs partenaires du Massif Central, en
            circuit court, en privilégiant les races à viande — Salers, Aubrac, Charolaise.</p>
        </article>

        <article class="step reveal">
          <span class="step-number">02</span>
          <div class="step-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48"><rect x="10" y="8" width="28" height="34" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M16 16h16M16 22h16M16 28h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          </div>
          <h3>Maturation en cave</h3>
          <p>Nos pièces de bœuf reposent dans notre cave de maturation, à température et hygrométrie
            maîtrisées, de 21 à 45 jours, pour révéler saveur et tendreté.</p>
        </article>

        <article class="step reveal">
          <span class="step-number">03</span>
          <div class="step-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48"><path d="M8 40 30 18a4 4 0 0 0 0-6 4 4 0 0 0-6 0L2 34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 14l8-8 6 6-8 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <h3>Découpe à la main</h3>
          <p>Chaque pièce est désossée, parée et découpée au couteau dans notre atelier, chaque matin,
            par nos bouchers — sans machine, sans compromis.</p>
        </article>

        <article class="step reveal">
          <span class="step-number">04</span>
          <div class="step-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48"><path d="M24 6l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
          </div>
          <h3>Conseil sur mesure</h3>
          <p>Cuisson, accompagnement, quantité par convive : nos bouchers vous conseillent la pièce et la
            préparation adaptées à votre table.</p>
        </article>
      </div>
    </div>
  </section>

  <!-- ============ NOS VIANDES ============ -->
  <section class="section viandes" id="viandes">
    <div class="section-inner">
      <div class="section-head reveal">
        <p class="eyebrow"><?= e($settings['meat_eyebrow']) ?></p>
        <h2><?= e($settings['meat_title']) ?></h2>
        <p class="section-lede"><?= e($settings['meat_lede']) ?></p>
      </div>

      <div class="meat-grid">
        <?php foreach ($products as $product): ?>
        <article class="meat-card reveal">
          <?php if (!empty($product['image_url'])): ?>
          <img class="meat-card-image" src="<?= e($product['image_url']) ?>" alt="<?= e($product['title']) ?>" loading="lazy">
          <?php endif; ?>
          <div class="meat-card-top">
            <?php if (!empty($product['tag'])): ?>
            <span class="meat-tag<?= $product['tag_style'] === 'alt' ? ' meat-tag-alt' : '' ?>"><?= e($product['tag']) ?></span>
            <?php endif; ?>
            <h3><?= e($product['title']) ?></h3>
          </div>
          <?php if (!empty($product['description'])): ?><p><?= e($product['description']) ?></p><?php endif; ?>
          <?php if (!empty($product['items'])): ?>
          <ul class="meat-list">
            <?php foreach ($product['items'] as $item): ?>
            <li><?= e($item) ?></li>
            <?php endforeach; ?>
          </ul>
          <?php endif; ?>
        </article>
        <?php endforeach; ?>
      </div>

      <p class="meat-note reveal"><?= e($settings['meat_note']) ?></p>
    </div>
  </section>

  <!-- ============ TRAITEUR ============ -->
  <section class="section traiteur" id="traiteur">
    <div class="traiteur-texture" aria-hidden="true"></div>
    <div class="section-inner">
      <div class="section-head section-head-light reveal">
        <p class="eyebrow eyebrow-gold"><?= e($settings['traiteur_eyebrow']) ?></p>
        <h2><?= e($settings['traiteur_title']) ?></h2>
        <p class="section-lede"><?= e($settings['traiteur_lede']) ?></p>
      </div>

      <div class="traiteur-grid">
        <article class="traiteur-card reveal">
          <div class="traiteur-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48"><path d="M24 6c-7 0-12 6-12 12 0 9 12 24 12 24s12-15 12-24c0-6-5-12-12-12z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="24" cy="18" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
          </div>
          <h3>Mariages &amp; réceptions</h3>
          <p>Buffets et pièces à partager pensés pour sublimer votre table, du cocktail au plat principal.</p>
        </article>

        <article class="traiteur-card reveal">
          <div class="traiteur-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48"><rect x="6" y="14" width="36" height="24" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M14 14V10a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
          </div>
          <h3>Entreprise &amp; événements</h3>
          <p>Plateaux, cocktails dînatoires et pièces cuisinées, livrés ou à retirer, pour vos événements pro.</p>
        </article>

        <article class="traiteur-card reveal">
          <div class="traiteur-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48"><path d="M8 32c0-8 7-14 16-14s16 6 16 14" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 32h36M12 32v6h24v-6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
          </div>
          <h3>Kits barbecue &amp; plancha</h3>
          <p>Sélections prêtes à griller composées avec votre boucher, marinades et sauces maison incluses.</p>
        </article>

        <article class="traiteur-card reveal">
          <div class="traiteur-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48"><path d="M10 20h28l-3 18H13l-3-18z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M16 20c0-6 3.5-10 8-10s8 4 8 10" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
          </div>
          <h3>Pièces prêtes à rôtir</h3>
          <p>Rôtis farcis, volailles bardées, pièces ficelées et assaisonnées : il ne reste qu'à enfourner.</p>
        </article>
      </div>

      <div class="traiteur-cta reveal">
        <div class="traiteur-cta-text">
          <h3><?= e($settings['traiteur_cta_title']) ?></h3>
          <p><?= e($settings['traiteur_cta_text']) ?></p>
        </div>
        <a href="#contact" class="btn btn-gold">Demander un devis traiteur</a>
      </div>
    </div>
  </section>

  <!-- ============ AVIS ============ -->
  <section class="section avis" id="avis">
    <div class="section-inner">
      <div class="section-head reveal">
        <p class="eyebrow">Ils nous font confiance</p>
        <h2>La parole à nos clients</h2>
      </div>

      <div class="avis-grid">
        <figure class="avis-card reveal">
          <div class="stars" aria-hidden="true">★★★★★</div>
          <blockquote>« La côte de bœuf maturée 35 jours restera un souvenir marquant. Un accueil chaleureux
            et des conseils précis sur la cuisson. »</blockquote>
          <figcaption>— Camille R., cliente depuis 2019</figcaption>
        </figure>

        <figure class="avis-card reveal">
          <div class="stars" aria-hidden="true">★★★★★</div>
          <blockquote>« Le service traiteur a sublimé notre mariage : buffet généreux, présentation soignée,
            et une équipe disponible jusqu'au bout. »</blockquote>
          <figcaption>— Julien &amp; Marion, mariés en juin</figcaption>
        </figure>

        <figure class="avis-card reveal">
          <div class="stars" aria-hidden="true">★★★★★</div>
          <blockquote>« Une charcuterie maison introuvable ailleurs. Le pâté en croûte et le saucisson sec
            valent le détour à eux seuls. »</blockquote>
          <figcaption>— Denis M., habitué du samedi matin</figcaption>
        </figure>
      </div>
    </div>
  </section>

  <!-- ============ CONTACT ============ -->
  <section class="section contact" id="contact">
    <div class="section-inner contact-inner">
      <div class="contact-info reveal">
        <p class="eyebrow"><?= e($settings['contact_eyebrow']) ?></p>
        <h2><?= e($settings['contact_title']) ?></h2>
        <p class="section-lede"><?= e($settings['contact_lede']) ?></p>

        <ul class="contact-details">
          <li>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 22s7-7.4 7-13a7 7 0 1 0-14 0c0 5.6 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></svg>
            <span><?= e($settings['address']) ?></span>
          </li>
          <li>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 5c0 9 7 16 16 16l3-4-6-3-2 2c-3-1-6-4-7-7l2-2-3-6z"/></svg>
            <a href="tel:<?= e($settings['phone_link']) ?>"><?= e($settings['phone_display']) ?></a>
          </li>
          <li>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>
            <a href="mailto:<?= e($settings['email']) ?>"><?= e($settings['email']) ?></a>
          </li>
        </ul>

        <table class="hours">
          <caption>Horaires d'ouverture</caption>
          <tbody>
            <tr><th><?= e($settings['hours_1_label']) ?></th><td><?= e($settings['hours_1_value']) ?></td></tr>
            <tr><th><?= e($settings['hours_2_label']) ?></th><td><?= e($settings['hours_2_value']) ?></td></tr>
            <tr><th><?= e($settings['hours_3_label']) ?></th><td><?= e($settings['hours_3_value']) ?></td></tr>
            <tr><th><?= e($settings['hours_4_label']) ?></th><td><?= e($settings['hours_4_value']) ?></td></tr>
          </tbody>
        </table>

        <div class="social-links">
          <a href="<?= e($settings['social_instagram'] ?: '#') ?>" aria-label="Instagram">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1"/></svg>
          </a>
          <a href="<?= e($settings['social_facebook'] ?: '#') ?>" aria-label="Facebook">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M15 8h-2a2 2 0 0 0-2 2v2H9v3h2v7h3v-7h2.2l.8-3H14v-1.5c0-.6.4-1 1-1h1.5V8z"/></svg>
          </a>
        </div>
      </div>

      <form class="contact-form reveal" id="contact-form" novalidate>
        <p class="eyebrow">Écrivez-nous</p>
        <h2>Une question, un devis traiteur ?</h2>

        <div class="form-row">
          <label for="f-name">Nom &amp; prénom</label>
          <input type="text" id="f-name" name="name" required autocomplete="name">
        </div>

        <div class="form-row form-row-split">
          <div>
            <label for="f-email">E-mail</label>
            <input type="email" id="f-email" name="email" required autocomplete="email">
          </div>
          <div>
            <label for="f-phone">Téléphone</label>
            <input type="tel" id="f-phone" name="phone" autocomplete="tel">
          </div>
        </div>

        <div class="form-row">
          <label for="f-subject">Sujet</label>
          <select id="f-subject" name="subject">
            <option>Demande d'information</option>
            <option>Devis traiteur — mariage / réception</option>
            <option>Devis traiteur — entreprise</option>
            <option>Commande de viande</option>
            <option>Autre</option>
          </select>
        </div>

        <div class="form-row">
          <label for="f-message">Message</label>
          <textarea id="f-message" name="message" rows="4" required></textarea>
        </div>

        <button type="submit" class="btn btn-gold btn-full">Envoyer ma demande</button>
        <p class="form-note" id="form-note" role="status" aria-live="polite"></p>
      </form>
    </div>
  </section>

</main>

<!-- ============ FOOTER ============ -->
<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-brand">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="36" height="36">
          <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-width="1.4"/>
          <text x="32" y="41" text-anchor="middle" font-family="Playfair Display, serif" font-size="21" fill="currentColor">ML</text>
        </svg>
      </span>
      <div>
        <strong><?= e($settings['brand_name']) ?></strong>
        <p><?= e($settings['footer_tagline']) ?></p>
      </div>
    </div>

    <nav class="footer-nav" aria-label="Navigation de pied de page">
      <a href="#savoir-faire">Savoir-faire</a>
      <a href="#viandes">Nos viandes</a>
      <a href="#traiteur">Traiteur</a>
      <a href="#avis">Avis</a>
      <a href="#contact">Contact</a>
    </nav>

    <button class="back-to-top" id="back-to-top" aria-label="Revenir en haut de page">↑</button>
  </div>
  <div class="footer-bottom">
    <p>© <span id="year"></span> <?= e($settings['brand_name']) ?>. Tous droits réservés.</p>
    <p class="footer-fictif">Site vitrine fictif, réalisé à titre de démonstration.</p>
  </div>
</footer>

<script src="<?= e($base) ?>/assets/main.js"></script>
</body>
</html>
