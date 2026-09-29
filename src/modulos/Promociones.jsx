/* ============================================================
   PRODUCTOS · PROMOCIONES (0102)
   ============================================================

   Cargar las promos que el mostrador aplica solo: 2x1, 3x2, la segunda
   al 50%, 3 por $1.000, 20% en un rubro. La cuenta está en
   src/utils/promociones.js; acá se arman y se prenden o se apagan.

   No se borran: se apagan. Las ventas guardan qué promo se les aplicó
   (operaciones.campos_extra), y ese detalle tiene que seguir teniendo a
   qué apuntar.

   Cargarlas pide el permiso de cambiar precios, y eso lo controla la
   base (0102). Sin él, la lista se ve pero no se toca.
   ============================================================ */

import React, { useState, useMemo } from "react";
import { Plus, X, Search } from "lucide-react";
import { Card, Boton, Modal, Vacio } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";
import { money } from "../utils/helpers.js";
import { describir, vigente } from "../utils/promociones.js";
import { guardarPromocion } from "../datos/promociones.js";

const TIPOS = [
  { k: "nxm", n: "Llevá N, pagá M", d: "2x1, 3x2: lo más barato del grupo va gratis." },
  { k: "segunda", n: "Segunda unidad con descuento", d: "La segunda al 50%, al 70%…" },
  { k: "porcentaje", n: "Porcentaje de descuento", d: "20% en Limpieza, 10% en una marca." },
  { k: "pack", n: "N unidades por $P", d: "3 alfajores por $1.000." },
];
const DIAS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
const PARAMETROS_INICIALES = { nxm: { lleva: 2, paga: 1 }, segunda: { pct: 50 }, porcentaje: { pct: 10 }, pack: { cantidad: 3, precio: 1000 } };

const vacia = () => ({ nombre: "", tipo: "nxm", parametros: { ...PARAMETROS_INICIALES.nxm }, alcance: { productos: [], rubros: [] }, desde: "", hasta: "", dias: [], activa: true });

function cuando(p) {
  const partes = [];
  if (p.desde && p.hasta) partes.push(`del ${p.desde.split("-").reverse().join("/")} al ${p.hasta.split("-").reverse().join("/")}`);
  else if (p.desde) partes.push(`desde el ${p.desde.split("-").reverse().join("/")}`);
  else if (p.hasta) partes.push(`hasta el ${p.hasta.split("-").reverse().join("/")}`);
  if (p.dias && p.dias.length && p.dias.length < 7) partes.push(p.dias.slice().sort().map((d) => DIAS[d]).join(", "));
  return partes.join(" · ") || "Siempre";
}

