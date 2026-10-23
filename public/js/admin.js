// Panel de administración de Bee Green
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const crc = (c) => '₡' + Math.round(Number(c || 0) / 100).toLocaleString('es-CR').replace(/ | /g, ' ');
const fecha = (s) => s ? new Date(String(s).replace(' ', 'T') + 'Z').toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' }) : '';
async function api(url, opts = {}) {
  const o = { ...opts };
  if (o.body && !(o.body instanceof FormData)) { o.headers = { 'content-type': 'application/json' }; o.body = JSON.stringify(o.body); }
  const r = await fetch(url, o);
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.endsWith('/login')) { showLogin(); throw new Error('Tu sesión expiró'); }
  if (!r.ok) throw new Error(data.error || 'Error');
  return data;
}
function toast(t) { const el = $('.toast'); el.textContent = t; el.classList.add('show'); clearTimeout(el._h); el._h = setTimeout(() => el.classList.remove('show'), 2600); }
const modal = $('#modal');
function openModal(html) { $('#modalBody').innerHTML = html; modal.showModal(); return $('#modalBody'); }
const confirmar = (t) => window.confirm(t);

// ---------- sesión ----------
function showLogin() { $('#login').classList.remove('hidden'); $('#app').classList.add('hidden'); }
function showApp() { $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); go(location.hash.slice(1) || 'resumen'); }
$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  try { await api('/api/admin/login', { method: 'POST', body: { password: e.target.password.value } }); showApp(); }
  catch (x) { $('#loginErr').textContent = x.message; $('#loginErr').classList.remove('hidden'); }
};
$('#logout').onclick = async () => { await api('/api/admin/logout', { method: 'POST' }); showLogin(); };
$('#sideToggle').onclick = () => $('.sidebar').classList.toggle('open');
fetch('/api/admin/me').then((r) => (r.ok ? showApp() : showLogin()));

// ---------- navegación ----------
const views = {};
let current = null;
addEventListener('hashchange', () => { const t = location.hash.slice(1); if (t !== current && !$('#app').classList.contains('hidden')) go(t); });
async function go(tab) {
  if (!views[tab]) tab = 'resumen';
  current = tab;
  location.hash = tab;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('.sidebar').classList.remove('open');
  $('#view').innerHTML = '<p class="muted">Cargando…</p>';
  try { await views[tab]($('#view')); } catch (e) { $('#view').innerHTML = `<div class="alert error">${esc(e.message)}</div>`; }
  badges();
}
document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => go(b.dataset.tab)));
async function badges() {
  const s = await api('/api/admin/summary').catch(() => null);
  if (!s) return;
  $('#n-orders').textContent = s.orders_new || ''; $('#n-hotels').textContent = s.hotels_pending || '';
  $('#n-bot').textContent = s.bot_unanswered || ''; $('#n-msgs').textContent = s.messages || '';
}
const head = (title, actions = '') => `<div class="view-head"><h1>${title}</h1><div class="btn-row">${actions}</div></div>`;

// ---------- resumen ----------
views.resumen = async (el) => {
  const s = await api('/api/admin/summary');
  const k = (n, t, tab) => `<a class="kpi" href="#${tab}" style="text-decoration:none" onclick="go('${tab}')"><strong>${n}</strong><span>${t}</span></a>`;
  el.innerHTML = head('¡Hola! 🐝') + `<div class="kpis">
    ${k(s.orders_new, 'Pedidos nuevos', 'pedidos')}${k(crc(s.sales_cents), 'Ventas totales', 'pedidos')}
    ${k(s.hotels_pending, 'Hoteles por aprobar', 'mapa')}${k(s.hotels_approved, 'Hoteles en el mapa', 'mapa')}
    ${k(s.products, 'Productos', 'productos')}${k(s.low_stock, 'Con poco stock (≤3)', 'productos')}
    ${k(s.codes_free, 'Códigos sin usar', 'codigos')}${k(s.bot_unanswered, 'Preguntas del bot sin respuesta', 'bot')}
    ${k(s.messages, 'Mensajes sin leer', 'mensajes')}${k(s.subscribers, 'Suscriptores', 'suscriptores')}</div>
    <div class="panel" style="margin-top:24px"><h3>Atajos</h3><div class="btn-row">
      <button class="btn" onclick="go('productos').then(() => editProduct())">+ Nuevo producto</button>
      <button class="btn honey" onclick="go('codigos')">Generar códigos</button>
      <button class="btn indigo" onclick="go('publicaciones').then(() => editPost())">+ Nueva publicación</button></div></div>`;
};

