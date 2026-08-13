/* ============================================================
   9 ter. CLIENTES
   ============================================================ */

import React, { useState, useEffect } from "react";
import { Search, Plus, Check } from "lucide-react";
import { uid } from "../datos/generador.js";
import { CONDICIONES, FISCAL_INICIAL, condicionNombre, money, letraComprobante, CLIENTES_INICIALES } from "../utils/helpers.js";
import { Modal, Boton, Card, Vacio } from "../ui/Base.jsx";
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

export function Clientes({ clientes, setClientes, tickets, ajustes, toast }) {
  const [q, setQ] = useState("");
  const [alta, setAlta] = useState(null);
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lista = q.trim().length >= 2
    ? clientes.filter((c) => norm(c.razonSocial).includes(norm(q)) || String(c.doc || "").includes(q.trim()))
    : clientes;
  const emisor = (ajustes.fiscal || FISCAL_INICIAL).condicion;

  const facturadoA = (id) => tickets.filter((t) => t.cliente && t.cliente.id === id).reduce((s, t) => s + t.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o CUIT"
            className="w-full pl-9 pr-3 py-2 text-sm border border-borde rounded-xl outline-none focus:border-acento bg-superficie" />
        </div>
        <Boton size="sm" onClick={() => setAlta({})}><Plus size={14} /> Nuevo cliente</Boton>
      </div>

      <Card className="overflow-hidden">
        {lista.length === 0 ? <Vacio>No hay clientes cargados. Los necesitás solo para emitir facturas: la venta al mostrador no requiere ninguno.</Vacio> : (
          <ul className="divide-y divide-borde">
            {lista.map((c) => {
              const letra = letraComprobante(emisor, c.condicion);
              const total = facturadoA(c.id);
              return (
                <li key={c.id}>
                  <button onClick={() => setAlta(c)} className="w-full text-left px-4 py-3 hover:bg-superficie-2 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-texto">{c.razonSocial}</div>
                      <div className="f-m text-[11px] text-texto-tenue">
                        {c.tipoDoc} {c.doc || "sin número"} · {condicionNombre(c.condicion)}
                        {c.tel ? ` · ${c.tel}` : ""}
                      </div>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${
                      letra === "A" ? "bg-superficie-3 text-texto border-superficie-3" : "bg-superficie-2 text-texto-suave border-borde"}`}>
                      Factura {letra}
                    </span>
                    {total > 0 && <span className="f-m text-sm text-texto-suave">{money(total)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="text-xs text-texto-suave">
        La letra la calcula el sistema: sos <strong>{condicionNombre(emisor)}</strong>, así que a un responsable inscripto
        le emitís {letraComprobante(emisor, "RI")} y al resto {letraComprobante(emisor, "CF")}.
        Se cambia en Ajustes, en Datos fiscales.
      </p>

      <FormCliente abierto={!!alta} inicial={alta} onCerrar={() => setAlta(null)}
        onGuardar={(d) => {
          if (d.id) setClientes((cs) => cs.map((c) => (c.id === d.id ? { ...c, ...d } : c)));
          else setClientes((cs) => [...cs, { ...d, id: "c" + uid() }]);
          setAlta(null);
          toast(`${d.razonSocial} guardado.`);
        }} />
    </div>
  );
}
