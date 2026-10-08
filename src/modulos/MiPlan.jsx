/* ============================================================
   MI PLAN · arriba de Ajustes (0130)
   ============================================================

   Lo que los términos prometen dentro del sistema (punto 7 y 8): ver el
   plan, cambiarlo por cualquier otro y darse de baja, todo desde acá y
   tan fácil como contratar (Res. 316/2018 como buena práctica, Ley 24.240
   art. 10 ter). La baja devuelve un código en el momento.

   Solo el dueño cambia o da de baja: el servidor lo verifica igual
   (api/_mi_plan.js); acá se le avisa a los demás en vez de mostrarles
   botones que van a fallar.

   Los comercios de antes de los planes (Super 25, Bar Rivadavia…) no se
   dieron de alta solos y no tienen suscripción: su plan se acordó con
   Genez y se cambia hablando.
   ============================================================ */

import React, { useEffect, useState } from "react";
import { Card, Boton, Modal } from "../ui/Base.jsx";
import { money } from "../utils/helpers.js";
import { cargarTarifasPublicas } from "../datos/tarifas.js";
import { miCuenta, cambiarPlan, darDeBaja } from "../datos/autoservicio.js";
import { Contratar } from "../genez/Prueba.jsx";

const NOMBRE = { start: "Simple", pro: "Pro", empresa: "Empresa", medida: "A medida", completo: "A medida" };
export const NOMBRE_PLAN = NOMBRE;
const QUE_TRAE = {
  start: "Un usuario y un local. Sin factura electrónica.",
  pro: "Factura electrónica ARCA, varios usuarios y sucursales.",
};
const hoyEnBuenosAires = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

/* AAAA-MM-DD (+ días) a "12/10/2026". Como texto: como Date cae al día
   anterior en Buenos Aires. */