// ---------- pedidos ----------
const ESTADOS = ['nuevo', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado'];
const PAGO = { sinpe: 'SINPE Móvil', transferencia: 'Transferencia', tarjeta: 'Tarjeta' };
views.pedidos = async (el) => {
  const orders = await api('/api/admin/orders');
  el.innerHTML = head('Pedidos') + `<div class="toolbar"><select id="fEstado"><option value="">Todos los estados</option>${ESTADOS.map((e) => `<option>${e}</option>`).join('')}</select></div><div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Productos</th><th>Total</th><th>Pago</th><th>Estado</th></tr></thead><tbody id="rows"></tbody></table></div>`;
  const render = () => {
    const f = $('#fEstado').value;
    $('#rows').innerHTML = orders.filter((o) => !f || o.status === f).map((o) => `<tr>
      <td><strong>${o.id}</strong></td><td>${fecha(o.created_at)}</td>
      <td><strong>${esc(o.name)}</strong><br><small>${esc(o.email)} · <a href="https://wa.me/${esc(String(o.phone || '').replace(/\D/g, '').replace(/^(\d{8})$/, '506$1'))}" target="_blank">${esc(o.phone)}</a></small><br><small class="muted">${esc(o.city)}, ${esc(o.postal_code)} · ${esc(o.address)}</small>${o.notes ? `<br><small>📝 ${esc(o.notes)}</small>` : ''}</td>
      <td><ul class="order-items">${o.items.map((i) => `<li>${i.qty} × ${esc(i.name)}</li>`).join('')}</ul></td>
      <td><strong>${crc(o.total_cents)}</strong>${o.discount_cents ? `<br><small>Cupón ${esc(o.coupon)}: −${crc(o.discount_cents)}</small>` : ''}</td>
      <td>${PAGO[o.payment_method] || '-'}</td>
      <td><select data-id="${o.id}" class="tag ${o.status}">${ESTADOS.map((e) => `<option ${e === o.status ? 'selected' : ''}>${e}</option>`).join('')}</select></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Todavía no hay pedidos.</td></tr>';
    el.querySelectorAll('select[data-id]').forEach((s) => (s.onchange = async () => {
      if (s.value === 'cancelado' && !confirmar('¿Cancelar el pedido? El stock se devuelve automáticamente.')) return render();
      await api('/api/admin/orders/' + s.dataset.id, { method: 'PATCH', body: { status: s.value } });
      orders.find((o) => o.id == s.dataset.id).status = s.value; s.className = 'tag ' + s.value; toast('Estado actualizado'); badges();
    }));
  };
  $('#fEstado').onchange = render; render();
};

// ---------- productos ----------
let productsCache = [];
views.productos = async (el) => {
  productsCache = await api('/api/admin/products');
  el.innerHTML = head('Productos', '<button class="btn" id="newP">+ Nuevo producto</button>') + `<div class="toolbar"><input id="q" placeholder="Buscar…"></div><div class="table-wrap"><table>
    <thead><tr><th></th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Descuento</th><th>Precio final</th><th>Stock</th><th>Estado</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>`;
  const render = () => {
    const q = $('#q').value.toLowerCase();
    $('#rows').innerHTML = productsCache.filter((p) => !q || (p.name + p.category).toLowerCase().includes(q)).map((p) => `<tr>
      <td>${p.image ? `<img class="t" src="${esc(p.image)}" alt="">` : ''}</td>
      <td><strong>${esc(p.name)}</strong>${p.featured ? ' ⭐' : ''}${p.model_3d ? ' <span class="tag">3D</span>' : ''}<br><small class="muted">${esc(p.short || '')}</small></td>
      <td>${esc(p.category)}</td><td>${crc(p.price_cents)}</td><td>${p.discount_percent ? `<span class="tag nuevo">−${p.discount_percent}%</span>` : '-'}</td>
      <td><strong>${crc(p.final_cents)}</strong></td><td>${p.stock <= 3 ? `<span class="tag cancelado">${p.stock}</span>` : p.stock}</td>
      <td>${p.active ? '<span class="tag approved">Visible</span>' : '<span class="tag off">Oculto</span>'}</td>
      <td><div class="actions"><button class="btn small" data-edit="${p.id}">Editar</button><button class="btn small ghost" data-toggle="${p.id}">${p.active ? 'Ocultar' : 'Mostrar'}</button><button class="btn small danger" data-del="${p.id}">Eliminar</button></div></td></tr>`).join('') || '<tr><td colspan="9" class="muted">No hay productos.</td></tr>';
    el.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => editProduct(productsCache.find((p) => p.id == b.dataset.edit))));
    el.querySelectorAll('[data-toggle]').forEach((b) => (b.onclick = async () => {
      const p = productsCache.find((x) => x.id == b.dataset.toggle);
      const fd = productForm(p); fd.set('active', p.active ? '0' : '1');
      await api('/api/admin/products/' + p.id, { method: 'PUT', body: fd }); go('productos');
    }));
    el.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => { if (!confirmar('¿Eliminar este producto? No se puede deshacer. (Si solo quieres sacarlo de la tienda, usa "Ocultar")')) return; await api('/api/admin/products/' + b.dataset.del, { method: 'DELETE' }); go('productos'); }));
  };
  $('#q').oninput = render; $('#newP').onclick = () => editProduct(); render();
};
function productForm(p) {
  const fd = new FormData();
  Object.entries({ name: p.name, short: p.short || '', description: p.description || '', category: p.category, price: p.price_cents / 100, discount_percent: p.discount_percent, stock: p.stock, active: p.active ? 1 : 0, featured: p.featured ? 1 : 0, sort_order: p.sort_order, show_3d: p.show_3d ? 1 : 0 }).forEach(([k, v]) => fd.set(k, v));
  return fd;
}
function editProduct(p = null) {
  const cats = [...new Set(['Hoteles domésticos', 'Hoteles empresariales', 'Kits de semillas', 'Kits para armar', 'Talleres', ...productsCache.map((x) => x.category)])];
  const v = p || { name: '', short: '', description: '', category: cats[0], price_cents: 0, discount_percent: 0, stock: 10, active: 1, featured: 0, sort_order: 0, show_3d: 1 };
  const body = openModal(`<h2>${p ? 'Editar producto' : 'Nuevo producto'}</h2><form class="form" id="pf">
    <label>Nombre<input name="name" required value="${esc(v.name)}"></label>
    <label>Descripción corta <span class="hint">(se ve en la tarjeta)</span><input name="short" maxlength="200" value="${esc(v.short)}"></label>
    <label>Descripción completa<textarea name="description" rows="5">${esc(v.description)}</textarea></label>
    <div class="row">
      <label>Categoría<input name="category" list="cats" value="${esc(v.category)}" required><datalist id="cats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
      <label>Orden <span class="hint">(menor = primero)</span><input type="number" name="sort_order" value="${v.sort_order}"></label>
    </div>
    <div class="row">
      <label>Precio (₡)<input type="number" name="price" min="0" step="1" required value="${v.price_cents / 100}"></label>
      <label>Descuento (%)<input type="number" name="discount_percent" min="0" max="90" value="${v.discount_percent}"></label>
      <label>Stock / cupos<input type="number" name="stock" min="0" value="${v.stock}"></label>
    </div>
    <p class="hint" id="finalPrice"></p>
    <label>Foto del producto<input type="file" name="image" accept="image/*">${v.image ? `<img class="preview-img" src="${esc(v.image)}" alt=""><span class="check"><input type="checkbox" name="remove_image" value="1"> Quitar foto</span>` : ''}</label>
    <label>Modelo 3D (.glb) <span class="hint">opcional · si no hay, los hoteles muestran un modelo 3D genérico</span><input type="file" name="model" accept=".glb">${v.model_3d ? `<span class="hint">✅ Tiene modelo 3D</span><span class="check"><input type="checkbox" name="remove_model" value="1"> Quitar modelo</span>` : ''}</label>
    <div class="btn-row">
      <label class="check"><input type="checkbox" name="active" value="1" ${v.active ? 'checked' : ''}> Visible en la tienda</label>
      <label class="check"><input type="checkbox" name="featured" value="1" ${v.featured ? 'checked' : ''}> Destacado en el inicio</label>
      <label class="check"><input type="checkbox" name="show_3d" value="1" ${v.show_3d ? 'checked' : ''}> Mostrar visor 3D</label>
    </div>
    <p class="alert error hidden" id="pe"></p>
    <button class="btn honey">Guardar</button></form>`);
  const f = $('#pf', body);
  const calc = () => { const pr = +f.price.value || 0, d = +f.discount_percent.value || 0; $('#finalPrice').textContent = d ? `Precio final con descuento: ${crc(Math.round(pr * (100 - d)))}` : ''; };
  f.price.oninput = f.discount_percent.oninput = calc; calc();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    ['active', 'featured', 'show_3d'].forEach((k) => fd.set(k, f[k].checked ? '1' : '0'));
    const btn = f.querySelector('button.btn'); btn.disabled = true; btn.textContent = 'Guardando…';
    try { await api('/api/admin/products' + (p ? '/' + p.id : ''), { method: p ? 'PUT' : 'POST', body: fd }); modal.close(); toast('Producto guardado'); go('productos'); }
    catch (x) { $('#pe').textContent = x.message; $('#pe').classList.remove('hidden'); btn.disabled = false; btn.textContent = 'Guardar'; }
  };
}

// ---------- cupones ----------
views.cupones = async (el) => {
  const list = await api('/api/admin/coupons');
  el.innerHTML = head('Cupones de descuento') + `<form class="panel form" id="cf" style="margin-bottom:20px"><h3 style="margin:0">Nuevo cupón</h3><div class="row">
    <label>Código<input name="code" required placeholder="VERANO15" style="text-transform:uppercase"></label><label>Descuento (%)<input type="number" name="percent" min="1" max="90" required value="10"></label>
    <label>Compra mínima (₡)<input type="number" name="min" min="0" value="0"></label><label>Usos máximos<input type="number" name="max_uses" min="0" placeholder="Sin límite"></label><label>Vence<input type="date" name="expires_at"></label></div>
    <button class="btn">Crear cupón</button></form>
    <div class="table-wrap"><table><thead><tr><th>Código</th><th>Descuento</th><th>Mínimo</th><th>Usos</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>
    ${list.map((c) => `<tr><td><strong>${esc(c.code)}</strong></td><td>${c.percent}%</td><td>${c.min_cents ? crc(c.min_cents) : '-'}</td><td>${c.uses}${c.max_uses ? ' / ' + c.max_uses : ''}</td><td>${esc(c.expires_at || '-')}</td>
      <td>${c.active ? '<span class="tag approved">Activo</span>' : '<span class="tag off">Pausado</span>'}</td>
      <td><div class="actions"><button class="btn small ghost" data-t="${c.id}" data-a="${c.active ? 0 : 1}">${c.active ? 'Pausar' : 'Activar'}</button><button class="btn small danger" data-d="${c.id}">Eliminar</button></div></td></tr>`).join('') || '<tr><td colspan="7" class="muted">No hay cupones.</td></tr>'}
    </tbody></table></div>`;
  $('#cf').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/admin/coupons', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Cupón creado'); go('cupones'); } catch (x) { toast(x.message); } };
  el.querySelectorAll('[data-t]').forEach((b) => (b.onclick = async () => { await api('/api/admin/coupons/' + b.dataset.t, { method: 'PATCH', body: { active: b.dataset.a } }); go('cupones'); }));
  el.querySelectorAll('[data-d]').forEach((b) => (b.onclick = async () => { if (confirmar('¿Eliminar el cupón?')) { await api('/api/admin/coupons/' + b.dataset.d, { method: 'DELETE' }); go('cupones'); } }));
};

// ---------- códigos ----------
views.codigos = async (el) => {
  const list = await api('/api/admin/codes');
  el.innerHTML = head('Códigos de hotel') + `<div class="grid grid-2" style="align-items:start;gap:20px;margin-bottom:20px">
    <form class="panel form" id="gf"><h3 style="margin:0">Generar códigos</h3>
      <p class="hint" style="margin:0">Los códigos <strong>BG-</strong> son para clientes normales. Los <strong>EMP-</strong> son de empresa: el hotel aparece en el mapa con el logo de la empresa.</p>
      <div class="row"><label>Tipo<select name="type" id="gtype"><option value="normal">Normal (BG-)</option><option value="empresa">Empresa (EMP-)</option></select></label><label>Cantidad<input type="number" name="quantity" min="1" max="500" value="10"></label></div>
      <div id="empFields" class="hidden form"><label>Nombre de la empresa<input name="company_name"></label><label>Logo de la empresa <span class="hint">(opcional; también lo pueden subir al registrar)</span><input type="file" name="company_logo" accept="image/*"></label></div>
      <label>Nota interna<input name="note" placeholder="Ej.: lote octubre, feria, pedido #12"></label>
      <button class="btn honey">Generar</button></form>
    <div id="out"></div></div>
    <div class="toolbar"><input id="q" placeholder="Buscar código o empresa…"><select id="fu"><option value="">Todos</option><option value="libre">Sin usar</option><option value="usado">Usados</option></select><button class="btn small ghost" id="csv">Descargar CSV</button></div>
    <div class="table-wrap"><table><thead><tr><th>Código</th><th>Tipo</th><th>Empresa</th><th>Nota</th><th>Creado</th><th>Estado</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>`;
  $('#gtype').onchange = (e) => $('#empFields').classList.toggle('hidden', e.target.value !== 'empresa');
  $('#gf').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api('/api/admin/codes', { method: 'POST', body: new FormData(e.target) });
      await views.codigos(el);
      $('#out').innerHTML = `<div class="panel"><h3>✅ ${r.codes.length} códigos nuevos</h3><p class="hint">Cópialos para imprimirlos en las tarjetas de los hoteles. Enlace directo: ${location.origin}/registra-tu-hotel?codigo=CÓDIGO</p><div class="codes-out">${r.codes.join('\n')}</div><button class="btn small" id="copy" style="margin-top:10px">Copiar</button></div>`;
      $('#copy').onclick = () => navigator.clipboard.writeText(r.codes.join('\n')).then(() => toast('Copiados'));
    } catch (x) { toast(x.message); }
  };
  const filtered = () => { const q = $('#q').value.toLowerCase(), u = $('#fu').value; return list.filter((c) => (!q || (c.code + (c.company_name || '') + (c.note || '')).toLowerCase().includes(q)) && (!u || (u === 'usado') === !!c.used_at)); };
  const render = () => {
    $('#rows').innerHTML = filtered().slice(0, 300).map((c) => `<tr><td><strong style="font-family:monospace">${esc(c.code)}</strong></td><td>${c.type === 'empresa' ? '<span class="tag preparando">Empresa</span>' : 'Normal'}</td>
      <td>${c.company_logo ? `<img src="${esc(c.company_logo)}" style="height:24px;display:inline;vertical-align:middle"> ` : ''}${esc(c.company_name || '')}</td><td>${esc(c.note || '')}</td><td>${fecha(c.created_at)}</td>
      <td>${c.used_at ? `<span class="tag approved">Usado</span><br><small>${fecha(c.used_at)}</small>` : '<span class="tag nuevo">Libre</span>'}</td>
      <td>${c.used_at ? '' : `<button class="btn small danger" data-d="${esc(c.code)}">Eliminar</button>`}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">No hay códigos.</td></tr>';
    el.querySelectorAll('[data-d]').forEach((b) => (b.onclick = async () => { if (confirmar('¿Eliminar el código ' + b.dataset.d + '?')) { await api('/api/admin/codes/' + encodeURIComponent(b.dataset.d), { method: 'DELETE' }); go('codigos'); } }));
  };
  $('#q').oninput = $('#fu').onchange = render;
  $('#csv').onclick = () => {
    const rows = [['codigo', 'tipo', 'empresa', 'nota', 'usado', 'enlace'], ...filtered().map((c) => [c.code, c.type, c.company_name || '', c.note || '', c.used_at ? 'si' : 'no', `${location.origin}/registra-tu-hotel?codigo=${c.code}`])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'codigos-bee-green.csv'; a.click();
  };
  render();
};

// ---------- mapa / moderación ----------
views.mapa = async (el) => {
  const list = await api('/api/admin/hotels');
  const s = await api('/api/admin/settings');
  el.innerHTML = head('Mapa de la comunidad') + `<div class="panel" style="margin-bottom:20px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
    <span id="autoTxt"></span>
    <label class="check"><input type="checkbox" id="auto" ${s.auto_approve_hotels === '1' ? 'checked' : ''}> Publicar automáticamente si no hay nada inadecuado</label></div>
    <form class="panel form" id="bw" style="margin-bottom:20px"><label>Palabras bloqueadas extra <span class="hint">(separadas por coma; ya se bloquean las groserías más comunes en español e inglés, enlaces, teléfonos y correos)</span><textarea name="blocked_words" rows="2">${esc(s.blocked_words || '')}</textarea></label><button class="btn small" style="justify-self:start">Guardar palabras</button></form>
    <div id="amap" class="map small" style="margin-bottom:20px"></div>
    <div class="toolbar"><select id="fs"><option value="">Todos</option><option value="pending" selected>Por aprobar</option><option value="approved">Publicados</option><option value="rejected">Rechazados</option></select></div>
    <div class="grid" id="cards"></div>`;
  const autoTxt = (on) => ($('#autoTxt').innerHTML = on ? 'Los hoteles nuevos <strong>se publican solos</strong>. Si el texto tiene malas palabras, enlaces o teléfonos, quedan aquí <strong>por aprobar</strong> con el motivo.' : 'Los hoteles nuevos <strong>esperan tu aprobación</strong> antes de salir en el mapa.');
  autoTxt(s.auto_approve_hotels === '1');
  $('#auto').onchange = async (e) => { await api('/api/admin/settings', { method: 'PUT', body: { auto_approve_hotels: e.target.checked ? '1' : '0' } }); autoTxt(e.target.checked); toast('Guardado'); };
  $('#bw').onsubmit = async (e) => { e.preventDefault(); await api('/api/admin/settings', { method: 'PUT', body: { blocked_words: e.target.blocked_words.value } }); toast('Palabras guardadas'); };
  if (!list.some((h) => h.status === 'pending')) $('#fs').value = '';
  const map = L.map('amap').setView([9.85, -84.1], 7);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap · © CARTO' }).addTo(map);
  const color = { pending: '#e1aa2a', approved: '#193f3a', rejected: '#c0392b' };
  list.forEach((h) => L.circleMarker([h.lat, h.lng], { radius: 8, color: '#fff', weight: 2, fillColor: color[h.status], fillOpacity: 1 }).addTo(map).bindPopup(`<strong>${esc(h.company_name || h.name)}</strong><br>${esc(h.city || '')}`));
  const ST = { pending: 'Por aprobar', approved: 'Publicado', rejected: 'Rechazado' };
  const render = () => {
    const f = $('#fs').value;
    $('#cards').innerHTML = list.filter((h) => !f || h.status === f).map((h) => `<div class="hotel-card">
      ${h.photo ? `<a href="${esc(h.photo)}" target="_blank"><img class="ph" src="${esc(h.photo)}" alt=""></a>` : '<div class="ph" style="width:120px;height:120px;border-radius:10px;background:var(--cream-2);display:grid;place-items:center">Sin foto</div>'}
      <div><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>${h.logo ? `<img src="${esc(h.logo)}" style="height:28px;display:inline;vertical-align:middle"> ` : ''}${esc(h.company_name || h.name)}</strong><span class="tag ${h.status}">${ST[h.status]}</span></div>
      <small class="muted">${esc(h.city || '')} · ${fecha(h.created_at)} · código ${esc(h.code || '-')}${h.email ? ' · ' + esc(h.email) : ''}</small>
      ${h.message ? `<p style="margin:6px 0">“${esc(h.message)}”</p>` : ''}${h.flag_reason && h.status === 'pending' ? `<p class="alert error" style="margin:6px 0;padding:8px 12px">⚠️ No se publicó solo: ${esc(h.flag_reason)}</p>` : ''}
      <div class="actions" style="margin-top:8px">${h.status !== 'approved' ? `<button class="btn small" data-s="approved" data-id="${h.id}">Aprobar</button>` : ''}${h.status !== 'rejected' ? `<button class="btn small ghost" data-s="rejected" data-id="${h.id}">Rechazar</button>` : ''}
      <button class="btn small ghost" data-fly="${h.id}">Ver en mapa</button><button class="btn small danger" data-del="${h.id}">Eliminar</button></div></div></div>`).join('') || '<p class="muted">No hay hoteles en este filtro.</p>';
    el.querySelectorAll('[data-s]').forEach((b) => (b.onclick = async () => { await api('/api/admin/hotels/' + b.dataset.id, { method: 'PATCH', body: { status: b.dataset.s } }); list.find((h) => h.id == b.dataset.id).status = b.dataset.s; toast('Actualizado'); render(); badges(); }));
    el.querySelectorAll('[data-fly]').forEach((b) => (b.onclick = () => { const h = list.find((x) => x.id == b.dataset.fly); map.flyTo([h.lat, h.lng], 14); $('#amap').scrollIntoView({ behavior: 'smooth' }); }));
    el.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => { if (confirmar('¿Eliminar este hotel? Su código queda libre para volver a usarse.')) { await api('/api/admin/hotels/' + b.dataset.del, { method: 'DELETE' }); go('mapa'); } }));
  };
  $('#fs').onchange = render; render();
};

// ---------- publicaciones ----------
let postsCache = [];
views.publicaciones = async (el) => {
  postsCache = await api('/api/admin/posts');
  el.innerHTML = head('Noticias y participaciones', '<button class="btn" id="newPost">+ Nueva publicación</button>') + `<div class="table-wrap"><table><thead><tr><th></th><th>Título</th><th>Tipo</th><th>Fecha</th><th>Estado</th><th></th></tr></thead><tbody>
    ${postsCache.map((p) => `<tr><td>${p.image ? `<img class="t" src="${esc(p.image)}" alt="">` : ''}</td><td><strong>${esc(p.title)}</strong><br><small class="muted">${esc(p.excerpt || '')}</small></td>
      <td>${p.type === 'noticia' ? 'Noticia' : 'Participación'}</td><td>${fecha(p.created_at)}</td><td>${p.published ? '<span class="tag approved">Publicada</span>' : '<span class="tag off">Borrador</span>'}</td>
      <td><div class="actions"><button class="btn small" data-e="${p.id}">Editar</button><a class="btn small ghost" target="_blank" href="/publicacion?p=${encodeURIComponent(p.slug)}">Ver</a><button class="btn small danger" data-d="${p.id}">Eliminar</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="muted">No hay publicaciones.</td></tr>'}
    </tbody></table></div>`;
  $('#newPost').onclick = () => editPost();
  el.querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => editPost(postsCache.find((p) => p.id == b.dataset.e))));
  el.querySelectorAll('[data-d]').forEach((b) => (b.onclick = async () => { if (confirmar('¿Eliminar la publicación?')) { await api('/api/admin/posts/' + b.dataset.d, { method: 'DELETE' }); go('publicaciones'); } }));
};
function editPost(p = null) {
  const v = p || { type: 'noticia', title: '', excerpt: '', body: '', published: 1 };
  const body = openModal(`<h2>${p ? 'Editar publicación' : 'Nueva publicación'}</h2><form class="form" id="pf">
    <div class="row"><label>Tipo<select name="type"><option value="noticia" ${v.type === 'noticia' ? 'selected' : ''}>Noticia</option><option value="participacion" ${v.type === 'participacion' ? 'selected' : ''}>Participación (talleres, ferias, colaboraciones)</option></select></label></div>
    <label>Título<input name="title" required value="${esc(v.title)}"></label>
    <label>Resumen <span class="hint">(se ve en la tarjeta)</span><input name="excerpt" maxlength="400" value="${esc(v.excerpt || '')}"></label>
    <label>Texto <span class="hint">(deja una línea en blanco entre párrafos)</span><textarea name="body" rows="10">${esc(v.body || '')}</textarea></label>
    <label>Imagen de portada<input type="file" name="image" accept="image/*">${v.image ? `<img class="preview-img" src="${esc(v.image)}" alt=""><span class="check"><input type="checkbox" name="remove_image" value="1"> Quitar imagen</span>` : ''}</label>
    <label class="check"><input type="checkbox" name="published" value="1" ${v.published ? 'checked' : ''}> Publicada (si no, queda como borrador)</label>
    <p class="alert error hidden" id="pe"></p><button class="btn honey">Guardar</button></form>`);
  const f = $('#pf', body);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(f); fd.set('published', f.published.checked ? '1' : '0');
    try { await api('/api/admin/posts' + (p ? '/' + p.id : ''), { method: p ? 'PUT' : 'POST', body: fd }); modal.close(); toast('Publicación guardada'); go('publicaciones'); }
    catch (x) { $('#pe').textContent = x.message; $('#pe').classList.remove('hidden'); }
  };
}

// ---------- bot ----------
views.bot = async (el) => {
  const [faqs, qs] = await Promise.all([api('/api/admin/faqs'), api('/api/admin/bot-questions')]);
  const pending = qs.filter((q) => !q.answered);
  el.innerHTML = head('Bot de dudas (Abi)', '<button class="btn" id="newF">+ Nueva pregunta y respuesta</button>') + `
    <p class="muted">Abi responde con estas preguntas y respuestas. Las <strong>palabras clave</strong> ayudan a reconocer distintas formas de preguntar lo mismo (por ejemplo: pican, picadura, aguijón, peligrosas).</p>
    ${pending.length ? `<div class="panel" style="margin-bottom:20px"><h3>❓ Preguntas que Abi no supo responder (${pending.length})</h3><div class="table-wrap"><table><tbody>${pending.map((q) => `<tr><td>${esc(q.question)}<br><small class="muted">${fecha(q.created_at)}</small></td><td><div class="actions"><button class="btn small honey" data-ans="${q.id}">Responder</button><button class="btn small ghost" data-rm="${q.id}">Descartar</button></div></td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <div class="table-wrap"><table><thead><tr><th>Pregunta</th><th>Respuesta</th><th>Estado</th><th></th></tr></thead><tbody>
    ${faqs.map((f) => `<tr><td><strong>${esc(f.question)}</strong><br><small class="muted">🔑 ${esc(f.keywords || '')}</small></td><td><small>${esc(f.answer)}</small></td><td>${f.active ? '<span class="tag approved">Activa</span>' : '<span class="tag off">Inactiva</span>'}</td>
      <td><div class="actions"><button class="btn small" data-e="${f.id}">Editar</button><button class="btn small danger" data-d="${f.id}">Eliminar</button></div></td></tr>`).join('')}
    </tbody></table></div>`;
  $('#newF').onclick = () => editFaq();
  el.querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => editFaq(faqs.find((f) => f.id == b.dataset.e))));
  el.querySelectorAll('[data-d]').forEach((b) => (b.onclick = async () => { if (confirmar('¿Eliminar esta pregunta?')) { await api('/api/admin/faqs/' + b.dataset.d, { method: 'DELETE' }); go('bot'); } }));
  el.querySelectorAll('[data-ans]').forEach((b) => (b.onclick = () => { const q = qs.find((x) => x.id == b.dataset.ans); editFaq({ question: q.question, answer: '', keywords: '', active: 1, sort_order: 50 }, q.id); }));
  el.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = async () => { await api('/api/admin/bot-questions/' + b.dataset.rm, { method: 'DELETE' }); go('bot'); }));
};
function editFaq(f = null, fromQ = null) {
  const v = f || { question: '', answer: '', keywords: '', active: 1, sort_order: 0 };
  const body = openModal(`<h2>${f && f.id ? 'Editar' : 'Nueva'} pregunta</h2><form class="form" id="ff">
    <label>Pregunta<input name="question" required value="${esc(v.question)}"></label>
    <label>Respuesta de Abi<textarea name="answer" rows="5" required>${esc(v.answer)}</textarea></label>
    <label>Palabras clave <span class="hint">(separadas por espacios: sinónimos y formas de preguntar)</span><input name="keywords" value="${esc(v.keywords || '')}"></label>
    <div class="row"><label>Orden<input type="number" name="sort_order" value="${v.sort_order || 0}"></label><label class="check" style="align-self:end"><input type="checkbox" name="active" ${v.active ? 'checked' : ''}> Activa</label></div>
    <p class="hint">Las 6 primeras (por orden) aparecen como botones al abrir el bot.</p>
    <button class="btn honey">Guardar</button></form>`);
  $('#ff', body).onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target)); data.active = e.target.active.checked ? 1 : 0; if (fromQ) data.from_question_id = fromQ;
    try { await api('/api/admin/faqs' + (f && f.id ? '/' + f.id : ''), { method: f && f.id ? 'PUT' : 'POST', body: data }); modal.close(); toast('Guardado'); go('bot'); } catch (x) { toast(x.message); }
  };
}

// ---------- mensajes y suscriptores ----------
views.mensajes = async (el) => {
  const list = await api('/api/admin/messages');
  el.innerHTML = head('Mensajes de contacto') + `<div class="grid">${list.map((m) => `<div class="panel" style="padding:18px;${m.read ? 'opacity:.7' : ''}"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>${esc(m.name)} · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a></strong><small class="muted">${fecha(m.created_at)}</small></div><p style="margin:8px 0;white-space:pre-wrap">${esc(m.message)}</p>${m.read ? '' : `<button class="btn small ghost" data-r="${m.id}">Marcar como leído</button>`}</div>`).join('') || '<p class="muted">No hay mensajes.</p>'}</div>`;
  el.querySelectorAll('[data-r]').forEach((b) => (b.onclick = async () => { await api('/api/admin/messages/' + b.dataset.r, { method: 'PATCH' }); go('mensajes'); }));
};
views.suscriptores = async (el) => {
  const list = await api('/api/admin/subscribers');
  el.innerHTML = head('Suscriptores del boletín', '<button class="btn small" id="copyAll">Copiar todos los correos</button>') + `<div class="table-wrap"><table><thead><tr><th>Correo</th><th>Fecha</th></tr></thead><tbody>${list.map((s) => `<tr><td>${esc(s.email)}</td><td>${fecha(s.created_at)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Todavía no hay suscriptores.</td></tr>'}</tbody></table></div>`;
  $('#copyAll').onclick = () => navigator.clipboard.writeText(list.map((s) => s.email).join(', ')).then(() => toast('Copiados'));
};

// ---------- ajustes ----------
views.ajustes = async (el) => {
  const s = await api('/api/admin/settings');
  const val = (k) => esc(s[k] || '');
  el.innerHTML = head('Ajustes y pagos') + `<form class="form" id="sf">
    <div class="panel form"><h3 style="margin:0">Contacto</h3><div class="row">
      <label>WhatsApp <span class="hint">(con código de país, ej.: 50689935184)</span><input name="whatsapp" value="${val('whatsapp')}"></label>
      <label>Correo de contacto<input name="email" value="${val('email')}"></label></div>
      <label>Mensaje inicial de WhatsApp<input name="whatsapp_message" value="${val('whatsapp_message')}"></label>
      <label>Enlace de "Rastrea tu pedido"<input name="tracking_url" value="${val('tracking_url')}" placeholder="https://correos.go.cr/rastreo/"></label>
      <div class="row"><label>Instagram <span class="hint">(usuario sin @)</span><input name="instagram" value="${val('instagram')}"></label><label>Facebook <span class="hint">(usuario o página)</span><input name="facebook" value="${val('facebook')}"></label></div></div>
    <div class="panel form"><h3 style="margin:0">Envíos</h3><div class="row">
      <label>Costo de envío (₡)<input type="number" name="shipping" value="${(+s.shipping_cents || 0) / 100}"></label>
      <label>Envío gratis desde (₡) <span class="hint">(0 = nunca)</span><input type="number" name="free_from" value="${(+s.free_shipping_from_cents || 0) / 100}"></label></div></div>
    <div class="panel form"><h3 style="margin:0">SINPE Móvil</h3><p class="hint" style="margin:0">Deja el número vacío para no ofrecer esta opción.</p><div class="row">
      <label>Número SINPE<input name="sinpe_number" value="${val('sinpe_number')}"></label><label>A nombre de<input name="sinpe_name" value="${val('sinpe_name')}"></label></div></div>
    <div class="panel form"><h3 style="margin:0">Transferencia bancaria</h3><p class="hint" style="margin:0">Deja el IBAN vacío para no ofrecer esta opción.</p><div class="row">
      <label>Banco<input name="bank_name" value="${val('bank_name')}"></label><label>Cuenta IBAN<input name="bank_iban" value="${val('bank_iban')}"></label><label>Titular<input name="bank_holder" value="${val('bank_holder')}"></label></div></div>
    <div class="panel form"><h3 style="margin:0">Tarjeta</h3>
      <label class="check"><input type="checkbox" name="card_enabled" ${s.card_enabled === '1' ? 'checked' : ''}> Ofrecer pago con tarjeta</label>
      <label>Enlace de pago <span class="hint">(opcional: un enlace de pago de su pasarela, p. ej. ONVO o Tilopay. Si está vacío, se le avisa al cliente que le enviarán el enlace)</span><input name="card_link" value="${val('card_link')}" placeholder="https://…"></label></div>
    <button class="btn honey" style="justify-self:start">Guardar ajustes</button></form>`;
  $('#sf').onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    d.shipping_cents = Math.round((+d.shipping || 0) * 100); d.free_shipping_from_cents = Math.round((+d.free_from || 0) * 100);
    d.card_enabled = e.target.card_enabled.checked ? '1' : '0';
    delete d.shipping; delete d.free_from;
    try { await api('/api/admin/settings', { method: 'PUT', body: d }); toast('Ajustes guardados'); } catch (x) { toast(x.message); }
  };
};