export function Promociones({ promos, productos, empresaId, toast, recargar, puede }) {
  const [editando, setEditando] = useState(null);
  const nombreDe = useMemo(() => new Map(productos.map((p) => [p.id, p.nombre])), [productos]);

  const alternar = async (p) => {
    try { await guardarPromocion(empresaId, { ...p, activa: !p.activa }); await recargar(); toast(p.activa ? "Promo apagada." : "Promo prendida."); }
    catch (e) { toast(e.message || "No se pudo guardar.", "mal"); }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-borde">
        <div className="min-w-0">
          <h3 className="f-d text-lg">Promociones</h3>
          <p className="text-xs text-texto-tenue mt-0.5">Las aplica la caja sola. No entran lo que tiene precio a mano ni precio por cantidad, y cada unidad va en una sola promo.</p>
        </div>
        {puede && <Boton size="sm" onClick={() => setEditando(vacia())}><Plus size={14} /> Nueva</Boton>}
      </div>
      {!promos.length ? (
        <Vacio>Todavía no hay promociones.</Vacio>
      ) : (
        <ul className="divide-y divide-borde">
          {promos.map((p) => {
            const hoy = vigente(p);
            const abarca = [...(p.alcance.rubros || []).map((r) => `Rubro ${r}`), ...(p.alcance.productos || []).map((id) => nombreDe.get(id) || "producto dado de baja")];
            return (
              <li key={p.id} className={`px-5 py-3 flex items-center gap-3 ${p.activa ? "" : "opacity-60"}`}>
                <span className="f-m text-sm font-bold w-24 shrink-0 text-bien">{describir(p)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{p.nombre}</div>
                  <div className="text-xs text-texto-tenue truncate">{abarca.join(", ") || "No abarca nada todavía"} · {cuando(p)}</div>
                </div>
                <span className={`text-[10px] uppercase tracking-[0.1em] font-bold px-2 py-0.5 rounded border ${hoy ? "border-bien bg-bien-suave text-bien" : "border-borde text-texto-tenue"}`}>
                  {hoy ? "Hoy vale" : p.activa ? "Hoy no" : "Apagada"}
                </span>
                {puede && (
                  <>
                    <Boton size="sm" variant="ghost" onClick={() => setEditando(p)}>Editar</Boton>
                    <Boton size="sm" variant="ghost" onClick={() => alternar(p)}>{p.activa ? "Apagar" : "Prender"}</Boton>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editando && (
        <FormPromo inicial={editando} productos={productos} empresaId={empresaId} toast={toast}
          onCerrar={() => setEditando(null)} onGuardada={async () => { await recargar(); setEditando(null); }} />
      )}
    </Card>
  );
}

function FormPromo({ inicial, productos, empresaId, toast, onCerrar, onGuardada }) {
  const [p, setP] = useState(inicial);
  const [q, setQ] = useState("");
  const [guardando, setGuardando] = useState(false);
  const set = (cambios) => setP((x) => ({ ...x, ...cambios }));
  const setPar = (k, v) => setP((x) => ({ ...x, parametros: { ...x.parametros, [k]: v === "" ? "" : Number(v) } }));

  const rubros = useMemo(() => Array.from(new Set(productos.map((x) => x.categoria).filter(Boolean))).sort(), [productos]);
  const porId = useMemo(() => new Map(productos.map((x) => [x.id, x])), [productos]);
  const encontrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return productos.filter((x) => x.nombre.toLowerCase().includes(t) || (x.barcode || "").includes(t)).slice(0, 8);
  }, [q, productos]);

  const alternarRubro = (r) => set({ alcance: { ...p.alcance, rubros: p.alcance.rubros.includes(r) ? p.alcance.rubros.filter((x) => x !== r) : [...p.alcance.rubros, r] } });
  const agregarProducto = (id) => { if (!p.alcance.productos.includes(id)) set({ alcance: { ...p.alcance, productos: [...p.alcance.productos, id] } }); setQ(""); };
  const quitarProducto = (id) => set({ alcance: { ...p.alcance, productos: p.alcance.productos.filter((x) => x !== id) } });
  const alternarDia = (d) => set({ dias: p.dias.includes(d) ? p.dias.filter((x) => x !== d) : [...p.dias, d] });

  const guardar = async () => {
    if (!p.nombre.trim()) return toast("Ponele un nombre a la promo: es lo que sale en el ticket.", "mal");
    if (!p.alcance.productos.length && !p.alcance.rubros.length) return toast("Elegí a qué productos o rubros se aplica.", "mal");
    setGuardando(true);
    try {
      await guardarPromocion(empresaId, { ...p, desde: p.desde || null, hasta: p.hasta || null });
      toast(inicial.id ? "Promo guardada." : "Promo creada: la caja ya la aplica.");
      await onGuardada();
    } catch (e) {
      toast(e.message || "No se pudo guardar.", "mal");
    } finally {
      setGuardando(false);
    }
  };

  const num = (k, ancho = "w-20") => (
    <input value={p.parametros[k] ?? ""} onChange={(e) => setPar(k, e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric"
      className={`f-m ${ancho} text-right border border-borde rounded-lg px-2 py-1 bg-superficie outline-none focus:border-acento`} />
  );

  return (
    <Modal open onClose={onCerrar} ancho="max-w-xl">
      <div className="sticky top-0 bg-superficie border-b border-borde px-5 py-3.5 flex items-center justify-between">
        <h3 className="f-d text-lg">{inicial.id ? "Editar promoción" : "Nueva promoción"}</h3>
        <button onClick={onCerrar} className="text-texto-tenue hover:text-texto"><X size={18} /></button>
      </div>
      <div className="p-5 space-y-4 text-sm">
        <Campo label="Nombre (sale en el ticket)">
          <input value={p.nombre} onChange={(e) => set({ nombre: e.target.value.slice(0, 60) })} placeholder="2x1 en gaseosas" className={inputCls} />
        </Campo>

        <div className="grid grid-cols-2 gap-2">
          {TIPOS.map((t) => (
            <button key={t.k} onClick={() => set({ tipo: t.k, parametros: { ...PARAMETROS_INICIALES[t.k] } })}
              className={`text-left rounded-lg border px-3 py-2 ${p.tipo === t.k ? "border-acento bg-acento-suave/40" : "border-borde hover:bg-superficie-2"}`}>
              <div className="font-semibold">{t.n}</div>
              <div className="text-xs text-texto-tenue">{t.d}</div>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {p.tipo === "nxm" && <>Llevá {num("lleva", "w-14")} y pagá {num("paga", "w-14")}</>}
          {p.tipo === "segunda" && <>La segunda unidad con {num("pct", "w-16")}% de descuento</>}
          {p.tipo === "porcentaje" && <>{num("pct", "w-16")}% de descuento</>}
          {p.tipo === "pack" && <>{num("cantidad", "w-14")} unidades por ${num("precio", "w-24")} {p.parametros.precio ? <span className="text-texto-tenue">({money(p.parametros.precio)})</span> : null}</>}
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold mb-1.5">Rubros enteros</div>
          <div className="flex flex-wrap gap-1.5">
            {rubros.map((r) => (
              <button key={r} onClick={() => alternarRubro(r)}
                className={`text-xs px-2.5 py-1 rounded-full border ${p.alcance.rubros.includes(r) ? "border-acento bg-acento-suave text-texto font-semibold" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>{r}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold mb-1.5">Productos sueltos</div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o código" className={`${inputCls} pl-8`} />
          </div>
          {encontrados.length > 0 && (
            <ul className="mt-1 border border-borde rounded-lg divide-y divide-borde">
              {encontrados.map((x) => (
                <li key={x.id}><button onClick={() => agregarProducto(x.id)} className="w-full text-left px-3 py-1.5 hover:bg-superficie-2 flex justify-between gap-2">
                  <span className="truncate">{x.nombre}</span><span className="f-m text-texto-tenue">{money(x.precio)}</span>
                </button></li>
              ))}
            </ul>
          )}
          {p.alcance.productos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {p.alcance.productos.map((id) => (
                <span key={id} className="text-xs px-2 py-1 rounded-full border border-borde bg-superficie-2 inline-flex items-center gap-1">
                  {(porId.get(id) || {}).nombre || "producto dado de baja"}
                  <button onClick={() => quitarProducto(id)} className="text-texto-tenue hover:text-mal"><X size={11} /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Desde (opcional)"><input type="date" value={p.desde || ""} onChange={(e) => set({ desde: e.target.value })} className={inputCls} /></Campo>
          <Campo label="Hasta (opcional)"><input type="date" value={p.hasta || ""} onChange={(e) => set({ hasta: e.target.value })} className={inputCls} /></Campo>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold mb-1.5">Qué días (ninguno = todos)</div>
          <div className="flex gap-1.5">
            {DIAS.map((d, i) => (
              <button key={d} onClick={() => alternarDia(i)}
                className={`w-9 h-8 text-xs rounded-lg border ${p.dias.includes(i) ? "border-acento bg-acento-suave font-semibold" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>{d}</button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-borde">
          <Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</Boton>
        </div>
      </div>
    </Modal>
  );
}
