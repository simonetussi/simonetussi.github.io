/* ============================================================
   SIMONE TUSSI v2.0 — Main Script
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ─── Custom Cursor ──────────────────────────────────────
  const cursor     = document.getElementById('cursor');
  const cursorRing = document.getElementById('cursor-ring');
  if (cursor && cursorRing) {
    let cx = -100, cy = -100, rx = -100, ry = -100;
    document.addEventListener('mousemove', e => {
      cx = e.clientX; cy = e.clientY;
      cursor.style.left = cx + 'px';
      cursor.style.top  = cy + 'px';
    });
    // Smooth ring follow
    function animateCursor() {
      rx += (cx - rx) * 0.12;
      ry += (cy - ry) * 0.12;
      cursorRing.style.left = rx + 'px';
      cursorRing.style.top  = ry + 'px';
      requestAnimationFrame(animateCursor);
    }
    animateCursor();
  }

  // ─── Nav scroll ─────────────────────────────────────────
  const nav = document.querySelector('nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 60);
    });
  }

  // ─── Mobile nav toggle ───────────────────────────────────
  const toggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
    document.addEventListener('click', e => {
      if (!nav.contains(e.target)) navLinks.classList.remove('open');
    });
  }

  // ─── Hero parallax ──────────────────────────────────────
  const heroBg = document.querySelector('.hero-bg');
  if (heroBg) {
    heroBg.classList.add('loaded');
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      heroBg.style.transform = `scale(1) translateY(${y * 0.3}px)`;
    }, { passive: true });
  }

  // ─── Scroll reveal ──────────────────────────────────────
  const reveals = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  reveals.forEach(el => revealObserver.observe(el));

  // ─── Gallery Lightbox ────────────────────────────────────
  const lightbox     = document.getElementById('lightbox');
  const lbImg        = document.getElementById('lightbox-img');
  const lbClose      = document.getElementById('lightbox-close');
  const lbPrev       = document.getElementById('lightbox-prev');
  const lbNext       = document.getElementById('lightbox-next');
  const lbCounter    = document.getElementById('lightbox-counter');
  const galleryItems = document.querySelectorAll('.masonry-item');

  if (!lightbox || galleryItems.length === 0) return;

  let currentIndex = 0;
  const imgs = Array.from(galleryItems).map(item => item.querySelector('img'));

  function openLightbox(idx) {
    currentIndex = idx;
    showImg();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  function showImg() {
    if (!lbImg) return;
    lbImg.style.opacity = '0';
    setTimeout(() => {
      lbImg.src = imgs[currentIndex].src;
      lbImg.onload = () => { lbImg.style.opacity = '1'; };
    }, 150);
    if (lbCounter) lbCounter.textContent = `${currentIndex + 1} / ${imgs.length}`;
  }

  galleryItems.forEach((item, i) => {
    item.addEventListener('click', () => openLightbox(i));
  });

  lbClose && lbClose.addEventListener('click', closeLightbox);

  lbPrev && lbPrev.addEventListener('click', () => {
    currentIndex = (currentIndex - 1 + imgs.length) % imgs.length;
    showImg();
  });

  lbNext && lbNext.addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % imgs.length;
    showImg();
  });

  lightbox && lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape')      closeLightbox();
    if (e.key === 'ArrowLeft')  { currentIndex = (currentIndex - 1 + imgs.length) % imgs.length; showImg(); }
    if (e.key === 'ArrowRight') { currentIndex = (currentIndex + 1) % imgs.length; showImg(); }
  });

  // Touch swipe for lightbox
  let touchStartX = 0;
  lightbox && lightbox.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  });
  lightbox && lightbox.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      if (dx < 0) { currentIndex = (currentIndex + 1) % imgs.length; }
      else        { currentIndex = (currentIndex - 1 + imgs.length) % imgs.length; }
      showImg();
    }
  });

  // ─── Contact form (static — opens mailto) ────────────────
  const form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name    = form.querySelector('[name="nome"]').value;
      const email   = form.querySelector('[name="email"]').value;
      const subject = form.querySelector('[name="oggetto"]').value;
      const message = form.querySelector('[name="messaggio"]').value;
      const body    = `Ciao Simone,\n\nSono ${name} (${email}).\n\n${message}`;
      window.location.href = `mailto:simonetussi2006@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  }

});
