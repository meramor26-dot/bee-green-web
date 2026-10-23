// Bee Green: servidor web, API y panel de administración
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const db = require('./db');
const moderation = require('./moderation');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'beegreen-admin';
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('bg:' + ADMIN_PASSWORD).digest('hex');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'data', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

if (!process.env.ADMIN_PASSWORD && process.env.NODE_ENV === 'production') {
  console.error('Falta ADMIN_PASSWORD: defínela en las variables de entorno del hosting.');
  process.exit(1);
}
if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠️  ADMIN_PASSWORD no definida: usando la contraseña por defecto "beegreen-admin". Cámbiala en producción.');
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.use('/vendor/leaflet', express.static(path.join(__dirname, 'node_modules/leaflet/dist'), { maxAge: '30d' }));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three'), { maxAge: '30d' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// ---------- utilidades ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase().replace(/[^.a-z0-9]/g, '');
      cb(null, Date.now() + '-' + crypto.randomBytes(5).toString('hex') + ext);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'model') {
      const ok = /\.glb$/i.test(file.originalname);
      return cb(ok ? null : new Error('El modelo 3D debe ser un archivo .glb'), ok);
    }
    const ok = /^image\/(jpeg|png|webp|gif|svg\+xml)$/.test(file.mimetype);
    cb(ok ? null : new Error('Solo se permiten imágenes (jpg, png, webp, gif, svg)'), ok);
  },
});
const fileUrl = (f) => (f ? '/uploads/' + f.filename : null);

