/* ============================================================
   TIENDA ONLINE · el sitio del comercio (0141)
   ============================================================

   Un solo lugar para el sitio entero, como el panel de Tienda Nube:

     Diseño          plantilla, color, letra, fondo, anuncio, banners y
                     qué secciones van en el inicio y en qué orden
     Productos       qué se publica, con sus fotos, su descripción, su
                     precio web y sus variantes (talle, color)
     Envíos y pagos  prenderla, retiro, envío y su costo, efectivo,
                     transferencia, compra mínima
     Información     horarios, contacto, aviso, fotos y video del local
                     (lo que era "Presencia online", 0140)

   A la derecha, el sitio de verdad: el mismo componente que ve el
   cliente (src/cliente/sitio/Sitio.jsx), armado con lo que se está
   editando (armar.js) y dibujado adentro de un iframe del ancho de un
   celular o de una computadora. Así los breakpoints son los del sitio y
   no los de la gestión, y lo que se ve es lo que va a ver la gente.

   Sin el módulo de tienda (lo prende la plataforma), el comercio tiene
   igual su sitio con la información del local: Diseño e Información
   andan, Productos y Envíos dicen que falta activarla.

   Los productos son los de Productos: publicar es una marca
   (campos_extra.tienda), las fotos extra van en esa marca y la principal
   es items.imagen. Una variante es un producto hijo (padre_id), así la
   caja, la pistola y el stock no se enteran.
   ============================================================ */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ExternalLink, Search, Star, ImagePlus, ShoppingBag, Store, Truck, Smartphone, Monitor, Palette, Package,
  Info, ChevronUp, ChevronDown, Trash2, X, ChevronLeft, ChevronRight, Plus, Layers, Globe, Banknote, Landmark,
} from "lucide-react";
import { Card, Boton, Modal } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { money } from "../utils/helpers.js";
import { useLogos } from "../ui/logos.js";
import { guardarProducto, crearProducto } from "../datos/items.js";
import { subirFotoPublica } from "../datos/presencia.js";
import { Sitio } from "../cliente/sitio/Sitio.jsx";
import { sitioDesdeConfig } from "../cliente/sitio/armar.js";
import { FUENTES } from "../cliente/sitio/nucleo.jsx";
import { PresenciaOnline } from "./PresenciaOnline.jsx";

const rotulo = "text-[11px] uppercase tracking-[0.1em] font-bold text-texto-tenue";
const sinAcentos = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const plata = (v) => (v === "" || v == null ? "" : String(v).replace(/\D/g, ""));

const PLANTILLAS = [
  { k: "clasica", n: "Clásica", d: "Logo al centro, menú abajo. Tarjetas con borde." },
  { k: "moderna", n: "Moderna", d: "Logo a la izquierda, banner redondeado, fotos protagonistas." },
  { k: "minima", n: "Mínima", d: "Mucho aire, letra chica en mayúsculas, fotos altas." },
];
const COLORES = ["#ea580c", "#0f766e", "#1d4ed8", "#7c3aed", "#be123c", "#15803d", "#111827", "#b45309"];
const SECCIONES = [
  { k: "banner", n: "Banner principal" }, { k: "destacados", n: "Destacados" }, { k: "categorias", n: "Categorías" },
  { k: "productos", n: "Productos" }, { k: "local", n: "El local (horarios y contacto)" }, { k: "galeria", n: "Fotos" }, { k: "video", n: "Video" },
];

