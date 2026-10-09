/* ============================================================
   LA VIDRIERA: LAS CUENTAS (0140)
   ============================================================

   Lo que se calcula para la página pública del comercio, sin dibujar
   nada: si está abierto, cuándo abre, los links de cada contacto. Va
   aparte del componente porque lo usan dos aplicaciones —la página, en
   el bundle del cliente, y la vista previa de Presencia online, en el
   de gestión— y porque son las cuentas que conviene poder leer solas.

   Los horarios se guardan por día, con hasta dos franjas:
     { lun: [{ d: "08:00", h: "13:00" }, { d: "17:00", h: "21:00" }], dom: [] }
   Una franja que termina antes de empezar ("20:00" a "02:00") cruza la
   medianoche: un bar abierto hasta las 2 sigue abierto el sábado a la
   1 de la mañana del domingo.
   ============================================================ */

export const DIAS = [
  { k: "lun", n: "Lunes" }, { k: "mar", n: "Martes" }, { k: "mie", n: "Miércoles" },
  { k: "jue", n: "Jueves" }, { k: "vie", n: "Viernes" }, { k: "sab", n: "Sábado" }, { k: "dom", n: "Domingo" },
];
/* getDay(): 0 es domingo. */
const POR_GETDAY = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

const minutos = (hhmm) => {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : null;
};

const franjasDe = (horarios, k) => ((horarios && horarios[k]) || []).filter((f) => minutos(f.d) != null && minutos(f.h) != null);

export const hayHorarios = (horarios) => DIAS.some((d) => franjasDe(horarios, d.k).length);

/* "08:00 a 13:00 y 17:00 a 21:00", o "Cerrado". */
export function horarioDelDia(horarios, k) {
  const fs = franjasDe(horarios, k);
  return fs.length ? fs.map((f) => `${f.d} a ${f.h}`).join(" y ") : "Cerrado";
}

/* { abierto, texto }, o null si no cargó horarios. */
export function estadoAhora(horarios, ahora = new Date()) {
  if (!hayHorarios(horarios)) return null;
  const hoy = ahora.getDay();
  const m = ahora.getHours() * 60 + ahora.getMinutes();

  /* Abierto: por una franja de hoy, o por una de ayer que cruzó la
     medianoche. */
  for (const f of franjasDe(horarios, POR_GETDAY[hoy])) {
    const d = minutos(f.d), h = minutos(f.h);
    const fin = h <= d ? h + 1440 : h;
    if (m >= d && m < fin) return { abierto: true, texto: `Abierto · cierra a las ${f.h}` };
  }
  for (const f of franjasDe(horarios, POR_GETDAY[(hoy + 6) % 7])) {
    const d = minutos(f.d), h = minutos(f.h);
    if (h <= d && m < h) return { abierto: true, texto: `Abierto · cierra a las ${f.h}` };
  }

  /* Cerrado: cuándo abre. */
  for (let i = 0; i < 7; i++) {
    const k = POR_GETDAY[(hoy + i) % 7];
    const proximas = franjasDe(horarios, k).filter((f) => i > 0 || minutos(f.d) > m).sort((a, b) => minutos(a.d) - minutos(b.d));
    if (proximas.length) {
      const cuando = i === 0 ? "hoy" : i === 1 ? "mañana" : `el ${DIAS.find((x) => x.k === k).n.toLowerCase()}`;
      return { abierto: false, texto: `Cerrado · abre ${cuando} a las ${proximas[0].d}` };
    }
  }
  return { abierto: false, texto: "Cerrado" };
}

export const diaDeHoy = (ahora = new Date()) => POR_GETDAY[ahora.getDay()];

/* El link de cada dato de contacto: lo que se toca en el teléfono. */
const sinArroba = (v) => String(v).trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?[^/]+\//, "");
const conProtocolo = (v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);
const soloDigitos = (v) => String(v).replace(/\D/g, "");

/* wa.me pide el número internacional: en Argentina, 549 y el código de
   área sin el 0. Si ya lo cargaron con el 54, se respeta. */
const numeroWhatsApp = (v) => {
  const d = soloDigitos(v);
  return d.startsWith("54") ? d : `549${d.replace(/^0/, "")}`;
};