function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 80) || 'item';
}
function uniqueSlug(table, base, id) {
  let slug = slugify(base), n = 1;
  while (db.prepare(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`).get(slug, id || 0)) slug = slugify(base) + '-' + ++n;
  return slug;
}
const money = (cents) => Math.round(Number(cents) || 0);
const toCents = (v) => Math.round(parseFloat(String(v).replace(',', '.')) * 100) || 0;
const finalPrice = (p) => Math.round(p.price_cents * (100 - (p.discount_percent || 0)) / 100);
const bool = (v) => (v === true || v === 'true' || v === '1' || v === 1 || v === 'on' ? 1 : 0);
const clean = (s, max = 2000) => String(s ?? '').trim().slice(0, max);

function paymentInfo(s) {
  const out = [];
  if (s.sinpe_number) out.push({ id: 'sinpe', label: 'SINPE Móvil', number: s.sinpe_number, name: s.sinpe_name || '' });
  if (s.bank_iban) out.push({ id: 'transferencia', label: 'Transferencia bancaria', bank: s.bank_name || '', iban: s.bank_iban, holder: s.bank_holder || '' });
  if (s.card_enabled === '1') out.push({ id: 'tarjeta', label: 'Tarjeta de crédito o débito', link: s.card_link || '' });
  return out;
}
function getSettings() {
  const out = {};
  for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key] = r.value;
  return out;
}

// sesión de admin con cookie firmada
function sign(v) { return v + '.' + crypto.createHmac('sha256', SECRET).update(v).digest('hex'); }
function verify(token) {
  if (!token) return false;
  const i = token.lastIndexOf('.');
  const v = token.slice(0, i);
  const expected = sign(v);
  if (expected.length !== token.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))) return false;
  return Number(v.split(':')[1]) > Date.now();
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((c) => {
    const i = c.indexOf('=');
    return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())];
  }));
}
function requireAdmin(req, res, next) {
  if (verify(cookies(req).bg_admin)) return next();
  res.status(401).json({ error: 'No autorizado' });
}
const wrap = (fn) => (req, res, next) => { try { fn(req, res, next); } catch (e) { next(e); } };

// límite sencillo de intentos para formularios públicos
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = req.path + ':' + (req.ip || '');
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: 'Demasiados intentos, intenta de nuevo en unos minutos.' });
    arr.push(now); hits.set(key, arr); next();
  };
}

// ---------- API pública ----------
app.get('/api/settings', (req, res) => {
  const s = getSettings();
  res.json({
    whatsapp: s.whatsapp || '', whatsapp_message: s.whatsapp_message || '', email: s.email || '', instagram: s.instagram || '', facebook: s.facebook || '', tracking_url: s.tracking_url || '',
    shipping_cents: Number(s.shipping_cents || 0), free_shipping_from_cents: Number(s.free_shipping_from_cents || 0),
    payments: paymentInfo(s),
  });
});

app.get('/api/stats', (req, res) => {
  const hotels = db.prepare("SELECT COUNT(*) n FROM hotels WHERE status='approved'").get().n;
  const companies = db.prepare("SELECT COUNT(DISTINCT company_name) n FROM hotels WHERE status='approved' AND company_name IS NOT NULL AND company_name != ''").get().n;
  const cities = db.prepare("SELECT COUNT(DISTINCT city) n FROM hotels WHERE status='approved' AND city IS NOT NULL AND city != ''").get().n;
  res.json({ hotels, companies, cities, bees: hotels * 350 });
});

app.get('/api/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY featured DESC, sort_order, id DESC').all();
  res.json(rows.map(publicProduct));
});
app.get('/api/products/:slug', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE slug = ? AND active = 1').get(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(publicProduct(p));
});
function publicProduct(p) {
  return { id: p.id, slug: p.slug, name: p.name, short: p.short, description: p.description, category: p.category, image: p.image, price_cents: p.price_cents, discount_percent: p.discount_percent, final_cents: finalPrice(p), stock: p.stock, featured: !!p.featured, model_3d: p.model_3d, show_3d: !!p.show_3d };
}

app.get('/api/posts', (req, res) => {
  const type = req.query.type;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const rows = type
    ? db.prepare('SELECT id, type, title, slug, excerpt, image, created_at FROM posts WHERE published = 1 AND type = ? ORDER BY created_at DESC LIMIT ?').all(type, limit)
    : db.prepare('SELECT id, type, title, slug, excerpt, image, created_at FROM posts WHERE published = 1 ORDER BY created_at DESC LIMIT ?').all(limit);
  res.json(rows);
});
app.get('/api/posts/:slug', (req, res) => {
  const p = db.prepare('SELECT * FROM posts WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Publicación no encontrada' });
  res.json(p);
});

app.get('/api/hotels', (req, res) => {
  res.json(db.prepare("SELECT id, name, message, city, lat, lng, photo, logo, company_name, created_at FROM hotels WHERE status = 'approved' ORDER BY created_at DESC").all());
});

// Comprueba un código antes de registrar el hotel
app.get('/api/codes/:code', rateLimit(30, 60000), (req, res) => {
  const c = db.prepare('SELECT code, type, company_name, company_logo, used_at FROM codes WHERE code = ?').get(normCode(req.params.code));
  if (!c) return res.status(404).json({ error: 'Código no válido. Revisa que esté bien escrito.' });
  if (c.used_at) return res.status(409).json({ error: 'Este código ya se usó para registrar un hotel.' });
  res.json({ code: c.code, type: c.type, company_name: c.company_name, company_logo: c.company_logo });
});
const normCode = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, '');

app.post('/api/hotels', rateLimit(10, 10 * 60000), upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'logo', maxCount: 1 }]), async (req, res, next) => { try {
  const b = req.body;
  const code = db.prepare('SELECT * FROM codes WHERE code = ?').get(normCode(b.code));
  if (!code) return res.status(400).json({ error: 'Código no válido.' });
  if (code.used_at) return res.status(409).json({ error: 'Este código ya se usó.' });
  const lat = parseFloat(b.lat), lng = parseFloat(b.lng);
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) return res.status(400).json({ error: 'Marca en el mapa dónde colocaste tu hotel.' });
  const photo = fileUrl(req.files?.photo?.[0]);
  const isCompany = code.type === 'empresa';
  const logo = isCompany ? (fileUrl(req.files?.logo?.[0]) || code.company_logo) : null;
  const company = isCompany ? (clean(b.company_name, 120) || code.company_name) : null;
  const s = getSettings();
  const name = clean(b.name, 120) || 'Anónimo', message = clean(b.message, 500), city = clean(b.city, 120);
  let status = 'pending', flag = null;
  if (s.auto_approve_hotels === '1') {
    const files = [req.files?.photo?.[0], isCompany ? req.files?.logo?.[0] : null].filter(Boolean).map((f) => f.path);
    const check = await moderation.review({ texts: [name, message, city, company || ''], files, extraWords: (s.blocked_words || '').split(/[,\n]/) });
    if (check.ok) status = 'approved'; else flag = check.reason;
  }
  const r = db.prepare(`INSERT INTO hotels (code, name, email, message, city, lat, lng, photo, logo, company_name, status, flag_reason)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(code.code, name, clean(b.email, 200), message, city, lat, lng, photo, logo, company, status, flag);
  db.prepare("UPDATE codes SET used_at = datetime('now'), hotel_id = ? WHERE code = ?").run(r.lastInsertRowid, code.code);
  res.json({ ok: true, status });
} catch (e) { next(e); } });