function Interruptor({ prendido, onCambiar, etiqueta }) {
  return (
    <button type="button" role="switch" aria-checked={prendido} aria-label={etiqueta} onClick={onCambiar}
      className={`relative w-10 h-6 rounded-full border transition-colors shrink-0 ${prendido ? "bg-acento border-acento" : "bg-superficie-3 border-borde"}`}>
      <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-superficie shadow-sm transition-all ${prendido ? "left-[19px]" : "left-0.5"}`} />
    </button>
  );
}

function Bloque({ titulo, d, children, accion }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div><div className={rotulo}>{titulo}</div>{d && <p className="text-xs text-texto-tenue mt-1 leading-relaxed">{d}</p>}</div>
        {accion}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

/* ---------- La vista previa: el sitio en un iframe ---------- */

/* Un iframe vacío con las hojas de estilo de la gestión copiadas, y el
   sitio dibujado adentro con un portal: el mismo React, los mismos
   datos, otro ancho de pantalla. */
function MarcoPrevia({ ancho, alto, escala, children }) {
  const ref = useRef(null);
  const [cuerpo, setCuerpo] = useState(null);
  useEffect(() => {
    const doc = ref.current && ref.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write("<!doctype html><html lang=\"es-AR\"><head><meta charset=\"utf-8\"></head><body style=\"margin:0\"></body></html>");
    doc.close();
    for (const n of document.querySelectorAll("link[rel=\"stylesheet\"], style")) doc.head.appendChild(n.cloneNode(true));
    setCuerpo(doc.body);
  }, []);
  return (
    <div style={{ width: ancho * escala, height: alto * escala }} className="overflow-hidden">
      <iframe ref={ref} title="Vista previa del sitio" style={{ width: ancho, height: alto, transform: `scale(${escala})`, transformOrigin: "0 0", border: 0, display: "block" }} />
      {cuerpo && createPortal(children, cuerpo)}
    </div>
  );
}

function VistaPrevia({ ajustes, productos, conTienda, slug }) {
  const [modo, setModo] = useState("celular");
  const [ancho, setAncho] = useState(360);
  const caja = useRef(null);
  const logos = useLogos(ajustes.marca);
  useEffect(() => {
    if (!caja.current || typeof ResizeObserver === "undefined") return;
    const o = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    o.observe(caja.current);
    return () => o.disconnect();
  }, []);
  const sitio = useMemo(() => sitioDesdeConfig(ajustes, productos, { conTienda, forzar: true }), [ajustes, productos, conTienda]);
  const oscuro = ajustes.sitio && ajustes.sitio.fondo === "oscuro";
  const m = ajustes.marca || {};
  const marca = { nombre: ajustes.negocio, slug, logo: (oscuro ? logos.paraOscuro : logos.paraClaro) || null, lema: m.lema || "", bajada: m.bajada || "", portada: m.portada || null };
  const [pa, pal] = modo === "celular" ? [390, 780] : [1280, 820];
  const escala = Math.min(1, ancho / pa);
  /* Al cambiar de modo se arma de nuevo: el iframe nuevo, del ancho nuevo. */
  return (
    <div ref={caja} className="w-full">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className={rotulo}>Así se ve</div>
        <div className="flex rounded-md border border-borde overflow-hidden text-xs font-semibold">
          {[["celular", Smartphone, "Celular"], ["computadora", Monitor, "Computadora"]].map(([k, I, n]) => (
            <button key={k} type="button" onClick={() => setModo(k)} className={`flex items-center gap-1 px-2.5 py-1 ${modo === k ? "bg-acento-suave text-texto" : "text-texto-tenue hover:bg-superficie-2"}`}><I size={13} /> {n}</button>
          ))}
        </div>
      </div>
      <div className={`mx-auto rounded-xl border border-borde overflow-hidden bg-superficie-2 ${modo === "celular" ? "w-fit" : ""}`}>
        {sitio
          ? <MarcoPrevia key={modo} ancho={pa} alto={pal} escala={escala}><Sitio sitio={sitio} marca={marca} slug={slug} memoria /></MarcoPrevia>
          : <p className="p-6 text-sm text-texto-tenue">Cargá la información o activá la tienda para ver el sitio.</p>}
      </div>
      <p className="text-[11px] text-texto-tenue mt-2">Es tu sitio de verdad, con lo que estás editando. Se puede navegar: tocá un producto.</p>
    </div>
  );
}

/* ---------- Diseño ---------- */

function Diseno({ ajustes, setAjustes, empresaId, toast, slug, subdominio }) {
  const s = ajustes.sitio || {};
  const set = (k, v) => setAjustes({ ...ajustes, sitio: { ...s, [k]: v } });
  const banners = s.banners || [];
  const secciones = (s.secciones && s.secciones.length ? s.secciones : SECCIONES.map((x) => ({ k: x.k, activo: true })));
  const archivo = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const url = slug ? `https://${slug}.genez.com.ar` : null;

  async function subirBanner(e) {
    const a = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!a) return;
    setSubiendo(true);
    try {
      const { url: u, ruta } = await subirFotoPublica(empresaId, a, "banners");
      setAjustes((aj) => { const ss = aj.sitio || {}; return { ...aj, sitio: { ...ss, banners: [...(ss.banners || []), { url: u, ruta, titulo: "", texto: "", boton: "Ver productos", enlace: "/productos" }].slice(0, 5) } }; });
    } catch (err) { toast(err.message || "No se pudo subir.", "mal"); }
    setSubiendo(false);
  }
  const setBanner = (i, k, v) => set("banners", banners.map((b, j) => (j === i ? { ...b, [k]: v } : b)));
  const moverSeccion = (i, d) => { const j = i + d; if (j < 0 || j >= secciones.length) return; const n = [...secciones]; [n[i], n[j]] = [n[j], n[i]]; set("secciones", n); };

  return (
    <div className="space-y-5">
      <Bloque titulo="Tu dirección" d="Donde está tu sitio. Compartila en Instagram, en WhatsApp y en tu Google.">
        {url ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-acento hover:underline"><Globe size={15} /> {url.replace("https://", "")} <ExternalLink size={13} /></a>
              {/* Cómo quedó en Vercel (0142): se pide sola al entrar. */}
              {subdominio && (
                <span data-subdominio={subdominio.estado} className={`text-[11px] font-bold uppercase tracking-wider rounded px-2 py-0.5 ${subdominio.estado === "listo" ? "bg-bien-suave text-bien" : subdominio.estado === "error" ? "bg-ojo-suave text-ojo" : "bg-superficie-2 text-texto-suave"}`}>
                  {subdominio.estado === "listo" ? "Lista" : subdominio.estado === "error" ? "Con un problema" : "Preparando"}
                </span>
              )}
            </div>
            {subdominio && subdominio.estado === "pendiente" && <p className="text-xs text-texto-tenue mt-2">Se está preparando: en unos minutos se puede abrir. No tenés que hacer nada.</p>}
            {subdominio && subdominio.estado === "error" && <p className="text-xs text-texto-tenue mt-2">No se pudo preparar todavía; se vuelve a intentar solo todos los días. Si sigue así, escribinos.</p>}
            <p className="text-xs text-texto-tenue mt-2">Dominio propio (tunegocio.com.ar): próximamente.</p>
          </>
        ) : <p className="text-sm text-texto-suave">Tu comercio todavía no tiene dirección. Escribinos y te la armamos.</p>}
      </Bloque>

      <Bloque titulo="Plantilla" d="Cambia la forma del sitio: dónde va el logo, cómo son las tarjetas y el banner.">
        <div className="grid sm:grid-cols-3 gap-2.5">
          {PLANTILLAS.map((p) => (
            <button key={p.k} type="button" onClick={() => set("plantilla", p.k)} data-plantilla={p.k}
              className={`text-left rounded-lg border p-3.5 ${(s.plantilla || "clasica") === p.k ? "border-acento bg-acento-suave" : "border-borde hover:bg-superficie-2"}`}>
              <div className="text-sm font-semibold">{p.n}</div>
              <div className="text-xs text-texto-tenue mt-1 leading-snug">{p.d}</div>
            </button>
          ))}
        </div>
      </Bloque>

      <Bloque titulo="Color, letra y fondo">
        <div className="space-y-4">
          <div>
            <span className="text-xs font-semibold text-texto-suave">Color principal</span>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {COLORES.map((c) => (
                <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => set("color", c)}
                  className={`w-8 h-8 rounded-full border-2 ${s.color === c ? "border-texto" : "border-transparent"}`} style={{ background: c }} />
              ))}
              <label className="flex items-center gap-1.5 text-xs text-texto-suave ml-1">
                <input type="color" value={s.color || "#ea580c"} onChange={(e) => set("color", e.target.value)} className="w-8 h-8 rounded border border-borde bg-transparent p-0" /> otro
              </label>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-texto-suave">Letra</span>
              <select value={s.fuente || "inter"} onChange={(e) => set("fuente", e.target.value)} className={inputCls}>
                {Object.entries(FUENTES).map(([k, f]) => <option key={k} value={k}>{f.n}</option>)}
              </select>
            </label>
            <div>
              <span className="text-xs font-semibold text-texto-suave">Fondo</span>
              <div className="mt-1 flex gap-2">
                {[["claro", "Claro"], ["oscuro", "Oscuro"]].map(([k, n]) => (
                  <button key={k} type="button" onClick={() => set("fondo", k)} className={`flex-1 text-sm font-semibold rounded-md border px-3 py-2 ${(s.fondo || "claro") === k ? "border-acento bg-acento-suave" : "border-borde hover:bg-superficie-2"}`}>{n}</button>
                ))}
              </div>
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-texto-suave">Barra de anuncio (arriba de todo)</span>
            <input value={s.anuncio || ""} onChange={(e) => set("anuncio", e.target.value.slice(0, 120))} placeholder="Envío gratis desde $25.000 · 3 cuotas sin interés" className={inputCls} />
          </label>
        </div>
      </Bloque>

      <Bloque titulo="Banners" d="Hasta 5 imágenes grandes arriba del inicio, que van pasando solas. Horizontales, 1600 × 600 o parecido. Sin banners, se usa la portada con tu frase."
        accion={banners.length < 5 && <Boton size="sm" variant="ghost" onClick={() => archivo.current && archivo.current.click()} disabled={subiendo || !empresaId}><ImagePlus size={14} /> {subiendo ? "Subiendo…" : "Agregar"}</Boton>}>
        <input ref={archivo} type="file" accept="image/*" className="hidden" onChange={subirBanner} />
        {banners.length === 0 && <p className="text-sm text-texto-tenue">Todavía no hay banners.</p>}
        <div className="space-y-3">
          {banners.map((b, i) => (
            <div key={b.ruta || b.url} className="flex gap-3 rounded-lg border border-borde p-3">
              <div className="w-32 h-20 rounded-md overflow-hidden bg-superficie-2 shrink-0"><img src={b.url} alt="" className="w-full h-full object-cover" /></div>
              <div className="flex-1 min-w-0 grid sm:grid-cols-2 gap-2">
                <input value={b.titulo || ""} onChange={(e) => setBanner(i, "titulo", e.target.value.slice(0, 80))} placeholder="Título (ej: Nueva temporada)" className={`${inputCls} !mt-0`} />
                <input value={b.texto || ""} onChange={(e) => setBanner(i, "texto", e.target.value.slice(0, 160))} placeholder="Texto (opcional)" className={`${inputCls} !mt-0`} />
                <input value={b.boton || ""} onChange={(e) => setBanner(i, "boton", e.target.value.slice(0, 30))} placeholder="Botón (ej: Ver productos)" className={`${inputCls} !mt-0`} />
                <input value={b.enlace || ""} onChange={(e) => setBanner(i, "enlace", e.target.value.slice(0, 120))} placeholder="A dónde lleva (/productos)" className={`${inputCls} !mt-0`} />
              </div>
              <div className="flex flex-col gap-1">
                <button type="button" aria-label="Subir" onClick={() => { const n = [...banners]; if (i > 0) { [n[i - 1], n[i]] = [n[i], n[i - 1]]; set("banners", n); } }} className="p-1 text-texto-tenue hover:text-texto"><ChevronUp size={15} /></button>
                <button type="button" aria-label="Bajar" onClick={() => { const n = [...banners]; if (i < n.length - 1) { [n[i + 1], n[i]] = [n[i], n[i + 1]]; set("banners", n); } }} className="p-1 text-texto-tenue hover:text-texto"><ChevronDown size={15} /></button>
                <button type="button" aria-label="Sacar" onClick={() => set("banners", banners.filter((_, j) => j !== i))} className="p-1 text-texto-tenue hover:text-mal"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </Bloque>

      <Bloque titulo="Secciones del inicio" d="Qué se muestra en la página principal y en qué orden.">
        <ul className="divide-y divide-borde">
          {secciones.map((x, i) => {
            const def = SECCIONES.find((y) => y.k === x.k);
            if (!def) return null;
            return (
              <li key={x.k} className="flex items-center gap-3 py-2">
                <div className="flex flex-col">
                  <button type="button" aria-label="Subir" onClick={() => moverSeccion(i, -1)} className="text-texto-tenue hover:text-texto"><ChevronUp size={14} /></button>
                  <button type="button" aria-label="Bajar" onClick={() => moverSeccion(i, 1)} className="text-texto-tenue hover:text-texto"><ChevronDown size={14} /></button>
                </div>
                <span className={`flex-1 text-sm ${x.activo === false ? "text-texto-tenue" : ""}`}>{def.n}</span>
                <Interruptor prendido={x.activo !== false} onCambiar={() => set("secciones", secciones.map((y, j) => (j === i ? { ...y, activo: y.activo === false } : y)))} etiqueta={`Mostrar ${def.n}`} />
              </li>
            );
          })}
        </ul>
      </Bloque>
    </div>
  );
}

/* ---------- Productos ---------- */

const tiendaDe = (p) => (p.camposExtra && p.camposExtra.tienda) || {};

function Productos({ productos, setProductos, empresaId, toast }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [soloPublicados, setSoloPublicados] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState(null);
  const vendibles = useMemo(() => productos.filter((p) => p.activo !== false && !p.padreId), [productos]);
  const hijos = useMemo(() => { const h = {}; for (const p of productos) if (p.padreId && p.activo !== false) (h[p.padreId] = h[p.padreId] || []).push(p); return h; }, [productos]);
  const categorias = useMemo(() => [...new Set(vendibles.map((p) => p.categoria || "Otros"))].sort(), [vendibles]);
  const lista = vendibles.filter((p) =>
    (!cat || (p.categoria || "Otros") === cat) && (!soloPublicados || tiendaDe(p).publicado)
    && (!q.trim() || sinAcentos(p.nombre).includes(sinAcentos(q.trim())) || String(p.barcode || "").includes(q.trim())));
  const publicados = vendibles.filter((p) => tiendaDe(p).publicado);

  async function guardarTienda(p, cambios) {
    const camposExtra = { ...(p.camposExtra || {}), tienda: { ...tiendaDe(p), ...cambios } };
    await guardarProducto(p.id, { camposExtra });
    setProductos((ps) => ps.map((x) => (x.id === p.id ? { ...x, camposExtra } : x)));
  }
  const cambiar = (p, c) => guardarTienda(p, c).catch((e) => toast(e.message || "No se pudo guardar.", "mal"));
  async function publicarLista(publicar) {
    const afectados = lista.filter((p) => !!tiendaDe(p).publicado !== publicar && (p.precio > 0 || hijos[p.id]));
    if (!afectados.length) return;
    setOcupado(true);
    let mal = 0;
    for (const p of afectados) { try { await guardarTienda(p, { publicado: publicar }); } catch { mal++; } }
    setOcupado(false);
    toast(mal ? `Quedaron ${mal} sin guardar.` : publicar ? `Publicaste ${afectados.length}.` : `Sacaste ${afectados.length}.`, mal ? "mal" : "ok");
  }
  const p = editando && productos.find((x) => x.id === editando);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[["Publicados", publicados.length], ["Con foto", publicados.filter((x) => x.imagen).length], ["Con variantes", publicados.filter((x) => hijos[x.id]).length]].map(([n, v]) => (
          <Card key={n} className="px-4 py-3"><div className="text-[11px] text-texto-tenue">{n}</div><div className="f-m text-xl font-semibold">{v}</div></Card>
        ))}
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b border-borde">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o código" className={`${inputCls} !mt-0 pl-8`} />
            </div>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className={`${inputCls} !mt-0 !w-auto`}>
              <option value="">Todas las categorías</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm px-1"><input type="checkbox" checked={soloPublicados} onChange={(e) => setSoloPublicados(e.target.checked)} /> Solo publicados</label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-texto-tenue">{lista.length} productos</span>
            <Boton size="sm" variant="ghost" disabled={ocupado || !lista.length} onClick={() => publicarLista(true)}><ShoppingBag size={14} /> Publicar estos</Boton>
            <Boton size="sm" variant="quiet" disabled={ocupado || !lista.length} onClick={() => publicarLista(false)}>Sacarlos</Boton>
            {ocupado && <span className="text-xs text-texto-tenue">Guardando…</span>}
          </div>
        </div>
        <ul className="divide-y divide-borde max-h-[620px] overflow-y-auto">
          {lista.slice(0, 200).map((x) => {
            const ti = tiendaDe(x);
            const vs = hijos[x.id] || [];
            return (
              <li key={x.id} data-producto-tienda={x.id} className={`flex items-center gap-3 px-5 py-2.5 hover:bg-superficie-2 cursor-pointer ${ti.publicado ? "" : "opacity-70"}`} onClick={() => setEditando(x.id)}>
                <div className="w-12 h-12 rounded-md border border-borde bg-superficie-2 overflow-hidden shrink-0 flex items-center justify-center">
                  {x.imagen ? <img src={x.imagen} alt="" className="w-full h-full object-cover" /> : <ImagePlus size={16} className="text-texto-tenue" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{x.nombre}</div>
                  <div className="text-xs text-texto-tenue">{x.categoria || "Otros"} · <span className="f-m">{money(Number(ti.precio) || x.precio)}</span>{vs.length ? ` · ${vs.length} variantes` : ""}{ti.fotos && ti.fotos.length ? ` · ${ti.fotos.length + 1} fotos` : ""}</div>
                </div>
                {ti.destacado && <Star size={15} className="text-acento" fill="currentColor" />}
                <span onClick={(e) => e.stopPropagation()}><Interruptor prendido={!!ti.publicado} onCambiar={() => cambiar(x, { publicado: !ti.publicado })} etiqueta={`Publicar ${x.nombre}`} /></span>
              </li>
            );
          })}
          {!lista.length && <li className="px-5 py-8 text-sm text-texto-tenue text-center">No hay productos que coincidan.</li>}
        </ul>
        <div className="px-5 py-3 border-t border-borde text-xs text-texto-tenue">Tocá un producto para cargarle fotos, descripción y variantes.</div>
      </Card>
      {p && <EditorProducto p={p} hijos={hijos[p.id] || []} productos={productos} setProductos={setProductos} empresaId={empresaId} toast={toast} guardarTienda={guardarTienda} onCerrar={() => setEditando(null)} />}
    </div>
  );
}

