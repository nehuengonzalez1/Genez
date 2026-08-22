/* ============================================================
   9 ter. CLIENTES
   ============================================================ */

import React, { useState, useEffect, useCallback } from "react";
import { Search, Plus, Check, AlertTriangle } from "lucide-react";
import { CONDICIONES, FISCAL_INICIAL, condicionNombre, money, letraComprobante, nf } from "../utils/helpers.js";
import { Modal, Boton, Card, Vacio, Sello, Cargando, ErrorEstado } from "../ui/Base.jsx";
import { cargarClientesConCuentas } from "../datos/clientes.js";
import { FichaCliente } from "./FichaCliente.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";

export function FormCliente({ abierto, inicial, onGuardar, onCerrar }) {
  const [d, setD] = useState({});
  useEffect(() => { if (abierto) setD({ tipoDoc: "CUIT", condicion: "CF", ...(inicial || {}) }); }, [abierto, inicial]);
  if (!abierto) return null;
  const set = (c, v) => setD((x) => ({ ...x, [c]: v }));
  const necesitaCuit = d.condicion === "RI" || d.condicion === "MONOTRIBUTO" || d.condicion === "EXENTO";
  const faltaCuit = necesitaCuit && (!d.doc || d.tipoDoc !== "CUIT");

  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-5">
        <h3 className="f-d text-lg">{d.id ? "Editar cliente" : "Nuevo cliente"}</h3>
        <div className="space-y-3 mt-4">
          <Campo label="Razón social o nombre">
            <input value={d.razonSocial || ""} onChange={(e) => set("razonSocial", e.target.value)} autoFocus className={inputCls} />
          </Campo>
          <Campo label="Condición frente al IVA">
            <select value={d.condicion} onChange={(e) => set("condicion", e.target.value)} className={inputCls}>
              {CONDICIONES.map((c) => <option key={c.k} value={c.k}>{c.n}</option>)}
            </select>
          </Campo>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Tipo">
              <select value={d.tipoDoc} onChange={(e) => set("tipoDoc", e.target.value)} className={inputCls}>
                <option>CUIT</option><option>DNI</option><option>CUIL</option>
              </select>
            </Campo>
            <label className="block col-span-2">
              <span className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">Número</span>
              <input value={d.doc || ""} onChange={(e) => set("doc", e.target.value)} className={`${inputCls} f-m`} />
            </label>
          </div>
          <Campo label="Domicilio"><input value={d.domicilio || ""} onChange={(e) => set("domicilio", e.target.value)} className={inputCls} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Email"><input value={d.email || ""} onChange={(e) => set("email", e.target.value)} className={inputCls} /></Campo>
            <Campo label="Teléfono"><input value={d.tel || ""} onChange={(e) => set("tel", e.target.value)} className={`${inputCls} f-m`} /></Campo>
          </div>
        </div>

        {faltaCuit && (
          <div className="text-sm text-amber-800 bg-ojo-suave border border-ojo rounded-xl p-3 mt-4">
            Un {condicionNombre(d.condicion).toLowerCase()} necesita CUIT para que la factura sea válida.
            Sin eso, la venta va a salir como Factura B.
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => onGuardar(d)} disabled={!d.razonSocial}><Check size={15} /> Guardar</Boton>
        </div>
      </div>
    </Modal>
  );
}


/* ============================================================
   La lista

   Muestra las cuentas de cada uno —cuántas veces vino, cuánto hace, si
   debe— porque en un negocio de turnos eso es lo que se mira. La letra
   del comprobante sigue estando: un comercio que factura la necesita, y
   uno de servicios simplemente no la usa.

   Se carga sola contra `clientes_vista` en vez de usar la lista que baja
   por props: esa la necesitan el punto de venta y la agenda, y no tiene
   por qué cargar las cuentas de todos para elegir un nombre.
   ============================================================ */

