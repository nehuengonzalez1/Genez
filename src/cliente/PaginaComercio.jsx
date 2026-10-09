/* ============================================================
   LA PÁGINA DEL COMERCIO, EN CELULAR Y EN COMPUTADORA (0140)
   ============================================================

   Nehuen (08/10), mirando la vista previa: "ahí se ve en versión
   vertical, pero en versión PC ¿cómo se ve?". Se veía como un celular en
   el medio de la pantalla: una columna de 500 px con todo lo demás
   vacío. Para una página que se comparte en Instagram y se abre desde
   una computadora, no alcanzaba.

   Ahora hay dos formas de la misma página:
     celular       una columna: quién es, la vidriera (abierto, botones,
                   horarios), las fotos y el video;
     computadora   la portada a todo el ancho y dos columnas: a la
                   izquierda quién es, las fotos y el video; a la
                   derecha, fija mientras se baja, la tarjeta con lo que
                   se toca (abierto ahora, escribir, llegar, horarios).

   Cuál se dibuja lo decide quien la usa (`modo`), no los breakpoints de
   Tailwind: la vista previa de Presencia online dibuja la de computadora
   adentro de una ventana chica de la gestión, y ahí los breakpoints
   miran el ancho de la gestión y no el de la página.

   Lo usan la página pública (App.jsx) y la vista previa de la gestión
   (PresenciaOnline.jsx). No importa nada de ninguna de las dos.
   ============================================================ */

import React, { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Images, PlayCircle } from "lucide-react";
import { Vidriera } from "./Vidriera.jsx";
import { videoEmbebido, numeroWhatsApp } from "./vidriera.js";
import { Tienda } from "./Tienda.jsx";

const ROTULO = "text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold";

/* El ancho de una computadora. 1024 es donde una tablet acostada ya
   tiene lugar para las dos columnas. */
