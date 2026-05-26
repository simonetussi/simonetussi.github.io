/* ============================================================
   SIMONE TUSSI v2.1 — Main Script
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
  const toggle   = document.querySelector('.nav-toggle');
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

  // ─── Gallery da JSON ────────────────────────────────────
  //
  //  Per ogni .masonry-grid con l'attributo [data-gallery-src],
  //  carica il JSON indicato e inietta i .masonry-item.
  //
  //  Formato JSON (file in /galleries/):
  //  {
  //    "base": "https://…/uploads/2024/01/",   ← URL base (opzionale)
  //    "photos": [
  //      { "src": "foto-1.webp", "alt": "Descrizione" },
  //      { "src": "https://…/foto-completa.jpg" }  ← URL assoluto: base ignorata
  //    ]
  //  }
  //
  const SVG_ZOOM = `<svg viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" fill="none">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    <line x1="11" y1="8" x2="11" y2="14"/>
    <line x1="8" y1="11" x2="14" y2="11"/>
  </svg>`;

  function buildMasonryItem(src, alt) {
    const div = document.createElement('div');
    div.className = 'masonry-item';
    const img = document.createElement('img');
    img.src     = src;
    img.alt     = alt || '';
    img.loading = 'lazy';
    const overlay = document.createElement('div');
    overlay.className = 'masonry-item-overlay';
    overlay.innerHTML = SVG_ZOOM;
    div.appendChild(img);
    div.appendChild(overlay);
    return div;
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async function loadGalleryFromJSON(grid) {
    const src = grid.dataset.gallerySrc;
    if (!src) return;

    try {
      const res  = await fetch(src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const base   = data.base || '';
      const photos = data.photos || [];

      if (photos.length === 0) {
        showEmptyState(grid);
        return;
      }

      const items = photos.map(photo => {
        // Se src inizia con http/https usa direttamente, altrimenti antepone base
        const url = /^https?:\/\//.test(photo.src) ? photo.src : base + photo.src;
        return buildMasonryItem(url, photo.alt || '');
      });

      shuffleArray(items);
      items.forEach(item => grid.appendChild(item));

      // Dopo aver caricato le foto, inizializza il lightbox per questa griglia
      initLightbox(grid);

    } catch (err) {
      console.warn(`[Gallery] Impossibile caricare ${src}:`, err);
      showEmptyState(grid);
    }
  }

  function showEmptyState(grid) {
    // Mostra il messaggio "In aggiornamento" se presente come elemento successivo
    const empty = grid.parentElement.querySelector('[data-gallery-empty]');
    if (empty) empty.hidden = false;
  }

  // Carica tutte le gallery con [data-gallery-src]
  document.querySelectorAll('.masonry-grid[data-gallery-src]').forEach(grid => {
    loadGalleryFromJSON(grid);
  });

  // ─── Gallery statiche (senza data-gallery-src) ──────────
  //  Mantieni compatibilità con le gallery HTML già esistenti
  document.querySelectorAll('.masonry-grid:not([data-gallery-src])').forEach(grid => {
    const items = Array.from(grid.children).filter(c => c.classList.contains('masonry-item'));
    shuffleArray(items);
    items.forEach(item => grid.appendChild(item));
    initLightbox(grid);
  });

  // Gallery empty state per griglia statica
  document.querySelectorAll('[data-gallery-empty]').forEach(empty => {
    const grid = empty.previousElementSibling;
    if (grid && grid.querySelector('.masonry-item')) empty.hidden = true;
  });

  // ─── Private galleries ──────────────────────────────────
const hashText = async value => {
  const encoded = new TextEncoder().encode(value);
  const digest  = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};
const hasGalleryAccess = key => {
  try { return sessionStorage.getItem(key) === 'unlocked'; } catch { return false; }
};
const rememberGalleryAccess = key => {
  try { sessionStorage.setItem(key, 'unlocked'); } catch { /* ok */ }
};

