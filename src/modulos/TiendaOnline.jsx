/* ============================================================
   TIENDA ONLINE · lo que se vende por internet (0141)
   ============================================================

   Tres cosas, en el orden en que se arman:
     1. prenderla, y dónde está (es la misma página del comercio);
     2. cómo se entrega: retiro, envío y su costo, compra mínima;
     3. qué se vende: los productos de Productos, publicados acá, con su
        foto y, si se quiere, un precio para la web.

   No hay un catálogo aparte. Publicar es una marca en el producto
   (`campos_extra.tienda`), así el precio y el stock son los de la caja.
   La foto es la del producto (`items.imagen`), la misma que usa la
   carta del salón, y va al bucket público como las de la galería.

   Los pedidos no se ven acá: entran a Pedidos, junto a los que se arman
   con la pistola, porque ahí se preparan y se cobran.
   ============================================================ */

import React, { useMemo, useRef, useState } from "react";
import { ExternalLink, Search, Star, ImagePlus, ShoppingBag, Store, Truck, Eye } from "lucide-react";
import { Card, Boton } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { money } from "../utils/helpers.js";
import { guardarProducto } from "../datos/items.js";
import { subirFotoPublica } from "../datos/presencia.js";

const rotulo = "text-[11px] uppercase tracking-[0.1em] font-bold text-texto-tenue";
const sinAcentos = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function Interruptor({ prendido, onCambiar, etiqueta }) {
  return (
    <button type="button" role="switch" aria-checked={prendido} aria-label={etiqueta} onClick={onCambiar}
      className={`relative w-10 h-6 rounded-full border transition-colors shrink-0 ${prendido ? "bg-acento border-acento" : "bg-superficie-3 border-borde"}`}>
      <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-superficie shadow-sm transition-all ${prendido ? "left-[19px]" : "left-0.5"}`} />
    </button>
  );
}

const plata = (v) => (v === "" || v == null ? "" : String(v).replace(/\D/g, ""));

export function TiendaOnline({ ajustes, setAjustes, productos, setProductos, slug, empresaId, toast, onIr }) {
  const t = ajustes.tienda || {};
  const set = (k, v) => setAjustes({ ...ajustes, tienda: { ...t, [k]: v } });
  const url = slug ? `https://${slug}.genez.com.ar` : null;

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [soloPublicados, setSoloPublicados] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [subiendo, setSubiendo] = useState(null);
  const archivo = useRef(null);
  const paraFoto = useRef(null);

  const vendibles = useMemo(() => productos.filter((p) => p.activo !== false && p.precio > 0), [productos]);
  const tiendaDe = (p) => (p.camposExtra && p.camposExtra.tienda) || {};
  const publicados = vendibles.filter((p) => tiendaDe(p).publicado);
  const categorias = useMemo(() => [...new Set(vendibles.map((p) => p.categoria || "Otros"))].sort(), [vendibles]);
  const lista = vendibles.filter((p) =>
    (!cat || (p.categoria || "Otros") === cat)
    && (!soloPublicados || tiendaDe(p).publicado)
    && (!q.trim() || sinAcentos(p.nombre).includes(sinAcentos(q.trim())) || String(p.barcode || "").includes(q.trim())));

  /* Guarda lo de la tienda de un producto y lo refleja en pantalla. Solo
     se toca `camposExtra.tienda` (y la foto): lo demás del producto queda
     como estaba. */
  async function guardarTienda(p, cambios) {
    const camposExtra = { ...(p.camposExtra || {}), tienda: { ...tiendaDe(p), ...cambios } };
    await guardarProducto(p.id, { camposExtra });
    setProductos((ps) => ps.map((x) => (x.id === p.id ? { ...x, camposExtra } : x)));
  }
  const cambiar = (p, cambios) => guardarTienda(p, cambios).catch((e) => toast(e.message || "No se pudo guardar.", "mal"));

  async function publicarLista(publicar) {
    const afectados = lista.filter((p) => !!tiendaDe(p).publicado !== publicar);
    if (!afectados.length) return;
    setOcupado(true);
    let mal = 0;
    for (const p of afectados) {
      try { await guardarTienda(p, { publicado: publicar }); } catch { mal++; }
    }
    setOcupado(false);
    toast(mal ? `Quedaron ${mal} sin guardar. Probá de nuevo.` : publicar ? `Publicaste ${afectados.length}.` : `Sacaste ${afectados.length} de la tienda.`, mal ? "mal" : "ok");
  }

  async function subirFoto(e) {
    const a = e.target.files && e.target.files[0];
    const p = paraFoto.current;
    e.target.value = "";
    if (!a || !p) return;
    setSubiendo(p.id);
    try {
      const { url: foto } = await subirFotoPublica(empresaId, a, "productos");
      await guardarProducto(p.id, { imagen: foto });
      setProductos((ps) => ps.map((x) => (x.id === p.id ? { ...x, imagen: foto } : x)));
    } catch (err) {
      toast(err.message || "No se pudo subir la foto.", "mal");
    }
    setSubiendo(null);
  }
  const elegirFoto = (p) => { paraFoto.current = p; archivo.current && archivo.current.click(); };

  return (
    <div className="space-y-5">
      {/* 1 · PRENDERLA */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className={rotulo}>Tu tienda</div>
            <p className="text-sm text-texto-suave mt-1.5 max-w-xl leading-relaxed">
              Está en tu página, debajo de tu información: quien entra ve lo que publicaste, arma el carrito y te manda el pedido.
              Los pedidos llegan a <b>Pedidos</b>, donde los preparás y los cobrás como siempre. Se paga al retirar o al recibir.
            </p>
            {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-acento hover:underline mt-3"><ExternalLink size={14} /> {url.replace("https://", "")}</a>}
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-texto-suave">{t.activa ? "Recibiendo pedidos" : "Apagada"}</span>
            <Interruptor prendido={!!t.activa} onCambiar={() => set("activa", !t.activa)} etiqueta="Recibir pedidos por la tienda" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[["Publicados", publicados.length], ["Con foto", publicados.filter((p) => p.imagen).length], ["Destacados", publicados.filter((p) => tiendaDe(p).destacado).length]].map(([n, v]) => (
            <div key={n} className="rounded-lg border border-borde px-3 py-2.5">
              <div className="text-[11px] text-texto-tenue">{n}</div>
              <div className="f-m text-lg font-semibold">{v}</div>
            </div>
          ))}
        </div>
        {t.activa && !publicados.length && <p className="text-xs text-ojo mt-3">La tienda está prendida pero no publicaste ningún producto: abajo elegís cuáles.</p>}
      </Card>

      {/* 2 · CÓMO SE ENTREGA */}
      <Card className="p-5">
        <div className={rotulo}>Cómo se entrega</div>
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          <label className="flex items-start gap-3 rounded-lg border border-borde p-3.5 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={t.retiro !== false} onChange={(e) => set("retiro", e.target.checked)} />
            <span><span className="text-sm font-semibold flex items-center gap-1.5"><Store size={14} /> Retiro en el local</span><span className="block text-xs text-texto-tenue mt-0.5">Lo preparan y lo pasan a buscar.</span></span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-borde p-3.5 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={!!t.envio} onChange={(e) => set("envio", e.target.checked)} />
            <span><span className="text-sm font-semibold flex items-center gap-1.5"><Truck size={14} /> Envío a domicilio</span><span className="block text-xs text-texto-tenue mt-0.5">Lo llevás vos; el costo se suma al cobrar.</span></span>
          </label>
        </div>
        {t.envio && (
          <div className="mt-4 grid sm:grid-cols-3 gap-4">
            <label className="block"><span className="text-xs font-semibold text-texto-suave">Costo del envío</span>
              <input value={plata(t.costoEnvio)} onChange={(e) => set("costoEnvio", Number(plata(e.target.value)) || 0)} placeholder="0" className={`${inputCls} f-m text-right`} /></label>
            <label className="block"><span className="text-xs font-semibold text-texto-suave">Gratis desde</span>
              <input value={plata(t.envioGratisDesde)} onChange={(e) => set("envioGratisDesde", Number(plata(e.target.value)) || 0)} placeholder="Nunca" className={`${inputCls} f-m text-right`} /></label>
            <label className="block"><span className="text-xs font-semibold text-texto-suave">Hasta dónde</span>
              <input value={t.zona || ""} onChange={(e) => set("zona", e.target.value.slice(0, 120))} placeholder="Hasta 15 cuadras" className={inputCls} /></label>
          </div>
        )}
        <div className="mt-4 grid sm:grid-cols-2 gap-4 items-end">
          <label className="block"><span className="text-xs font-semibold text-texto-suave">Compra mínima</span>
            <input value={plata(t.minimo)} onChange={(e) => set("minimo", Number(plata(e.target.value)) || 0)} placeholder="Sin mínimo" className={`${inputCls} f-m text-right`} /></label>
          <label className="flex items-center gap-2 text-sm pb-2">
            <input type="checkbox" checked={!!t.mostrarStock} onChange={(e) => set("mostrarStock", e.target.checked)} /> Mostrar cuántos quedan
          </label>
        </div>
        <p className="text-xs text-texto-tenue mt-3">Lo agotado se muestra como agotado y no se puede pedir, se muestre o no el stock.</p>
      </Card>

      {/* 3 · QUÉ SE VENDE */}
      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b border-borde">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className={rotulo}>Qué vendés</div>
            {onIr && <button type="button" onClick={() => onIr("presencia")} className="text-xs text-texto-tenue hover:text-texto underline">Ver cómo queda la página</button>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
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
            <span className="text-xs text-texto-tenue">{lista.length} {lista.length === 1 ? "producto" : "productos"}</span>
            <Boton size="sm" variant="ghost" disabled={ocupado || !lista.length} onClick={() => publicarLista(true)}><ShoppingBag size={14} /> Publicar estos {lista.length}</Boton>
            <Boton size="sm" variant="quiet" disabled={ocupado || !lista.length} onClick={() => publicarLista(false)}>Sacarlos</Boton>
            {ocupado && <span className="text-xs text-texto-tenue">Guardando…</span>}
          </div>
        </div>
        <input ref={archivo} type="file" accept="image/*" className="hidden" onChange={subirFoto} />
        <ul className="divide-y divide-borde max-h-[560px] overflow-y-auto">
          {lista.slice(0, 200).map((p) => {
            const ti = tiendaDe(p);
            return (
              <li key={p.id} data-producto-tienda={p.id} className={`flex items-center gap-3 px-5 py-2.5 ${ti.publicado ? "" : "opacity-70"}`}>
                <button type="button" onClick={() => elegirFoto(p)} aria-label={`Foto de ${p.nombre}`}
                  className="w-12 h-12 rounded-md border border-borde bg-superficie-2 overflow-hidden shrink-0 flex items-center justify-center hover:border-acento">
                  {subiendo === p.id ? <span className="text-[10px] text-texto-tenue">…</span>
                    : p.imagen ? <img src={p.imagen} alt="" className="w-full h-full object-cover" /> : <ImagePlus size={16} className="text-texto-tenue" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.nombre}</div>
                  <div className="text-xs text-texto-tenue">{p.categoria || "Otros"} · caja <span className="f-m">{money(p.precio)}</span></div>
                </div>
                <label className="hidden sm:flex items-center gap-1.5 text-xs text-texto-tenue" title="Precio en la tienda. Vacío: el de la caja.">
                  web
                  <input defaultValue={ti.precio || ""} placeholder={String(p.precio)}
                    onBlur={(e) => { const v = Number(plata(e.target.value)) || 0; if (v !== (ti.precio || 0)) cambiar(p, { precio: v || null }); }}
                    className={`${inputCls} !mt-0 !w-24 f-m text-right`} />
                </label>
                <button type="button" aria-label={ti.destacado ? "Sacar de destacados" : "Destacar"} onClick={() => cambiar(p, { destacado: !ti.destacado })}
                  className={`p-1.5 rounded-md ${ti.destacado ? "text-acento" : "text-texto-tenue hover:text-texto"}`}>
                  <Star size={16} fill={ti.destacado ? "currentColor" : "none"} />
                </button>
                <Interruptor prendido={!!ti.publicado} onCambiar={() => cambiar(p, { publicado: !ti.publicado })} etiqueta={`Publicar ${p.nombre}`} />
              </li>
            );
          })}
          {lista.length > 200 && <li className="px-5 py-3 text-xs text-texto-tenue">Se muestran 200. Buscá o filtrá por categoría para ver el resto.</li>}
          {!lista.length && <li className="px-5 py-8 text-sm text-texto-tenue text-center">No hay productos con precio que coincidan.</li>}
        </ul>
        <div className="px-5 py-3 border-t border-borde text-xs text-texto-tenue flex items-center gap-1.5"><Eye size={13} /> Los destacados salen primero. Tocá la foto de un producto para subirle una.</div>
      </Card>
    </div>
  );
}