export function useModoPagina() {
  const ver = () => (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(min-width: 1024px)").matches ? "computadora" : "celular");
  const [modo, setModo] = useState(ver);
  useEffect(() => {
    if (!window.matchMedia) return;
    const m = window.matchMedia("(min-width: 1024px)");
    const h = () => setModo(ver());
    m.addEventListener ? m.addEventListener("change", h) : m.addListener(h);
    return () => (m.removeEventListener ? m.removeEventListener("change", h) : m.removeListener(h));
  }, []);
  return modo;
}

/* El lema con su segunda frase en el color de la marca, igual que la
   bienvenida de siempre. */
function Lema({ texto, grande }) {
  const frases = String(texto || "").split(".").map((f) => f.trim()).filter(Boolean);
  if (!frases.length) return null;
  return (
    <p className={`f-d leading-[1.2] ${grande ? "text-[40px]" : "text-[26px]"}`}>
      {frases.map((f, i) => <span key={i} className={`block ${frases.length > 1 && i === 1 ? "text-acento" : ""}`}>{f}.</span>)}
    </p>
  );
}

function Quien({ marca, grande }) {
  return (
    <div>
      {marca.logo
        ? <img src={marca.logo} alt={marca.nombre} className={`${grande ? "h-14" : "h-11"} object-contain`} />
        : <h1 className={`f-d text-acento ${grande ? "text-4xl" : "text-3xl"}`}>{marca.nombre}</h1>}
      <p className="text-[11px] uppercase tracking-[0.18em] mt-2 text-texto-tenue">by GENEZ</p>
    </div>
  );
}

/* Las fotos, y una tocada a pantalla completa (solo en la página de
   verdad: en la vista previa no se abre nada). */
function Galeria({ fotos, columnas, enlaces }) {
  const [abierta, setAbierta] = useState(null);
  useEffect(() => {
    if (abierta == null) return;
    const h = (e) => {
      if (e.key === "Escape") setAbierta(null);
      if (e.key === "ArrowRight") setAbierta((i) => (i + 1) % fotos.length);
      if (e.key === "ArrowLeft") setAbierta((i) => (i - 1 + fotos.length) % fotos.length);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [abierta, fotos.length]);
  if (!fotos.length) return null;
  return (
    <section>
      <h2 className={`${ROTULO} flex items-center gap-1.5 mb-3`}><Images size={13} /> Fotos</h2>
      <div className={`grid gap-2.5 ${columnas === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {fotos.map((src, i) => (
          <button key={src + i} type="button" onClick={() => enlaces && setAbierta(i)} data-foto={i}
            className={`block overflow-hidden rounded-xl bg-superficie-2 aspect-[4/3] ${enlaces ? "cursor-zoom-in" : "cursor-default"}`}>
            <img src={src} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.03]" />
          </button>
        ))}
      </div>
      {abierta != null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setAbierta(null)}>
          <img src={fotos[abierta]} alt="" className="max-w-full max-h-[86vh] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          <button type="button" aria-label="Cerrar" className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20" onClick={() => setAbierta(null)}><X size={22} /></button>
          {fotos.length > 1 && (
            <>
              <button type="button" aria-label="Anterior" className="absolute left-3 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
                onClick={(e) => { e.stopPropagation(); setAbierta((i) => (i - 1 + fotos.length) % fotos.length); }}><ChevronLeft size={24} /></button>
              <button type="button" aria-label="Siguiente" className="absolute right-3 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
                onClick={(e) => { e.stopPropagation(); setAbierta((i) => (i + 1) % fotos.length); }}><ChevronRight size={24} /></button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Video({ url, enlaces }) {
  const v = videoEmbebido(url);
  if (!v) return null;
  return (
    <section>
      <h2 className={`${ROTULO} flex items-center gap-1.5 mb-3`}><PlayCircle size={13} /> Video</h2>
      <div className={`overflow-hidden rounded-xl bg-superficie-2 ${v.vertical ? "aspect-[9/16] max-w-[320px]" : "aspect-video"}`}>
        {enlaces
          ? <iframe src={v.src} title="Video" className="w-full h-full" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
          /* En la vista previa no se carga el reproductor: es pesado y
             no hace falta para ver cómo queda. */
          : <div className="w-full h-full flex items-center justify-center text-texto-tenue"><PlayCircle size={40} /></div>}
      </div>
    </section>
  );
}

/* `pie`: lo de abajo de la tarjeta (el botón para entrar, en la página
   de verdad). `enlaces`: false en la vista previa, para que nada lleve a
   ningún lado. */
/* `tienda`: el catálogo de catalogo_tienda (0141), o null. `onPedir`:
   manda el pedido; sin él (vista previa), la tienda se ve pero no vende. */
export function PaginaComercio({ marca, presencia, modo = "celular", enlaces = true, pie = null, tienda = null, onPedir = null }) {
  const fotos = (presencia && presencia.galeria) || [];
  const video = presencia && presencia.video;
  const wa = presencia && presencia.contacto && presencia.contacto.whatsapp ? numeroWhatsApp(presencia.contacto.whatsapp) : null;
  const laTienda = (cols) => <Tienda slug={marca.slug || marca.nombre} tienda={tienda} columnas={cols} onPedir={onPedir} whatsapp={wa} nombre={marca.nombre} />;

  if (modo === "computadora") {
    return (
      <div className="bg-fondo text-texto min-h-full">
        {marca.portada && (
          <div className="h-[340px] bg-superficie-2 overflow-hidden">
            <img src={marca.portada} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="max-w-6xl mx-auto px-10 py-12 grid grid-cols-[1fr_380px] gap-14 items-start">
          <div className="min-w-0 space-y-10">
            <div>
              <Quien marca={marca} grande />
              {marca.lema && <div className="mt-8"><Lema texto={marca.lema} grande /></div>}
              {marca.bajada && <p className="text-base text-texto-suave mt-4 leading-relaxed max-w-2xl">{marca.bajada}</p>}
            </div>
            {laTienda(3)}
            <Galeria fotos={fotos} columnas={3} enlaces={enlaces} />
            <Video url={video} enlaces={enlaces} />
          </div>
          <aside className="sticky top-6">
            <div className="rounded-2xl border border-borde bg-superficie p-6">
              <Vidriera nombre={marca.nombre} presencia={presencia} enlaces={enlaces} />
              {pie && <div className="mt-6 pt-5 border-t border-borde">{pie}</div>}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-fondo text-texto min-h-full">
      {marca.portada && (
        <div className="h-56 bg-superficie-2 overflow-hidden">
          <img src={marca.portada} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="max-w-lg mx-auto px-6 py-8 space-y-8">
        <div>
          <Quien marca={marca} />
          {marca.lema && <div className="mt-7"><Lema texto={marca.lema} /></div>}
          {marca.bajada && <p className="text-sm text-texto-suave mt-3 leading-relaxed">{marca.bajada}</p>}
        </div>
        <Vidriera nombre={marca.nombre} presencia={presencia} enlaces={enlaces} />
        {laTienda(2)}
        <Galeria fotos={fotos} columnas={2} enlaces={enlaces} />
        <Video url={video} enlaces={enlaces} />
        {pie && <div className="pt-6 border-t border-borde">{pie}</div>}
      </div>
    </div>
  );
}