function fecha(f, mas = 0) {
  if (!f) return "";
  const d = new Date(`${String(f).slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + mas);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

function Fila({ etiqueta, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-borde last:border-0">
      <span className="text-sm text-texto-suave">{etiqueta}</span>
      <span className="text-sm text-right">{children}</span>
    </div>
  );
}

export function MiPlan({ toast }) {
  const [cuenta, setCuenta] = useState(null);
  const [estado, setEstado] = useState("cargando");
  const [tarifas, setTarifas] = useState(null);
  const [plan, setPlan] = useState(null);
  const [periodo, setPeriodo] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [baja, setBaja] = useState(false);
  const [codigo, setCodigo] = useState(null);

  const leer = () => miCuenta()
    .then((c) => {
      setCuenta(c);
      setEstado("listo");
      if (c && c.suscripcion) { setPlan(c.suscripcion.plan); setPeriodo(c.suscripcion.periodo); }
    })
    .catch(() => setEstado("error"));

  useEffect(() => {
    leer();
    cargarTarifasPublicas().then(setTarifas).catch(() => setTarifas(false));
  }, []);

  if (estado === "cargando") return <Card className="p-5"><h3 className="f-d text-lg">Mi plan</h3><p className="text-sm text-texto-tenue mt-2">Cargando…</p></Card>;
  if (estado === "error" || !cuenta) return null;

  const s = cuenta.suscripcion;
  const esDueno = cuenta.miRol === "dueno";
  const hoy = cuenta.hoy || hoyEnBuenosAires();

  /* Los de antes de los planes. */
  if (!cuenta.autoservicio && !s) {
    return (
      <Card className="p-5">
        <h3 className="f-d text-lg">Mi plan</h3>
        <p className="text-sm text-texto-suave mt-2">
          Tu plan ({NOMBRE[cuenta.plan] || cuenta.plan}) lo acordaste con Genez. Para cambiarlo o darlo de baja, escribinos.
        </p>
      </Card>
    );
  }

  /* Sin suscripción vigente: la prueba, una pendiente o una baja. */
  if (!s || s.estado === "pendiente" || s.estado === "cancelada") {
    const enPrueba = cuenta.pruebaHasta && cuenta.pruebaHasta >= hoy;
    return (
      <Card className="p-5">
        <h3 className="f-d text-lg">Mi plan</h3>
        {s && s.estado === "cancelada" ? (
          <div className="text-sm text-texto-suave mt-2 space-y-1">
            <p>
              Tu suscripción está dada de baja{s.bajaCodigo ? <> (código de baja <span className="f-m text-texto select-all">{s.bajaCodigo}</span>)</> : null}.
              {cuenta.pruebaHasta && cuenta.pruebaHasta >= hoy ? ` Seguís usando el sistema hasta el ${fecha(cuenta.pruebaHasta)}.` : ""}
            </p>
            <p>Tus datos quedan guardados 90 días. Podés volver a contratar cuando quieras.</p>
          </div>
        ) : enPrueba ? (
          <p className="text-sm text-texto-suave mt-2">Estás en la prueba gratis de Pro hasta el {fecha(cuenta.pruebaHasta)}.</p>
        ) : null}
        {esDueno ? (
          <div className="mt-4 pt-4 border-t border-borde"><Contratar cuenta={cuenta} /></div>
        ) : (
          <p className="text-sm text-texto-tenue mt-3">El plan lo contrata el dueño del comercio.</p>
        )}
      </Card>
    );
  }

  /* Una suscripción vigente. */
  const precio = (k) => (tarifas && tarifas.planes ? tarifas.planes[k] : null);
  const meses = (tarifas && tarifas.anualMeses) || 12;
  const igual = plan === s.plan && periodo === s.periodo;
  const nuevoMonto = precio(plan) == null ? null : precio(plan) * (periodo === "anual" ? meses : 1);
  const otroPeriodo = periodo !== s.periodo;
  const congeladoHasta = s.proximoAjuste && s.proximoAjuste > hoy ? s.proximoAjuste : null;
  const puedeArrepentirse = s.autorizadaEn && (Date.now() - new Date(s.autorizadaEn).getTime()) < 10 * 86400000;

  const cambiar = async () => {
    setError(null);
    setOcupado(true);
    try {
      const r = await cambiarPlan({ plan, periodo });
      if (r.link) { window.location.href = r.link; return; }
      toast(`Listo: pasaste a ${NOMBRE[plan]}. El precio nuevo se cobra desde el próximo cobro.`);
      /* El plan cambia los módulos del menú: se recarga para verlos. */
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setError(e.message);
      setOcupado(false);
    }
  };

  const confirmarBaja = async () => {
    setError(null);
    setOcupado(true);
    try {
      const r = await darDeBaja();
      setCodigo(r);
      await leer();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="f-d text-lg">Mi plan</h3>
        <span className={`text-[11px] uppercase tracking-widest font-bold ${s.estado === "activa" && !s.pagoFallidoDesde ? "text-bien" : "text-ojo"}`}>
          {s.pagoFallidoDesde ? "Cobro rechazado" : s.estado === "pausada" ? "Pausada" : "Activa"}
        </span>
      </div>

      <div className="mt-3">
        <Fila etiqueta="Plan"><b>{NOMBRE[s.plan]}</b>, {s.periodo === "anual" ? "anual" : "mensual"}</Fila>
        <Fila etiqueta="Precio"><span className="f-m">{money(s.monto)}</span> / {s.periodo === "anual" ? "año" : "mes"}</Fila>
        {s.proximoCobro && <Fila etiqueta="Próximo cobro">{fecha(s.proximoCobro)}</Fila>}
        {congeladoHasta && <Fila etiqueta="Precio congelado hasta">{fecha(congeladoHasta, -1)}</Fila>}
        {s.montoAnterior && s.ajustadoEn && (
          <Fila etiqueta="Último ajuste por inflación">{fecha(s.ajustadoEn)}: antes <span className="f-m">{money(s.montoAnterior)}</span></Fila>
        )}
        {s.cambio && (
          <Fila etiqueta="Cambio pendiente">
            {NOMBRE[s.cambio.plan]} {s.cambio.periodo}, <span className="f-m">{money(s.cambio.monto)}</span>: falta autorizarlo en Mercado Pago
          </Fila>
        )}
      </div>

      {!esDueno ? (
        <p className="text-sm text-texto-tenue mt-4">El plan lo cambia o lo da de baja el dueño del comercio.</p>
      ) : (
        <>
          <div className="mt-5 text-[11px] uppercase tracking-widest text-texto-suave font-bold">Cambiar de plan</div>
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            {["start", "pro"].map((k) => (
              <button key={k} type="button" onClick={() => setPlan(k)}
                className={`text-left rounded-xl border p-3.5 transition-colors ${plan === k ? "border-acento bg-acento-suave" : "border-borde hover:bg-superficie-2"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{NOMBRE[k]}{k === s.plan ? <span className="text-xs text-texto-tenue font-normal"> · el tuyo</span> : null}</span>
                  <span className="f-m text-sm">{precio(k) != null ? `${money(precio(k))} / mes` : tarifas === null ? "…" : "Consultar"}</span>
                </div>
                <div className="text-xs text-texto-suave mt-1">{QUE_TRAE[k]}</div>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {[["mensual", "Por mes"], ["anual", `Por año: pagás ${meses} meses`]].map(([k, n]) => (
              <button key={k} type="button" onClick={() => setPeriodo(k)}
                className={`text-sm font-semibold rounded-full border px-3.5 py-1.5 ${periodo === k ? "bg-superficie-3 text-texto border-superficie-3" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>
                {n}
              </button>
            ))}
          </div>

          {!igual && (
            <div className="mt-3 rounded-xl border border-borde p-3.5 text-sm space-y-1.5">
              <p>
                Pasás a <b>{NOMBRE[plan]}</b>, {periodo}: <span className="f-m">{nuevoMonto != null ? money(nuevoMonto) : "—"}</span> / {periodo === "anual" ? "año" : "mes"}
                {s.proximoCobro ? `, desde el cobro del ${fecha(s.proximoCobro)}` : ""}. No se cobran diferencias por los días que faltan.
              </p>
              {otroPeriodo && (
                <p className="text-texto-suave">Cambiar a {periodo === "anual" ? "anual" : "mensual"} arma una suscripción nueva: Mercado Pago te va a pedir que la autorices. Hasta entonces sigue la de ahora.</p>
              )}
              {plan === "start" && s.plan !== "start" && (
                <p className="text-texto-suave">Simple es para una sola persona y un local: los demás usuarios se dan de baja y no hay factura electrónica.</p>
              )}
            </div>
          )}
          {error && <p className="text-sm text-mal mt-3" role="alert">{error}</p>}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Boton onClick={cambiar} disabled={igual || ocupado || nuevoMonto == null}>
              {ocupado ? "Cambiando…" : otroPeriodo ? "Seguir en Mercado Pago" : "Cambiar de plan"}
            </Boton>
            <Boton variant="quiet" onClick={() => { setError(null); setCodigo(null); setBaja(true); }}>Dar de baja</Boton>
          </div>
          {puedeArrepentirse && (
            <p className="text-xs text-texto-tenue mt-3">
              Contrataste hace menos de 10 días: si te arrepentiste, te devolvemos todo desde el <a href="/arrepentimiento" target="_blank" rel="noreferrer" className="text-acento hover:underline">botón de arrepentimiento</a>.
            </p>
          )}
        </>
      )}

      <Modal open={baja} onClose={() => !ocupado && setBaja(false)}>
        <div className="p-5 md:p-6">
          {codigo ? (
            <>
              <div className="f-d text-lg">Listo, diste de baja</div>
              <p className="text-sm text-texto-suave mt-2">Tu código de baja es</p>
              <div className="f-m text-2xl font-bold mt-1 select-all">{codigo.codigo}</div>
              <p className="text-sm text-texto-suave mt-3">
                {codigo.hasta ? `Seguís usando el sistema hasta el ${fecha(codigo.hasta)}. ` : ""}No se te va a cobrar nada más. Te lo mandamos también por mail.
              </p>
              <div className="flex justify-end mt-5"><Boton onClick={() => setBaja(false)}>Cerrar</Boton></div>
            </>
          ) : (
            <>
              <div className="f-d text-lg">¿Dar de baja Genez?</div>
              <p className="text-sm text-texto-suave mt-2">
                Se cancela la suscripción en Mercado Pago y no se cobra nada más.
                {s.proximoCobro ? ` Seguís usando el sistema hasta el ${fecha(s.proximoCobro, -1)}, el último día que pagaste.` : ""}
                {" "}Tus datos quedan guardados 90 días por si volvés; después se borran.
              </p>
              {error && <p className="text-sm text-mal mt-3" role="alert">{error}</p>}
              <div className="flex justify-end gap-2 mt-5">
                <Boton variant="quiet" onClick={() => setBaja(false)} disabled={ocupado}>Cancelar</Boton>
                <Boton variant="danger" onClick={confirmarBaja} disabled={ocupado}>{ocupado ? "Dando de baja…" : "Dar de baja"}</Boton>
              </div>
            </>
          )}
        </div>
      </Modal>
    </Card>
  );
}
