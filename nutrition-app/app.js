// NutriCoach - JS minimal, sans dépendance externe

document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('mainNav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
    });
  }

  // Auto-soumission des cases à cocher (liste de courses) pour un rendu ludique instantané
  document.querySelectorAll('form.autosubmit input[type=checkbox]').forEach(function (box) {
    box.addEventListener('change', function () {
      box.closest('form').submit();
    });
  });

  // Confirmation avant suppression
  document.querySelectorAll('[data-confirm]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      if (!confirm(el.getAttribute('data-confirm'))) {
        e.preventDefault();
      }
    });
  });
});
