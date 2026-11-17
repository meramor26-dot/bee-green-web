// Avisos por WhatsApp a Bee Green con CallMeBot (https://www.callmebot.com/blog/free-api-whatsapp-messages/).
// Se activa solo si existen CALLMEBOT_PHONE y CALLMEBOT_APIKEY. Nunca bloquea ni rompe un pedido o un mensaje:
// si el aviso falla, queda anotado en el registro del servidor y la web sigue igual.
const API = process.env.CALLMEBOT_URL || 'https://api.callmebot.com/whatsapp.php';

const enabled = () => Boolean(process.env.CALLMEBOT_PHONE && process.env.CALLMEBOT_APIKEY);
const firstName = (s) => String(s || '').trim().split(/\s+/)[0].slice(0, 40) || 'alguien';
const colones = (cents) => '₡' + Math.round(Number(cents || 0) / 100).toLocaleString('es-CR').replace(/ | /g, ' ');
const adminUrl = (req) => (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '') + '/admin';

async function send(text) {
  if (!enabled()) return false;
  const url = `${API}?phone=${encodeURIComponent(process.env.CALLMEBOT_PHONE)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(process.env.CALLMEBOT_APIKEY)}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) console.warn(`[aviso WhatsApp] CallMeBot respondió ${r.status}`);
    return r.ok;
  } catch (e) {
    console.warn('[aviso WhatsApp] no se pudo enviar:', e.message);
    return false;
  }
}

// Solo va el primer nombre y lo mínimo: el detalle (correo, dirección, texto) se lee en el admin.
const newOrder = (req, o) => send(`🐝 Nuevo pedido #${o.id} en la web\n${firstName(o.name)} · ${o.units} ${o.units === 1 ? 'producto' : 'productos'} · ${colones(o.total_cents)}\nPago: ${o.payment}\nVer: ${adminUrl(req)}`);
const newMessage = (req, m) => send(`✉️ Nuevo mensaje en la web de ${firstName(m.name)}\nLeer: ${adminUrl(req)}`);

module.exports = { enabled, newOrder, newMessage };
