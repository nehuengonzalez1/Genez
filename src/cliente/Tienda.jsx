/* ============================================================
   LA TIENDA, DEL LADO DE QUIEN COMPRA (0141)
   ============================================================

   La grilla de lo publicado, un carrito y el pedido. Sin cuenta: nombre
   y celular alcanzan, que es lo que el comercio necesita para
   prepararlo y avisar. Se paga al retirar o al recibir.

   El carrito se guarda en el teléfono (por comercio): si la persona se
   va a WhatsApp a preguntar algo y vuelve, sigue ahí. Al mandar el
   pedido se vacía.

   El precio que se ve es el que devolvió la base, y el que se cobra
   también lo pone la base al recibir el pedido: si cambió en el medio,
   manda el de la base. Lo agotado no se puede agregar, y si se agotó
   mientras estaba en el carrito, la base lo rechaza con su nombre.

   Lo dibuja PaginaComercio, en la página y en la vista previa de la
   gestión; en la vista previa (`onPedir` vacío) los botones no hacen
   nada.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { Search, Plus, Minus, ShoppingBag, X, Store, Truck, Check, MessageCircle, ImageOff } from "lucide-react";

const ROTULO = "text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold";
const plata = (n) => `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;
const sinAcentos = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const esPeso = (u) => u === "kg";
const paso = (u) => (esPeso(u) ? 0.25 : 1);
const cantidadLinda = (c, u) => (esPeso(u) ? `${String(c).replace(".", ",")} kg` : `${c}`);

function guardado(slug) {
  try { return JSON.parse(localStorage.getItem(`genez:carrito:${slug}`) || "{}") || {}; } catch { return {}; }
}

export function Tienda({ slug, tienda, columnas = 2, onPedir = null, whatsapp = null, nombre = "" }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [carrito, setCarrito] = useState(() => (onPedir ? guardado(slug) : {}));
  const [abierto, setAbierto] = useState(false);
  const items = (tienda && tienda.items) || [];
  const config = (tienda && tienda.config) || {};

  useEffect(() => {
    if (!onPedir) return;
    try { localStorage.setItem(`genez:carrito:${slug}`, JSON.stringify(carrito)); } catch { /* sin lugar: el carrito vive en memoria */ }
  }, [carrito, slug, onPedir]);

  const categorias = useMemo(() => [...new Set(items.map((i) => i.categoria))], [items]);
  const lista = items.filter((i) => (!cat || i.categoria === cat) && (!q.trim() || sinAcentos(i.nombre).includes(sinAcentos(q.trim()))));
  const lineas = Object.entries(carrito).map(([id, c]) => ({ item: items.find((i) => i.id === id), cantidad: c })).filter((l) => l.item && l.cantidad > 0);
  const subtotal = lineas.reduce((s, l) => s + Math.round(l.item.precio * l.cantidad), 0);
  const unidades = lineas.reduce((s, l) => s + (esPeso(l.item.unidad) ? 1 : l.cantidad), 0);

  const sumar = (i, d) => {
    if (!onPedir || i.agotado) return;
    setCarrito((c) => {
      const v = Math.max(0, Math.min(50, +((c[i.id] || 0) + d * paso(i.unidad)).toFixed(2)));
      const n = { ...c };
      if (v > 0) n[i.id] = v; else delete n[i.id];
      return n;
    });
  };

  if (!items.length) return null;

  return (
    <section data-tienda>
      <h2 className={`${ROTULO} flex items-center gap-1.5 mb-3`}><ShoppingBag size={13} /> Tienda</h2>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar"
            className="w-full rounded-xl border border-borde bg-superficie pl-9 pr-3 py-2.5 text-sm outline-none focus:border-acento" />
        </div>
      </div>
      {categorias.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto mt-3 pb-1 -mx-1 px-1">
          {["", ...categorias].map((c) => (
            <button key={c || "todo"} type="button" onClick={() => setCat(c)}
              className={`shrink-0 text-xs font-semibold rounded-full border px-3 py-1.5 ${cat === c ? "border-acento bg-acento-suave text-texto" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>
              {c || "Todo"}
            </button>
          ))}
        </div>
      )}

      <div className={`grid gap-3 mt-4 ${columnas === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {lista.map((i) => {
          const en = carrito[i.id] || 0;
          return (
            <article key={i.id} data-producto={i.id} className={`rounded-xl border border-borde bg-superficie overflow-hidden flex flex-col ${i.agotado ? "opacity-60" : ""}`}>
              <div className="aspect-square bg-superficie-2 relative">
                {i.imagen
                  ? <img src={i.imagen} alt="" loading="lazy" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-texto-tenue"><ImageOff size={22} /></div>}
                {i.destacado && !i.agotado && <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider bg-acento text-sobre-acento rounded px-1.5 py-0.5">Destacado</span>}
                {i.agotado && <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider bg-fondo/80 text-texto rounded px-1.5 py-0.5">Agotado</span>}
              </div>
              <div className="p-3 flex-1 flex flex-col">
                <div className="text-sm font-medium leading-snug line-clamp-2">{i.nombre}</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="f-m font-semibold">{plata(i.precio)}</span>
                  {esPeso(i.unidad) && <span className="text-xs text-texto-tenue">el kg</span>}
                </div>
                {i.stock != null && !i.agotado && <div className="text-[11px] text-texto-tenue mt-0.5">Quedan {cantidadLinda(i.stock, i.unidad)}</div>}
                <div className="mt-auto pt-3">
                  {en > 0 ? (
                    <div className="flex items-center justify-between rounded-lg border border-acento">
                      <button type="button" aria-label="Uno menos" onClick={() => sumar(i, -1)} className="p-2 text-acento"><Minus size={15} /></button>
                      <span className="f-m text-sm font-semibold">{cantidadLinda(en, i.unidad)}</span>
                      <button type="button" aria-label="Uno más" onClick={() => sumar(i, 1)} className="p-2 text-acento"><Plus size={15} /></button>
                    </div>
                  ) : (
                    <button type="button" disabled={i.agotado} onClick={() => sumar(i, 1)} data-agregar={i.id}
                      className="w-full rounded-lg bg-acento text-sobre-acento text-sm font-semibold py-2 disabled:bg-superficie-3 disabled:text-texto-tenue">
                      {i.agotado ? "Agotado" : "Agregar"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!lista.length && <p className="text-sm text-texto-tenue mt-4">No hay productos que coincidan.</p>}

      {/* La barra del carrito: aparece cuando hay algo. */}
      {lineas.length > 0 && !abierto && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4 pointer-events-none">
          <button type="button" onClick={() => setAbierto(true)} data-ver-carrito
            className="pointer-events-auto mx-auto w-full max-w-lg flex items-center justify-between rounded-2xl bg-acento text-sobre-acento px-5 py-3.5 shadow-lg">
            <span className="flex items-center gap-2 text-sm font-bold"><ShoppingBag size={17} /> Ver carrito · {unidades}</span>
            <span className="f-m font-bold">{plata(subtotal)}</span>
          </button>
        </div>
      )}

      {abierto && (
        <Carrito slug={slug} config={config} lineas={lineas} subtotal={subtotal} sumar={sumar} onPedir={onPedir}
          whatsapp={whatsapp} nombre={nombre} onCerrar={() => setAbierto(false)} onListo={() => setCarrito({})} />
      )}
    </section>
  );
}

function Carrito({ config, lineas, subtotal, sumar, onPedir, whatsapp, nombre, onCerrar, onListo }) {
  const opciones = [config.retiro !== false && "retiro", config.envio && "envio"].filter(Boolean);
  const [entrega, setEntrega] = useState(opciones[0] || "retiro");
  const [datos, setDatos] = useState(() => {
    try { return JSON.parse(localStorage.getItem("genez:comprador") || "{}") || {}; } catch { return {}; }
  });
  const [mandando, setMandando] = useState(false);
  const [error, setError] = useState(null);
  const [hecho, setHecho] = useState(null);
  const set = (k, v) => setDatos((d) => ({ ...d, [k]: v }));

  const gratis = config.envioGratisDesde && subtotal >= config.envioGratisDesde;
  const envio = entrega === "envio" && !gratis ? Number(config.costoEnvio) || 0 : 0;
  const total = subtotal + envio;
  const falta = config.minimo && subtotal < config.minimo ? config.minimo - subtotal : 0;

  async function mandar(e) {
    e.preventDefault();
    if (!onPedir || mandando) return;
    setError(null);
    setMandando(true);
    try {
      const r = await onPedir({
        nombre: datos.nombre || "", telefono: datos.telefono || "", entrega,
        direccion: entrega === "envio" ? datos.direccion || "" : null, nota: datos.nota || null,
        lineas: lineas.map((l) => ({ item_id: l.item.id, cantidad: l.cantidad })),
      });
      /* Nombre, celular y dirección quedan en el teléfono para la próxima. */
      try { localStorage.setItem("genez:comprador", JSON.stringify({ nombre: datos.nombre, telefono: datos.telefono, direccion: datos.direccion })); } catch { /* nada */ }
      setHecho({ ...r, lineas, entrega });
      onListo();
    } catch (err) {
      setError(err.message);
    }
    setMandando(false);
  }

  const campo = "w-full rounded-xl border border-borde bg-superficie px-3.5 py-2.5 text-sm outline-none focus:border-acento";
  const aviso = hecho && whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola ${nombre}, te mandé el pedido #${hecho.numero} por la tienda.`)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onCerrar} />
      <div className="relative w-full max-w-md h-full bg-fondo text-texto flex flex-col shadow-xl" role="dialog" aria-label="Carrito">
        <div className="flex items-center justify-between px-5 py-4 border-b border-borde">
          <div className="f-d text-lg">{hecho ? "Pedido enviado" : "Tu pedido"}</div>
          <button type="button" aria-label="Cerrar" onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-superficie-2"><X size={20} /></button>
        </div>

        {hecho ? (
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="w-12 h-12 rounded-full bg-bien-suave text-bien flex items-center justify-center"><Check size={24} /></div>
            <p className="f-d text-2xl mt-4">Pedido #{hecho.numero}</p>
            <p className="text-sm text-texto-suave mt-2 leading-relaxed">
              {nombre} lo recibió y te va a escribir para confirmarlo.
              {hecho.entrega === "envio" ? " Se paga cuando llega." : " Se paga al retirarlo."}
            </p>
            <div className="mt-5 rounded-xl border border-borde p-4 text-sm space-y-1.5">
              {hecho.lineas.map((l) => <div key={l.item.id} className="flex justify-between gap-3"><span className="truncate">{cantidadLinda(l.cantidad, l.item.unidad)} × {l.item.nombre}</span></div>)}
              <div className="flex justify-between font-semibold pt-2 border-t border-borde"><span>Total</span><span className="f-m">{plata(hecho.total)}</span></div>
            </div>
            {aviso && (
              <a href={aviso} target="_blank" rel="noopener noreferrer" className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-borde px-4 py-3 text-sm font-semibold hover:bg-superficie-2">
                <MessageCircle size={16} /> Avisarle por WhatsApp
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={mandar} className="flex-1 overflow-y-auto">
            <ul className="divide-y divide-borde px-5">
              {lineas.map((l) => (
                <li key={l.item.id} className="py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{l.item.nombre}</div>
                    <div className="text-xs text-texto-tenue f-m">{plata(l.item.precio)}{esPeso(l.item.unidad) ? " el kg" : ""}</div>
                  </div>
                  <div className="flex items-center rounded-lg border border-borde">
                    <button type="button" aria-label="Uno menos" onClick={() => sumar(l.item, -1)} className="p-1.5"><Minus size={14} /></button>
                    <span className="f-m text-sm w-12 text-center">{cantidadLinda(l.cantidad, l.item.unidad)}</span>
                    <button type="button" aria-label="Uno más" onClick={() => sumar(l.item, 1)} className="p-1.5"><Plus size={14} /></button>
                  </div>
                  <div className="f-m text-sm w-20 text-right">{plata(l.item.precio * l.cantidad)}</div>
                </li>
              ))}
            </ul>

            <div className="px-5 py-4 space-y-3 border-t border-borde">
              {opciones.length > 1 && (
                <div className="grid grid-cols-2 gap-2">
                  {opciones.map((o) => (
                    <button key={o} type="button" onClick={() => setEntrega(o)}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold ${entrega === o ? "border-acento bg-acento-suave" : "border-borde"}`}>
                      {o === "envio" ? <><Truck size={15} /> Envío</> : <><Store size={15} /> Retiro</>}
                    </button>
                  ))}
                </div>
              )}
              {entrega === "envio" && config.zona && <p className="text-xs text-texto-tenue">Envíos: {config.zona}.</p>}
              <input required value={datos.nombre || ""} onChange={(e) => set("nombre", e.target.value)} placeholder="Tu nombre" autoComplete="name" className={campo} />
              <input required value={datos.telefono || ""} onChange={(e) => set("telefono", e.target.value)} placeholder="Tu celular, con código de área" inputMode="tel" autoComplete="tel" className={campo} />
              {entrega === "envio" && <input required value={datos.direccion || ""} onChange={(e) => set("direccion", e.target.value)} placeholder="Dirección para el envío" autoComplete="street-address" className={campo} />}
              <textarea value={datos.nota || ""} onChange={(e) => set("nota", e.target.value)} placeholder="¿Algo que tengan que saber? (opcional)" rows={2} className={`${campo} resize-none`} />
            </div>

            <div className="px-5 py-4 border-t border-borde space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-texto-suave">Productos</span><span className="f-m">{plata(subtotal)}</span></div>
              {entrega === "envio" && <div className="flex justify-between"><span className="text-texto-suave">Envío</span><span className="f-m">{gratis ? "Gratis" : plata(envio)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-1"><span>Total</span><span className="f-m">{plata(total)}</span></div>
              <p className="text-xs text-texto-tenue">{entrega === "envio" ? "Se paga cuando llega." : "Se paga al retirar."}</p>
            </div>

            <div className="px-5 pb-6">
              {falta > 0 && <p className="text-sm text-ojo mb-3">La compra mínima es de {plata(config.minimo)}: te faltan {plata(falta)}.</p>}
              {error && <p className="text-sm text-mal mb-3" role="alert">{error}</p>}
              <button type="submit" disabled={mandando || falta > 0 || !onPedir}
                className="w-full rounded-xl bg-acento text-sobre-acento font-bold py-3.5 disabled:opacity-50">
                {mandando ? "Mandando…" : `Mandar pedido · ${plata(total)}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
