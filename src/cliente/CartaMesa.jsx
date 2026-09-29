/* ============================================================
   LA CARTA DE LA MESA (0104)
   ============================================================

   Lo que ve quien escanea el QR de una mesa: la carta, y un pedido que
   arma y manda. Sin cuenta, sin descargar nada. Se entra con
   /cliente?mesa=<código> (src/cliente/main.jsx).

   Lo que manda no va a la cocina solo: entra en la comanda como
   borrador y el mozo lo confirma. Por eso la pantalla dice "el mozo lo
   confirma" y no "tu pedido está en preparación": prometer lo segundo
   sería mentir cada vez que el mozo tarda o lo anula.

   El precio que se ve es el de la base, y el que se cobra también: el
   pedido viaja sin precios.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { cargarCartaDeMesa, pedirDesdeLaMesa } from "../datos/cartaQr.js";
import { Boton, Cargando } from "./ui.jsx";

const plata = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-AR");

export function CartaMesa({ token }) {
  const [carta, setCarta] = useState(undefined);   // undefined = cargando, null = QR que no sirve
  const [error, setError] = useState(null);
  const [pedido, setPedido] = useState({});         // itemId → { cantidad, notas }
  const [revisando, setRevisando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [mandando, setMandando] = useState(false);
  const [listo, setListo] = useState(false);

  const leer = () => {
    setError(null);
    cargarCartaDeMesa(token).then(setCarta).catch(() => setError("No pudimos cargar la carta. Revisá la conexión."));
  };
  useEffect(leer, [token]);
  /* La pestaña decía "Tus turnos", el título de la app de turnos, que
     es la misma página (cliente.html). */
  useEffect(() => { if (carta) document.title = `${carta.comercio} · Carta`; }, [carta]);

  const porId = useMemo(() => new Map((carta ? carta.secciones : []).flatMap((s) => s.items).map((i) => [i.id, i])), [carta]);
  const lineas = Object.entries(pedido).filter(([, v]) => v.cantidad > 0).map(([id, v]) => ({ itemId: id, ...v, item: porId.get(id) })).filter((l) => l.item);
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const total = lineas.reduce((s, l) => s + l.item.precio * l.cantidad, 0);

  const cambiar = (id, delta) => setPedido((p) => {
    const actual = p[id] || { cantidad: 0, notas: "" };
    const cantidad = Math.max(0, Math.min(20, actual.cantidad + delta));
    return { ...p, [id]: { ...actual, cantidad } };
  });

  const mandar = async () => {
    setMandando(true); setError(null);
    try {
      await pedirDesdeLaMesa(token, lineas.map((l) => ({ itemId: l.itemId, cantidad: l.cantidad, notas: l.notas })), nombre.trim());
      setPedido({}); setRevisando(false); setListo(true);
    } catch (e) {
      setError(e.message || "No se pudo mandar el pedido. Probá de nuevo o llamá al mozo.");
    } finally {
      setMandando(false);
    }
  };

  if (carta === undefined && !error) return <Cargando>Cargando la carta…</Cargando>;
  if (error && carta === undefined) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <p className="text-texto-suave">{error}</p>
        <Boton className="mt-4" onClick={leer}>Reintentar</Boton>
      </div>
    );
  }
  if (carta === null) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <h1 className="f-d text-2xl">Este QR ya no sirve</h1>
        <p className="text-texto-suave mt-2">Pedile al mozo: te toma el pedido él.</p>
      </div>
    );
  }

  if (listo) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold">{carta.comercio} · {carta.mesa}</p>
        <h1 className="f-d text-2xl mt-2">Listo, el pedido llegó</h1>
        <p className="text-texto-suave mt-2">El mozo lo confirma en un momento y pasa a la cocina. Si querés cambiar algo, avisale a él.</p>
        <Boton className="mt-6" variante="suave" onClick={() => setListo(false)}>Pedir algo más</Boton>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto pb-28">
      <header className="px-5 pt-6 pb-3">
        <p className="text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold">{carta.mesa}</p>
        <h1 className="f-d text-2xl mt-1">{carta.comercio}</h1>
      </header>

      {/* Los rubros como atajos, pegados arriba: una carta de bar son
          cincuenta cosas, y bajar hasta los postres no puede ser un viaje. */}
      <nav className="sticky top-0 z-10 bg-fondo border-b border-borde px-5 py-2 flex gap-2 overflow-x-auto">
        {carta.secciones.map((s) => (
          <a key={s.categoria} href={`#${encodeURIComponent(s.categoria)}`}
            className="shrink-0 text-sm px-3 py-1.5 rounded-full border border-borde text-texto-suave">{s.categoria}</a>
        ))}
      </nav>

      {carta.secciones.map((s) => (
        <section key={s.categoria} id={encodeURIComponent(s.categoria)} className="px-5 pt-5 scroll-mt-14">
          <h2 className="f-d text-lg">{s.categoria}</h2>
          <ul className="mt-2 divide-y divide-borde">
            {s.items.map((i) => {
              const cant = (pedido[i.id] || {}).cantidad || 0;
              return (
                <li key={i.id} className="py-3 flex gap-3">
                  {i.imagen && <img src={i.imagen} alt="" loading="lazy" className="w-20 h-20 rounded-lg object-cover shrink-0 bg-superficie-2" />}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold leading-snug">{i.nombre}</div>
                    {i.descripcion && <div className="text-sm text-texto-suave mt-0.5 line-clamp-2">{i.descripcion}</div>}
                    <div className="flex items-center justify-between mt-2">
                      <span className="f-m font-semibold">{plata(i.precio)}</span>
                      {cant === 0 ? (
                        <button onClick={() => cambiar(i.id, 1)} className="px-4 py-1.5 rounded-lg border border-borde-fuerte text-sm font-semibold">Agregar</button>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button onClick={() => cambiar(i.id, -1)} aria-label="Uno menos" className="w-9 h-9 rounded-lg border border-borde-fuerte text-lg leading-none">−</button>
                          <span className="f-m w-5 text-center font-semibold">{cant}</span>
                          <button onClick={() => cambiar(i.id, 1)} aria-label="Uno más" className="w-9 h-9 rounded-lg bg-acento text-sobre-acento text-lg leading-none">+</button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {unidades > 0 && !revisando && (
        <div className="fixed bottom-0 inset-x-0 bg-superficie border-t border-borde p-3">
          <div className="max-w-md mx-auto">
            <Boton onClick={() => setRevisando(true)}>Ver el pedido · {unidades} · {plata(total)}</Boton>
          </div>
        </div>
      )}

      {revisando && (
        <div className="fixed inset-0 z-20 bg-fondo overflow-y-auto">
          <div className="max-w-md mx-auto p-5 pb-32">
            <button onClick={() => setRevisando(false)} className="text-sm text-texto-suave">← Seguir mirando la carta</button>
            <h2 className="f-d text-2xl mt-3">Tu pedido</h2>
            <ul className="mt-3 divide-y divide-borde">
              {lineas.map((l) => (
                <li key={l.itemId} className="py-3">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold">{l.cantidad} × {l.item.nombre}</span>
                    <span className="f-m">{plata(l.item.precio * l.cantidad)}</span>
                  </div>
                  <input value={l.notas || ""} placeholder="Alguna aclaración (sin hielo, bien cocido…)" maxLength={140}
                    onChange={(e) => setPedido((p) => ({ ...p, [l.itemId]: { ...p[l.itemId], notas: e.target.value } }))}
                    className="mt-2 w-full text-sm bg-superficie border border-borde rounded-lg px-3 py-2 outline-none focus:border-acento" />
                </li>
              ))}
            </ul>
            <label className="block mt-4">
              <span className="text-sm text-texto-suave">¿A nombre de quién? (opcional)</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value.slice(0, 40))} placeholder="Para que el mozo sepa a quién"
                className="mt-1 w-full bg-superficie border border-borde rounded-lg px-3 py-2 outline-none focus:border-acento" />
            </label>
            <div className="flex justify-between mt-5 f-m font-semibold text-lg"><span>Total</span><span>{plata(total)}</span></div>
            <p className="text-xs text-texto-tenue mt-1">Se paga al final, como siempre. El mozo confirma el pedido antes de que vaya a la cocina.</p>
            {error && <p className="text-mal text-sm mt-3">{error}</p>}
          </div>
          <div className="fixed bottom-0 inset-x-0 bg-superficie border-t border-borde p-3">
            <div className="max-w-md mx-auto">
              <Boton onClick={mandar} disabled={mandando || !lineas.length}>{mandando ? "Mandando…" : "Mandar el pedido"}</Boton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
