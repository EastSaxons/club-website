(function () {
  var toggle = document.getElementById('navToggle');
  var mobileNav = document.getElementById('mobileNav');
  if (!toggle || !mobileNav) return;

  function setOpen(open) {
    if (open) {
      mobileNav.classList.remove('hidden');
      toggle.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close navigation');
    } else {
      mobileNav.classList.add('hidden');
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
    }
  }

  toggle.addEventListener('click', function () {
    setOpen(mobileNav.classList.contains('hidden'));
  });

  document.addEventListener('click', function (e) {
    if (!toggle.contains(e.target) && !mobileNav.contains(e.target)) {
      setOpen(false);
    }
  });
})();