app.post('/api/coupons/check', rateLimit(30, 60000), (req, res) => {
  const c = findCoupon(req.body.code);
  if (!c) return res.status(404).json({ error: 'Cupón no válido o caducado.' });
  res.json({ code: c.code, percent: c.percent, min_cents: c.min_cents });
});
function findCoupon(code) {
  if (!code) return null;
  const c = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(normCode(code));
  if (!c) return null;
  if (c.expires_at && new Date(c.expires_at) < new Date()) return null;
  if (c.max_uses && c.uses >= c.max_uses) return null;
  return c;
}

app.post('/api/orders', rateLimit(10, 10 * 60000), wrap((req, res) => {
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items.slice(0, 50) : [];
  if (!items.length) return res.status(400).json({ error: 'El carrito está vacío.' });
  if (!clean(b.name) || !clean(b.email) || !clean(b.phone) || !clean(b.address)) return res.status(400).json({ error: 'Completa nombre, correo, teléfono y dirección.' });
  const lines = [];
  let subtotal = 0;
  for (const it of items) {
    const p = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(Number(it.id));
    const qty = Math.max(1, Math.min(99, parseInt(it.qty) || 1));
    if (!p) return res.status(400).json({ error: 'Un producto del carrito ya no está disponible.' });
    if (p.stock < qty) return res.status(400).json({ error: `No hay stock suficiente de "${p.name}" (quedan ${p.stock}).` });
    const unit = finalPrice(p);
    lines.push({ id: p.id, name: p.name, qty, unit_cents: unit, total_cents: unit * qty });
    subtotal += unit * qty;
  }
  const s = getSettings();
  const methods = paymentInfo(s);
  const pay = methods.find((m) => m.id === b.payment_method);
  if (!pay) return res.status(400).json({ error: 'Elige un método de pago.' });
  const coupon = findCoupon(b.coupon);
  const discount = coupon && subtotal >= (coupon.min_cents || 0) ? Math.round(subtotal * coupon.percent / 100) : 0;
  const freeFrom = Number(s.free_shipping_from_cents || 0);
  const shipping = freeFrom && subtotal - discount >= freeFrom ? 0 : Number(s.shipping_cents || 0);
  const total = subtotal - discount + shipping;

  db.exec('BEGIN');
  try {
    const r = db.prepare(`INSERT INTO orders (name, email, phone, address, city, postal_code, notes, items, subtotal_cents, discount_cents, coupon, shipping_cents, total_cents, payment_method, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'nuevo')`).run(clean(b.name, 120), clean(b.email, 200), clean(b.phone, 40), clean(b.address, 300), clean(b.city, 120), clean(b.postal_code, 20), clean(b.notes, 1000), JSON.stringify(lines), subtotal, discount, coupon ? coupon.code : null, shipping, total, pay.id);
    for (const l of lines) db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(l.qty, l.id);
    if (coupon && discount) db.prepare('UPDATE coupons SET uses = uses + 1 WHERE code = ?').run(coupon.code);
    db.exec('COMMIT');
    res.json({ ok: true, order_id: r.lastInsertRowid, payment: pay, items: lines, subtotal_cents: subtotal, discount_cents: discount, shipping_cents: shipping, total_cents: total });
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}));

app.post('/api/newsletter', rateLimit(5, 10 * 60000), (req, res) => {
  const email = clean(req.body.email, 200).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Email no válido.' });
  db.prepare('INSERT OR IGNORE INTO subscribers (email) VALUES (?)').run(email);
  res.json({ ok: true });
});

app.post('/api/contact', rateLimit(5, 10 * 60000), (req, res) => {
  const b = req.body || {};
  if (!clean(b.name) || !clean(b.email) || !clean(b.message)) return res.status(400).json({ error: 'Completa todos los campos.' });
  db.prepare('INSERT INTO messages (name, email, message) VALUES (?,?,?)').run(clean(b.name, 120), clean(b.email, 200), clean(b.message, 3000));
  res.json({ ok: true });
});

// ---------- bot de preguntas y respuestas ----------
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]+/g, ' ');
const STOP = new Set('el la los las un una unos unas de del al a y o que en es son se mi tu su me te lo le les por para con sin como mas muy ya si no hay hace hacen ser esta estan este esto eso tengo tiene puedo puede qué'.split(' '));
const words = (s) => norm(s).split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
const stem = (w) => w.replace(/(es|s)$/, '').slice(0, 6);

