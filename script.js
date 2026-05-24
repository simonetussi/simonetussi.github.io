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

  const privateGalleries = document.querySelectorAll('[data-private-gallery]');
  const hashText = async value => {
    const encoded = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  };
  const hasGalleryAccess = key => {
    try {
      return sessionStorage.getItem(key) === 'unlocked';
    } catch (err) {
      return false;
    }
  };
  const rememberGalleryAccess = key => {
    try {
      sessionStorage.setItem(key, 'unlocked');
    } catch (err) {
      // Accesso valido anche se il browser blocca lo storage di sessione.
    }
  };

  privateGalleries.forEach(gallery => {
    const galleryId = gallery.dataset.galleryId || window.location.pathname;
    const expectedHash = gallery.dataset.passwordHash;
    const lock = gallery.querySelector('[data-private-lock]');
    const content = gallery.querySelector('[data-private-content]');
    const form = gallery.querySelector('[data-private-lock-form]');
    const input = form && form.querySelector('[name="password"]');
    const error = gallery.querySelector('[data-private-lock-error]');
    const storageKey = `private-gallery:${galleryId}`;

    if (!expectedHash || !lock || !content || !form || !input) return;

    const unlock = () => {
      if (error) error.hidden = true;
      lock.hidden = true;
      content.hidden = false;
      rememberGalleryAccess(storageKey);
    };

    if (hasGalleryAccess(storageKey)) {
      unlock();
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();

      try {
        const currentHash = await hashText(input.value.trim());
        if (currentHash === expectedHash) {
          unlock();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      } catch (err) {
        if (error) error.textContent = 'Impossibile verificare la password in questo browser.';
      }

      if (error) error.hidden = false;
      input.select();
    });
  });

  const galleryGrids = document.querySelectorAll('.masonry-grid');
  galleryGrids.forEach(grid => {
    const items = Array.from(grid.children).filter(child => child.classList.contains('masonry-item'));

    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    items.forEach(item => grid.appendChild(item));
  });

  document.querySelectorAll('[data-gallery-empty]').forEach(empty => {
    const grid = empty.previousElementSibling;
    empty.hidden = Boolean(grid && grid.querySelector('.masonry-item'));
  });

  const compareSliders = document.querySelectorAll('[data-compare-slider]');
  compareSliders.forEach(slider => {
    const range = slider.querySelector('.postprod-compare-range');
    if (!range) return;

    const updateCompare = () => {
      slider.style.setProperty('--position', `${range.value}%`);
    };

    range.addEventListener('input', updateCompare);
    updateCompare();
  });

  // ─── Gallery Lightbox ────────────────────────────────────
  const shop = document.querySelector('[data-shop]');
  if (shop) {
    const formatPrice = value => `${value.toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} EUR`;
    const cart = new Map();
    const cartCounts = document.querySelectorAll('[data-cart-count]');
    const cartItems = shop.querySelector('[data-cart-items]');
    const cartEmpty = shop.querySelector('[data-cart-empty]');
    const subtotalEl = shop.querySelector('[data-cart-subtotal]');
    const shippingEl = shop.querySelector('[data-cart-shipping]');
    const totalEl = shop.querySelector('[data-cart-total]');
    const checkoutBtn = shop.querySelector('[data-cart-checkout]');
    const cartPanel = shop.querySelector('#merch-cart');

    const renderCart = () => {
      const items = Array.from(cart.values());
      const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
      const shipping = items.length > 0 ? 5 : 0;
      const totalQty = items.reduce((sum, item) => sum + item.qty, 0);

      cartCounts.forEach(count => { count.textContent = totalQty; });
      if (cartEmpty) cartEmpty.hidden = items.length > 0;
      if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
      if (shippingEl) shippingEl.textContent = formatPrice(shipping);
      if (totalEl) totalEl.textContent = formatPrice(subtotal + shipping);
      if (checkoutBtn) checkoutBtn.disabled = items.length === 0;

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

        const size = card.querySelector('[name="size"]')?.value || 'Unica';
        const color = card.querySelector('[name="color"]')?.value || 'Standard';
        const product = {
          id: card.dataset.productId,
          name: card.dataset.productName,
          price: Number(card.dataset.productPrice),
          image: card.dataset.productImage,
          size,
          color
        };
        const key = `${product.id}:${size}:${color}`;
        const current = cart.get(key);

        if (current) {
          current.qty += 1;
        } else {
          cart.set(key, { ...product, key, qty: 1 });
        }

        renderCart();
        if (cartPanel && window.innerWidth < 1024) {
          cartPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    shop.addEventListener('click', e => {
      const inc = e.target.closest('[data-cart-inc]');
      const dec = e.target.closest('[data-cart-dec]');
      const remove = e.target.closest('[data-cart-remove]');

      if (inc) {
        const item = cart.get(inc.dataset.cartInc);
        if (item) item.qty += 1;
      }
      if (dec) {
        const item = cart.get(dec.dataset.cartDec);
        if (item) {
          item.qty -= 1;
          if (item.qty <= 0) cart.delete(item.key);
        }
      }
      if (remove) {
        cart.delete(remove.dataset.cartRemove);
      }

      if (inc || dec || remove) renderCart();
    });

    shop.querySelectorAll('[data-shop-filter]').forEach(button => {
      button.addEventListener('click', () => {
        const filter = button.dataset.shopFilter;
        shop.querySelectorAll('[data-shop-filter]').forEach(item => {
          item.classList.toggle('active', item === button);
        });
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
      const items = Array.from(cart.values());
      if (items.length === 0) return;

      const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
      const lines = items.map(item => (
        `- ${item.qty}x ${item.name} (${item.size}, ${item.color}) - ${formatPrice(item.price * item.qty)}`
      )).join('\n');
      const message = `Ciao Simone, vorrei completare questo ordine merch:\n\n${lines}\n\nTotale stimato: ${formatPrice(subtotal + 5)}`;
      window.open(`https://wa.me/393334721296?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    });

    renderCart();
  }

  const merchZoom = document.querySelector('[data-merch-zoom]');
  if (merchZoom) {
    const zoomImage = merchZoom.querySelector('[data-zoom-image]');
    const zoomCaption = merchZoom.querySelector('[data-zoom-caption]');
    const closeZoom = () => {
      merchZoom.hidden = true;
      document.body.style.overflow = '';
    };

    document.querySelectorAll('[data-zoom-src]').forEach(button => {
      button.addEventListener('click', () => {
        if (!zoomImage || !zoomCaption) return;
        zoomImage.src = button.dataset.zoomSrc;
        zoomImage.alt = button.dataset.zoomTitle || '';
        zoomCaption.textContent = button.dataset.zoomTitle || '';
        merchZoom.hidden = false;
        document.body.style.overflow = 'hidden';
      });
    });

    merchZoom.querySelector('[data-zoom-close]')?.addEventListener('click', closeZoom);
    merchZoom.addEventListener('click', e => {
      if (e.target === merchZoom) closeZoom();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !merchZoom.hidden) closeZoom();
    });
  }

  const lightbox     = document.getElementById('lightbox');
  const lbImg        = document.getElementById('lightbox-img');
  const lbClose      = document.getElementById('lightbox-close');
  const lbPrev       = document.getElementById('lightbox-prev');
  const lbNext       = document.getElementById('lightbox-next');
  const lbCounter    = document.getElementById('lightbox-counter');
  const galleryItems = Array.from(document.querySelectorAll('.masonry-item'));

  if (lightbox && galleryItems.length > 0) {

  let currentIndex = 0;
  const imgs = galleryItems.map(item => item.querySelector('img'));

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
  }

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
