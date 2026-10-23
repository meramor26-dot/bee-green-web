// Base de datos SQLite (módulo nativo de Node 22) y datos iniciales
process.removeAllListeners('warning');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const file = process.env.DB_FILE || path.join(__dirname, 'data', 'beegreen.db');
fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE, short TEXT, description TEXT,
  category TEXT DEFAULT 'Hoteles', price_cents INTEGER NOT NULL DEFAULT 0, discount_percent INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0, image TEXT, active INTEGER NOT NULL DEFAULT 1, featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0, model_3d TEXT, show_3d INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, percent INTEGER NOT NULL, min_cents INTEGER DEFAULT 0,
  max_uses INTEGER, uses INTEGER NOT NULL DEFAULT 0, expires_at TEXT, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY, name TEXT, email TEXT, phone TEXT, address TEXT, city TEXT, postal_code TEXT, notes TEXT,
  items TEXT NOT NULL, subtotal_cents INTEGER, discount_cents INTEGER DEFAULT 0, coupon TEXT, shipping_cents INTEGER DEFAULT 0,
  total_cents INTEGER, payment_method TEXT, status TEXT DEFAULT 'nuevo', created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS codes (
  code TEXT PRIMARY KEY, type TEXT NOT NULL DEFAULT 'normal', company_name TEXT, company_logo TEXT, note TEXT,
  used_at TEXT, hotel_id INTEGER, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS hotels (
  id INTEGER PRIMARY KEY, code TEXT, name TEXT, email TEXT, message TEXT, city TEXT, lat REAL NOT NULL, lng REAL NOT NULL,
  photo TEXT, logo TEXT, company_name TEXT, status TEXT NOT NULL DEFAULT 'pending', flag_reason TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY, type TEXT NOT NULL DEFAULT 'noticia', title TEXT NOT NULL, slug TEXT UNIQUE, excerpt TEXT, body TEXT,
  image TEXT, published INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS faqs (
  id INTEGER PRIMARY KEY, question TEXT NOT NULL, answer TEXT NOT NULL, keywords TEXT, sort_order INTEGER DEFAULT 0, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS bot_questions (
  id INTEGER PRIMARY KEY, question TEXT NOT NULL, answered INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY, email TEXT UNIQUE, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, name TEXT, email TEXT, message TEXT, read INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
`);


// Datos de ejemplo la primera vez (se pueden editar o borrar desde el admin)
// Los precios se guardan en céntimos de colón (₡14 900 = 1490000)
const C = (colones) => colones * 100;
if (!db.prepare('SELECT 1 FROM settings LIMIT 1').get()) {
  const set = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  [['whatsapp', '50689935184'], ['whatsapp_message', '¡Hola Bee Green! Tengo una consulta 🐝'], ['email', 'beegreencr@gmail.com'], ['tracking_url', 'https://correos.go.cr/rastreo/'],
   ['instagram', 'beegreencr'], ['shipping_cents', String(C(3000))], ['free_shipping_from_cents', String(C(40000))], ['auto_approve_hotels', '1'], ['blocked_words', ''],
   ['sinpe_number', '8993 5184'], ['sinpe_name', 'Bee Green'], ['bank_name', '[Banco]'], ['bank_iban', 'CR00 0000 0000 0000 0000 00'], ['bank_holder', 'Bee Green'],
   ['card_enabled', '1'], ['card_link', '']]
    .forEach((r) => set.run(...r));

  const p = db.prepare('INSERT INTO products (name, slug, short, description, category, price_cents, discount_percent, stock, image, featured, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  p.run('Hotel Doméstico Pequeño', 'hotel-domestico-pequeno', 'Ideal para balcones, ventanas y jardines pequeños.', 'Madera sin químicos, techo que protege de la lluvia y tubos de distintos tamaños para que lleguen diferentes especies de abejas.\n\nIncluye un código para marcar tu hotel en el mapa de la comunidad.', 'Hoteles domésticos', C(14900), 0, 25, '/img/products/hotel-pequeno.svg', 1, 1);
  p.run('Hotel Doméstico Mediano', 'hotel-domestico-mediano', 'Para patios, jardines y huertas.', 'Más habitaciones y compartimentos con caña, bambú y madera perforada. Perfecto para la casa y la huerta.\n\nIncluye un código para el mapa.', 'Hoteles domésticos', C(22900), 10, 15, '/img/products/hotel-mediano.svg', 1, 2);
  p.run('Hotel Empresarial', 'hotel-empresarial', 'Gran formato para oficinas, hoteles, fincas y colegios.', 'Hotel de gran capacidad pensado para empresas e instituciones. Con el código de empresa, cada hotel aparece en el mapa con su logo.\n\nPregúntanos por paquetes de varios hoteles y personalización.', 'Hoteles empresariales', C(65000), 0, 8, '/img/products/hotel-empresarial.svg', 1, 3);
  p.run('Kit de Semillas para Polinizadores', 'kit-semillas-polinizadores', 'Flores que encantan a abejas y mariposas.', 'Mezcla de semillas de flores ricas en néctar y polen para sembrar cerca de tu hotel y que tus huéspedes tengan comida cerca.', 'Kits de semillas', C(4500), 0, 80, '/img/products/semillas.svg', 0, 4);
  p.run('Kit Arme su Hotel', 'kit-arme-su-hotel', 'Todas las piezas e instrucciones para construirlo en familia.', 'Piezas de madera precortadas, cañas, tornillos e instrucciones ilustradas. Una actividad bonita para hacer con niños y niñas.\n\nIncluye un código para el mapa.', 'Kits para armar', C(12500), 0, 30, '/img/products/kit-armar.svg', 0, 5);
  p.run('Taller: Construyamos un hotel para abejas', 'taller-hotel-para-abejas', 'Taller presencial de 2 horas. Cada persona se lleva su hotel.', 'Aprendemos sobre las abejas nativas de Costa Rica, por qué son importantes y cómo cuidarlas, y cada participante arma su propio hotel.\n\nTambién hacemos talleres privados para empresas, colegios y grupos: escríbenos por WhatsApp.', 'Talleres', C(18000), 0, 20, '/img/products/taller.svg', 0, 6);

  const c = db.prepare('INSERT INTO codes (code, type, company_name, note) VALUES (?,?,?,?)');
  c.run('BG-DEMO01', 'normal', null, 'Código de prueba');
  c.run('BG-DEMO02', 'normal', null, 'Código de prueba');
  c.run('EMP-DEMO01', 'empresa', 'Empresa Demo', 'Código de prueba de empresa');

  const h = db.prepare("INSERT INTO hotels (code, name, message, city, lat, lng, logo, company_name, status) VALUES (?,?,?,?,?,?,?,?, 'approved')");
  h.run(null, 'Daniela', '¡Ya llegaron las primeras inquilinas!', 'San José', 9.9281, -84.0907, null, null);
  h.run(null, 'Escuela Los Guayabos', 'Proyecto de 4.º grado 🌼', 'Heredia', 9.9986, -84.1165, null, null);
  h.run(null, 'Andrés', 'En el balcón, entre las matas.', 'Cartago', 9.8644, -83.9194, null, null);
  h.run(null, 'Equipo Verde', 'Nuestra oficina se suma a la red Bee Green.', 'Alajuela', 10.0163, -84.2116, '/img/logo-demo-empresa.svg', 'Verde S.A.');
  h.run(null, 'Sofía', 'Junto a la huerta familiar.', 'Liberia', 10.6346, -85.4407, null, null);
  h.run(null, 'Finca La Esperanza', 'Entre los cafetales.', 'Monteverde', 10.3010, -84.8250, null, null);

  const post = db.prepare("INSERT INTO posts (type, title, slug, excerpt, body, image, created_at) VALUES (?,?,?,?,?,?, datetime('now', ?))");
  post.run('noticia', 'Ya somos más de 100 hoteles en la red', 'ya-somos-mas-de-100-hoteles', 'La comunidad Bee Green no para de crecer. ¡Gracias a todas las personas que han colocado su hotel!', 'La comunidad Bee Green no para de crecer.\n\nCada hotel es un refugio para abejas que polinizan huertas, parques y jardines. Gracias por ser parte.', '/img/posts/comunidad.svg', '-2 days');
  post.run('noticia', 'Cómo preparar tu hotel para que se llene', 'como-preparar-tu-hotel', 'Ubicación, altura y flores cerca: tres claves para recibir a tus primeras inquilinas.', '1. Colócalo donde reciba sol de la mañana y esté protegido de la lluvia directa.\n2. Ponlo a más de 1 metro del suelo y bien firme, que no se mueva con el viento.\n3. Siembra flores cerca: albahaca, lavanda, girasoles y plantas nativas son ideales.\n4. Cambia los tubos usados cada año.', '/img/posts/primavera.svg', '-6 days');
  post.run('participacion', 'Taller en la Escuela Los Guayabos', 'taller-escuela-los-guayabos', 'Más de 60 chicos y chicas armaron su propio hotel para abejas.', 'Pasamos una mañana increíble con los estudiantes de la Escuela Los Guayabos. Aprendieron qué son las abejas solitarias y nativas, y armaron tres hoteles para el jardín de la escuela.', '/img/posts/taller.svg', '-10 days');
  post.run('participacion', 'Feria Verde de Aranjuez', 'feria-verde-aranjuez', 'Estuvimos con nuestro stand y un mapa gigante de la comunidad.', '¡Gracias a todas las personas que se acercaron al stand! Durante el fin de semana se registraron 25 hoteles nuevos.', '/img/posts/feria.svg', '-20 days');

  db.prepare('INSERT INTO coupons (code, percent, min_cents) VALUES (?,?,?)').run('BIENVENIDA10', 10, 0);
}

if (!db.prepare('SELECT 1 FROM faqs LIMIT 1').get()) {
  const f = db.prepare('INSERT INTO faqs (question, answer, keywords, sort_order) VALUES (?,?,?,?)');
  [
    ['¿Las abejas de los hoteles son peligrosas? ¿Pican?', 'Son muy pacíficas. Las abejas que usan los hoteles son solitarias: no tienen colmena ni miel que defender, así que no atacan. Los machos ni siquiera tienen aguijón y las hembras casi nunca pican, solo si las aprietas con la mano, y su picadura es mucho más suave que la de una abeja de miel. Son perfectas para casas con niños y mascotas.', 'peligro peligrosa peligrosas pican picar picadura aguijon miedo atacan agresivas seguras niños mascotas perro gato alergia africanizadas', 1],
    ['¿Qué es un hotel para abejas?', 'Es un refugio con tubos y huecos donde las abejas solitarias ponen sus huevos. Cada tubo se convierte en una "habitación" que la mamá sella con barro, resina u hojas. Después nacen nuevas abejas que van a polinizar tu zona.', 'que es hotel sirve funciona refugio casa insectos', 2],
    ['¿Se va a llenar de abejas? ¿Puede llegar un enjambre?', 'No. Las abejas solitarias no forman enjambres ni colmenas: cada hembra trabaja sola en su tubo. Vas a ver algunas idas y venidas tranquilas, nada más. Un hotel no atrae abejas africanizadas, que buscan cavidades grandes y cerradas.', 'enjambre colmena muchas llenar invasion plaga africanizadas africanas', 3],
    ['¿Dónde coloco mi hotel?', 'Donde le dé el sol de la mañana, protegido de la lluvia directa y del viento, a más de 1 metro del suelo y bien firme (que no se mueva). Si hay flores o una huerta cerca, mucho mejor.', 'donde colocar poner ubicar orientacion sol altura balcon terraza jardin pared lluvia', 4],
    ['¿Hacen miel?', 'No. Las abejas solitarias no producen miel; su superpoder es polinizar. Son muy eficientes polinizando frutas, hortalizas y flores silvestres.', 'miel producen panal cera', 5],
    ['¿Cuándo llegan las abejas?', 'Depende de la zona y de la época del año. A veces llegan en pocas semanas y otras veces tardan unos meses en descubrir el hotel. Tener flores cerca ayuda muchísimo. ¡Paciencia, que llegan!', 'cuando llegan tardan vienen epoca verano invierno mes vacio nadie', 6],
    ['¿Qué mantenimiento necesita?', 'Muy poco. Cuando veas tubos sellados, déjalos tranquilos hasta que salgan las nuevas abejas. Los tubos vacíos o con hongos cámbialos una vez al año. Y evita usar insecticidas cerca del hotel.', 'mantenimiento limpiar limpieza cuidar cambiar tubos hongos insecticida', 7],
    ['¿Cómo marco mi hotel en el mapa?', 'Cada hotel trae un código. Entra en "Registra tu hotel", escribe el código, marca en el mapa dónde lo colocaste y sube una foto. Después de una revisión rápida aparece en el mapa de la comunidad.', 'mapa codigo registrar marcar foto subir comunidad', 8],
    ['Somos una empresa, ¿podemos aparecer con nuestro logo?', '¡Claro! Con los códigos de empresa (empiezan por EMP-) su hotel aparece en el mapa con el logo de la empresa. Escríbenos por WhatsApp y les preparamos un paquete para su oficina, hotel, finca, colegio o evento.', 'empresa logo marca corporativo oficina rse colegio institucion', 9],
    ['¿Cómo puedo pagar?', 'Puedes pagar por SINPE Móvil, transferencia bancaria o tarjeta. Al finalizar la compra eliges el método y te mostramos los datos. Si pagas por SINPE o transferencia, envíanos el comprobante por WhatsApp.', 'pagar pago sinpe transferencia tarjeta credito debito metodo', 10],
    ['¿Hacen envíos? ¿Cuánto tardan?', 'Enviamos a todo Costa Rica por Correos de Costa Rica o mensajería, normalmente en 2 a 5 días hábiles. El envío es gratis en compras desde ₡40 000.', 'envio entrega tarda dias gastos gratis correos mensajeria', 11],
    ['¿Dan talleres?', '¡Sí! Damos talleres abiertos y privados para empresas, colegios y grupos, donde cada persona arma su hotel y aprende sobre las abejas nativas. Mira las fechas en la sección Talleres o escríbenos por WhatsApp.', 'taller talleres curso clase capacitacion actividad grupo', 12],
  ].forEach((r) => f.run(...r));
}

module.exports = db;