function EditorProducto({ p, hijos, setProductos, empresaId, toast, guardarTienda, onCerrar }) {
  const ti = tiendaDe(p);
  const fotos = [p.imagen, ...(ti.fotos || [])].filter(Boolean);
  const archivo = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [descripcion, setDescripcion] = useState(p.descripcion || "");
  const [atributos, setAtributos] = useState([{ n: "Talle", v: "" }, { n: "Color", v: "" }]);
  const [generando, setGenerando] = useState(false);

  async function guardarFotos(nuevas) {
    const [principal, ...resto] = nuevas;
    const camposExtra = { ...(p.camposExtra || {}), tienda: { ...ti, fotos: resto } };
    await guardarProducto(p.id, { imagen: principal || null, camposExtra });
    setProductos((ps) => ps.map((x) => (x.id === p.id ? { ...x, imagen: principal || "", camposExtra } : x)));
  }
  async function subir(e) {
    const as = [...(e.target.files || [])].slice(0, 8 - fotos.length);
    e.target.value = "";
    if (!as.length) return;
    setSubiendo(true);
    const nuevas = [];
    for (const a of as) { try { nuevas.push((await subirFotoPublica(empresaId, a, "productos")).url); } catch (err) { toast(err.message, "mal"); } }
    if (nuevas.length) await guardarFotos([...fotos, ...nuevas]).catch((err) => toast(err.message, "mal"));
    setSubiendo(false);
  }
  const mover = (i, d) => { const j = i + d; if (j < 0 || j >= fotos.length) return; const n = [...fotos]; [n[i], n[j]] = [n[j], n[i]]; guardarFotos(n).catch((err) => toast(err.message, "mal")); };

  /* Las combinaciones de los atributos cargados ("S, M, L" × "Negro,
     Blanco"), sin las que ya existen. */
  const valores = atributos.map((a) => ({ n: a.n.trim(), vs: a.v.split(",").map((x) => x.trim()).filter(Boolean) })).filter((a) => a.n && a.vs.length);
  const combinaciones = valores.reduce((acc, a) => acc.flatMap((c) => a.vs.map((v) => ({ ...c, [a.n]: v }))), [{}]).filter((c) => Object.keys(c).length);
  const existe = (c) => hijos.some((h) => Object.entries(c).every(([k, v]) => (h.atributos || {})[k] === v) && Object.keys(h.atributos || {}).length === Object.keys(c).length);
  const nuevas = valores.length ? combinaciones.filter((c) => !existe(c)) : [];

  async function generar() {
    setGenerando(true);
    const creados = [];
    for (const c of nuevas.slice(0, 60)) {
      try {
        creados.push(await crearProducto(empresaId, {
          nombre: `${p.nombre} · ${Object.values(c).join(" · ")}`, categoria: p.categoria, marca: p.marca, unidad: p.unidad,
          precio: p.precio, costo: p.costo, iva: p.iva, ivaCondicion: p.ivaCondicion, padreId: p.id, atributos: c,
        }));
      } catch (err) { toast(err.message || "No se pudo crear una variante.", "mal"); break; }
    }
    if (creados.length) { setProductos((ps) => [...ps, ...creados]); toast(`Creaste ${creados.length} variantes. Cargales el stock desde Stock o la ficha.`); }
    setGenerando(false);
  }
  const cambiarHijo = async (h, cambios) => {
    try { const n = await guardarProducto(h.id, cambios); setProductos((ps) => ps.map((x) => (x.id === h.id ? { ...x, ...cambios, ...(n ? { precio: n.precio } : {}) } : x))); }
    catch (err) { toast(err.message || "No se pudo guardar.", "mal"); }
  };

  return (
    <Modal open onClose={onCerrar} ancho="max-w-3xl">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-borde">
        <div className="min-w-0"><div className={rotulo}>Producto en la tienda</div><div className="f-d text-lg truncate">{p.nombre}</div></div>
        <button type="button" aria-label="Cerrar" onClick={onCerrar} className="p-1.5 rounded-md hover:bg-superficie-2"><X size={18} /></button>
      </div>
      <div className="p-5 space-y-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-sm"><Interruptor prendido={!!ti.publicado} onCambiar={() => guardarTienda(p, { publicado: !ti.publicado })} etiqueta="Publicado" /> Publicado</label>
          <label className="flex items-center gap-2 text-sm"><Interruptor prendido={!!ti.destacado} onCambiar={() => guardarTienda(p, { destacado: !ti.destacado })} etiqueta="Destacado" /> Destacado</label>
          <label className="flex items-center gap-2 text-sm">Precio web
            <input defaultValue={ti.precio || ""} placeholder={String(p.precio)} onBlur={(e) => { const v = Number(plata(e.target.value)) || 0; if (v !== (Number(ti.precio) || 0)) guardarTienda(p, { precio: v || null }); }} className={`${inputCls} !mt-0 !w-28 f-m text-right`} />
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between"><span className="text-sm font-semibold">Fotos</span><span className="text-xs text-texto-tenue">La primera es la principal. Hasta 8.</span></div>
          <div className="mt-2 grid grid-cols-4 sm:grid-cols-6 gap-2">
            {fotos.map((f, i) => (
              <div key={f} className="relative group aspect-square rounded-md overflow-hidden border border-borde bg-superficie-2">
                <img src={f} alt="" className="w-full h-full object-cover" />
                {i === 0 && <span className="absolute top-1 left-1 text-[9px] font-bold uppercase bg-acento text-sobre-acento rounded px-1">Principal</span>}
                <div className="absolute inset-x-0 bottom-0 flex justify-between p-0.5 bg-black/50 opacity-0 group-hover:opacity-100">
                  <button type="button" aria-label="Antes" onClick={() => mover(i, -1)} className="p-0.5 text-white"><ChevronLeft size={13} /></button>
                  <button type="button" aria-label="Sacar" onClick={() => guardarFotos(fotos.filter((_, j) => j !== i)).catch((err) => toast(err.message, "mal"))} className="p-0.5 text-white"><Trash2 size={13} /></button>
                  <button type="button" aria-label="Después" onClick={() => mover(i, 1)} className="p-0.5 text-white"><ChevronRight size={13} /></button>
                </div>
              </div>
            ))}
            {fotos.length < 8 && (
              <button type="button" onClick={() => archivo.current && archivo.current.click()} disabled={subiendo || !empresaId}
                className="aspect-square rounded-md border border-dashed border-borde flex flex-col items-center justify-center text-[11px] text-texto-tenue hover:bg-superficie-2 disabled:opacity-50">
                <ImagePlus size={16} /> {subiendo ? "…" : "Agregar"}
              </button>
            )}
          </div>
          <input ref={archivo} type="file" accept="image/*" multiple className="hidden" onChange={subir} />
        </div>

        <label className="block">
          <span className="text-sm font-semibold">Descripción</span>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value.slice(0, 2000))} rows={4}
            onBlur={() => { if (descripcion !== (p.descripcion || "")) guardarProducto(p.id, { descripcion: descripcion || null }).then(() => setProductos((ps) => ps.map((x) => (x.id === p.id ? { ...x, descripcion } : x)))).catch((err) => toast(err.message, "mal")); }}
            placeholder="Materiales, medidas, cuidados, para qué sirve…" className={`${inputCls} resize-y`} />
        </label>

        <div>
          <div className="flex items-center gap-2"><Layers size={15} className="text-acento" /><span className="text-sm font-semibold">Variantes</span></div>
          <p className="text-xs text-texto-tenue mt-1">Talles, colores, sabores. Cada combinación es un producto con su stock, su código y su precio: se vende en la caja como cualquier otro.</p>
          {hijos.length > 0 && (
            <ul className="mt-3 rounded-lg border border-borde divide-y divide-borde">
              {hijos.map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-3 py-2 text-sm" data-variante-gestion={h.id}>
                  <span className="flex-1 min-w-0 truncate">{Object.entries(h.atributos || {}).map(([k, v]) => `${k}: ${v}`).join(" · ")}</span>
                  <span className={`text-xs ${h.stock > 0 ? "text-texto-suave" : "text-ojo"}`}>stock {h.stock || 0}</span>
                  <input defaultValue={h.precio} onBlur={(e) => { const v = Number(plata(e.target.value)) || 0; if (v && v !== h.precio) cambiarHijo(h, { precio: v }); }} className={`${inputCls} !mt-0 !w-24 f-m text-right`} aria-label="Precio de la variante" />
                  <button type="button" aria-label="Sacar la variante" onClick={() => cambiarHijo(h, { activo: false })} className="p-1 text-texto-tenue hover:text-mal"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 space-y-2">
            {atributos.map((a, i) => (
              <div key={i} className="flex gap-2">
                <input value={a.n} onChange={(e) => setAtributos(atributos.map((x, j) => (j === i ? { ...x, n: e.target.value } : x)))} placeholder="Atributo (Talle)" className={`${inputCls} !mt-0 !w-36`} />
                <input value={a.v} onChange={(e) => setAtributos(atributos.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} placeholder="Valores separados por coma (S, M, L)" className={`${inputCls} !mt-0 flex-1`} />
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              {atributos.length < 3 && <button type="button" onClick={() => setAtributos([...atributos, { n: "", v: "" }])} className="text-xs font-semibold text-acento hover:underline flex items-center gap-1"><Plus size={13} /> otro atributo</button>}
              <span className="flex-1" />
              <Boton size="sm" onClick={generar} disabled={generando || !nuevas.length}>{generando ? "Creando…" : nuevas.length ? `Crear ${nuevas.length} variantes` : "Crear variantes"}</Boton>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Envíos y pagos ---------- */

function EnviosYPagos({ ajustes, setAjustes }) {
  const t = ajustes.tienda || {};
  const set = (k, v) => setAjustes({ ...ajustes, tienda: { ...t, [k]: v } });
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><div className={rotulo}>La tienda</div><p className="text-sm text-texto-suave mt-1.5">Prendida, tu sitio muestra los productos y recibe pedidos. Los pedidos llegan a <b>Pedidos</b>.</p></div>
          <div className="flex items-center gap-2.5"><span className="text-xs text-texto-suave">{t.activa ? "Recibiendo pedidos" : "Apagada"}</span><Interruptor prendido={!!t.activa} onCambiar={() => set("activa", !t.activa)} etiqueta="Recibir pedidos por la tienda" /></div>
        </div>
      </Card>
      <Bloque titulo="Cómo se entrega">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex items-start gap-3 rounded-lg border border-borde p-3.5 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={t.retiro !== false} onChange={(e) => set("retiro", e.target.checked)} />
            <span><span className="text-sm font-semibold flex items-center gap-1.5"><Store size={14} /> Retiro en el local</span><span className="block text-xs text-texto-tenue mt-0.5">Lo preparan y lo pasan a buscar.</span></span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-borde p-3.5 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={!!t.envio} onChange={(e) => set("envio", e.target.checked)} />
            <span><span className="text-sm font-semibold flex items-center gap-1.5"><Truck size={14} /> Envío a domicilio</span><span className="block text-xs text-texto-tenue mt-0.5">El costo se suma al cobrar.</span></span>
          </label>
        </div>
        {t.envio && (
          <div className="mt-4 grid sm:grid-cols-3 gap-4">
            <label className="block"><span className="text-xs font-semibold text-texto-suave">Costo del envío</span><input value={plata(t.costoEnvio)} onChange={(e) => set("costoEnvio", Number(plata(e.target.value)) || 0)} placeholder="0" className={`${inputCls} f-m text-right`} /></label>
            <label className="block"><span className="text-xs font-semibold text-texto-suave">Gratis desde</span><input value={plata(t.envioGratisDesde)} onChange={(e) => set("envioGratisDesde", Number(plata(e.target.value)) || 0)} placeholder="Nunca" className={`${inputCls} f-m text-right`} /></label>
            <label className="block"><span className="text-xs font-semibold text-texto-suave">Hasta dónde</span><input value={t.zona || ""} onChange={(e) => set("zona", e.target.value.slice(0, 120))} placeholder="Hasta 15 cuadras" className={inputCls} /></label>
          </div>
        )}
      </Bloque>
      <Bloque titulo="Cómo se paga" d="Por ahora se paga al retirar o al recibir. El pago online con Mercado Pago viene en la próxima etapa.">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex items-start gap-3 rounded-lg border border-borde p-3.5 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={t.efectivo !== false} onChange={(e) => set("efectivo", e.target.checked)} />
            <span><span className="text-sm font-semibold flex items-center gap-1.5"><Banknote size={14} /> Efectivo</span><span className="block text-xs text-texto-tenue mt-0.5">Al retirar o al recibir.</span></span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-borde p-3.5 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={!!t.transferencia} onChange={(e) => set("transferencia", e.target.checked)} />
            <span><span className="text-sm font-semibold flex items-center gap-1.5"><Landmark size={14} /> Transferencia</span><span className="block text-xs text-texto-tenue mt-0.5">Al confirmar, el cliente ve tu alias.</span></span>
          </label>
        </div>
        {t.transferencia && (
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <label className="block"><span className="text-xs font-semibold text-texto-suave">Alias o CBU</span><input value={t.alias || ""} onChange={(e) => set("alias", e.target.value.slice(0, 60))} placeholder="tunegocio.mp" className={inputCls} /></label>
            <label className="block"><span className="text-xs font-semibold text-texto-suave">A nombre de</span><input value={t.titular || ""} onChange={(e) => set("titular", e.target.value.slice(0, 80))} placeholder="Nombre del titular" className={inputCls} /></label>
          </div>
        )}
        <div className="mt-4 grid sm:grid-cols-2 gap-4 items-end">
          <label className="block"><span className="text-xs font-semibold text-texto-suave">Compra mínima</span><input value={plata(t.minimo)} onChange={(e) => set("minimo", Number(plata(e.target.value)) || 0)} placeholder="Sin mínimo" className={`${inputCls} f-m text-right`} /></label>
          <label className="flex items-center gap-2 text-sm pb-2"><input type="checkbox" checked={!!t.mostrarStock} onChange={(e) => set("mostrarStock", e.target.checked)} /> Mostrar cuántos quedan</label>
        </div>
      </Bloque>
    </div>
  );
}

/* ---------- La sección ---------- */

const PESTANAS = [
  { k: "diseno", n: "Diseño", i: Palette },
  { k: "productos", n: "Productos", i: Package, tienda: true },
  { k: "entrega", n: "Envíos y pagos", i: Truck, tienda: true },
  { k: "info", n: "Información", i: Info },
];

export function TiendaOnline({ ajustes, setAjustes, productos, setProductos, slug, empresaId, toast, onIr, conTienda, subdominio = null }) {
  const [pestana, setPestana] = useState("diseno");
  const pes = PESTANAS.find((x) => x.k === pestana);
  return (
    <div className="grid grid-cols-1 2xl:grid-cols-[1fr_420px] gap-6 items-start">
      <div className="min-w-0 space-y-5">
        <div className="flex gap-1.5 flex-wrap" role="tablist">
          {PESTANAS.map((x) => (
            <button key={x.k} type="button" role="tab" aria-selected={pestana === x.k} data-pestana-tienda={x.k} onClick={() => setPestana(x.k)}
              className={`flex items-center gap-1.5 text-sm font-semibold rounded-md border px-3.5 py-2 ${pestana === x.k ? "border-acento bg-acento-suave text-texto" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>
              <x.i size={15} /> {x.n}
            </button>
          ))}
        </div>
        {pes.tienda && !conTienda ? (
          <Card className="p-6">
            <div className="f-d text-lg">La tienda no está activada</div>
            <p className="text-sm text-texto-suave mt-2 leading-relaxed">Tu sitio ya muestra la información de tu local. Para vender productos por internet —con carrito, variantes y pedidos— hay que sumar el módulo Tienda online. Escribinos y te lo activamos.</p>
          </Card>
        ) : pestana === "diseno" ? <Diseno ajustes={ajustes} setAjustes={setAjustes} empresaId={empresaId} toast={toast} slug={slug} subdominio={subdominio} />
          : pestana === "productos" ? <Productos productos={productos} setProductos={setProductos} empresaId={empresaId} toast={toast} />
          : pestana === "entrega" ? <EnviosYPagos ajustes={ajustes} setAjustes={setAjustes} />
          : <PresenciaOnline ajustes={ajustes} setAjustes={setAjustes} slug={slug} empresaId={empresaId} toast={toast} onIr={onIr} sinVista />}
      </div>
      <div className="2xl:sticky 2xl:top-4 min-w-0">
        <VistaPrevia ajustes={ajustes} productos={productos} conTienda={conTienda} slug={slug} />
      </div>
    </div>
  );
}
