/* ============================================================
   8. STOCK
   ============================================================ */

import React, { useState, useEffect, useCallback } from "react";
import { Barcode } from "lucide-react";
import { uid, fdatel } from "../datos/generador.js";
import { diasDesde, money, moneyk, nf } from "../utils/helpers.js";
import { useScanHandler, beep, Card, Kpi, Tabs, Vacio, Boton, TablaSimple } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { cargarStockPorSucursal, transferirStock } from "../datos/sucursales.js";

export function Stock({ productos, setProductos, k, toast, empresaId = null, lugar = { sucursales: [], varias: false } }) {
  const [tab, setTab] = useState("alertas");
  const [q, setQ] = useState("");
  const [conteo, setConteo] = useState({});
  const [ajustados, setAjustados] = useState([]);

  useScanHandler((cod) => {
    const p = productos.find((x) => x.barcode === cod);
    if (!p) { beep(false, true); return toast(`El código ${cod} no está en el catálogo.`, "mal"); }
    beep(true, true);
    setQ(cod);
    setConteo((c) => ({ ...c, [p.id]: String((Number(c[p.id]) || 0) + 1) }));
  }, tab === "inventario");

  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const buscar = q.trim().length >= 2 ? productos.filter((p) => norm(p.nombre).includes(norm(q.trim())) || p.barcode.includes(q.trim())).slice(0, 25) : [];

  const aplicar = (p) => {
    const real = Number(conteo[p.id]);
    if (isNaN(real)) return;
    const dif = +(real - p.stock).toFixed(2);
    setProductos((ps) => ps.map((x) => (x.id === p.id ? { ...x, stock: real } : x)));
    setAjustados((a) => [{ id: uid(), nombre: p.nombre, antes: p.stock, real, dif, valor: dif * p.costo }, ...a]);
    setConteo((c) => ({ ...c, [p.id]: "" }));
    toast(`${p.nombre}: stock ajustado a ${real}.`);
  };

  const items = [
    { k: "alertas", n: "Reponer", badge: k.criticos.length },
    { k: "vencer", n: "Vencimientos", badge: k.porVencer.length },
    { k: "dormidos", n: "Sin movimiento", badge: k.dormidos.length },
    { k: "inventario", n: "Conteo de inventario" },
    /* Con una sola sucursal no hay nada que mostrar (0108). */
    ...(lugar.varias && empresaId ? [{ k: "sucursales", n: "Sucursales" }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Valor del inventario" valor={moneyk(k.valorStock)} sub={`${nf.format(productos.length)} artículos`} />
        <Kpi label="Para reponer ya" valor={nf.format(k.criticos.filter((x) => x.cobertura < 4).length)} sub="menos de 4 días" tono="mal" />
        <Kpi label="Sin rotación" valor={moneyk(k.valorDormido)} sub={`${k.dormidos.length} productos`} />
        <Kpi label="Vencen en 15 días" valor={moneyk(k.valorVencer)} sub={`${k.porVencer.length} productos`} />
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 pt-2"><Tabs items={items} value={tab} onChange={setTab} /></div>

        {tab === "alertas" && (
          <TablaSimple
            cols={["Producto", "Stock", "Vende por día", "Alcanza para", "Sugerido"]}
            filas={k.criticos.slice(0, 60).map(({ p, cobertura }) => [
              <div key="a"><div className="font-medium">{p.nombre}</div><div className="text-[11px] text-texto-tenue">{p.proveedor}</div></div>,
              <span className="f-m">{p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)}</span>,
              <span className="f-m text-texto-suave">{p.vel.toFixed(1)}</span>,
              <span className={`f-m font-semibold ${cobertura < 2 ? "text-mal" : "text-ojo"}`}>{cobertura < 1 ? "hoy" : `${Math.round(cobertura)} días`}</span>,
              <span className="f-m">{Math.max(p.bulto, Math.ceil((p.vel * 14 - p.stock) / p.bulto) * p.bulto)} u</span>,
            ])}
            vacio="No hay nada por reponer. Buen momento."
          />
        )}

        {tab === "vencer" && (
          <TablaSimple
            cols={["Producto", "Vence", "Stock", "Plata en riesgo", ""]}
            filas={k.porVencer.map(({ p, dias, valor }) => [
              <div key="a" className="font-medium">{p.nombre}</div>,
              <span className={`f-m ${dias <= 0 ? "text-mal font-semibold" : dias <= 7 ? "text-ojo" : ""}`}>{dias <= 0 ? "Vencido" : `en ${dias} días`} · {fdatel(p.vence)}</span>,
              <span className="f-m">{p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)}</span>,
              <span className="f-m">{money(valor)}</span>,
              <Boton key="b" size="sm" variant="ghost" onClick={() => {
                setProductos((ps) => ps.map((x) => (x.id === p.id ? { ...x, precio: Math.round(x.precio * 0.7 / 10) * 10 } : x)));
                toast(`${p.nombre} pasó a promo con 30% off.`);
              }}>Poner en promo</Boton>,
            ])}
            vacio="Ningún producto vence en los próximos 15 días."
          />
        )}

        {tab === "dormidos" && (
          <TablaSimple
            cols={["Producto", "Última venta", "Stock", "Plata inmovilizada", ""]}
            filas={k.dormidos.slice(0, 60).map(({ p, valor }) => [
              <div key="a"><div className="font-medium">{p.nombre}</div><div className="text-[11px] text-texto-tenue">{p.categoria}</div></div>,
              <span className="f-m text-texto-suave">hace {diasDesde(p.ultimaVenta)} días</span>,
              <span className="f-m">{p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)}</span>,
              <span className="f-m font-semibold">{money(valor)}</span>,
              <Boton key="b" size="sm" variant="ghost" onClick={() => {
                setProductos((ps) => ps.map((x) => (x.id === p.id ? { ...x, activo: false } : x)));
                toast(`${p.nombre} marcado para no reponer.`);
              }}>No reponer</Boton>,
            ])}
            vacio="Todo tu inventario rotó en los últimos 30 días."
          />
        )}

        {tab === "sucursales" && (
          <StockPorSucursal productos={productos} empresaId={empresaId} lugar={lugar} toast={toast} />
        )}

        {tab === "inventario" && (
          <div className="p-4">
            <p className="text-sm text-texto-suave mb-3">
              Escaneá o buscá el producto, contá lo que hay en góndola y cargá el número real. El sistema calcula la diferencia contra el stock teórico.
            </p>
            <div className="relative max-w-lg">
              <Barcode size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Disparale con la pistola o buscalo por nombre"
                className="w-full pl-9 pr-3 py-2 text-sm border border-borde rounded-xl outline-none focus:border-acento" />
            </div>
            {buscar.length > 0 && (
              <div className="mt-3 border border-borde rounded-xl divide-y divide-borde max-h-80 overflow-auto">
                {buscar.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{p.nombre}</div>
                      <div className="f-m text-[11px] text-texto-tenue">Sistema: {p.unidad === "kg" ? p.stock.toFixed(1) : nf.format(p.stock)} {p.unidad}</div>
                    </div>
                    <input value={conteo[p.id] || ""} onChange={(e) => setConteo((c) => ({ ...c, [p.id]: e.target.value.replace(/[^\d.]/g, "") }))}
                      placeholder="Contado" className="f-m w-24 text-right border border-borde rounded-lg px-2 py-1.5 text-sm outline-none focus:border-acento" />
                    <Boton size="sm" onClick={() => aplicar(p)} disabled={!conteo[p.id]}>Ajustar</Boton>
                  </div>
                ))}
              </div>
            )}
            {ajustados.length > 0 && (
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-2">Ajustes de esta sesión</div>
                <ul className="text-sm divide-y divide-borde border border-borde rounded-xl">
                  {ajustados.map((a) => (
                    <li key={a.id} className="flex items-center justify-between px-3 py-2">
                      <span className="truncate">{a.nombre}</span>
                      <span className="f-m text-xs shrink-0 ml-3">
                        {a.antes} → {a.real}
                        <span className={a.dif < 0 ? "text-mal ml-2" : "text-bien ml-2"}>{a.dif > 0 ? "+" : ""}{a.dif} ({money(a.valor)})</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-texto-suave mt-2">
                  Diferencia acumulada: <strong className={ajustados.reduce((s, a) => s + a.valor, 0) < 0 ? "text-mal" : "text-bien"}>{money(ajustados.reduce((s, a) => s + a.valor, 0))}</strong>. Si da negativo seguido, hay merma o error de carga.
                </p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

/* --- El stock de cada sucursal (0108) -----------------------------------
   Lo real de la base (stock_actual), no el estado en memoria: el pase de
   mercadería lo escribe la base en una transacción, y lo que se muestra
   después es lo que quedó. Se relee después de cada pase. */
function StockPorSucursal({ productos, empresaId, lugar, toast }) {
  const activas = lugar.sucursales.filter((s) => s.activa);
  const [mapa, setMapa] = useState(null);
  const [q, setQ] = useState("");
  const [pase, setPase] = useState(null);   // { p, cantidad, desde, hacia }
  const [ocupado, setOcupado] = useState(false);

  const leer = useCallback(async () => {
    try { setMapa(await cargarStockPorSucursal(empresaId)); }
    catch (e) { toast(e.message || "No se pudo leer el stock por sucursal.", "mal"); setMapa(new Map()); }
  }, [empresaId, toast]);
  useEffect(() => { leer(); }, [leer]);

  useScanHandler((cod) => {
    const p = productos.find((x) => x.barcode === cod);
    if (!p) { beep(false, true); return toast(`El código ${cod} no está en el catálogo.`, "mal"); }
    beep(true, true);
    setQ(cod);
  }, true);

  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const lista = q.trim().length >= 2
    ? productos.filter((p) => norm(p.nombre).includes(norm(q.trim())) || (p.barcode || "").includes(q.trim())).slice(0, 40)
    : [];
  const de = (p, s) => ((mapa && mapa.get(p.id)) || {})[s] || 0;
  const fmt = (p, n) => (p.unidad === "kg" ? n.toFixed(1) : nf.format(n));
  const nombreDe = (id) => (lugar.sucursales.find((s) => s.id === id) || {}).nombre;

  const abrirPase = (p) => {
    const desde = activas.some((s) => s.id === lugar.actual) ? lugar.actual : activas[0].id;
    const hacia = (activas.find((s) => s.id !== desde) || activas[0]).id;
    setPase({ p, cantidad: "", desde, hacia });
  };

  const pasar = async () => {
    const cant = Number(pase.cantidad);
    if (!(cant > 0)) return toast("Poné cuánto pasás.", "mal");
    setOcupado(true);
    try {
      await transferirStock({ itemId: pase.p.id, cantidad: cant, desde: pase.desde, hacia: pase.hacia });
      toast(`${fmt(pase.p, cant)} de ${pase.p.nombre}: de ${nombreDe(pase.desde)} a ${nombreDe(pase.hacia)}.`);
      setPase(null);
      await leer();
    } catch (e) {
      toast(e.message, "mal");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="p-4">
      <p className="text-sm text-texto-suave mb-3">
        Cuánto hay en cada local. Pasar mercadería la saca de uno y la pone en el otro, las dos cosas juntas; el total no cambia.
      </p>
      <div className="relative max-w-lg">
        <Barcode size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Disparale con la pistola o buscalo por nombre"
          className="w-full pl-9 pr-3 py-2 text-sm border border-borde rounded-xl outline-none focus:border-acento" />
      </div>
      {!mapa ? (
        <p className="text-sm text-texto-tenue mt-3">Leyendo el stock…</p>
      ) : lista.length > 0 && (
        <div className="mt-3 border border-borde rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-texto-tenue">
                <th className="text-left font-semibold px-3 py-2">Producto</th>
                {activas.map((s) => <th key={s.id} className="text-right font-semibold px-3 py-2">{s.nombre}</th>)}
                <th className="text-right font-semibold px-3 py-2">Total</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {lista.map((p) => (
                <React.Fragment key={p.id}>
                  <tr>
                    <td className="px-3 py-2"><div className="font-medium">{p.nombre}</div><div className="f-m text-[11px] text-texto-tenue">{p.barcode || "sin código"}</div></td>
                    {activas.map((s) => <td key={s.id} className="f-m text-right px-3 py-2">{fmt(p, de(p, s.id))}</td>)}
                    <td className="f-m text-right px-3 py-2 text-texto-suave">{fmt(p, activas.reduce((n, s) => n + de(p, s.id), 0))}</td>
                    <td className="px-3 py-2 text-right">
                      <Boton size="sm" variant="ghost" onClick={() => abrirPase(p)}>Pasar</Boton>
                    </td>
                  </tr>
                  {pase && pase.p.id === p.id && (
                    <tr className="bg-superficie-2">
                      <td colSpan={activas.length + 3} className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <input value={pase.cantidad} autoFocus onChange={(e) => setPase({ ...pase, cantidad: e.target.value.replace(/[^\d.]/g, "") })}
                            placeholder="Cantidad" className={`${inputCls} f-m w-24 text-right`} />
                          <span className="text-texto-suave">de</span>
                          <select value={pase.desde} onChange={(e) => {
                            const desde = e.target.value;
                            setPase({ ...pase, desde, hacia: pase.hacia === desde ? (activas.find((s) => s.id !== desde) || {}).id : pase.hacia });
                          }} className={`${inputCls} w-auto`}>
                            {activas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                          </select>
                          <span className="text-texto-suave">a</span>
                          <select value={pase.hacia} onChange={(e) => setPase({ ...pase, hacia: e.target.value })} className={`${inputCls} w-auto`}>
                            {activas.filter((s) => s.id !== pase.desde).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                          </select>
                          <Boton size="sm" disabled={ocupado || pase.desde === pase.hacia} onClick={pasar}>Pasar</Boton>
                          <Boton size="sm" variant="quiet" onClick={() => setPase(null)}>Cancelar</Boton>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* --- Emparejar un renglón de remito con el catálogo --------------------
   Los remitos abrevian ("COCA COLA 2.25 X6"), a veces traen el código del
   proveedor y no el EAN. Se prueba primero por código y después por
   coincidencia de palabras, devolviendo la confianza para que la pantalla
   marque en amarillo lo que hay que revisar a mano.                        */
export function palabras(t) {
  return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/).filter((x) => x.length > 2);
}

export function emparejar(descripcion, codigo, productos) {
  const cod = String(codigo || "").replace(/\D/g, "");
  if (cod.length >= 8) {
    const p = productos.find((x) => x.barcode === cod);
    if (p) return { p, conf: 1 };
  }
  const ts = palabras(descripcion);
  if (!ts.length) return { p: null, conf: 0 };
  let mejor = null, punt = 0;
  for (const p of productos) {
    const ps = palabras(p.nombre);
    let c = 0;
    for (const t of ts) if (ps.some((x) => x.startsWith(t) || t.startsWith(x))) c++;
    const score = c / ts.length;
    if (score > punt) { punt = score; mejor = p; }
  }
  return punt >= 0.5 ? { p: mejor, conf: punt } : { p: mejor, conf: punt };
}
