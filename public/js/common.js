// Partes compartidas: cabecera, pie, carrito, WhatsApp, bot y animaciones
const BG = (() => {
  const BEE = `<svg viewBox="0 0 64 64" aria-hidden="true"><g class="bee-wing"><ellipse cx="26" cy="20" rx="10" ry="13" fill="#dff3ff" stroke="#1b2422" stroke-width="2.5" opacity=".9"/><ellipse cx="40" cy="20" rx="9" ry="12" fill="#dff3ff" stroke="#1b2422" stroke-width="2.5" opacity=".9"/></g><ellipse cx="33" cy="38" rx="19" ry="14" fill="#e1aa2a" stroke="#1b2422" stroke-width="2.5"/><path d="M27 25.5c-2 7-2 18 0 25M37 25c2 7 2 18 0 26" stroke="#1b2422" stroke-width="5" fill="none"/><circle cx="50" cy="35" r="2.6" fill="#1b2422"/><path d="M14 38l-6 1.5" stroke="#1b2422" stroke-width="2.5" stroke-linecap="round"/><path d="M50 26c2-5 5-7 8-7M47 25c0-5 2-8 4-10" stroke="#1b2422" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
  const WA = `<svg viewBox="0 0 32 32"><path d="M16 3C9 3 3.3 8.6 3.3 15.6c0 2.4.7 4.7 1.9 6.7L3 29l6.9-2.1c1.9 1 4 1.6 6.1 1.6 7 0 12.7-5.7 12.7-12.7S23 3 16 3zm0 23.2c-1.9 0-3.8-.5-5.4-1.5l-.4-.2-4.1 1.2 1.2-4-.3-.4c-1.1-1.7-1.7-3.7-1.7-5.7C5.3 9.8 10.1 5 16 5s10.7 4.8 10.7 10.7S21.9 26.2 16 26.2zm5.9-8c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.6 5.7 5 .8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"/></svg>`;
  const CART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg>`;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = (c) => '₡' + Math.round(Number(c || 0) / 100).toLocaleString('es-CR').replace(/\u202f|\u00a0/g, ' ');
  const date = (s) => new Date(String(s).replace(' ', 'T') + 'Z').toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' });
  const paragraphs = (s) => esc(s).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  async function api(url, opts = {}) {
    const o = { ...opts };
    if (o.body && !(o.body instanceof FormData)) { o.headers = { 'content-type': 'application/json', ...(o.headers || {}) }; o.body = JSON.stringify(o.body); }
    const r = await fetch(url, o);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Algo ha fallado, inténtalo de nuevo.');
    return data;
  }
  function toast(text) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = text; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---- carrito (localStorage) ----
  const CART_KEY = 'bg_cart';
  const cart = {
    get() { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } },
    save(items) { try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch {} updateCount(); },
    add(p, qty = 1) {
      const items = cart.get();
      const it = items.find((i) => i.id === p.id);
      if (it) it.qty = Math.min(99, it.qty + qty); else items.push({ id: p.id, slug: p.slug, name: p.name, image: p.image, final_cents: p.final_cents, qty });
      cart.save(items); toast(`🐝 ${p.name} añadido al carrito`);
    },
    setQty(id, qty) { cart.save(cart.get().map((i) => (i.id === id ? { ...i, qty } : i)).filter((i) => i.qty > 0)); },
    clear() { cart.save([]); },
    count() { return cart.get().reduce((a, i) => a + i.qty, 0); },
  };
  function updateCount() { document.querySelectorAll('.cart-count').forEach((el) => { const n = cart.count(); el.textContent = n || ''; el.dataset.n = n; }); }

  let settings = {};
  const settingsReady = api('/api/settings').then((s) => (settings = s)).catch(() => settings);
  const waLink = (text) => `https://wa.me/${(settings.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(text || settings.whatsapp_message || '¡Hola Bee Green!')}`;

  const TRACK_URL = 'https://correos.go.cr/rastreo/';
  function header() {
    const here = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    const links = [['/', 'Inicio'], ['/tienda', 'Tienda'], ['/comunidad', 'Mapa'], ['/noticias', 'Noticias'], ['/talleres', 'Talleres'], ['/preguntas', 'Dudas'], ['/contacto', 'Contacto']];
    const CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><circle cx="8.5" cy="12" r=".6" fill="currentColor"/><circle cx="12" cy="12" r=".6" fill="currentColor"/><circle cx="15.5" cy="12" r=".6" fill="currentColor"/></svg>';
    return `<header class="site-header"><nav class="nav container" aria-label="Principal">
      <div class="nav-pill">
        <a class="brand" href="/" aria-label="Bee Green, inicio"><img src="/img/logo/logo-oscuro.png" alt="Bee Green"></a>
        <ul class="nav-links" id="navLinks">${links.map(([h, t]) => `<li><a href="${h}" class="${here === h ? 'active' : ''}">${t}</a></li>`).join('')}</ul>
      </div>
      <div class="nav-icons">
        <a class="btn pill-track" href="${TRACK_URL}" target="_blank" rel="noopener" data-track>Rastrea tu pedido</a>
        <button class="icon-btn" data-open-bot aria-label="Preguntarle a Abi">${CHAT}</button>
        <a class="icon-btn" href="/carrito" aria-label="Carrito">${CART}<span class="cart-count"></span></a>
        <button class="icon-btn menu-toggle" aria-label="Abrir menú" aria-expanded="false"><span></span><span></span><span></span></button>
      </div></nav></header>`;
  }
  // abejas que flotan por el fondo y se apartan del cursor
  function beeField(host, count = 16) {
    const field = document.createElement('div');
    field.className = 'bee-field'; field.setAttribute('aria-hidden', 'true');
    host.prepend(field);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const W = () => host.clientWidth, H = () => host.clientHeight;
    for (let i = 0; i < 7; i++) {
      const h = document.createElement('div'); h.className = 'hex';
      h.style.left = Math.random() * 100 + '%'; h.style.top = Math.random() * 100 + '%';
      h.style.transform = `scale(${0.6 + Math.random() * 1.6})`; field.appendChild(h);
    }
    const clouds = [...Array(4)].map((_, i) => {
      const c = document.createElement('div'); c.className = 'cloud';
      const w = 120 + Math.random() * 140;
      c.innerHTML = `<svg viewBox="0 0 200 100" width="${w}"><g fill="#fff" opacity=".85"><circle cx="60" cy="60" r="35"/><circle cx="100" cy="45" r="42"/><circle cx="145" cy="62" r="32"/><rect x="30" y="60" width="145" height="35" rx="17"/></g></svg>`;
      field.appendChild(c);
      return { el: c, x: Math.random() * W(), y: 40 + Math.random() * (H() * 0.7), v: 0.08 + Math.random() * 0.15, w };
    });
    const n = innerWidth < 700 ? Math.ceil(count / 2) : count;
    const bees = [...Array(n)].map(() => {
      const el = document.createElement('div'); el.className = 'fb';
      const size = 18 + Math.random() * 26;
      el.style.width = el.style.height = size + 'px'; el.innerHTML = BEE;
      field.appendChild(el);
      return { el, x: Math.random() * W(), y: Math.random() * H(), vx: (Math.random() < .5 ? -1 : 1) * (0.25 + Math.random() * 0.6), ph: Math.random() * 6.28, amp: 0.4 + Math.random(), size };
    });
    const mouse = { x: -999, y: -999 };
    host.addEventListener('pointermove', (e) => { const r = host.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    host.addEventListener('pointerleave', () => { mouse.x = mouse.y = -999; });
    let visible = true;
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(host);
    function tick(t) {
      if (visible) {
        const w = W(), h = H();
        for (const b of bees) {
          b.ph += 0.03;
          let dy = Math.sin(b.ph) * b.amp;
          const dx = b.x - mouse.x, dyM = b.y - mouse.y, d = Math.hypot(dx, dyM);
          if (d < 120) { b.x += (dx / d) * 3; b.y += (dyM / d) * 3; }
          b.x += b.vx; b.y += dy;
          if (b.x > w + 40) b.x = -40; if (b.x < -40) b.x = w + 40;
          if (b.y > h + 20) b.y = -20; if (b.y < -20) b.y = h + 20;
          b.el.style.transform = `translate(${b.x}px, ${b.y}px) scaleX(${b.vx < 0 ? -1 : 1}) rotate(${dy * 10}deg)`;
        }
        for (const c of clouds) { c.x += c.v; if (c.x > w + 20) c.x = -c.w; c.el.style.transform = `translate(${c.x}px, ${c.y}px)`; }
      }
      if (!reduce) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  // inclinación 3D de las tarjetas de producto al pasar el cursor
  function tilt(root = document) {
    root.addEventListener('pointermove', (e) => {
      const card = e.target.closest?.('.card.product');
      if (!card || e.pointerType === 'touch') return;
      const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--rx', (0.5 - y) * 14 + 'deg'); card.style.setProperty('--ry', (x - 0.5) * 16 + 'deg');
      card.style.setProperty('--mx', x * 100 + '%'); card.style.setProperty('--my', y * 100 + '%');
      card.style.setProperty('--px', (x - 0.5) * 12 + 'px'); card.style.setProperty('--py', (y - 0.5) * 12 + 'px');
    });
    root.addEventListener('pointerout', (e) => {
      const card = e.target.closest?.('.card.product');
      if (card && !card.contains(e.relatedTarget)) ['--rx', '--ry', '--px', '--py'].forEach((p) => card.style.removeProperty(p));
    });
  }
  const PAY_ICONS = `<span class="pay-icon" title="SINPE Móvil"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="13" y="4" width="22" height="40" rx="4"/><path d="M21 38h6"/><path d="M18 17h12l-3-3M30 25H18l3 3"/></svg>SINPE Móvil</span>
    <span class="pay-icon" title="Transferencia bancaria"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18 24 7l18 11z"/><path d="M10 22v14M19 22v14M29 22v14M38 22v14M6 40h36"/></svg>Transferencia</span>
    <span class="pay-icon" title="Tarjeta de crédito o débito"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="40" height="28" rx="4"/><path d="M4 18h40M10 30h10"/></svg>Tarjeta</span>`;
  function footer() {
    return `<footer class="site-footer">
      <svg class="footer-wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 70 C200 10 420 0 640 50 S1100 120 1440 30 V121 H0 Z" fill="currentColor"/></svg>
      <div class="container">
      <div class="footer-grid">
        <div><a class="brand" href="/" aria-label="Bee Green, inicio"><img src="/img/logo/logo-blanco.png" alt="Bee Green"></a>
          <a class="btn pill-light" href="${TRACK_URL}" target="_blank" rel="noopener" data-track>Rastrea tu pedido</a>
          <ul class="legal-links"><li><a href="/privacidad">Política de privacidad</a></li><li><a href="/aviso-legal">Términos y condiciones</a></li><li><a href="/envios">Envíos, pagos y devoluciones</a></li><li><a href="/cookies">Cookies</a></li></ul></div>
        <div><h4>¿Quieres enterarte de todo lo que pasa en la colmena?</h4><p class="soft">(Lanzamientos, talleres, promos y noticias de las abejas… nada de spam aburrido)</p>
          <form class="newsletter" id="newsletterForm"><input type="email" name="email" placeholder="Tu correo" required aria-label="Correo para el boletín"><button class="btn honey small" style="white-space:nowrap">Suscribirme</button></form></div>
        <div><h4>¿Necesitas ayuda?</h4><p class="soft">(Preguntas, pedidos, empresas, talleres, lo que necesites, aquí estamos)</p>
          <div class="btn-row"><a class="btn pill-light" href="#" data-wa>¡Hablemos!</a><button class="btn pill-light" data-open-bot>Pregúntale a Abi</button></div></div>
        <div><h4>Explora</h4><ul><li><a href="/tienda">Tienda</a></li><li><a href="/comunidad">Mapa de la comunidad</a></li><li><a href="/registra-tu-hotel">Registra tu hotel</a></li><li><a href="/talleres">Talleres</a></li><li><a href="/noticias">Noticias</a></li><li><a href="/preguntas">Preguntas frecuentes</a></li></ul>
          <div class="socials" id="socials"></div></div>
      </div>
      <div class="pay-row"><em>MÉTODOS DE PAGO</em>${PAY_ICONS}</div>
      <div class="footer-bottom"><span>© ${new Date().getFullYear()} Bee Green · Costa Rica 🇨🇷</span><span id="footerContact"></span></div>
    </div></footer>`;
  }

  // ---- bot de dudas ----
  function bot() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <button class="bot-toggle" aria-label="Abrir el asistente de dudas">${BEE}<span class="label">¿Dudas? Pregúntame</span></button>
      <section class="bot closed" aria-label="Asistente Bee Green" role="dialog">
        <div class="bot-head">${BEE}<div><strong>Abi</strong><small>La abeja que resuelve tus dudas</small></div><button aria-label="Cerrar">×</button></div>
        <div class="bot-msgs" aria-live="polite"></div>
        <form class="bot-form"><input name="q" placeholder="Escribe tu pregunta…" autocomplete="off" aria-label="Tu pregunta" maxlength="500"><button aria-label="Enviar">➤</button></form>
      </section>`;
    document.body.appendChild(wrap);
    const panel = wrap.querySelector('.bot'), msgs = wrap.querySelector('.bot-msgs'), form = wrap.querySelector('.bot-form');
    let started = false;
    const add = (html, who = 'bot-msg') => { const d = document.createElement('div'); d.className = 'msg ' + who; d.innerHTML = html; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; };
    async function ask(q, faqId) {
      add(esc(q), 'user');
      const t = add('<span></span><span></span><span></span>', 'bot-msg typing');
      try {
        const [r] = await Promise.all([api('/api/bot', { method: 'POST', body: { question: q, faq_id: faqId } }), new Promise((ok) => setTimeout(ok, 500))]);
        t.remove();
        add(esc(r.answer) + (r.whatsapp ? `<div style="margin-top:8px"><a class="btn small" style="background:#25d366" target="_blank" rel="noopener" href="${waLink('Hola, tengo una duda: ' + q)}">Preguntar por WhatsApp</a></div>` : ''));
      } catch (e) { t.remove(); add(esc(e.message)); }
    }
    async function start() {
      if (started) return; started = true;
      add('¡Hola! Soy Abi 🐝. Mucha gente cree que las abejas de los hoteles son peligrosas, ¡pero son súper tranquilas! Pregúntame lo que quieras o elige una duda:');
      const faqs = await api('/api/bot/faqs').catch(() => []);
      const chips = add('<div class="chips"></div>');
      chips.style.background = 'transparent'; chips.style.boxShadow = 'none'; chips.style.padding = '0';
      faqs.forEach((f) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = f.question; b.onclick = () => ask(f.question, f.id); chips.firstChild.appendChild(b); });
    }
    const toggle = (open) => { panel.classList.toggle('closed', !open); if (open) { start(); setTimeout(() => form.q.focus(), 300); } };
    wrap.querySelector('.bot-toggle').onclick = () => toggle(panel.classList.contains('closed'));
    wrap.querySelector('.bot-head button').onclick = () => toggle(false);
    form.onsubmit = (e) => { e.preventDefault(); const q = form.q.value.trim(); if (!q) return; form.q.value = ''; ask(q); };
    document.querySelectorAll('[data-open-bot]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); toggle(true); }));
  }

  function reveal() {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } }), { threshold: .12 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  }
  function counters() {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return; io.unobserve(e.target);
      const end = Number(e.target.dataset.to || 0), t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / 1600); e.target.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))).toLocaleString('es-CR'); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }));
    document.querySelectorAll('.counter').forEach((el) => io.observe(el));
  }

  // ---- mapa de hoteles (Leaflet) ----
  function hotelIcon(h) {
    if (h.logo) return L.divIcon({ className: '', html: `<div class="logo-marker"><img src="${esc(h.logo)}" alt=""></div>`, iconSize: [52, 52], iconAnchor: [26, 26], popupAnchor: [0, -24] });
    return L.divIcon({ className: '', html: `<div class="bee-marker"><div style="width:26px;height:26px">${BEE}</div></div>`, iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -36] });
  }
  async function hotelMap(el, opts = {}) {
    const map = L.map(el, { scrollWheelZoom: false, ...opts }).setView([9.85, -84.1], 8);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap · © CARTO', maxZoom: 19 }).addTo(map);
    const hotels = await api('/api/hotels').catch(() => []);
    const markers = hotels.map((h) => L.marker([h.lat, h.lng], { icon: hotelIcon(h) }).addTo(map).bindPopup(
      `${h.photo ? `<img class="popup-photo" src="${esc(h.photo)}" alt="Hotel de ${esc(h.name)}">` : ''}${h.logo ? `<img class="popup-logo" src="${esc(h.logo)}" alt="${esc(h.company_name || '')}">` : ''}
       <strong>${esc(h.company_name || h.name)}</strong>${h.city ? ` · ${esc(h.city)}` : ''}<br>${h.message ? `<em>“${esc(h.message)}”</em><br>` : ''}<small class="muted">Desde ${date(h.created_at)}</small>`));
    if (markers.length > 1) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.2), { maxZoom: 9 });
    el.addEventListener('click', () => map.scrollWheelZoom.enable(), { once: true });
    return { map, hotels };
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.body.insertAdjacentHTML('afterbegin', header());
    document.body.insertAdjacentHTML('beforeend', footer());
    const wa = document.createElement('a');
    wa.className = 'eu-float'; wa.href = '#'; wa.setAttribute('aria-label', 'Escríbenos por WhatsApp');
    wa.innerHTML = '<img src="/img/euglossa-whatsapp.svg" alt="">';
    document.body.appendChild(wa);
    settingsReady.then(() => {
      document.querySelectorAll('.eu-float, [data-wa]').forEach((a) => { a.href = waLink(a.dataset.wa); a.target = '_blank'; a.rel = 'noopener'; });
      const fc = document.getElementById('footerContact');
      const so = document.getElementById('socials');
      if (so) so.innerHTML = (settings.instagram ? `<a href="https://instagram.com/${esc(settings.instagram)}" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg></a>` : '') + (settings.facebook ? `<a href="https://facebook.com/${esc(settings.facebook)}" target="_blank" rel="noopener" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 8h3V4h-3c-2.8 0-4 1.8-4 4.3V11H7v4h3v6h4v-6h3l1-4h-4V8.6c0-.4.3-.6.6-.6z"/></svg></a>` : '');
      if (settings.tracking_url) document.querySelectorAll('[data-track]').forEach((a) => (a.href = settings.tracking_url));
      if (fc && settings.email) fc.innerHTML = `<a href="mailto:${esc(settings.email)}">${esc(settings.email)}</a>`;
    });
    const toggle = document.querySelector('.menu-toggle'), links = document.getElementById('navLinks');
    toggle.onclick = () => { const o = links.classList.toggle('open'); toggle.setAttribute('aria-expanded', o); };
    document.getElementById('newsletterForm').onsubmit = async (e) => {
      e.preventDefault();
      try { await api('/api/newsletter', { method: 'POST', body: { email: e.target.email.value } }); e.target.reset(); toast('¡Gracias! Ya formas parte de la colmena 🐝'); } catch (err) { toast(err.message); }
    };
    updateCount(); bot(); reveal(); counters(); tilt();
    document.querySelectorAll('[data-bees]').forEach((el) => beeField(el, Number(el.dataset.bees) || 16));
    const hdr = document.querySelector('.site-header');
    addEventListener('scroll', () => hdr.classList.toggle('scrolled', scrollY > 140), { passive: true });
  });

  return { beeField, BEE, WA, esc, eur, date, paragraphs, api, toast, cart, waLink, settingsReady, hotelMap, hotelIcon, get settings() { return settings; } };
})();
