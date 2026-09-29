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

export function CajasDelComercio({ empresaId, toast, alCambiar }) {
  const [cajas, setCajas] = useState(null);
  const [nueva, setNueva] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const leer = useCallback(async () => {
    try { setCajas(await cargarCajas(empresaId)); } catch (e) { toast(e.message || "No se pudieron leer las cajas.", "mal"); }
  }, [empresaId, toast]);
  useEffect(() => { leer(); }, [leer]);

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
            <FilaCaja key={c.id} caja={c} ocupado={ocupado} unicaActiva={c.activa && activas.length === 1}
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

function FilaCaja({ caja, ocupado, unicaActiva, renombrar, alternar }) {
  const [nombre, setNombre] = useState(caja.nombre);
  useEffect(() => setNombre(caja.nombre), [caja.nombre]);
  const cambio = nombre.trim() && nombre.trim() !== caja.nombre;
  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <input value={nombre} onChange={(e) => setNombre(e.target.value.slice(0, 40))}
        className={`${inputCls} ${caja.activa ? "" : "opacity-50"}`} />
      {cambio && <Boton size="sm" disabled={ocupado} onClick={() => renombrar(nombre)}>Guardar</Boton>}
      {/* La última activa no se apaga: sin ninguna, no se podría abrir la caja. */}
      <Boton size="sm" variant="ghost" disabled={ocupado || unicaActiva} onClick={alternar}
        title={unicaActiva ? "Es la única activa: sin ella no se podría abrir la caja." : ""}>
        {caja.activa ? "Desactivar" : "Activar"}
      </Boton>
    </li>
  );
}