export function linksDeContacto(c, nombre) {
  const l = [];
  if (c.whatsapp) l.push({ k: "whatsapp", n: "WhatsApp", v: c.whatsapp, href: `https://wa.me/${numeroWhatsApp(c.whatsapp)}?text=${encodeURIComponent(`Hola ${nombre || ""}`.trim())}` });
  if (c.telefono) l.push({ k: "telefono", n: "Llamar", v: c.telefono, href: `tel:${soloDigitos(c.telefono)}` });
  if (c.direccion || c.mapa) l.push({ k: "mapa", n: "Cómo llegar", v: c.direccion || "Ver en el mapa", href: c.mapa ? conProtocolo(c.mapa) : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.direccion)}` });
  if (c.instagram) l.push({ k: "instagram", n: "Instagram", v: `@${sinArroba(c.instagram)}`, href: `https://instagram.com/${sinArroba(c.instagram)}` });
  if (c.facebook) l.push({ k: "facebook", n: "Facebook", v: sinArroba(c.facebook), href: /^https?:\/\//i.test(c.facebook) ? c.facebook : `https://facebook.com/${sinArroba(c.facebook)}` });
  if (c.tiktok) l.push({ k: "tiktok", n: "TikTok", v: `@${sinArroba(c.tiktok)}`, href: `https://tiktok.com/@${sinArroba(c.tiktok)}` });
  if (c.email) l.push({ k: "email", n: "Mail", v: c.email, href: `mailto:${String(c.email).trim()}` });
  if (c.web) l.push({ k: "web", n: "Web", v: String(c.web).replace(/^https?:\/\//i, ""), href: conProtocolo(String(c.web).trim()) });
  return l;
}

/* Lo mismo que devuelve `presencia_de` (0140), armado en el navegador
   con la config del comercio: para la vista previa de Presencia online,
   que tiene que mostrar lo que va a ver la gente sin ir a la base. Si
   cambia una, cambia la otra. */
export function presenciaDesdeConfig(ajustes) {
  const p = (ajustes && ajustes.publico) || {};
  if (!p.publicada) return null;
  const c = (ajustes && ajustes.contacto) || {};
  const mostrar = p.mostrar || {};
  const contacto = {};
  for (const k of ["direccion", "mapa", "telefono", "whatsapp", "email", "instagram", "facebook", "tiktok", "web"]) {
    const v = String((k === "mapa" ? p.mapa : c[k]) || "").trim().slice(0, 200);
    if (mostrar[k] && v) contacto[k] = v;
  }
  const e = p.entrega;
  return {
    aviso: String(p.aviso || "").trim().slice(0, 200) || null,
    horarios: p.horarios && typeof p.horarios === "object" ? p.horarios : null,
    pagos: Array.isArray(p.pagos) ? p.pagos : null,
    entrega: e && typeof e === "object" ? { retiro: !!e.retiro, envio: !!e.envio, zona: String(e.zona || "").trim().slice(0, 120) || null } : null,
    contacto,
    /* La base además deja pasar solo fotos del bucket público; acá no se
       mira, porque en la pantalla de pruebas las fotos son blobs. */
    galeria: (Array.isArray(p.galeria) ? p.galeria : []).map((g) => g && g.url).filter(Boolean).slice(0, 8),
    video: videoEmbebido(p.video) ? String(p.video).trim().slice(0, 200) : null,
  };
}

/* Un link de YouTube o Vimeo, a la dirección que se puede embeber. Lo
   que no se reconoce devuelve null y no se muestra: la página no embebe
   cualquier cosa que alguien pegue. youtube-nocookie para no dejarle
   cookies de Google a quien solo quiere ver el horario. */
export function videoEmbebido(url) {
  const u = String(url || "").trim();
  let m = u.match(/^https:\/\/(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)([\w-]{6,})/i)
    || u.match(/^https:\/\/youtu\.be\/([\w-]{6,})/i);
  if (m) return { tipo: "youtube", src: `https://www.youtube-nocookie.com/embed/${m[1]}`, vertical: /\/shorts\//i.test(u) };
  m = u.match(/^https:\/\/(?:www\.)?vimeo\.com\/(\d+)/i);
  if (m) return { tipo: "vimeo", src: `https://player.vimeo.com/video/${m[1]}`, vertical: false };
  return null;
}
