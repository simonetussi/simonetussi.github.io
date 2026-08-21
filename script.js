/* Shared site behaviour — v2.1.4 */
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
      
      // Inseriamo l'immagine e raggruppiamo i testi in un div centrato
      loader.innerHTML = `
        <img src="/img/altro/logo-w.png" alt="">
        <div style="text-align: center; display: flex; flex-direction: column; gap: 8px;">
          <span style="font-size: 14px; font-weight: 500; letter-spacing: 0.1em;">Caricamento fotografie</span>
          <p style="opacity: 0.8; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase;">
            Se la galleria non appare, ricarica la pagina
          </p>
        </div>
      `;
      
      document.body.appendChild(loader);
    }
    const logo = loader.querySelector('img');
    if (logo) logo.src = document.documentElement.classList.contains('light-mode') ? '/img/altro/logo-b.png' : '/img/altro/logo-w.png';
    return loader;
  }

  function showPageLoader() {
    loadingVisible = true;
    document.documentElement.classList.add('loading-active');
    requestAnimationFrame(() => pageLoader().classList.add('is-visible'));
  }

  function hidePageLoader() {
    if (!loadingVisible || pendingGalleries > 0) return;
    pageLoader().classList.remove('is-visible');
    document.documentElement.classList.remove('loading-active');
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
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MAZZO CONDIVISO — Un singolo shuffle per sorgente JSON per refresh
  // ═══════════════════════════════════════════════════════════════════════════
  const galleryPools = {};

  /**
   * Restituisce (o crea) il pool condiviso per un dato JSON.
   * Il mazzo viene mescolato UNA SOLA VOLTA per refresh di pagina.
   * Griglia 1, Griglia 2 e Carosello pescano dallo stesso mazzo ordinato.
   */
  function getPool(source) {
    if (!galleryPools[source]) {
      galleryPools[source] = fetch(source)
        .then(r => r.json())
        .then(data => {
          const raw = data.photos || [];
          return {
            base: data.base || '',
            allPhotos: raw,
            deck: shuffle(raw),   // mescolato una volta per refresh
            cursor: 0             // indice di pescata progressiva
          };
        });
    }
    return galleryPools[source];
  }

  /** Pesca `count` foto dal mazzo condiviso senza mai ripetere all'interno dello stesso refresh */
  function drawFromDeck(pool, count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      if (pool.cursor >= pool.deck.length) {
        // se il mazzo si esaurisce, rimescola (caso raro con molte griglie)
        pool.deck = shuffle(pool.allPhotos);
        pool.cursor = 0;
      }
      out.push(pool.deck[pool.cursor]);
      pool.cursor++;
    }
    return out;
  }

  /** Costruisce l'URL completo di una foto */
  function photoURL(pool, photo) {
    const src = photo.src;
    return /^https?:\/\//.test(src) || src.startsWith('/') ? src : pool.base + src;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INFINITE MARQUEE — Velocità costante & zero duplicati nel DOM
  // ═══════════════════════════════════════════════════════════════════════════
  class InfiniteMarquee {
    /**
     * @param {HTMLElement} track  — il contenitore .marquee-track
     * @param {Object} opts        — { speed: number } px/secondo
     */
    constructor(track, opts = {}) {
      this.track   = track;
      this.wrapper = track.closest('.marquee-wrapper') || track.parentElement;
      this.speed   = opts.speed || 50;  // 50 px/s costanti

      this.offset  = 0;
      this.hovered = false;
      this.dragging = false;
      this.dragStartX = 0;
      this.dragStartOffset = 0;
      this.dragTotalMoved = 0;
      this.lastTime = null;
      this.rafId    = null;
      this.visible  = false;

      // Misure (calcolate in measure())
      this.containerW = 0;
      this.itemW = 0;
      this.gap = 0;
      this.pitch = 0;
      this.span = 0;

      this.items = Array.from(track.querySelectorAll('.masonry-item'));
      if (!this.items.length) return;

      this._measure();
      this._bind();
      this._observe();
      this._render();
    }

    /* ── Misurazione (Zero Clonazione, Zero Duplicati) ── */
    _measure() {
      this.containerW = this.wrapper.getBoundingClientRect().width || window.innerWidth;
      if (!this.items.length) return;

      const first = this.items[0];
      const rect  = first.getBoundingClientRect();
      this.itemW  = rect.width  || 280;
      const itemH = rect.height || 380;

      const cs = getComputedStyle(this.track);
      this.gap = parseFloat(cs.gap) || parseFloat(cs.columnGap) || 16;

      this.pitch = this.itemW + this.gap;
      const totalW = this.items.length * this.pitch;

      // Span = ampiezza del ciclo virtuale:
      // ZERO CLONI NEL DOM: esattamente N elementi unici dal JSON
      this.span = Math.max(totalW, this.containerW + this.pitch);
      this.track.style.height = itemH + 'px';
    }

    /* ── Eventi ── */
    _bind() {
      this.hasPointerDown = false;
      this.pointerTargetItem = null;

      // Hover → pausa
      this.wrapper.addEventListener('mouseenter', () => { this.hovered = true; });
      this.wrapper.addEventListener('mouseleave', () => {
        this.hovered = false;
        if (this.dragging) {
          this.dragging = false;
          this.hasPointerDown = false;
          this.wrapper.classList.remove('is-dragging');
        }
      });

      // Pointer down
      this.wrapper.addEventListener('pointerdown', e => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        this.hasPointerDown = true;
        this.dragging = false;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.dragStartOffset = this.offset;
        this.dragTotalMoved = 0;
        this.pointerTargetItem = e.target.closest('.masonry-item');
      });

      // Pointer move
      this.wrapper.addEventListener('pointermove', e => {
        if (!this.hasPointerDown) return;
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        const dist = Math.hypot(dx, dy);
        this.dragTotalMoved = Math.max(this.dragTotalMoved, dist);

        // Attiva il drag solo se il movimento supera 6px
        if (!this.dragging && dist > 6) {
          this.dragging = true;
          this.wrapper.classList.add('is-dragging');
          try { this.wrapper.setPointerCapture(e.pointerId); } catch (_) {}
        }

        if (this.dragging) {
          this.offset = this.dragStartOffset + dx;
          this._render();
        }
      });

      // Pointer up (gestisce sia la fine del drag sia il click/tap immediato)
      const onPointerUp = e => {
        if (!this.hasPointerDown) return;

        if (this.dragging) {
          this.dragging = false;
          this.wrapper.classList.remove('is-dragging');
          try { this.wrapper.releasePointerCapture(e.pointerId); } catch (_) {}
        } else if (this.dragTotalMoved <= 6) {
          // È un click / tap pulito: apri direttamente il Lightbox
          const item = this.pointerTargetItem || e.target.closest('.masonry-item');
          if (item) {
            const img = item.querySelector('img');
            if (img) openLightbox(img);
          }
        }

        this.hasPointerDown = false;
        this.pointerTargetItem = null;
      };

      this.wrapper.addEventListener('pointerup', onPointerUp);
      this.wrapper.addEventListener('pointercancel', () => {
        this.hasPointerDown = false;
        this.dragging = false;
        this.pointerTargetItem = null;
        this.wrapper.classList.remove('is-dragging');
      });

      // Click standard come ulteriore salvaguardia
      this.track.addEventListener('click', e => {
        if (this.dragTotalMoved > 6) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const item = e.target.closest('.masonry-item');
        if (item) {
          const img = item.querySelector('img');
          if (img) openLightbox(img);
        }
      });

      // Resize
      if (window.ResizeObserver) {
        new ResizeObserver(() => { this._measure(); this._render(); }).observe(this.wrapper);
      } else {
        window.addEventListener('resize', () => { this._measure(); this._render(); }, { passive: true });
      }
    }

    /* ── Visibilità (IntersectionObserver) ── */
    _observe() {
      if (!('IntersectionObserver' in window)) {
        this.visible = true;
        this.lastTime = performance.now();
        this.rafId = requestAnimationFrame(t => this._tick(t));
        return;
      }
      new IntersectionObserver(entries => {
        for (const entry of entries) {
          this.visible = entry.isIntersecting;
          if (this.visible && !this.rafId) {
            this.lastTime = performance.now();
            this.rafId = requestAnimationFrame(t => this._tick(t));
          }
        }
      }, { rootMargin: '200px' }).observe(this.wrapper);
    }

    /* ── Loop di animazione ── */
    _tick(now) {
      if (!this.visible) { this.rafId = null; return; }

      if (this.lastTime !== null && !this.hovered && !this.dragging) {
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.offset -= this.speed * dt;
      }
      this.lastTime = now;
      this._render();
      this.rafId = requestAnimationFrame(t => this._tick(t));
    }

    /* ── Rendering: wrapping virtuale (zero duplicati) ── */
    _render() {
      const lo = -this.pitch;
      const range = this.span;

      for (let i = 0; i < this.items.length; i++) {
        const raw = i * this.pitch + this.offset;
        // Modulo con segno positivo garantito
        const x = ((((raw - lo) % range) + range) % range) + lo;
        this.items[i].style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARICAMENTO GALLERIE — griglia mosaico e carosello dallo stesso mazzo
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadGalleryFromJSON(grid) {
    if (grid.dataset.galleryLoaded === 'true') return;
    const source = grid.dataset.gallerySrc;
    if (!source) return;
    grid.dataset.galleryLoaded = 'true';
    pendingGalleries++;

    try {
      const pool = await getPool(source);
      const isMarquee = grid.classList.contains('marquee-track');
      const limitAttr = grid.dataset.galleryLimit;
      const limit = limitAttr ? parseInt(limitAttr, 10) : null;

      if (isMarquee) {
        // ── CAROSELLO: Foto UNICHE dal mazzo condiviso, ZERO duplicati ──
        const deck = pool.deck;
        if (!deck.length) { showGalleryError(grid, 'Galleria in aggiornamento'); return; }

        // Quantità di foto: personalizzabile con data-gallery-limit="..." nell'HTML (default: 10)
        const maxPhotos = Number.isFinite(limit) ? limit : 10;

        // Velocità: personalizzabile con data-carousel-speed="..." nell'HTML 
        const speedAttr = grid.dataset.carouselSpeed;
        const speed = speedAttr ? parseFloat(speedAttr) : 100;

        let photos = [];

        // 1. Prendi prima le foto non ancora utilizzate nelle griglie a monte se sufficienti
        const unused = deck.slice(pool.cursor);
        if (unused.length >= 6) {
          photos = unused.slice(0, maxPhotos);
        } else {
          // Per gallerie con pochi scatti residui, prendi dal mazzo intero
          photos = deck.slice(0, maxPhotos);
        }

        // Garanzia assoluta: nessun duplicato ammesso nella lista
        const seen = new Set();
        photos = photos.filter(p => {
          if (seen.has(p.src)) return false;
          seen.add(p.src);
          return true;
        });

        const entries = photos.map(p => ({ url: photoURL(pool, p), alt: p.alt || '' }));
        await preloadImages(entries.map(e => e.url));

        // Esattamente N nodi nel DOM, ZERO cloni
        entries.forEach(e => grid.appendChild(galleryItem(e.url, e.alt)));

        // Avvia il motore a velocità costante e wrapping virtuale
        new InfiniteMarquee(grid, { speed });

      } else {
        // ── GRIGLIA MOSAICO ──
        const count = Number.isFinite(limit) ? limit : pool.allPhotos.length;
        const photos = drawFromDeck(pool, count);
        if (!photos.length) { showGalleryError(grid, 'Galleria in aggiornamento'); return; }

        const entries = photos.map(p => ({ url: photoURL(pool, p), alt: p.alt || '' }));
        await preloadImages(entries.map(e => e.url));
        entries.forEach(e => grid.appendChild(galleryItem(e.url, e.alt)));
        initLightbox(grid);
      }
    } catch (err) {
      console.warn(`[Gallery] Impossibile caricare ${source}:`, err);
      showGalleryError(grid);
    } finally {
      pendingGalleries--;
      hidePageLoader();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIGHTBOX — zoom a schermo intero con navigazione frecce
  // ═══════════════════════════════════════════════════════════════════════════

  const lightbox = () => document.getElementById('lightbox');

  // Funzioni per i pulsanti prev/next (conservate come riferimenti stabili
  // per poter rimuovere i listener e non accumularli)
  let _lbPrev = null;
  let _lbNext = null;

  function initLightbox(container) {
    const box = lightbox();
    if (!box) return;
    container.querySelectorAll('.masonry-item').forEach(item => {
      if (item.dataset.lightboxBound) return;
      item.dataset.lightboxBound = 'true';
      item.addEventListener('click', e => {
        e.preventDefault();
        const img = item.querySelector('img');
        if (img) openLightbox(img);
      });
    });
  }

  function openLightbox(image) {
    const box = lightbox();
    if (!box || !image) return;

    // Raccoglie TUTTE le foto della pagina per navigazione continua
    const selectors = [
      '.psico-intro-photo > img',
      '.cropped-mosaic .masonry-item img',
      '.marquee-track .masonry-item img',
      '.masonry-grid:not(.marquee-track) .masonry-item img'
    ];
    let images = [];
    const seen = new Set();
    document.querySelectorAll(selectors.join(',')).forEach(img => {
      if (!seen.has(img.src)) { seen.add(img.src); images.push(img); }
    });
    if (!images.length) images = [image];

    let index = images.findIndex(img => img.src === image.src);
    if (index === -1) index = 0;

    const boxImage = box.querySelector('#lightbox-img');
    const counter  = box.querySelector('#lightbox-counter');
    const btnClose = box.querySelector('#lightbox-close');
    const btnPrev  = box.querySelector('#lightbox-prev');
    const btnNext  = box.querySelector('#lightbox-next');

    const show = () => {
      boxImage.style.opacity = '0';
      boxImage.src = images[index].src;
      boxImage.alt = images[index].alt || '';
      boxImage.onload = () => { boxImage.style.opacity = '1'; };
      if (counter) counter.textContent = `${index + 1} / ${images.length}`;
    };

    // Rimuovi i vecchi listener per non accumulare callback
    if (_lbPrev && btnPrev) btnPrev.removeEventListener('click', _lbPrev);
    if (_lbNext && btnNext) btnNext.removeEventListener('click', _lbNext);

    _lbPrev = () => { index = (index - 1 + images.length) % images.length; show(); };
    _lbNext = () => { index = (index + 1) % images.length; show(); };

    btnClose?.addEventListener('click', closeLightbox, { once: true });
    btnPrev?.addEventListener('click', _lbPrev);
    btnNext?.addEventListener('click', _lbNext);

    box.classList.add('active');
    document.body.style.overflow = 'hidden';
    show();
  }

  function closeLightbox() {
    const box = lightbox();
    if (!box) return;
    box.classList.remove('active');
    document.body.style.overflow = '';

    // Pulisci i listener di navigazione
    const btnPrev = box.querySelector('#lightbox-prev');
    const btnNext = box.querySelector('#lightbox-next');
    if (_lbPrev && btnPrev) btnPrev.removeEventListener('click', _lbPrev);
    if (_lbNext && btnNext) btnNext.removeEventListener('click', _lbNext);
    _lbPrev = null;
    _lbNext = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INIZIALIZZAZIONE
  // ═══════════════════════════════════════════════════════════════════════════

  function initialise() {
    /* ── Cursore custom ── */
    const cursor = document.getElementById('cursor');
    const cursorRing = document.getElementById('cursor-ring');
    if (cursor && cursorRing && matchMedia('(pointer:fine)').matches) {
      let x = -100, y = -100, ringX = -100, ringY = -100;
      document.addEventListener('mousemove', e => {
        x = e.clientX; y = e.clientY;
        cursor.style.left = x + 'px'; cursor.style.top = y + 'px';
      });
      (function anim() {
        ringX += (x - ringX) * 0.12;
        ringY += (y - ringY) * 0.12;
        cursorRing.style.left = ringX + 'px';
        cursorRing.style.top  = ringY + 'px';
        requestAnimationFrame(anim);
      })();
    }

    /* ── Nav scroll ── */
    const nav = document.querySelector('nav');
    if (nav) {
      const updateNav = () => nav.classList.toggle('scrolled', scrollY > 60);
      updateNav();
      addEventListener('scroll', updateNav, { passive: true });
    }
    const toggle = document.querySelector('.nav-toggle');
    const links  = document.querySelector('.nav-links');
    toggle?.addEventListener('click', () => links?.classList.toggle('open'));
    document.addEventListener('click', e => { if (nav && !nav.contains(e.target)) links?.classList.remove('open'); });
    document.querySelector('.hero-bg')?.classList.add('loaded');

    /* ── Reveal animations ── */
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver(entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      }), { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
      document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
    } else {
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    }

    /* ── Slider post-produzione ── */
    document.querySelectorAll('[data-compare-slider]').forEach(slider => {
      const range = slider.querySelector('.postprod-compare-range');
      if (!range) return;
      const update = () => slider.style.setProperty('--position', range.value + '%');
      range.addEventListener('input', update);
      update();
    });

    /* ── Caricamento gallerie ──
     * ORDINE CRITICO: prima le griglie mosaico (pescano dal mazzo condiviso),
     * poi il carosello (usa tutte le foto ruotate dalla posizione corrente del mazzo).
     * Il selettore per le griglie classiche ESCLUDE il marquee-track per evitare
     * che venga inizializzato due volte.
     */

    // 1. Griglie mosaico (cropped-mosaic) — pescano N foto dal deck
    document.querySelectorAll('.cropped-mosaic[data-gallery-src]').forEach(grid => {
      if (!grid.closest('[data-private-content][hidden]')) loadGalleryFromJSON(grid);
    });

    // 2. Griglie classiche masonry (NON marquee-track)
    document.querySelectorAll('.masonry-grid[data-gallery-src]:not(.marquee-track)').forEach(grid => {
      if (!grid.closest('[data-private-content][hidden]')) loadGalleryFromJSON(grid);
    });

    // 3. Carosello marquee-track — viene per ultimo così il cursor del deck
    //    riflette le foto già assegnate alle griglie soprastanti
    document.querySelectorAll('.marquee-track[data-gallery-src]').forEach(grid => {
      if (!grid.closest('[data-private-content][hidden]')) loadGalleryFromJSON(grid);
    });

    /* ── Zoom su foto statiche di introduzione ── */
    document.querySelectorAll('.psico-intro-photo > img').forEach(img => {
      if (img.dataset.lightboxBound) return;
      img.dataset.lightboxBound = 'true';
      img.style.cursor = 'pointer';
      img.addEventListener('click', () => openLightbox(img));
    });

    /* ── Zoom su griglie non-JSON (statiche) ── */
    document.querySelectorAll('.masonry-grid:not([data-gallery-src]), .cropped-mosaic:not([data-gallery-src])').forEach(initLightbox);

    /* ── Gallerie private (password-protected) ── */
    document.querySelectorAll('[data-private-gallery]').forEach(gallery => {
      const lock    = gallery.querySelector('[data-private-lock]');
      const content = gallery.querySelector('[data-private-content]');
      const form    = gallery.querySelector('[data-private-lock-form]');
      const input   = form?.querySelector('[name="password"]');
      const error   = gallery.querySelector('[data-private-lock-error]');
      const expected = gallery.dataset.passwordHash;
      const key = `private-gallery:${gallery.dataset.galleryId || location.pathname}`;

      const unlock = () => {
        lock.hidden = true;
        content.hidden = false;
        sessionStorage.setItem(key, 'unlocked');
        content.querySelectorAll('.masonry-grid[data-gallery-src]').forEach(loadGalleryFromJSON);
      };

      if (sessionStorage.getItem(key) === 'unlocked') unlock();

      form?.addEventListener('submit', async e => {
        e.preventDefault();
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.value.trim()));
        const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
        if (hash === expected) { unlock(); return; }
        error.hidden = false;
        input.select();
      });
    });

    /* ── Lightbox: chiusura globale ── */
    const box = lightbox();
    box?.addEventListener('click', e => { if (e.target === box) closeLightbox(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
  }

  /* ── Bootstrap ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise, { once: true });
  } else {
    initialise();
  }
  window.loadGalleryFromJSON = loadGalleryFromJSON;
})();