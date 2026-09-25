/* ============================================================
   CAJA · VENTAS SIN GUARDAR
   ============================================================

   Lo que este equipo cobró y la base no tiene: ventas que esperan
   internet, y ventas que la base rechazó. Cada una es plata que está en
   el cajón y que el arqueo no ve.

   Antes no había dónde verlas. Una venta rechazada se apartaba en el
   equipo con un solo aviso rojo, y si nadie lo leía quedaba ahí para
   siempre. Pasó en Super 25 el primer día: la pantalla de la caja quedó
   abierta desde la noche anterior, con datos que se habían borrado, y la
   base rechazó tres ventas.

   Reenviar primero repara lo que se puede (`repararVenta`: un cliente o
   un producto que ya no existe, una caja que ya no está) y dice qué
   cambió. Si la base la vuelve a rechazar, queda acá con el motivo nuevo.
   ============================================================ */

import React, { useState, useEffect, useCallback } from "react";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { money, hora, medioPorK } from "../utils/helpers.js";
import { fdatel } from "../datos/generador.js";
import { sinGuardar, reenviar, descartar } from "../datos/cola.js";
import { repararVenta } from "../datos/ventas.js";
import { Boton, Sello } from "../ui/Base.jsx";

/* Lo que dice la base, en palabras del mostrador. Los rechazos que se
   conocen se traducen; el resto se muestra tal cual, que es lo que hay
   que pasarle a quien lo arregle. */
function motivoLegible(m) {
  if (!m) return m;
  if (/operaciones_cliente_id_fkey/.test(m)) return "El cliente de esta venta ya no existe.";
  if (/item_id_fkey/.test(m)) return "Un producto de esta venta ya no existe.";
  if (/sesion_id_fkey/.test(m)) return "La caja de esta venta ya no existe.";
  return m;
}

/* Lo que entró al cajón: el fiado no pasa por ahí. */
const alCajon = (v) => (v.pagos && v.pagos.length
  ? v.pagos.filter((p) => p.medio !== "cuenta_corriente").reduce((s, p) => s + Number(p.monto || 0), 0)
  : Number(v.total || 0));

