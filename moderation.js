// Revisión automática de lo que la comunidad publica en el mapa.
// Si el texto tiene malas palabras, enlaces o datos de contacto, queda pendiente para revisión manual.
// Si hay ANTHROPIC_API_KEY, además se revisa la foto con IA.
const fs = require('fs');
const path = require('path');

// Palabras base (se detectan también con tildes, mayúsculas, letras repetidas o números en vez de letras).
// Se pueden agregar más desde el admin (Ajustes > Palabras bloqueadas).
const BASE = [
  'puta', 'puto', 'putas', 'putos', 'hijueputa', 'hijoeputa', 'hdp', 'malparido', 'malparida', 'carepicha', 'carapicha', 'picha', 'pichas',
  'mierda', 'mierdas', 'verga', 'vergas', 'cabron', 'cabrona', 'pendejo', 'pendeja', 'culero', 'culera', 'culo', 'coño', 'chingar', 'chingada',
  'pinga', 'joder', 'jodido', 'jodida', 'idiota', 'imbecil', 'estupido', 'estupida', 'tarado', 'retrasado', 'mongolo', 'zorra', 'perra',
  'maricon', 'marica', 'playo', 'culiar', 'culiado', 'polla', 'pene', 'vagina', 'tetas', 'porno', 'sexo', 'xxx', 'nazi', 'droga', 'cocaina',
  'fuck', 'fucking', 'shit', 'bitch', 'dick', 'pussy', 'asshole', 'nigger', 'nigga', 'whore', 'slut', 'cunt', 'porn',
];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };
function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[013457@$]/g, (c) => LEET[c])
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/(.)\1{2,}/g, '$1')
    .replace(/[^a-zñ\s]/g, ' ');
}

function badWords(text, extra = []) {
  const words = normalize(text).split(/\s+/).filter(Boolean);
  const joined = words.join(' ');
  const list = new Set([...BASE, ...extra.map((w) => normalize(w).trim()).filter(Boolean)]);
  const found = [];
  for (const w of list) {
    if (w.includes(' ') ? joined.includes(w) : words.includes(w) || words.includes(w.replace(/s$/, ''))) found.push(w);
  }
  // también palabras con letras separadas: "p u t a"
  const squashed = joined.replace(/\b(\w) (?=\w\b)/g, '$1');
  for (const w of BASE) if (w.length > 3 && !found.includes(w) && squashed.split(' ').includes(w)) found.push(w);
  return found;
}

function suspicious(text) {
  const t = String(text || '');
  if (/(https?:\/\/|www\.|\.com\b|\.net\b|\.cr\b)/i.test(t)) return 'contiene un enlace';
  if (/(\d[\s-]?){8,}/.test(t)) return 'contiene un número de teléfono';
  if (/[^@\s]+@[^@\s]+\.[a-z]{2,}/i.test(t)) return 'contiene un correo';
  return null;
}

// Revisa la foto con Claude si hay clave configurada. Devuelve null si está bien o el motivo si no.
async function checkImage(file) {
  if (!process.env.ANTHROPIC_API_KEY || !file) return null;
  const ext = path.extname(file).toLowerCase();
  const media = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' }[ext];
  if (!media) return null;
  try {
    const data = fs.readFileSync(file).toString('base64');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.BOT_MODEL || 'claude-haiku-5-5',
        max_tokens: 20,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: media, data } },
          { type: 'text', text: 'Esta foto se va a publicar en un mapa público de una comunidad de hoteles para abejas. Responde solo OK si es apropiada para todo público, o NO si tiene desnudos, violencia, gestos ofensivos, texto ofensivo o contenido inadecuado.' },
        ] }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return null;
    const out = (await r.json()).content?.map((c) => c.text || '').join('').trim().toUpperCase();
    return out.startsWith('NO') ? 'la foto podría no ser apropiada' : null;
  } catch { return null; }
}

// Devuelve { ok: true } o { ok: false, reason }
async function review({ texts = [], files = [], extraWords = [] }) {
  const all = texts.join(' \n ');
  const bad = badWords(all, extraWords);
  if (bad.length) return { ok: false, reason: 'palabras no permitidas: ' + bad.join(', ') };
  const sus = suspicious(all);
  if (sus) return { ok: false, reason: 'el texto ' + sus };
  for (const f of files) { const why = await checkImage(f); if (why) return { ok: false, reason: why }; }
  return { ok: true };
}

module.exports = { review, badWords, normalize };
