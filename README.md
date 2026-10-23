# Bee Green · hotelesparaabejas.com

Web de Bee Green (Costa Rica): tienda de hoteles para abejas, kits y talleres; mapa de la comunidad con códigos; noticias y participaciones; bot de dudas "Abi"; botón de WhatsApp y panel de administración.

## Qué incluye

- **Tienda** con categorías, descuentos por producto, cupones, stock, carrito y pedido con pago por **SINPE Móvil**, **transferencia** o **tarjeta** (enlace de pago de la pasarela).
- **Visor 3D** en cada hotel (modelo genérico, o el `.glb` que se suba desde el admin).
- **Mapa de la comunidad**: con un código `BG-…` la persona marca su hotel y sube una foto; con un código `EMP-…` el pin sale con el logo de la empresa. Se publica solo si el texto no tiene malas palabras, enlaces ni teléfonos (y la foto, si hay clave de IA); si no, queda para aprobar.
- **Noticias y participaciones**, **talleres**, **preguntas frecuentes** y **Abi**, la abeja que responde dudas (aprende de las preguntas que se cargan en el admin; con `ANTHROPIC_API_KEY` también responde preguntas libres).
- **Admin** en `/admin`: pedidos, productos, cupones, códigos (genera e imprime en CSV), moderación del mapa, publicaciones, bot, mensajes, suscriptores, y ajustes de contacto, envíos y datos de pago.
- Páginas legales modelo para Costa Rica (completar los datos entre corchetes).

## Probarla en tu computadora

Necesitas [Node.js 22](https://nodejs.org) o más nuevo.

```bash
npm install
ADMIN_PASSWORD=una-clave npm start
```

Abre http://localhost:3000 y el admin en http://localhost:3000/admin. La primera vez se cargan productos, publicaciones y hoteles de ejemplo, que puedes editar o borrar. Códigos de prueba: `BG-DEMO01`, `BG-DEMO02`, `EMP-DEMO01`. Cupón de prueba: `BIENVENIDA10`.

## Publicarla en hotelesparaabejas.com

La web es un servidor Node con base de datos SQLite y fotos en disco, así que el hosting necesita **un disco persistente**. Opciones sencillas:

- **Render** (unos USD 7–8 al mes con disco): el repositorio trae `render.yaml`, así que en Render basta con **New › Blueprint**, elegir este repositorio y escribir la contraseña del admin (`ADMIN_PASSWORD`). Render crea el servicio y el disco en `/data`.
- **Railway** o cualquier VPS con Docker: hay un `Dockerfile` listo; monta un volumen en `/data`.

Después, en el panel del dominio, apunta `www.hotelesparaabejas.com` al hosting (registro CNAME que te da el hosting) y activa HTTPS.

## Variables de entorno

Ver `.env.example`. La única obligatoria en producción es `ADMIN_PASSWORD`.

## Cambiar ilustraciones

Todas están en `public/img/` (mascotas, `euglossa-whatsapp.svg`, `bee.svg`, productos y noticias). Se pueden reemplazar por archivos con el mismo nombre (PNG transparente o SVG). Las fotos de productos y publicaciones se cambian desde el admin.

## Pagos con tarjeta

Stripe no opera con comercios de Costa Rica. Opciones locales: ONVO Pay o Tilopay. Mientras tanto, en **Admin › Ajustes y pagos** puedes pegar un enlace de pago; al conectar la pasarela se reemplaza por un cobro automático.