function matchFaq(question) {
  const q = words(question).map(stem);
  if (!q.length) return null;
  let best = null;
  for (const f of db.prepare('SELECT * FROM faqs WHERE active = 1').all()) {
    const kw = new Set(words(f.keywords).map(stem));
    const qw = new Set(words(f.question).map(stem));
    let score = 0;
    for (const w of q) score += (kw.has(w) ? 2 : 0) + (qw.has(w) ? 1 : 0);
    score /= Math.sqrt(q.length);
    if (!best || score > best.score) best = { faq: f, score };
  }
  return best && best.score >= 1.2 ? best.faq : null;
}

async function askClaude(question) {
  const faqs = db.prepare('SELECT question, answer FROM faqs WHERE active = 1').all().map((f) => `P: ${f.question}\nR: ${f.answer}`).join('\n\n');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.BOT_MODEL || 'claude-haiku-5-5',
      max_tokens: 400,
      system: 'Eres Abi, la abeja asistente de Bee Green, una marca de Costa Rica que vende hoteles para abejas (domésticos y empresariales), kits de semillas, kits para armar hoteles y talleres, y que crea una comunidad con un mapa de hoteles. Responde en español latinoamericano neutro (tutea; para plural usa "ustedes", nunca "vosotros" ni expresiones de España), con calidez, en 2-4 frases, sin inventar precios ni datos de pedidos. Si la pregunta no tiene que ver con abejas, polinizadores, jardín o Bee Green, redirige amablemente. Si no sabes algo, sugiere escribir por WhatsApp. Información de referencia:\n\n' + faqs,
      messages: [{ role: 'user', content: question }],
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error('Claude API ' + r.status);
  const data = await r.json();
  return data.content?.map((c) => c.text || '').join('').trim();
}

app.get('/api/faqs', (req, res) => res.json(db.prepare('SELECT id, question, answer FROM faqs WHERE active = 1 ORDER BY sort_order, id').all()));
app.get('/api/bot/faqs',(req, res) => res.json(db.prepare('SELECT id, question FROM faqs WHERE active = 1 ORDER BY sort_order, id LIMIT 6').all()));
app.post('/api/bot', rateLimit(20, 60000), async (req, res) => {
  const question = clean(req.body.question, 500);
  if (!question) return res.status(400).json({ error: 'Escribe tu pregunta' });
  if (req.body.faq_id) {
    const f = db.prepare('SELECT * FROM faqs WHERE id = ? AND active = 1').get(Number(req.body.faq_id));
    if (f) return res.json({ answer: f.answer, source: 'faq' });
  }
  const f = matchFaq(question);
  if (f) return res.json({ answer: f.answer, source: 'faq', matched: f.question });
  db.prepare('INSERT INTO bot_questions (question) VALUES (?)').run(question);
  if (process.env.ANTHROPIC_API_KEY) {
    try { return res.json({ answer: await askClaude(question), source: 'ai' }); } catch (e) { console.error(e.message); }
  }
  res.json({ answer: 'Mmm, esa no me la sé todavía 🐝. Guardé tu pregunta para que el equipo la responda. Si quieres una respuesta ya, escríbenos por WhatsApp.', source: 'none', whatsapp: true });
});

