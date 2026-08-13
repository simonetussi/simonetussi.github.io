/* Shared site behaviour */
(function () {
  'use strict';

  const SVG_ZOOM = `<svg viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" fill="none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;
  let loadingVisible = false;
  let pendingGalleries = 0;

  const shuffle = items => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  function pageLoader() {
    let loader = document.getElementById('page-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'page-loader';
      loader.setAttribute('role', 'status');
      loader.setAttribute('aria-live', 'polite');
      loader.innerHTML = '<img src="/img/altro/logo-w.png" alt=""><span>Caricamento fotografie</span>';
      document.body.appendChild(loader);
    }
    return loader;
  }

  function showPageLoader() {
    loadingVisible = true;
    requestAnimationFrame(() => pageLoader().classList.add('is-visible'));
  }

  function hidePageLoader() {
    if (!loadingVisible || pendingGalleries > 0) return;
    pageLoader().classList.remove('is-visible');
    loadingVisible = false;
  }

  function preloadImages(urls) {
    const records = urls.map(url => {
      const image = new Image();
      image.decoding = 'async';
      let done;
      const promise = new Promise(resolve => { done = resolve; });
      const finish = () => done();
      image.onload = finish;
      image.onerror = finish;
      image.src = url;
      const cached = image.complete && image.naturalWidth > 0;
      if (image.complete) finish();
      return { cached, promise };
    });
    if (records.some(record => !record.cached)) showPageLoader();
    return Promise.all(records.map(record => record.promise));
  }

  function galleryItem(src, alt) {
    const item = document.createElement('div');
    item.className = 'masonry-item';
    item.innerHTML = `<img src="${src}" alt="${alt || ''}" loading="eager" fetchpriority="high"><div class="masonry-item-overlay">${SVG_ZOOM}</div>`;
    return item;
  }

  function showGalleryError(grid, message = 'Galleria temporaneamente non disponibile') {
    const empty = grid.parentElement.querySelector('[data-gallery-empty]');
    if (empty) {
      empty.hidden = false;
      empty.textContent = message;
    }
  }

  async function loadGalleryFromJSON(grid) {
    if (grid.dataset.galleryLoaded === 'true') return;
    const source = grid.dataset.gallerySrc;
    if (!source) return;
    grid.dataset.galleryLoaded = 'true';
    pendingGalleries += 1;

    try {
      const response = await fetch(source, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const base = data.base || '';
      const limit = Number.parseInt(grid.dataset.galleryLimit, 10);
      const photos = shuffle(data.photos || []).slice(0, Number.isFinite(limit) ? limit : undefined);
      if (!photos.length) {
        showGalleryError(grid, 'Galleria in aggiornamento');
        return;
      }

      const entries = photos.map(photo => ({
        alt: photo.alt || '',
        url: /^https?:\/\//.test(photo.src) || photo.src.startsWith('/') ? photo.src : base + photo.src
      }));
      await preloadImages(entries.map(entry => entry.url));
      entries.forEach(entry => grid.appendChild(galleryItem(entry.url, entry.alt)));
      initLightbox(grid);
    } catch (error) {
      console.warn(`[Gallery] Impossibile caricare ${source}:`, error);
      showGalleryError(grid);
    } finally {
      pendingGalleries -= 1;
      hidePageLoader();
    }
  }

  const lightbox = () => document.getElementById('lightbox');
  function initLightbox(grid) {
    const box = lightbox();
    if (!box) return;
    grid.querySelectorAll('.masonry-item').forEach(item => {
      if (item.dataset.lightboxBound) return;
      item.dataset.lightboxBound = 'true';
      item.addEventListener('click', () => openLightbox(item.querySelector('img')));
    });
  }

  function openLightbox(image) {
    const box = lightbox();
    if (!box || !image) return;
    const images = [...document.querySelectorAll('.masonry-item img')];
    let index = Math.max(0, images.indexOf(image));
    const boxImage = box.querySelector('#lightbox-img');
    const counter = box.querySelector('#lightbox-counter');
    const show = () => {
      boxImage.style.opacity = '0';
      boxImage.src = images[index].src;
      boxImage.alt = images[index].alt;
      boxImage.onload = () => { boxImage.style.opacity = '1'; };
      if (counter) counter.textContent = `${index + 1} / ${images.length}`;
    };
    box.querySelector('#lightbox-close')?.addEventListener('click', closeLightbox, { once: true });
    box.querySelector('#lightbox-prev')?.addEventListener('click', () => { index = (index - 1 + images.length) % images.length; show(); });
    box.querySelector('#lightbox-next')?.addEventListener('click', () => { index = (index + 1) % images.length; show(); });
    box._galleryImages = images;
    box._galleryIndex = () => index;
    box._setGalleryIndex = value => { index = value; show(); };
    box.classList.add('active');
    document.body.style.overflow = 'hidden';
    show();
  }

  function closeLightbox() {
    const box = lightbox();
    box?.classList.remove('active');
    document.body.style.overflow = '';
  }

  function initialise() {
    const cursor = document.getElementById('cursor');
    const cursorRing = document.getElementById('cursor-ring');
    if (cursor && cursorRing && matchMedia('(pointer:fine)').matches) {
      let x = -100; let y = -100; let ringX = -100; let ringY = -100;
      document.addEventListener('mousemove', event => { x = event.clientX; y = event.clientY; cursor.style.left = `${x}px`; cursor.style.top = `${y}px`; });
      const animate = () => { ringX += (x - ringX) * 0.12; ringY += (y - ringY) * 0.12; cursorRing.style.left = `${ringX}px`; cursorRing.style.top = `${ringY}px`; requestAnimationFrame(animate); };
      animate();
    }

    const nav = document.querySelector('nav');
    if (nav) {
      const updateNav = () => nav.classList.toggle('scrolled', window.scrollY > 60);
      updateNav();
      window.addEventListener('scroll', updateNav, { passive: true });
    }
    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    toggle?.addEventListener('click', () => links?.classList.toggle('open'));
    document.addEventListener('click', event => { if (nav && !nav.contains(event.target)) links?.classList.remove('open'); });
    document.querySelector('.hero-bg')?.classList.add('loaded');

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
      }), { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
      document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
    } else document.querySelectorAll('.reveal').forEach(element => element.classList.add('visible'));

    document.querySelectorAll('[data-compare-slider]').forEach(slider => {
      const range = slider.querySelector('.postprod-compare-range');
      if (!range) return;
      const update = () => slider.style.setProperty('--position', `${range.value}%`);
      range.addEventListener('input', update); update();
    });

    document.querySelectorAll('.masonry-grid[data-gallery-src]').forEach(grid => {
      if (!grid.closest('[data-private-content][hidden]')) loadGalleryFromJSON(grid);
    });
    document.querySelectorAll('.masonry-grid:not([data-gallery-src])').forEach(initLightbox);

    document.querySelectorAll('[data-private-gallery]').forEach(gallery => {
      const lock = gallery.querySelector('[data-private-lock]');
      const content = gallery.querySelector('[data-private-content]');
      const form = gallery.querySelector('[data-private-lock-form]');
      const input = form?.querySelector('[name="password"]');
      const error = gallery.querySelector('[data-private-lock-error]');
      const expected = gallery.dataset.passwordHash;
      const key = `private-gallery:${gallery.dataset.galleryId || location.pathname}`;
      const unlock = () => { lock.hidden = true; content.hidden = false; sessionStorage.setItem(key, 'unlocked'); content.querySelectorAll('.masonry-grid[data-gallery-src]').forEach(loadGalleryFromJSON); };
      if (sessionStorage.getItem(key) === 'unlocked') unlock();
      form?.addEventListener('submit', async event => {
        event.preventDefault();
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.value.trim()));
        const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        if (hash === expected) { unlock(); return; }
        error.hidden = false; input.select();
      });
    });

    const box = lightbox();
    box?.addEventListener('click', event => { if (event.target === box) closeLightbox(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeLightbox(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
  window.loadGalleryFromJSON = loadGalleryFromJSON;
})();
