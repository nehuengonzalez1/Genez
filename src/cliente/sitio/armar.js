/* ============================================================
   EL SITIO, ARMADO EN EL NAVEGADOR (0141)
   ============================================================

   Lo mismo que devuelve `sitio_de` en la base, armado con la config y
   los productos que ya tiene la gestión. Lo usan la vista previa del
   editor (que tiene que mostrar el cambio en el momento, sin guardar ni
   ir a la base) y la pantalla de pruebas.

   Si cambia la forma de `sitio_de`, cambia esto: son espejos.
   ============================================================ */

import { presenciaDesdeConfig } from "../vidriera.js";

const PLANTILLAS = ["clasica", "moderna", "minima"];
const FUENTES = ["inter", "poppins", "montserrat", "playfair", "lora", "dmsans"];

export function disenoDesdeConfig(ajustes) {
  const s = (ajustes && ajustes.sitio) || {};
  return {
    plantilla: PLANTILLAS.includes(s.plantilla) ? s.plantilla : "clasica",
    color: /^#[0-9a-fA-F]{6}$/.test(s.color || "") ? s.color : null,
    fuente: FUENTES.includes(s.fuente) ? s.fuente : "inter",
    fondo: s.fondo === "oscuro" ? "oscuro" : "claro",
    anuncio: String(s.anuncio || "").trim().slice(0, 120) || null,
    secciones: Array.isArray(s.secciones) ? s.secciones : null,
    banners: (Array.isArray(s.banners) ? s.banners : []).filter((b) => b && b.url).slice(0, 5)
      .map((b) => ({ url: b.url, titulo: b.titulo || null, texto: b.texto || null, boton: b.boton || null, enlace: b.enlace || null })),
  };
}

/* La tienda: lo publicado, con sus variantes (los hijos activos). */
export function tiendaDesdeConfig(ajustes, productos) {
  const t = (ajustes && ajustes.tienda) || {};
  const precioWeb = (p) => Number(p.camposExtra && p.camposExtra.tienda && p.camposExtra.tienda.precio) || p.precio;
  const agotado = (p) => p.controlaStock !== false && (p.stock || 0) <= 0;
  const hijos = {};
  for (const p of productos || []) if (p.padreId && p.activo !== false && p.precio > 0) (hijos[p.padreId] = hijos[p.padreId] || []).push(p);
  const items = (productos || [])
    .filter((p) => !p.padreId && p.activo !== false && p.camposExtra && p.camposExtra.tienda && p.camposExtra.tienda.publicado && (p.precio > 0 || hijos[p.id]))
    .map((p) => {
      const ti = p.camposExtra.tienda;
      const vs = (hijos[p.id] || []).sort((a, b) => a.nombre.localeCompare(b.nombre)).map((h) => ({
        id: h.id, atributos: h.atributos || {}, precio: precioWeb(h), imagen: h.imagen || null, agotado: agotado(h),
        stock: t.mostrarStock && h.controlaStock !== false ? Math.max(h.stock || 0, 0) : null,
      }));
      return {
        id: p.id, nombre: p.nombre, descripcion: p.descripcion || null, categoria: p.categoria || "Otros", marca: p.marca || null,
        precio: precioWeb(p), unidad: p.unidad, imagen: p.imagen || null, fotos: Array.isArray(ti.fotos) ? ti.fotos : [],
        destacado: !!ti.destacado, agotado: vs.length ? vs.every((v) => v.agotado) : agotado(p),
        stock: !vs.length && t.mostrarStock && p.controlaStock !== false ? Math.max(p.stock || 0, 0) : null,
        variantes: vs, creado: p.creadoEn || null,
      };
    })
    .sort((a, b) => (b.destacado - a.destacado) || String(a.categoria).localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));
  return {
    config: {
      minimo: t.minimo || 0, retiro: t.retiro !== false, envio: !!t.envio, costoEnvio: t.costoEnvio || 0,
      envioGratisDesde: t.envioGratisDesde || null, zona: t.zona || null, mostrarStock: !!t.mostrarStock,
      efectivo: t.efectivo !== false, transferencia: !!t.transferencia, alias: t.alias || null, titular: t.titular || null,
    },
    items,
  };
}

/* El sitio entero. `conTienda`: si el comercio tiene el módulo. `forzar`:
   en la vista previa se muestra aunque no esté publicado ni prendido. */
export function sitioDesdeConfig(ajustes, productos, { conTienda = false, forzar = false } = {}) {
  const info = presenciaDesdeConfig(forzar ? { ...ajustes, publico: { ...(ajustes.publico || {}), publicada: true } } : ajustes);
  const tienda = conTienda && (forzar || (ajustes.tienda && ajustes.tienda.activa)) ? tiendaDesdeConfig(ajustes, productos) : null;
  if (!info && !tienda) return null;
  return { diseno: disenoDesdeConfig(ajustes), info, tienda };
}
