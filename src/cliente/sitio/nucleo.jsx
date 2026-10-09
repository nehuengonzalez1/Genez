/* ============================================================
   EL SITIO: DIRECCIONES, ESTILO Y CARRITO (0141)
   ============================================================

   LAS DIRECCIONES
   ---------------
   Una tienda se comparte por producto: "mirá esta remera" es un link a
   esa remera, no a la tienda. Por eso el sitio tiene direcciones de
   verdad (`/producto/remera-lisa-3f2a91c0`, `/categoria/ropa`), que en
   producción son la ruta del subdominio: middleware.js manda cualquier
   ruta del subdominio a cliente.html.

   En desarrollo la página es `cliente.html?c=...` y Vite no sabe de esas
   rutas: ahí van detrás de un `#`. Y en la vista previa de la gestión no
   hay barra de direcciones: la ruta vive en memoria. Las tres formas se
   eligen acá y el resto del sitio usa `useRuta` y `<Enlace>` sin saber
   cuál es.

   EL ESTILO
   ---------
   Cada tienda elige su color, su letra y fondo claro u oscuro. Los
   colores de todo Genez son variables CSS ("R G B"), así que pisar
   --acento en la raíz del sitio cambia el color de cada botón sin tocar
   un componente. La letra se pide a Google Fonts solo cuando se usa.

   EL CARRITO
   ----------
   En el teléfono, por comercio: si la persona se va a WhatsApp a
   preguntar algo y vuelve, sigue ahí.
   ============================================================ */

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

/* ---------- Direcciones ---------- */

const RutaCtx = createContext(null);

const leerUrl = () => {
  if (typeof window === "undefined") return "/";
  const enHash = /cliente(\.html)?$/.test(window.location.pathname);
  return enHash ? (window.location.hash.slice(1) || "/") : (window.location.pathname || "/");
};

/* `memoria`: la vista previa de la gestión. */
export function ProveedorRuta({ memoria = false, inicial = "/", children }) {
  const [ruta, setRuta] = useState(memoria ? inicial : leerUrl());
  useEffect(() => {
    if (memoria) return;
    const h = () => setRuta(leerUrl());
    window.addEventListener("popstate", h);
    window.addEventListener("hashchange", h);
    return () => { window.removeEventListener("popstate", h); window.removeEventListener("hashchange", h); };
  }, [memoria]);
  const ir = useCallback((r) => {
    if (!memoria) {
      if (/cliente(\.html)?$/.test(window.location.pathname)) window.location.hash = r;
      else window.history.pushState(null, "", r);
      window.scrollTo(0, 0);
    }
    setRuta(r);
  }, [memoria]);
  const href = useCallback((r) => (memoria ? "#" : /cliente(\.html)?$/.test(window.location.pathname) ? `${window.location.pathname}${window.location.search}#${r}` : r), [memoria]);
  const v = useMemo(() => ({ ruta, ir, href, memoria }), [ruta, ir, href, memoria]);
  return <RutaCtx.Provider value={v}>{children}</RutaCtx.Provider>;
}

export const useRuta = () => useContext(RutaCtx);

/* Un link del sitio: con su dirección de verdad (se puede abrir en otra
   pestaña o copiar), pero navega sin recargar. */
export function Enlace({ a, children, className = "", onClick, ...resto }) {
  const { ir, href } = useRuta();
  return (
    <a href={href(a)} className={className} {...resto}
      onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onClick && onClick(e); ir(a); }}>
      {children}
    </a>
  );
}

/* "Remera lisa de algodón" → "remera-lisa-de-algodon". */
export const slugDe = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
export const rutaProducto = (p) => `/producto/${slugDe(p.nombre)}-${String(p.id).slice(0, 8)}`;
export const rutaCategoria = (c) => `/categoria/${slugDe(c)}`;

/* ---------- Estilo ---------- */