document.querySelectorAll('[data-private-gallery]').forEach(gallery => {
  const galleryId    = gallery.dataset.galleryId || window.location.pathname;
  const expectedHash = gallery.dataset.passwordHash;
  const lock         = gallery.querySelector('[data-private-lock]');
  const content      = gallery.querySelector('[data-private-content]');
  const form         = gallery.querySelector('[data-private-lock-form]');
  const input        = form && form.querySelector('[name="password"]');
  const error        = gallery.querySelector('[data-private-lock-error]');
  const storageKey   = `private-gallery:${galleryId}`;

  if (!expectedHash || !lock || !content || !form || !input) return;

  const unlock = () => {
    if (error) error.hidden = true;
    lock.hidden    = true;
    content.hidden = false;
    rememberGalleryAccess(storageKey);
    
    // Carica le gallery JSON presenti nel contenuto privato
    content.querySelectorAll('.masonry-grid[data-gallery-src]').forEach(grid => {
      grid.innerHTML = ''; // ⭐ MODIFICA: Svuota la griglia prima di caricare per evitare foto duplicate
      loadGalleryFromJSON(grid);
      });
    };

    if (hasGalleryAccess(storageKey)) unlock();

    form.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        const hash = await hashText(input.value.trim());
        if (hash === expectedHash) {
          unlock();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      } catch {
        if (error) error.textContent = 'Impossibile verificare la password in questo browser.';
      }
      if (error) error.hidden = false;
      input.select();
    });
  });

  // ─── Compare slider ─────────────────────────────────────
  document.querySelectorAll('[data-compare-slider]').forEach(slider => {
    const range = slider.querySelector('.postprod-compare-range');
    if (!range) return;
    const update = () => slider.style.setProperty('--position', `${range.value}%`);
    range.addEventListener('input', update);
    update();
  });

  // ─── Lightbox ────────────────────────────────────────────
  //  initLightbox viene chiamata dopo ogni caricamento gallery
  const lightbox  = document.getElementById('lightbox');
  const lbImg     = document.getElementById('lightbox-img');
  const lbClose   = document.getElementById('lightbox-close');
  const lbPrev    = document.getElementById('lightbox-prev');
  const lbNext    = document.getElementById('lightbox-next');
  const lbCounter = document.getElementById('lightbox-counter');

  if (!lightbox) return; // nessun lightbox su questa pagina

  let lbImages = [];
  let lbIndex  = 0;

  function rebuildImageList() {
    lbImages = Array.from(document.querySelectorAll('.masonry-item img'));
  }

  function openLightbox(idx) {
    rebuildImageList();
    lbIndex = idx;
    showLbImg();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  function showLbImg() {
    if (!lbImg || lbImages.length === 0) return;
    lbImg.style.opacity = '0';
    setTimeout(() => {
      lbImg.src   = lbImages[lbIndex].src;
      lbImg.onload = () => { lbImg.style.opacity = '1'; };
    }, 150);
    if (lbCounter) lbCounter.textContent = `${lbIndex + 1} / ${lbImages.length}`;
  }

  function initLightbox(grid) {
    grid.querySelectorAll('.masonry-item').forEach(item => {
      // Evita doppio listener
      if (item.dataset.lbBound) return;
      item.dataset.lbBound = '1';
      item.addEventListener('click', () => {
        rebuildImageList();
        const idx = lbImages.indexOf(item.querySelector('img'));
        openLightbox(idx >= 0 ? idx : 0);
      });
    });
  }

  lbClose && lbClose.addEventListener('click', closeLightbox);
  lbPrev  && lbPrev.addEventListener('click', () => {
    lbIndex = (lbIndex - 1 + lbImages.length) % lbImages.length;
    showLbImg();
  });
  lbNext  && lbNext.addEventListener('click', () => {
    lbIndex = (lbIndex + 1) % lbImages.length;
    showLbImg();
  });
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  { lbIndex = (lbIndex - 1 + lbImages.length) % lbImages.length; showLbImg(); }
    if (e.key === 'ArrowRight') { lbIndex = (lbIndex + 1) % lbImages.length; showLbImg(); }
  });

  let touchStartX = 0;
  lightbox.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
  lightbox.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      lbIndex = dx < 0
        ? (lbIndex + 1) % lbImages.length
        : (lbIndex - 1 + lbImages.length) % lbImages.length;
      showLbImg();
    }
  });

  // ─── Shop (merch) ────────────────────────────────────────
  const shop = document.querySelector('[data-shop]');
  if (shop) {
    const formatPrice = v => `${v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
    const cart        = new Map();
    const cartCounts  = document.querySelectorAll('[data-cart-count]');
    const cartItems   = shop.querySelector('[data-cart-items]');
    const cartEmpty   = shop.querySelector('[data-cart-empty]');
    const subtotalEl  = shop.querySelector('[data-cart-subtotal]');
    const shippingEl  = shop.querySelector('[data-cart-shipping]');
    const totalEl     = shop.querySelector('[data-cart-total]');
    const checkoutBtn = shop.querySelector('[data-cart-checkout]');
    const cartPanel   = shop.querySelector('#merch-cart');

    const renderCart = () => {
      const items    = Array.from(cart.values());
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      const shipping = items.length > 0 ? 5 : 0;
      const totalQty = items.reduce((s, i) => s + i.qty, 0);

      cartCounts.forEach(c => { c.textContent = totalQty; });
      if (cartEmpty)  cartEmpty.hidden  = items.length > 0;
      if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
      if (shippingEl) shippingEl.textContent = formatPrice(shipping);
      if (totalEl)    totalEl.textContent    = formatPrice(subtotal + shipping);
      if (checkoutBtn) checkoutBtn.disabled  = items.length === 0;

      if (!cartItems) return;
      cartItems.innerHTML = '';
      items.forEach(item => {
        const row = document.createElement('article');
        row.className = 'merch-cart-item';
        row.innerHTML = `
          <img src="${item.image}" alt="">
          <div>
            <h3>${item.name}</h3>
            <p class="merch-cart-meta">${item.size} / ${item.color}</p>
            <div class="merch-cart-row">
              <div class="merch-qty">
                <button type="button" data-cart-dec="${item.key}">-</button>
                <span>${item.qty}</span>
                <button type="button" data-cart-inc="${item.key}">+</button>
              </div>
              <strong>${formatPrice(item.price * item.qty)}</strong>
            </div>
            <button class="merch-remove" type="button" data-cart-remove="${item.key}">Rimuovi</button>
          </div>
        `;
        cartItems.appendChild(row);
      });
    };

    shop.querySelectorAll('[data-add-to-cart]').forEach(button => {
      button.addEventListener('click', () => {
        const card = button.closest('[data-product-card]');
        if (!card) return;
        const size  = card.querySelector('[name="size"]')?.value  || 'Unica';
        const color = card.querySelector('[name="color"]')?.value || 'Standard';
        const product = {
          id: card.dataset.productId, name: card.dataset.productName,
          price: Number(card.dataset.productPrice), image: card.dataset.productImage,
          size, color
        };
        const key = `${product.id}:${size}:${color}`;
        const cur = cart.get(key);
        if (cur) cur.qty += 1;
        else cart.set(key, { ...product, key, qty: 1 });
        renderCart();
        if (cartPanel && window.innerWidth < 1024) {
          cartPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    shop.addEventListener('click', e => {
      const inc    = e.target.closest('[data-cart-inc]');
      const dec    = e.target.closest('[data-cart-dec]');
      const remove = e.target.closest('[data-cart-remove]');
      if (inc)    { const i = cart.get(inc.dataset.cartInc); if (i) i.qty += 1; }
      if (dec)    { const i = cart.get(dec.dataset.cartDec); if (i) { i.qty -= 1; if (i.qty <= 0) cart.delete(i.key); } }
      if (remove) { cart.delete(remove.dataset.cartRemove); }
      if (inc || dec || remove) renderCart();
    });

    shop.querySelectorAll('[data-shop-filter]').forEach(button => {
      button.addEventListener('click', () => {
        const filter = button.dataset.shopFilter;
        shop.querySelectorAll('[data-shop-filter]').forEach(b => b.classList.toggle('active', b === button));
        shop.querySelectorAll('[data-product-card]').forEach(card => {
          card.hidden = filter !== 'all' && card.dataset.productCategory !== filter;
        });
      });
    });

    const cartJump = shop.querySelector('[data-cart-jump]');
    cartJump && cartJump.addEventListener('click', () => {
      cartPanel && cartPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    checkoutBtn && checkoutBtn.addEventListener('click', () => {
      const items    = Array.from(cart.values());
      if (!items.length) return;
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      const lines    = items.map(i => `- ${i.qty}x ${i.name} (${i.size}, ${i.color}) - ${formatPrice(i.price * i.qty)}`).join('\n');
      const message  = `Ciao Simone, vorrei completare questo ordine merch:\n\n${lines}\n\nTotale stimato: ${formatPrice(subtotal + 5)}`;
      window.open(`https://wa.me/393334721296?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    });

    renderCart();
  }

  // ─── Merch zoom ──────────────────────────────────────────
  const merchZoom = document.querySelector('[data-merch-zoom]');
  if (merchZoom) {
    const zoomImage   = merchZoom.querySelector('[data-zoom-image]');
    const zoomCaption = merchZoom.querySelector('[data-zoom-caption]');
    const closeZoom   = () => { merchZoom.hidden = true; document.body.style.overflow = ''; };

    document.querySelectorAll('[data-zoom-src]').forEach(button => {
      button.addEventListener('click', () => {
        if (!zoomImage) return;
        zoomImage.src        = button.dataset.zoomSrc;
        zoomImage.alt        = button.dataset.zoomTitle || '';
        if (zoomCaption) zoomCaption.textContent = button.dataset.zoomTitle || '';
        merchZoom.hidden     = false;
        document.body.style.overflow = 'hidden';
      });
    });

    merchZoom.querySelector('[data-zoom-close]')?.addEventListener('click', closeZoom);
    merchZoom.addEventListener('click', e => { if (e.target === merchZoom) closeZoom(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !merchZoom.hidden) closeZoom(); });
  }

  // ─── Contact form ────────────────────────────────────────
  const form = document.getElementById('contact-form');
  if (form) {
    function getFormData() {
      return {
        name:    form.querySelector('[name="nome"]').value.trim(),
        email:   form.querySelector('[name="email"]').value.trim(),
        subject: form.querySelector('[name="oggetto"]').value.trim(),
        message: form.querySelector('[name="messaggio"]').value.trim(),
      };
    }

    function validateForm() {
      const { name, email, subject, message } = getFormData();
      if (!name || !email || !subject || !message) {
        // Mostra validazione nativa del browser
        form.querySelectorAll('[required]').forEach(el => el.reportValidity());
        return false;
      }
      return true;
    }

    const btnWA    = document.getElementById('btn-whatsapp');
    const btnEmail = document.getElementById('btn-email');

    if (btnWA) {
      btnWA.addEventListener('click', () => {
        if (!validateForm()) return;
        const { name, email, subject, message } = getFormData();
        const text = `Ciao Simone, ti scrivo dal sito!\n\n*Nome:* ${name}\n*Email:* ${email}\n*Servizio:* ${subject}\n\n${message}`;
        window.open(`https://wa.me/393334721296?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      });
    }

    if (btnEmail) {
      btnEmail.addEventListener('click', () => {
        if (!validateForm()) return;
        const { name, email, subject, message } = getFormData();
        const body = `Ciao Simone,\n\nSono ${name} (${email}).\n\n${message}`;
        window.location.href = `mailto:simonetussi2006@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      });
    }
  }

  // ─── Theme toggle ───────────────────────────────────────
  const themeToggleBtn = document.getElementById('theme-toggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light-mode');
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
  }
});

// Applica il tema PRIMA del render per evitare flash — fuori da DOMContentLoaded
(function() {
  if (localStorage.getItem('theme') === 'light') {
    document.documentElement.classList.add('light-mode-pre');
    document.addEventListener('DOMContentLoaded', () => {
      document.body.classList.add('light-mode');
      document.documentElement.classList.remove('light-mode-pre');
    });
  }
})();