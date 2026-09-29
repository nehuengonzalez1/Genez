/* ============================================================
   AJUSTES · LAS CAJAS DEL COMERCIO (0101)
   ============================================================

   Un mostrador, una caja: cada una se abre, cobra y cierra con su propio
   arqueo, y pueden estar abiertas a la vez. Cada computadora elige una
   vez cuál es (en la pantalla de Caja).

   No se borran: una caja con sesiones es historia. Se desactiva, y deja
   de aparecer para elegir. Crearlas y renombrarlas pide el permiso de
   configurar el comercio, y eso lo controla la base (0101), no esta
   pantalla.
   ============================================================ */

import React, { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { Card, Boton } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { cargarCajas, crearCaja, editarCaja } from "../datos/caja.js";
import { qrMercadoPago } from "../datos/mercadopago.js";
import { crearSucursal, editarSucursal } from "../datos/sucursales.js";

export function CajasDelComercio({ empresaId, toast, alCambiar, sucursales = [] }) {
  const [cajas, setCajas] = useState(null);
  const [nueva, setNueva] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const leer = useCallback(async () => {
    try { setCajas(await cargarCajas(empresaId)); } catch (e) { toast(e.message || "No se pudieron leer las cajas.", "mal"); }
  }, [empresaId, toast]);
  useEffect(() => { leer(); }, [leer]);

  /* Las cajas de la cuenta de Mercado Pago, para el QR dinámico (0107).
     Sin cuenta conectada (o si Mercado Pago no contesta) no se muestra
     nada: esas cajas cobran con el QR fijo, como siempre. */
  const [cajasMp, setCajasMp] = useState(null);
  useEffect(() => {
    let vivo = true;
    qrMercadoPago("cajas", {}, empresaId).then((r) => vivo && setCajasMp(r.cajas || [])).catch(() => vivo && setCajasMp(null));
    return () => { vivo = false; };
  }, [empresaId]);

  const hacer = async (fn, exito) => {
    setOcupado(true);
    try {
      await fn();
      await leer();
      if (alCambiar) await alCambiar();
      if (exito) toast(exito);
      return true;
    } catch (e) {
      toast(e.message || "No se pudo guardar.", "mal");
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const activas = (cajas || []).filter((c) => c.activa);

  return (
    <Card className="p-5">
      <h3 className="f-d text-lg">Cajas</h3>
      <p className="text-sm text-texto-suave mt-1">
        Una por mostrador. Cada una tiene su propio arqueo y pueden estar abiertas a la vez. En cada computadora se elige una vez cuál es.
      </p>

      {!cajas ? (
        <p className="text-sm text-texto-tenue mt-3">Cargando…</p>
      ) : (
        <ul className="mt-3 divide-y divide-borde border border-borde rounded-lg">
          {cajas.map((c) => (
            <FilaCaja key={c.id} caja={c} ocupado={ocupado} unicaActiva={c.activa && activas.length === 1} cajasMp={cajasMp}
              sucursales={sucursales.filter((s) => s.activa)}
              elegirSucursal={(sucursalId) => hacer(() => editarCaja(c.id, { sucursalId }), "La caja cambió de sucursal. Lo que venda desde ahora va a esa.")}
              elegirMp={(mpCaja) => hacer(() => editarCaja(c.id, { mpCaja }), mpCaja ? "Esta caja cobra con QR con el monto." : "Esta caja vuelve al QR fijo.")}
              renombrar={(nombre) => hacer(() => editarCaja(c.id, { nombre }), "Caja renombrada.")}
              alternar={() => hacer(() => editarCaja(c.id, { activa: !c.activa }), c.activa ? "Caja desactivada." : "Caja activada.")} />
          ))}
        </ul>
      )}

      <div className="flex gap-2 mt-3">
        <input value={nueva} onChange={(e) => setNueva(e.target.value.slice(0, 40))} placeholder={`Caja ${(cajas || []).length + 1}`}
          className={inputCls} />
        <Boton disabled={ocupado} onClick={async () => {
          const nombre = nueva.trim() || `Caja ${(cajas || []).length + 1}`;
          if (await hacer(() => crearCaja(empresaId, nombre), `"${nombre}" creada. Elegila en la computadora de ese mostrador.`)) setNueva("");
        }}>
          <Plus size={14} /> Agregar
        </Boton>
      </div>
    </Card>
  );
}

function FilaCaja({ caja, ocupado, unicaActiva, renombrar, alternar, cajasMp, elegirMp, sucursales = [], elegirSucursal }) {
  const [nombre, setNombre] = useState(caja.nombre);
  useEffect(() => setNombre(caja.nombre), [caja.nombre]);
  const cambio = nombre.trim() && nombre.trim() !== caja.nombre;
  return (
    <li className="px-3 py-2">
    <div className="flex items-center gap-2">
      <input value={nombre} onChange={(e) => setNombre(e.target.value.slice(0, 40))}
        className={`${inputCls} ${caja.activa ? "" : "opacity-50"}`} />
      {cambio && <Boton size="sm" disabled={ocupado} onClick={() => renombrar(nombre)}>Guardar</Boton>}
      {/* La última activa no se apaga: sin ninguna, no se podría abrir la caja. */}
      <Boton size="sm" variant="ghost" disabled={ocupado || unicaActiva} onClick={alternar}
        title={unicaActiva ? "Es la única activa: sin ella no se podría abrir la caja." : ""}>
        {caja.activa ? "Desactivar" : "Activar"}
      </Boton>
    </div>
    {/* Con una sola sucursal no hay nada que elegir (0108). */}
    {sucursales.length > 1 && (
      <label className="flex items-center gap-2 mt-2 text-xs text-texto-suave">
        <span className="shrink-0">Sucursal</span>
        <select value={caja.sucursalId || ""} disabled={ocupado} onChange={(e) => elegirSucursal(e.target.value)}
          className={`${inputCls} text-xs py-1`}>
          {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </label>
    )}
    {cajasMp && (
      <label className="flex items-center gap-2 mt-2 text-xs text-texto-suave">
        <span className="shrink-0">QR de Mercado Pago</span>
        {/* Solo las que tienen external_id: es como las nombra la API de
            órdenes. Las otras se ven, pero no se pueden elegir. */}
        <select value={caja.mpCaja || ""} disabled={ocupado} onChange={(e) => elegirMp(e.target.value || null)}
          className={`${inputCls} text-xs py-1`}>
          <option value="">QR fijo: el cliente tipea el monto</option>
          {cajasMp.map((m) => (
            <option key={m.id} value={m.externo || ""} disabled={!m.externo}>
              {m.nombre}{m.externo ? " · con el monto de la venta" : " · sin identificador externo, no se puede usar"}
            </option>
          ))}
        </select>
      </label>
    )}
    </li>
  );
}


/* ============================================================
   AJUSTES · LAS SUCURSALES (0108)
   ============================================================

   Un local, una sucursal: su stock, sus cajas y sus ventas. La venta no
   la elige nadie: sale de la caja donde se cobró. Acá se crean, se les
   pone el domicilio (que sale en el ticket cuando hay más de una) y se
   desactivan; no se borran, porque una sucursal con ventas es historia.
   La base no deja apagar la última activa ni una con cajas activas.
   ============================================================ */
export function SucursalesDelComercio({ empresaId, sucursales, toast, alCambiar }) {
  const [nueva, setNueva] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const hacer = async (fn, exito) => {
    setOcupado(true);
    try {
      await fn();
      if (alCambiar) await alCambiar();
      if (exito) toast(exito);
      return true;
    } catch (e) {
      toast(e.message || "No se pudo guardar.", "mal");
      return false;
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Card className="p-5">
      <h3 className="f-d text-lg">Sucursales</h3>
      <p className="text-sm text-texto-suave mt-1">
        Cada local con su stock y sus cajas. Lo que se vende queda en la sucursal de la caja donde se cobró. Con una sola, no cambia nada.
      </p>
      <ul className="mt-3 divide-y divide-borde border border-borde rounded-lg">
        {sucursales.map((s) => (
          <FilaSucursal key={s.id} sucursal={s} ocupado={ocupado}
            guardar={(cambios) => hacer(() => editarSucursal(s.id, cambios), "Sucursal guardada.")}
            alternar={() => hacer(() => editarSucursal(s.id, { activa: !s.activa }), s.activa ? "Sucursal desactivada." : "Sucursal activada.")} />
        ))}
      </ul>
      <div className="flex gap-2 mt-3">
        <input value={nueva} onChange={(e) => setNueva(e.target.value.slice(0, 60))} placeholder="Nombre del local nuevo" className={inputCls} />
        <Boton disabled={ocupado || !nueva.trim()} onClick={async () => {
          if (await hacer(() => crearSucursal(empresaId, { nombre: nueva }), `"${nueva.trim()}" creada. Ahora pasale una caja, o creá una nueva.`)) setNueva("");
        }}>
          <Plus size={14} /> Agregar
        </Boton>
      </div>
    </Card>
  );
}

function FilaSucursal({ sucursal, ocupado, guardar, alternar }) {
  const [nombre, setNombre] = useState(sucursal.nombre);
  const [domicilio, setDomicilio] = useState(sucursal.domicilio);
  useEffect(() => { setNombre(sucursal.nombre); setDomicilio(sucursal.domicilio); }, [sucursal.nombre, sucursal.domicilio]);
  const cambio = nombre.trim() && (nombre.trim() !== sucursal.nombre || domicilio.trim() !== sucursal.domicilio);
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2">
      <input value={nombre} onChange={(e) => setNombre(e.target.value.slice(0, 60))} className={`${inputCls} flex-1 min-w-[8rem] ${sucursal.activa ? "" : "opacity-50"}`} />
      <input value={domicilio} onChange={(e) => setDomicilio(e.target.value.slice(0, 80))} placeholder="Domicilio"
        className={`${inputCls} flex-[2] min-w-[10rem] ${sucursal.activa ? "" : "opacity-50"}`} />
      {cambio && <Boton size="sm" disabled={ocupado} onClick={() => guardar({ nombre, domicilio })}>Guardar</Boton>}
      <Boton size="sm" variant="ghost" disabled={ocupado} onClick={alternar}>{sucursal.activa ? "Desactivar" : "Activar"}</Boton>
    </li>
  );
}
