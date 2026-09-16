/* ============================================================
   PRESUPUESTOS · cotizar sin vender (#29)
   ============================================================

   Convertir a venta reutiliza armarVenta()/registrarVenta() — las mismas
   funciones que ya usa el cobro real del POS — así una conversión pasa
   por el mismo confirmar_operacion de siempre en vez de reinventar cómo
   se descuenta stock o se cobra. Por eso este módulo no toca Vender.jsx:
   arma su propio carrito, más simple, solo para cotizar.
   ============================================================ */

import React, { useMemo, useState } from "react";
import { Plus, X, Search, Trash2, FileText, MessageCircle, ArrowRightLeft, Clock } from "lucide-react";
import { money, pct, precioAplicado, mediosDe, medioPorK, FISCAL_INICIAL, linkWhatsapp } from "../utils/helpers.js";
import { fdate } from "../datos/generador.js";
import { Card, Boton, Modal, Vacio, Cargando } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";
import { BuscarCliente } from "./Vender.jsx";
import { cargarPresupuestos, crearPresupuesto, marcarConvertido } from "../datos/presupuestos.js";
import { armarVenta, registrarVenta, siguienteNumero } from "../datos/ventas.js";
import { cargarProductos } from "../datos/items.js";

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const vencido = (p) => p.validoHasta && new Date(p.validoHasta + "T23:59:59") < new Date();

export function Presupuestos({ empresaId, sucursalId, productos, setProductos, clientes, guardarCliente, ajustes, toast, sesionId }) {
  const [lista, setLista] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState(false);
  const [abierto, setAbierto] = useState(null);

  React.useEffect(() => {
    if (!empresaId) return;
    let vigente = true;
    cargarPresupuestos(empresaId).then((l) => { if (vigente) { setLista(l); setCargando(false); } })
      .catch((e) => { toast(e.message || "No se pudieron cargar los presupuestos.", "mal"); setCargando(false); });
    return () => { vigente = false; };
  }, [empresaId]);

  const refrescar = async () => {
    const l = await cargarPresupuestos(empresaId);
    setLista(l);
    if (abierto) setAbierto(l.find((p) => p.id === abierto.id) || null);
  };

  const pendientes = (lista || []).filter((p) => p.estado === "pendiente");
  const otros = (lista || []).filter((p) => p.estado !== "pendiente");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="f-d text-xl">Presupuestos</h2>
          <p className="text-sm text-texto-suave mt-0.5">Cotizar sin vender: se convierte en venta recién cuando el cliente confirma.</p>
        </div>
        <Boton onClick={() => setNuevo(true)}><Plus size={15} /> Nuevo presupuesto</Boton>
      </div>

      {cargando && <Cargando />}
      {!cargando && !(lista || []).length && (
        <Vacio>
          <FileText size={28} className="mx-auto mb-2 text-texto-tenue" />
          Todavía no hay presupuestos. Armá uno con "Nuevo presupuesto".
        </Vacio>
      )}

      {!!pendientes.length && (
        <Card className="divide-y divide-borde overflow-hidden">
          {pendientes.map((p) => <FilaPresupuesto key={p.id} p={p} onClick={() => setAbierto(p)} />)}
        </Card>
      )}
      {!!otros.length && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-2">Convertidos</div>
          <Card className="divide-y divide-borde overflow-hidden opacity-70">
            {otros.map((p) => <FilaPresupuesto key={p.id} p={p} onClick={() => setAbierto(p)} />)}
          </Card>
        </div>
      )}

      {nuevo && (
        <NuevoPresupuesto productos={productos} clientes={clientes} guardarCliente={guardarCliente} ajustes={ajustes}
          onClose={() => setNuevo(false)}
          onGuardar={async (datos) => {
            try {
              await crearPresupuesto({ empresaId, sucursalId, ...datos });
              toast("Presupuesto guardado.");
              setNuevo(false);
              refrescar();
            } catch (e) { toast(e.message || "No se pudo guardar el presupuesto.", "mal"); }
          }} />
      )}

      {abierto && (
        <VerPresupuesto p={abierto} onClose={() => setAbierto(null)}
          onConvertido={async () => { await refrescar(); const fresh = await cargarProductos(empresaId); setProductos(fresh); }}
          empresaId={empresaId} sucursalId={sucursalId} ajustes={ajustes} toast={toast} sesionId={sesionId} />
      )}
    </div>
  );
}

