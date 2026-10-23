// Tarjetas de producto y publicación reutilizables
function productCard(p) {
  const { esc, eur } = BG;
  return `<article class="card product reveal visible">
    <a class="stretched" href="/producto?p=${encodeURIComponent(p.slug)}"><div class="thumb">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : ''}${p.discount_percent ? `<span class="hex-badge">-${p.discount_percent}%<small>DESC.</small></span>` : p.featured ? '<span class="hex-badge">⭐<small>TOP</small></span>' : ''}</div></a>
    <div class="card-body"><span class="badge green" style="align-self:start">${esc(p.category)}</span><h3><a class="stretched" href="/producto?p=${encodeURIComponent(p.slug)}">${esc(p.name)}</a></h3><p class="muted" style="margin:0">${esc(p.short || '')}</p>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:10px"><span class="price">${eur(p.final_cents)}${p.discount_percent ? `<s>${eur(p.price_cents)}</s>` : ''}</span>
    ${p.stock > 0 ? `<button class="btn small" data-add="${p.id}">Añadir</button>` : '<span class="badge">Agotado</span>'}</div></div></article>`;
}
function postCard(p) {
  const { esc, date } = BG;
  return `<article class="card reveal visible"><a class="stretched" href="/publicacion?p=${encodeURIComponent(p.slug)}">
    <div class="thumb">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : ''}<span class="badge corner ${p.type === 'noticia' ? '' : 'green'}">${p.type === 'noticia' ? 'Noticia' : 'Participación'}</span></div>
    <div class="card-body"><small class="muted">${date(p.created_at)}</small><h3>${esc(p.title)}</h3><p class="muted" style="margin:0">${esc(p.excerpt || '')}</p></div></a></article>`;
}
