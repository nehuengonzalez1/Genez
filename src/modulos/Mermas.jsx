/* ============================================================
   MERMAS · pestaña de Stock (06/10)
   ============================================================

   Dar de baja mercadería con su motivo, y ver cuánto se perdió en el
   mes y por qué. Ver src/datos/mermas.js.
   ============================================================ */

import React, { useEffect, useState } from "react";
import { Barcode } from "lucide-react";
import { money, nf } from "../utils/helpers.js";
import { useScanHandler, beep, Kpi, Boton } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { MOTIVOS_MERMA, registrarMerma, cargarMermas } from "../datos/mermas.js";

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const cuando = (iso) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

export function Mermas({ productos, setProductos, empresaId, lugar, toast, activa, verCostos = true }) {
  const [q, setQ] = useState("");
  const [elegido, setElegido] = useState(null);
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [lista, setLista] = useState(null);

  const leer = () => cargarMermas(empresaId).then(setLista).catch(() => setLista([]));
  useEffect(() => { if (empresaId) leer(); }, [empresaId]);

  useScanHandler((cod) => {
    const p = productos.find((x) => x.barcode === cod);
    if (!p) { beep(false, true); return toast(`El código ${cod} no está en el catálogo.`, "mal"); }
    beep(true, true);
    setElegido(p); setQ("");
  }, activa);

  const buscar = !elegido && q.trim().length >= 2
    ? productos.filter((p) => norm(p.nombre).includes(norm(q.trim())) || (p.barcode || "").includes(q.trim())).slice(0, 8)
    : [];

  const registrar = async () => {
    if (!elegido) return toast("Elegí el producto.", "mal");
    if (!motivo) return toast("Elegí el motivo.", "mal");
    const c = Number(String(cantidad).replace(",", "."));
    if (!c || c <= 0) return toast("Escribí la cantidad.", "mal");
    setGuardando(true);
    try {
      await registrarMerma({ empresaId, itemId: elegido.id, cantidad: c, motivo, nota, sucursalId: (lugar && lugar.actual) || null });
      setProductos((ps) => ps.map((x) => (x.id === elegido.id ? { ...x, stock: +(x.stock - c).toFixed(3) } : x)));
      toast(`${elegido.nombre}: ${nf.format(c)} dado${c === 1 ? "" : "s"} de baja (${motivo.toLowerCase()}).`);
      setElegido(null); setCantidad("1"); setMotivo(""); setNota("");
      leer();
    } catch (e) {
      toast(e.message, "mal");
    } finally {
      setGuardando(false);
    }
  };

  const total = (lista || []).reduce((s, m) => s + m.valor, 0);
  const porMotivo = MOTIVOS_MERMA.map(([k]) => {
    const ms = (lista || []).filter((m) => m.grupo === k);
    return { k, n: ms.length, valor: ms.reduce((s, m) => s + m.valor, 0) };
  }).filter((x) => x.n > 0).sort((a, b) => b.valor - a.valor);

  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-sm text-texto-suave mb-3">
          Lo que se rompió, se venció, falta o se usó en el negocio. Baja del stock y queda anotado con su motivo, para saber cuánto se pierde.
        </p>
        {!elegido ? (
          <>
            <div className="relative max-w-lg">
              <Barcode size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Disparale con la pistola o buscalo por nombre"
                className="w-full pl-9 pr-3 py-2 text-sm border border-borde rounded-xl outline-none focus:border-acento bg-superficie" />
            </div>
            {buscar.length > 0 && (
              <div className="mt-2 max-w-lg border border-borde rounded-xl divide-y divide-borde">
                {buscar.map((p) => (
                  <button key={p.id} type="button" onClick={() => setElegido(p)} className="w-full text-left px-3 py-2.5 hover:bg-superficie-2">
                    <div className="text-sm font-medium truncate">{p.nombre}</div>
                    <div className="f-m text-[11px] text-texto-tenue">Stock: {nf.format(p.stock)} {p.unidad}</div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="max-w-lg border border-borde rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{elegido.nombre}</div>
                <div className="f-m text-xs text-texto-tenue">Stock: {nf.format(elegido.stock)} {elegido.unidad}</div>
              </div>
              <button type="button" onClick={() => setElegido(null)} className="text-sm text-texto-suave hover:text-texto">Cambiar</button>
            </div>
            <label className="block">
              <span className="block text-xs font-semibold text-texto-suave mb-1">Cantidad que se da de baja</span>
              <input value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal"
                className={`${inputCls} f-m w-32 text-right`} />
            </label>
            <div>
              <span className="block text-xs font-semibold text-texto-suave mb-1">Motivo</span>
              <div className="grid sm:grid-cols-2 gap-2">
                {MOTIVOS_MERMA.map(([k, d]) => (
                  <button key={k} type="button" onClick={() => setMotivo(k)}
                    className={`text-left rounded-lg border px-3 py-2 ${motivo === k ? "border-acento bg-acento-suave" : "border-borde hover:bg-superficie-2"}`}>
                    <div className="text-sm font-semibold">{k}</div>
                    <div className="text-xs text-texto-suave">{d}</div>
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="block text-xs font-semibold text-texto-suave mb-1">Nota <span className="text-texto-tenue font-normal">(opcional)</span></span>
              <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={120} placeholder="Ej: se cayó la caja, lote de marzo"
                className={inputCls} />
            </label>
            <Boton onClick={registrar} disabled={guardando}>{guardando ? "Registrando…" : "Dar de baja"}</Boton>
          </div>
        )}
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-2">Últimos 30 días</div>
        {lista === null ? (
          <p className="text-sm text-texto-tenue">Cargando…</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-texto-tenue">Todavía no hay mermas registradas.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {verCostos && <Kpi label="Perdido al costo" valor={money(total)} sub={`${lista.length} baja${lista.length === 1 ? "" : "s"}`} />}
              {porMotivo.slice(0, verCostos ? 3 : 4).map((x) => (
                <Kpi key={x.k} label={x.k} valor={verCostos ? money(x.valor) : nf.format(x.n)} sub={verCostos ? `${x.n} baja${x.n === 1 ? "" : "s"}` : "bajas"} />
              ))}
            </div>
            <ul className="mt-3 text-sm divide-y divide-borde border border-borde rounded-xl">
              {lista.slice(0, 50).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate">{m.nombre}</div>
                    <div className="text-xs text-texto-tenue">{cuando(m.fecha)} · {m.motivo}{m.quien ? ` · ${m.quien}` : ""}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="f-m">−{nf.format(m.cantidad)} {m.unidad}</div>
                    {verCostos && <div className="f-m text-xs text-texto-tenue">{money(m.valor)}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