export function VentasSinGuardar({ empresaId, ajustes, toast, sesionAbiertaId = null, onGuardadas = null }) {
  const [lista, setLista] = useState(() => sinGuardar().filter((x) => x.venta.empresa_id === empresaId));
  const [enviando, setEnviando] = useState(null);   // id, o "todas"
  const [notas, setNotas] = useState({});          // id → lo que pasó al reenviar
  const [confirmando, setConfirmando] = useState(null);   // id de la que se va a quitar

  const releer = useCallback(() => setLista(sinGuardar().filter((x) => x.venta.empresa_id === empresaId)), [empresaId]);
  /* La cola se vacía sola cuando vuelve internet (vigilarCola, en
     Sistema); se relee cada tanto para que lo que entró deje de verse. */
  useEffect(() => { const t = setInterval(releer, 15000); return () => clearInterval(t); }, [releer]);

  const mandarUna = async (x) => {
    const { venta, cambios, bloqueo } = await repararVenta(x.venta, sesionAbiertaId);
    if (bloqueo) throw new Error(bloqueo);
    await reenviar(venta);
    return { cambios, fiscal: !!(venta.comprobante && venta.comprobante.fiscal) };
  };

  const una = async (x) => {
    setEnviando(x.venta.id);
    try {
      const r = await mandarUna(x);
      toast(`La venta ${x.venta.numero} quedó guardada.${r.cambios.length ? ` ${r.cambios.join(" ")}` : ""}`);
      setNotas((n) => { const c = { ...n }; delete c[x.venta.id]; return c; });
      if (onGuardadas) onGuardadas({ fiscal: r.fiscal });
    } catch (e) {
      setNotas((n) => ({ ...n, [x.venta.id]: e.message }));
    } finally {
      setEnviando(null);
      releer();
    }
  };

  const todas = async () => {
    setEnviando("todas");
    let bien = 0, fiscal = false;
    const fallas = {};
    for (const x of lista) {
      try { const r = await mandarUna(x); bien++; fiscal = fiscal || r.fiscal; }
      catch (e) { fallas[x.venta.id] = e.message; }
    }
    setNotas(fallas);
    setEnviando(null);
    releer();
    if (bien) {
      toast(bien === 1 ? "Se guardó 1 venta." : `Se guardaron ${bien} ventas.`);
      if (onGuardadas) onGuardadas({ fiscal });
    }
    const quedan = Object.keys(fallas).length;
    if (quedan) toast(quedan === 1 ? "Una venta no se pudo guardar: mirá el motivo." : `${quedan} ventas no se pudieron guardar: mirá el motivo de cada una.`, "mal");
  };

  if (!lista.length) return null;
  const enCajon = lista.reduce((s, x) => s + alCajon(x.venta), 0);

  return (
    <div className="bg-superficie border border-ojo rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-borde bg-ojo-suave">
        <div className="flex items-start gap-3 min-w-0">
          <AlertTriangle size={18} className="text-ojo shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="f-d text-lg">{lista.length === 1 ? "1 venta sin guardar" : `${lista.length} ventas sin guardar`}</h3>
            <p className="text-sm text-texto-suave mt-0.5">
              Se cobraron en esta computadora pero no están en la base: la caja no las cuenta.{enCajon > 0 && <> Son <span className="f-m">{money(enCajon)}</span> que están en el cajón.</>}
            </p>
          </div>
        </div>
        <Boton onClick={todas} disabled={!!enviando}>
          <RefreshCw size={15} className={enviando === "todas" ? "animate-spin" : ""} /> {enviando === "todas" ? "Guardando…" : "Guardar todas"}
        </Boton>
      </div>
      <ul className="divide-y divide-borde">
        {lista.map((x) => {
          const v = x.venta;
          const f = new Date(v.fecha);
          const medios = [...new Set((v.pagos || []).map((p) => medioPorK(ajustes, p.medio).n))].join(" + ");
          const nota = notas[v.id];
          return (
            <li key={v.id} className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="f-m font-semibold">{v.numero}</span>
                  <span className="f-m text-texto-suave">{fdatel(f)} {hora(f)}</span>
                  {x.rechazada
                    ? <Sello tono="mal">Rechazada</Sello>
                    : <Sello tono="ojo"><WifiOff size={10} className="inline -mt-0.5 mr-1" />Esperando internet</Sello>}
                  {v.comprobante && v.comprobante.fiscal && <Sello>Factura</Sello>}
                </div>
                <div className="text-xs text-texto-tenue mt-0.5 truncate">
                  {(v.lineas || []).map((l) => l.descripcion).join(", ")}{medios ? ` · ${medios}` : ""}
                </div>
                {(nota || x.motivo) && (
                  <div className="text-xs text-mal mt-1">{motivoLegible(nota || x.motivo)}</div>
                )}
                {/* Solo para una rechazada: una que espera internet entra sola. */}
                {x.rechazada && (confirmando === v.id ? (
                  <div className="text-xs mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-texto-suave">¿Ya la cobraste de nuevo? Sale de la lista y no se guarda.</span>
                    <button onClick={() => { descartar(v.id); setConfirmando(null); releer(); toast(`La venta ${v.numero} salió de la lista.`); }}
                      className="font-semibold text-mal hover:underline">Sí, quitarla</button>
                    <button onClick={() => setConfirmando(null)} className="font-semibold text-texto-suave hover:underline">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmando(v.id)} className="text-xs text-texto-tenue hover:text-texto mt-1.5 hover:underline">
                    Quitar de la lista
                  </button>
                ))}
              </div>
              <span className="f-m text-sm font-semibold">{money(v.total)}</span>
              <Boton size="sm" variant="ghost" onClick={() => una(x)} disabled={!!enviando}>
                <RefreshCw size={13} className={enviando === v.id ? "animate-spin" : ""} /> {enviando === v.id ? "Guardando…" : "Guardar"}
              </Boton>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