function FilaPresupuesto({ p, onClick }) {
  const venc = vencido(p);
  return (
    <button onClick={onClick} className="w-full text-left px-4 py-3 hover:bg-superficie-2 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{p.clienteNombre || "Consumidor final"}</div>
        <div className="text-[11px] text-texto-tenue">
          {fdate(p.fecha)} · {p.lineas.length} línea{p.lineas.length === 1 ? "" : "s"}
          {p.estado === "pendiente" && p.validoHasta && (
            <span className={venc ? " text-mal" : ""}> · {venc ? "venció" : "vale hasta"} {p.validoHasta}</span>
          )}
          {p.estado === "convertido" && " · convertido a venta"}
        </div>
      </div>
      <span className="f-m text-sm font-semibold shrink-0">{money(p.total)}</span>
    </button>
  );
}

function NuevoPresupuesto({ productos, clientes, guardarCliente, ajustes, onClose, onGuardar }) {
  const [q, setQ] = useState("");
  const [lineas, setLineas] = useState([]);
  const [cliente, setCliente] = useState(null);
  const [buscarCliente, setBuscarCliente] = useState(false);
  const [dias, setDias] = useState(15);
  const [guardando, setGuardando] = useState(false);

  const candidatos = useMemo(() => {
    if (q.trim().length < 2) return [];
    const t = norm(q.trim());
    return productos.filter((p) => p.activo !== false && norm(p.nombre).includes(t) && !lineas.some((l) => l.itemId === p.id)).slice(0, 6);
  }, [q, productos, lineas]);

  const agregar = (p) => {
    const { precio } = precioAplicado(p, 1, ajustes);
    setLineas((ls) => [...ls, { itemId: p.id, descripcion: p.nombre, cantidad: 1, precioUnitario: precio, unidad: p.unidad }]);
    setQ("");
  };
  const cambiarCantidad = (itemId, cantidad) => setLineas((ls) => ls.map((l) => {
    if (l.itemId !== itemId) return l;
    const p = productos.find((x) => x.id === itemId);
    const { precio } = precioAplicado(p, Number(cantidad) || 0, ajustes);
    return { ...l, cantidad, precioUnitario: precio };
  }));
  const quitar = (itemId) => setLineas((ls) => ls.filter((l) => l.itemId !== itemId));

  const total = lineas.reduce((s, l) => s + Number(l.cantidad || 0) * l.precioUnitario, 0);

  const guardar = async () => {
    setGuardando(true);
    const validoHasta = dias ? new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10) : null;
    await onGuardar({
      clienteId: cliente ? cliente.id : null,
      validoHasta,
      lineas: lineas.map((l) => ({ ...l, cantidad: Number(l.cantidad) || 0 })).filter((l) => l.cantidad > 0),
    });
    setGuardando(false);
  };

  return (
    <Modal open onClose={onClose} ancho="max-w-lg">
      <div className="sticky top-0 bg-superficie border-b border-borde px-5 py-3.5 flex items-center justify-between">
        <h3 className="f-d text-lg">Nuevo presupuesto</h3>
        <button onClick={onClose} className="text-texto-tenue hover:text-texto"><X size={18} /></button>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <span className="text-[11px] text-texto-suave">Para</span>
          <button onClick={() => setBuscarCliente(true)}
            className="w-full text-left border border-borde rounded-lg px-3 py-2 text-sm mt-0.5 hover:bg-superficie-2">
            {cliente ? cliente.razonSocial : "Consumidor final · tocá para elegir"}
          </button>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-2">Productos</div>
          {lineas.length === 0 && <p className="text-sm text-texto-tenue">Todavía no agregaste nada.</p>}
          <ul className="space-y-2">
            {lineas.map((l) => (
              <li key={l.itemId} className="flex items-center gap-2">
                <span className="text-sm flex-1 min-w-0 truncate">{l.descripcion}</span>
                <input value={l.cantidad} onChange={(e) => cambiarCantidad(l.itemId, e.target.value.replace(/[^\d.]/g, ""))}
                  className={`${inputCls} !w-16 text-right`} />
                <span className="f-m text-sm w-20 text-right shrink-0">{money(l.precioUnitario)}</span>
                <button onClick={() => quitar(l.itemId)} className="text-texto-tenue hover:text-mal shrink-0"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
          <div className="relative mt-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un producto…"
              className={`${inputCls} pl-8`} />
            {candidatos.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 mt-1 bg-superficie border border-borde rounded-xl shadow-sm overflow-hidden">
                {candidatos.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => agregar(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-superficie-2 flex justify-between">
                      <span>{p.nombre}</span><span className="text-texto-tenue">{money(p.precio)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <Campo label="Vale por">
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className={inputCls}>
            <option value={7}>7 días</option>
            <option value={15}>15 días</option>
            <option value={30}>30 días</option>
            <option value={0}>Sin vencimiento</option>
          </select>
        </Campo>

        <div className="flex items-center justify-between border-t border-borde pt-4">
          <span className="text-sm text-texto-suave">Total</span>
          <span className="f-d text-xl">{money(total)}</span>
        </div>

        <Boton className="w-full" disabled={!lineas.length || guardando} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar presupuesto"}
        </Boton>
      </div>

      {buscarCliente && (
        <BuscarCliente clientes={clientes} onCerrar={() => setBuscarCliente(false)}
          onElegir={(c) => { setCliente(c); setBuscarCliente(false); }}
          onCrear={async (d) => {
            const c = await guardarCliente(d);
            if (!c) return;
            setCliente(c);
            setBuscarCliente(false);
          }} />
      )}
    </Modal>
  );
}

function VerPresupuesto({ p, onClose, onConvertido, empresaId, sucursalId, ajustes, toast, sesionId }) {
  const [convirtiendo, setConvirtiendo] = useState(false);
  const venc = vencido(p);

  const textoWhatsapp = () => {
    const lineas = p.lineas.map((l) => `• ${l.cantidad} ${l.descripcion} — ${money(l.total)}`).join("\n");
    return `Presupuesto${p.validoHasta ? ` (vale hasta ${p.validoHasta})` : ""}:\n\n${lineas}\n\nTotal: ${money(p.total)}`;
  };
  const linkWa = p.clienteTelefono ? linkWhatsapp(p.clienteTelefono, textoWhatsapp()) : null;

  return (
    <Modal open onClose={onClose} ancho="max-w-lg">
      <div className="sticky top-0 bg-superficie border-b border-borde px-5 py-3.5 flex items-center justify-between">
        <div>
          <h3 className="f-d text-lg">{p.clienteNombre || "Consumidor final"}</h3>
          <div className="text-[11px] text-texto-tenue">{fdate(p.fecha)}</div>
        </div>
        <button onClick={onClose} className="text-texto-tenue hover:text-texto"><X size={18} /></button>
      </div>

      <div className="p-5 space-y-4">
        {p.estado === "pendiente" && p.validoHasta && (
          <div className={`flex items-center gap-2 text-sm rounded-xl border px-3 py-2 ${venc ? "border-mal bg-mal-suave text-mal" : "border-borde bg-superficie-2 text-texto-suave"}`}>
            <Clock size={14} /> {venc ? "Venció el" : "Vale hasta el"} {p.validoHasta}
          </div>
        )}

        <ul className="divide-y divide-borde border border-borde rounded-xl overflow-hidden">
          {p.lineas.map((l, i) => (
            <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{l.cantidad} × {l.descripcion}</span>
              <span className="f-m">{money(l.total)}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between">
          <span className="text-sm text-texto-suave">Total</span>
          <span className="f-d text-xl">{money(p.total)}</span>
        </div>

        <div className="flex gap-2">
          {linkWa && (
            <Boton variant="ghost" className="flex-1" onClick={() => window.open(linkWa, "_blank")}>
              <MessageCircle size={15} /> Enviar por WhatsApp
            </Boton>
          )}
          {p.estado === "pendiente" && (
            <Boton className="flex-1" onClick={() => setConvirtiendo(true)}>
              <ArrowRightLeft size={15} /> Convertir a venta
            </Boton>
          )}
        </div>
      </div>

      {convirtiendo && (
        <ConvertirAVenta p={p} empresaId={empresaId} sucursalId={sucursalId} ajustes={ajustes} toast={toast} sesionId={sesionId}
          onClose={() => setConvirtiendo(false)}
          onConvertido={async () => { setConvirtiendo(false); onClose(); await onConvertido(); }} />
      )}
    </Modal>
  );
}

function ConvertirAVenta({ p, empresaId, sucursalId, ajustes, toast, sesionId, onClose, onConvertido }) {
  const [lineas, setLineas] = useState(p.lineas.map((l) => ({ ...l })));
  const [medio, setMedio] = useState((mediosDe(ajustes)[0] || {}).k || "efectivo");
  const [guardando, setGuardando] = useState(false);

  const cambiarCantidad = (i, cantidad) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, cantidad } : l)));
  const quitar = (i) => setLineas((ls) => ls.filter((_, j) => j !== i));
  const total = lineas.reduce((s, l) => s + Number(l.cantidad || 0) * l.precioUnitario, 0);

  const confirmar = async () => {
    if (!sesionId) return toast("Abrí la caja antes de convertir un presupuesto en venta.", "mal");
    const validas = lineas.filter((l) => Number(l.cantidad) > 0);
    if (!validas.length) return toast("No queda ninguna línea para vender.", "mal");

    setGuardando(true);
    try {
      const items = validas.map((l) => ({ pid: l.itemId, qty: Number(l.cantidad), precio: l.precioUnitario, costo: 0, nombre: l.descripcion }));
      const nro = siguienteNumero(empresaId, (ajustes.fiscal || FISCAL_INICIAL).puntoVenta || "0001");
      const venta = armarVenta({
        empresaId, sucursalId, sesionId, numero: nro, items,
        sub: total, desc: 0, recargo: 0, total,
        pagos: [{ medio, monto: total }],
        cliente: p.clienteId ? { id: p.clienteId } : null,
        comprobante: { origenPresupuesto: p.id },
      });
      await registrarVenta(venta);
      await marcarConvertido(p.id);
      toast(`Convertido en la venta ${nro}.`);
      await onConvertido();
    } catch (e) {
      toast(e.message || "No se pudo convertir el presupuesto.", "mal");
    }
    setGuardando(false);
  };

  return (
    <Modal open onClose={onClose} ancho="max-w-md">
      <div className="sticky top-0 bg-superficie border-b border-borde px-5 py-3.5 flex items-center justify-between">
        <h3 className="f-d text-lg">Convertir en venta</h3>
        <button onClick={onClose} className="text-texto-tenue hover:text-texto"><X size={18} /></button>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-xs text-texto-suave">Sacá lo que no se lleva hoy: el presupuesto sigue como cotización, esto genera una venta real con lo que quede.</p>
        <ul className="space-y-2">
          {lineas.map((l, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-sm flex-1 min-w-0 truncate">{l.descripcion}</span>
              <input value={l.cantidad} onChange={(e) => cambiarCantidad(i, e.target.value.replace(/[^\d.]/g, ""))}
                className={`${inputCls} !w-16 text-right`} />
              <button onClick={() => quitar(i)} className="text-texto-tenue hover:text-mal shrink-0"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
        <Campo label="Medio de pago">
          <select value={medio} onChange={(e) => setMedio(e.target.value)} className={inputCls}>
            {mediosDe(ajustes).map((m) => <option key={m.k} value={m.k}>{m.n}</option>)}
          </select>
        </Campo>
        <div className="flex items-center justify-between border-t border-borde pt-4">
          <span className="text-sm text-texto-suave">Total a cobrar</span>
          <span className="f-d text-xl">{money(total)}</span>
        </div>
        <Boton className="w-full" disabled={guardando} onClick={confirmar}>
          {guardando ? "Confirmando…" : `Cobrar ${money(total)} y convertir`}
        </Boton>
      </div>
    </Modal>
  );
}