export function Clientes({ clientes, guardarCliente, tickets, ajustes, empresaId, permisos, toast }) {
  const [q, setQ] = useState("");
  const [alta, setAlta] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const releer = useCallback(async () => {
    const xs = await cargarClientesConCuentas(empresaId);
    setLista(xs);
  }, [empresaId]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    releer()
      .catch((e) => { if (vigente) setError(e.message || "No pudimos cargar los clientes."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [releer, clientes]);

  if (ficha) {
    return (
      <FichaCliente empresaId={empresaId} clienteId={ficha} permisos={permisos} toast={toast}
        onVolver={() => { setFicha(null); releer().catch(() => {}); }}
        onEditar={(c) => setAlta(c)} />
    );
  }

  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filtrados = q.trim().length >= 2
    ? lista.filter((c) => norm(c.razonSocial).includes(norm(q)) || String(c.doc || "").includes(q.trim()) || String(c.tel || "").includes(q.trim()))
    : lista;

  const emisor = (ajustes.fiscal || FISCAL_INICIAL).condicion;
  const conAlertas = lista.filter((c) => c.alertas > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, documento o teléfono"
            className="w-full pl-9 pr-3 py-2 text-sm border border-borde rounded-xl outline-none focus:border-acento bg-superficie" />
        </div>
        <Boton size="sm" onClick={() => setAlta({})}><Plus size={14} /> Nuevo cliente</Boton>
      </div>

      <Card className="overflow-hidden">
        {error ? (
          <ErrorEstado onReintentar={() => releer().catch((e) => setError(e.message))}>{error}</ErrorEstado>
        ) : cargando ? (
          <Cargando />
        ) : filtrados.length === 0 ? (
          <Vacio>
            {lista.length === 0
              ? "Todavía no hay clientes cargados. Cada turno y cada abono apuntan a uno."
              : "Nadie coincide con esa búsqueda."}
          </Vacio>
        ) : (
          <ul className="divide-y divide-borde">
            {filtrados.map((c) => {
              const letra = letraComprobante(emisor, c.condicion);
              const debe = c.gastado > 0 && c.compras > 0;
              return (
                <li key={c.id}>
                  <button onClick={() => setFicha(c.id)}
                    className="w-full text-left px-4 py-3 hover:bg-superficie-2 flex flex-wrap items-center gap-3">
                    <span className="w-9 h-9 shrink-0 rounded-full bg-superficie-2 flex items-center justify-center text-[11px] font-bold text-texto-suave">
                      {iniciales(c.razonSocial)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-texto flex items-center gap-2">
                        {c.razonSocial}
                        {c.alertas > 0 && <AlertTriangle size={13} className="text-mal" />}
                      </div>
                      <div className="f-m text-[11px] text-texto-tenue">
                        {c.tel || (c.doc ? `${c.tipoDoc} ${c.doc}` : "sin contacto")}
                        {c.turnos > 0 && ` · ${nf.format(c.turnos)} turnos`}
                      </div>
                    </div>

                    {c.abonosActivos > 0 && <Sello tono="bien">{c.abonosActivos} abono{c.abonosActivos > 1 ? "s" : ""}</Sello>}

                    <div className="text-right shrink-0 w-28">
                      <div className="f-m text-xs text-texto-suave">{haceCuanto(c.ultima)}</div>
                      {c.gastado > 0 && <div className="f-m text-[11px] text-texto-tenue">{money(c.gastado)}</div>}
                    </div>

                    {/* La letra solo tiene sentido donde se factura. */}
                    {c.doc && (
                      <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border bg-superficie-2 text-texto-suave border-borde">
                        {letra}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {conAlertas > 0 && (
        <p className="text-xs text-texto-suave">
          {conAlertas === 1 ? "Una persona tiene" : `${conAlertas} personas tienen`} algo anotado para ver antes de atenderla.
        </p>
      )}

      <FormCliente abierto={!!alta} inicial={alta} onCerrar={() => setAlta(null)}
        onGuardar={async (d) => {
          const c = await guardarCliente(d);
          if (c) { setAlta(null); await releer(); }
        }} />
    </div>
  );
}

const haceCuanto = (d) => {
  if (!d) return "nunca vino";
  const dias = Math.floor((Date.now() - d) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} d`;
  const meses = Math.floor(dias / 30);
  return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
};

const iniciales = (nombre) =>
  String(nombre || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