export const FUENTES = {
  inter: { n: "Inter", css: "Inter:wght@400;500;600;700" },
  poppins: { n: "Poppins", css: "Poppins:wght@400;500;600;700" },
  montserrat: { n: "Montserrat", css: "Montserrat:wght@400;500;600;700" },
  playfair: { n: "Playfair Display", css: "Playfair+Display:wght@400;600;700" },
  lora: { n: "Lora", css: "Lora:wght@400;500;600;700" },
  dmsans: { n: "DM Sans", css: "DM+Sans:wght@400;500;600;700" },
};

/* `doc`: el documento donde está dibujado el sitio. En la vista previa de
   la gestión es el de un iframe, y la letra tiene que cargarse ahí. */
export function usarFuente(k, doc) {
  useEffect(() => {
    const f = FUENTES[k];
    const d = doc || document;
    if (!f) return;
    const id = `fuente-${k}`;
    if (d.getElementById(id)) return;
    const l = d.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href = `https://fonts.googleapis.com/css2?family=${f.css}&display=swap`;
    d.head.appendChild(l);
  }, [k, doc]);
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mezcla = (a, b, t) => a.map((x, i) => Math.round(x * (1 - t) + b[i] * t));

/* Las variables que pisa el color de la tienda. El "suave" se mezcla con
   el fondo: con blanco en el claro, con negro en el oscuro. Sobre el
   color va negro o blanco según cuánta luz tenga. */
export function variablesDeColor(hex, oscuro) {
  if (!hex) return {};
  const c = rgb(hex);
  const luz = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  const vivo = mezcla(c, oscuro ? [255, 255, 255] : [0, 0, 0], 0.15);
  const suave = mezcla(c, oscuro ? [20, 20, 20] : [255, 255, 255], oscuro ? 0.78 : 0.88);
  return {
    "--acento": c.join(" "),
    "--acento-vivo": vivo.join(" "),
    "--acento-suave": suave.join(" "),
    "--sobre-acento": luz > 0.62 ? "20 20 20" : "255 255 255",
  };
}

/* ---------- Carrito ---------- */

/* Lo guardado se revisa antes de usarlo: un carrito de otra versión de la
   tienda (o tocado a mano) no puede romper la página. */
const leerCarrito = (slug) => {
  try {
    const l = JSON.parse(localStorage.getItem(`genez:carrito:${slug}`) || "[]");
    return Array.isArray(l) ? l.filter((x) => x && x.id && Number(x.cantidad) > 0 && Number.isFinite(Number(x.precio))) : [];
  } catch { return []; }
};

/* Un renglón: { id (el producto o la variante), productoId, nombre,
   detalle ("M · Negro"), precio, imagen, unidad, cantidad }. */
export function useCarrito(slug, guardar = true) {
  const [lineas, setLineas] = useState(() => (guardar ? leerCarrito(slug) : []));
  useEffect(() => {
    if (!guardar) return;
    try { localStorage.setItem(`genez:carrito:${slug}`, JSON.stringify(lineas)); } catch { /* sin lugar: vive en memoria */ }
  }, [lineas, slug, guardar]);
  const agregar = useCallback((l, cantidad = 1) => setLineas((ls) => {
    const i = ls.findIndex((x) => x.id === l.id);
    if (i < 0) return [...ls, { ...l, cantidad: Math.min(50, cantidad) }];
    return ls.map((x, j) => (j === i ? { ...x, cantidad: Math.min(50, +(x.cantidad + cantidad).toFixed(2)) } : x));
  }), []);
  const cambiar = useCallback((id, cantidad) => setLineas((ls) => (cantidad <= 0 ? ls.filter((x) => x.id !== id) : ls.map((x) => (x.id === id ? { ...x, cantidad: Math.min(50, cantidad) } : x)))), []);
  const vaciar = useCallback(() => setLineas([]), []);
  const subtotal = lineas.reduce((s, l) => s + Math.round(l.precio * l.cantidad), 0);
  const unidades = lineas.reduce((s, l) => s + (l.unidad === "kg" ? 1 : l.cantidad), 0);
  return { lineas, agregar, cambiar, vaciar, subtotal, unidades };
}

export const plata = (n) => `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;
export const sinAcentos = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