// ---------- API de administración ----------
app.post('/api/admin/login', rateLimit(8, 10 * 60000), (req, res) => {
  const pass = String(req.body.password || '');
  const a = crypto.createHash('sha256').update(pass).digest(), b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  if (!crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Contraseña incorrecta' });
  const token = sign('admin:' + (Date.now() + 7 * 864e5));
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `bg_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${7 * 86400}${secure}`);
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'bg_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});
app.use('/api/admin', requireAdmin);
app.get('/api/admin/me', (req, res) => res.json({ ok: true }));

app.get('/api/admin/summary', (req, res) => {
  const one = (sql) => db.prepare(sql).get().n;
  res.json({
    orders_new: one("SELECT COUNT(*) n FROM orders WHERE status = 'nuevo'"),
    sales_cents: one("SELECT COALESCE(SUM(total_cents),0) n FROM orders WHERE status NOT IN ('cancelado')"),
    hotels_pending: one("SELECT COUNT(*) n FROM hotels WHERE status = 'pending'"),
    hotels_approved: one("SELECT COUNT(*) n FROM hotels WHERE status = 'approved'"),
    products: one('SELECT COUNT(*) n FROM products'),
    low_stock: one('SELECT COUNT(*) n FROM products WHERE active = 1 AND stock <= 3'),
    codes_free: one('SELECT COUNT(*) n FROM codes WHERE used_at IS NULL'),
    subscribers: one('SELECT COUNT(*) n FROM subscribers'),
    messages: one('SELECT COUNT(*) n FROM messages WHERE read = 0'),
    bot_unanswered: one('SELECT COUNT(*) n FROM bot_questions WHERE answered = 0'),
  });
});

// productos
app.get('/api/admin/products', (req, res) => res.json(db.prepare('SELECT * FROM products ORDER BY sort_order, id DESC').all().map((p) => ({ ...p, final_cents: finalPrice(p) }))));
const productUpload = upload.fields([{ name: 'image', maxCount: 1 }, { name: 'model', maxCount: 1 }]);
app.post('/api/admin/products', productUpload, wrap((req, res) => saveProduct(req, res, null)));
app.put('/api/admin/products/:id', productUpload, wrap((req, res) => saveProduct(req, res, Number(req.params.id))));
function saveProduct(req, res, id) {
  const b = req.body;
  if (!clean(b.name)) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const prev = id ? db.prepare('SELECT * FROM products WHERE id = ?').get(id) : null;
  if (id && !prev) return res.status(404).json({ error: 'No existe' });
  const image = fileUrl(req.files?.image?.[0]) || (b.remove_image === '1' ? null : prev?.image || null);
  const model = fileUrl(req.files?.model?.[0]) || (b.remove_model === '1' ? null : prev?.model_3d || null);
  const discount = Math.max(0, Math.min(90, parseInt(b.discount_percent) || 0));
  const vals = [clean(b.name, 120), uniqueSlug('products', b.name, id), clean(b.short, 200), clean(b.description, 5000), clean(b.category, 60) || 'Hoteles', toCents(b.price), discount, Math.max(0, parseInt(b.stock) || 0), image, bool(b.active), bool(b.featured), parseInt(b.sort_order) || 0, model, bool(b.show_3d)];
  if (id) db.prepare('UPDATE products SET name=?, slug=?, short=?, description=?, category=?, price_cents=?, discount_percent=?, stock=?, image=?, active=?, featured=?, sort_order=?, model_3d=?, show_3d=? WHERE id=?').run(...vals, id);
  else id = db.prepare('INSERT INTO products (name, slug, short, description, category, price_cents, discount_percent, stock, image, active, featured, sort_order, model_3d, show_3d) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...vals).lastInsertRowid;
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
}
app.delete('/api/admin/products/:id', (req, res) => { db.prepare('DELETE FROM products WHERE id = ?').run(Number(req.params.id)); res.json({ ok: true }); });

// cupones de descuento
app.get('/api/admin/coupons', (req, res) => res.json(db.prepare('SELECT * FROM coupons ORDER BY id DESC').all()));
app.post('/api/admin/coupons', wrap((req, res) => {
  const b = req.body;
  const code = normCode(b.code);
  if (!code) return res.status(400).json({ error: 'Escribe el código del cupón' });
  const percent = Math.max(1, Math.min(90, parseInt(b.percent) || 0));
  db.prepare('INSERT INTO coupons (code, percent, min_cents, max_uses, expires_at, active) VALUES (?,?,?,?,?,1) ON CONFLICT(code) DO UPDATE SET percent=excluded.percent, min_cents=excluded.min_cents, max_uses=excluded.max_uses, expires_at=excluded.expires_at')
    .run(code, percent, toCents(b.min || 0), parseInt(b.max_uses) || null, clean(b.expires_at, 20) || null);
  res.json({ ok: true });
}));
app.patch('/api/admin/coupons/:id', (req, res) => { db.prepare('UPDATE coupons SET active = ? WHERE id = ?').run(bool(req.body.active), Number(req.params.id)); res.json({ ok: true }); });
app.delete('/api/admin/coupons/:id', (req, res) => { db.prepare('DELETE FROM coupons WHERE id = ?').run(Number(req.params.id)); res.json({ ok: true }); });

// pedidos
app.get('/api/admin/orders', (req, res) => res.json(db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 500').all().map((o) => ({ ...o, items: JSON.parse(o.items) }))));
app.patch('/api/admin/orders/:id', (req, res) => {
  const allowed = ['nuevo', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Estado no válido' });
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!o) return res.status(404).json({ error: 'No existe' });
  // devolver stock si se cancela
  if (req.body.status === 'cancelado' && o.status !== 'cancelado') for (const l of JSON.parse(o.items)) db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(l.qty, l.id);
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(req.body.status, o.id);
  res.json({ ok: true });
});

// códigos de hotel
app.get('/api/admin/codes', (req, res) => res.json(db.prepare('SELECT * FROM codes ORDER BY created_at DESC, code LIMIT 2000').all()));
app.post('/api/admin/codes', upload.single('company_logo'), wrap((req, res) => {
  const b = req.body;
  const type = b.type === 'empresa' ? 'empresa' : 'normal';
  const qty = Math.max(1, Math.min(500, parseInt(b.quantity) || 1));
  const prefix = type === 'empresa' ? 'EMP-' : 'BG-';
  const logo = fileUrl(req.file);
  const created = [];
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < qty; i++) {
    let code;
    do code = prefix + Array.from(crypto.randomBytes(6), (x) => alphabet[x % alphabet.length]).join('');
    while (db.prepare('SELECT 1 FROM codes WHERE code = ?').get(code));
    db.prepare('INSERT INTO codes (code, type, company_name, company_logo, note) VALUES (?,?,?,?,?)').run(code, type, type === 'empresa' ? clean(b.company_name, 120) : null, type === 'empresa' ? logo : null, clean(b.note, 200));
    created.push(code);
  }
  res.json({ ok: true, codes: created });
}));
app.delete('/api/admin/codes/:code', (req, res) => { db.prepare('DELETE FROM codes WHERE code = ? AND used_at IS NULL').run(req.params.code); res.json({ ok: true }); });

// hoteles del mapa (moderación)
app.get('/api/admin/hotels', (req, res) => res.json(db.prepare('SELECT * FROM hotels ORDER BY CASE status WHEN \'pending\' THEN 0 ELSE 1 END, id DESC').all()));
app.patch('/api/admin/hotels/:id', (req, res) => {
  const b = req.body;
  const h = db.prepare('SELECT * FROM hotels WHERE id = ?').get(Number(req.params.id));
  if (!h) return res.status(404).json({ error: 'No existe' });
  const status = ['pending', 'approved', 'rejected'].includes(b.status) ? b.status : h.status;
  db.prepare('UPDATE hotels SET status=?, name=?, message=?, city=?, company_name=? WHERE id=?')
    .run(status, b.name !== undefined ? clean(b.name, 120) : h.name, b.message !== undefined ? clean(b.message, 500) : h.message, b.city !== undefined ? clean(b.city, 120) : h.city, b.company_name !== undefined ? clean(b.company_name, 120) || null : h.company_name, h.id);
  res.json({ ok: true });
});
app.delete('/api/admin/hotels/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('UPDATE codes SET used_at = NULL, hotel_id = NULL WHERE hotel_id = ?').run(id);
  db.prepare('DELETE FROM hotels WHERE id = ?').run(id);
  res.json({ ok: true });
});

// noticias y participaciones
app.get('/api/admin/posts', (req, res) => res.json(db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all()));
app.post('/api/admin/posts', upload.single('image'), wrap((req, res) => savePost(req, res, null)));
app.put('/api/admin/posts/:id', upload.single('image'), wrap((req, res) => savePost(req, res, Number(req.params.id))));
function savePost(req, res, id) {
  const b = req.body;
  if (!clean(b.title)) return res.status(400).json({ error: 'El título es obligatorio' });
  const prev = id ? db.prepare('SELECT * FROM posts WHERE id = ?').get(id) : null;
  if (id && !prev) return res.status(404).json({ error: 'No existe' });
  const image = fileUrl(req.file) || (b.remove_image === '1' ? null : prev?.image || null);
  const type = b.type === 'participacion' ? 'participacion' : 'noticia';
  const vals = [type, clean(b.title, 200), uniqueSlug('posts', b.title, id), clean(b.excerpt, 400), clean(b.body, 50000), image, bool(b.published)];
  if (id) db.prepare('UPDATE posts SET type=?, title=?, slug=?, excerpt=?, body=?, image=?, published=? WHERE id=?').run(...vals, id);
  else id = db.prepare('INSERT INTO posts (type, title, slug, excerpt, body, image, published) VALUES (?,?,?,?,?,?,?)').run(...vals).lastInsertRowid;
  res.json(db.prepare('SELECT * FROM posts WHERE id = ?').get(id));
}
app.delete('/api/admin/posts/:id', (req, res) => { db.prepare('DELETE FROM posts WHERE id = ?').run(Number(req.params.id)); res.json({ ok: true }); });

// preguntas del bot
app.get('/api/admin/faqs', (req, res) => res.json(db.prepare('SELECT * FROM faqs ORDER BY sort_order, id').all()));
app.post('/api/admin/faqs', (req, res) => saveFaq(req, res, null));
app.put('/api/admin/faqs/:id', (req, res) => saveFaq(req, res, Number(req.params.id)));
function saveFaq(req, res, id) {
  const b = req.body;
  if (!clean(b.question) || !clean(b.answer)) return res.status(400).json({ error: 'Pregunta y respuesta son obligatorias' });
  const vals = [clean(b.question, 300), clean(b.answer, 3000), clean(b.keywords, 1000), parseInt(b.sort_order) || 0, b.active === undefined ? 1 : bool(b.active)];
  if (id) db.prepare('UPDATE faqs SET question=?, answer=?, keywords=?, sort_order=?, active=? WHERE id=?').run(...vals, id);
  else db.prepare('INSERT INTO faqs (question, answer, keywords, sort_order, active) VALUES (?,?,?,?,?)').run(...vals);
  if (b.from_question_id) db.prepare('UPDATE bot_questions SET answered = 1 WHERE id = ?').run(Number(b.from_question_id));
  res.json({ ok: true });
}
app.delete('/api/admin/faqs/:id', (req, res) => { db.prepare('DELETE FROM faqs WHERE id = ?').run(Number(req.params.id)); res.json({ ok: true }); });
app.get('/api/admin/bot-questions', (req, res) => res.json(db.prepare('SELECT * FROM bot_questions ORDER BY answered, id DESC LIMIT 300').all()));
app.delete('/api/admin/bot-questions/:id', (req, res) => { db.prepare('DELETE FROM bot_questions WHERE id = ?').run(Number(req.params.id)); res.json({ ok: true }); });

// mensajes, suscriptores y ajustes
app.get('/api/admin/messages', (req, res) => res.json(db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 500').all()));
app.patch('/api/admin/messages/:id', (req, res) => { db.prepare('UPDATE messages SET read = 1 WHERE id = ?').run(Number(req.params.id)); res.json({ ok: true }); });
app.get('/api/admin/subscribers', (req, res) => res.json(db.prepare('SELECT * FROM subscribers ORDER BY id DESC').all()));
app.get('/api/admin/settings', (req, res) => res.json(getSettings()));
app.put('/api/admin/settings', (req, res) => {
  const keys = ['whatsapp', 'whatsapp_message', 'email', 'instagram', 'facebook', 'shipping_cents', 'free_shipping_from_cents', 'auto_approve_hotels', 'sinpe_number', 'sinpe_name', 'bank_name', 'bank_iban', 'bank_holder', 'card_enabled', 'card_link', 'tracking_url', 'blocked_words'];
  for (const k of keys) if (req.body[k] !== undefined) db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, clean(req.body[k], 500));
  res.json(getSettings());
});

// ---------- errores ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'No encontrado' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'El archivo pesa demasiado (máx. 25 MB)' : err.message || 'Error' });
});
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

if (require.main === module) app.listen(PORT, () => console.log(`🐝 Bee Green en http://localhost:${PORT}  ·  admin en /admin`));
module.exports = app;
