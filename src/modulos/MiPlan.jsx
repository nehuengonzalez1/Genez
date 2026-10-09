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
   Genez. Desde el 08/10 igual pueden pasar solos a Simple o a Pro: es
   contratar la suscripción, como cualquiera. Lo único que se habla es A
   medida.

   CÓMO SE VE (08/10)
   ------------------
   Nehuen: "que te diga qué plan tenés contratado y que te dé la opción de
   cambiar a otro de una manera rápida". Antes eran renglones y, abajo,
   un selector de plan que había que elegir y después confirmar con otro
   botón; a un comercio de antes le decía solo "escribinos".

   Ahora arriba va el plan que tenés, grande, con su estado y lo que
   pagás. Abajo, los planes uno al lado del otro, cada uno con su botón:
   "Pasar a Pro" abre la confirmación con el precio y desde cuándo, y con
   un toque más queda. Lo que cada comercio puede hacer con ese botón
   depende de cómo contrató:
     - con suscripción: se cambia en el momento, sin que nadie lo
       apruebe. El servidor cambia el monto en Mercado Pago, el plan y los
       módulos (api/_mi_plan.js). Solo pasar de mensual a anual (o al
       revés) pide autorizar en MP, porque MP no cambia la frecuencia de
       una suscripción: lo autoriza el mismo comercio;
     - en la prueba, sin suscripción o de antes de los planes: se
       contrata ese plan, también solo.
   Nehuen (08/10): "entre el Simple y el Pro que sea autoservicio; el que
   tiene que hablar conmigo es el que quiere un plan a medida". A medida
   es lo único que va por WhatsApp: no tiene precio fijo.
   ============================================================ */

import React, { useEffect, useState } from "react";
import { Check, MessageCircle, ArrowRight } from "lucide-react";
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
/* Lo que se muestra de cada plan en su tarjeta. */
const PLANES = [
  { k: "start", trae: ["Un usuario y un local", "Lo esencial para vender y cobrar", "Sin factura electrónica"] },
  { k: "pro", trae: ["Factura electrónica ARCA", "Varios usuarios y sucursales", "Asistente con IA"] },
  { k: "medida", trae: ["Los módulos que necesites", "Las sucursales que tengas", "Un precio armado para vos"] },
];
const esMedida = (k) => k === "medida" || k === "completo" || k === "empresa";
const rotulo = "text-[11px] uppercase tracking-[0.1em] font-bold";
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
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-borde last:border-0">
      <span className="text-sm text-texto-suave">{etiqueta}</span>
      <span className="text-sm text-right">{children}</span>
    </div>
  );
}

const whatsappA = (numero, texto) => (numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null);

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
  /* El plan al que se quiere pasar: abre la confirmación (o el contratar). */
  const [pasarA, setPasarA] = useState(null);

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

  if (estado === "cargando") return <Card className="p-6"><div className={`${rotulo} text-texto-tenue`}>Tu plan</div><p className="text-sm text-texto-tenue mt-2">Cargando…</p></Card>;
  if (estado === "error" || !cuenta) return null;

  const s = cuenta.suscripcion;
  const esDueno = cuenta.miRol === "dueno";
  const hoy = cuenta.hoy || hoyEnBuenosAires();
  const vigente = s && s.estado !== "pendiente" && s.estado !== "cancelada";
  const enPrueba = !vigente && cuenta.pruebaHasta && cuenta.pruebaHasta >= hoy;
  /* Cómo se cambia el plan de este comercio (ver arriba). */
  const modo = vigente ? "suscripcion" : "contratar";
  /* De antes de los planes: el plan se acordó con Genez y se cobra por
     fuera. Puede pasar solo a Simple o a Pro igual (es contratar). */
  const acordado = !vigente && !cuenta.autoservicio && !s;
  const actual = vigente ? s.plan : cuenta.plan;

  const precio = (k) => (tarifas && tarifas.planes ? tarifas.planes[k] : null);
  const meses = (tarifas && tarifas.anualMeses) || 12;
  const whatsapp = tarifas && tarifas.whatsapp;

  const igual = vigente && plan === s.plan && periodo === s.periodo;
  const nuevoMonto = precio(plan) == null ? null : precio(plan) * (periodo === "anual" ? meses : 1);
  const otroPeriodo = vigente && periodo !== s.periodo;
  const congeladoHasta = vigente && s.proximoAjuste && s.proximoAjuste > hoy ? s.proximoAjuste : null;
  const puedeArrepentirse = vigente && s.autorizadaEn && (Date.now() - new Date(s.autorizadaEn).getTime()) < 10 * 86400000;

  /* El estado, en una palabra y un color. */
  const sello = vigente
    ? (s.pagoFallidoDesde ? ["Cobro rechazado", "text-ojo"] : s.estado === "pausada" ? ["Pausada", "text-ojo"] : ["Activa", "text-bien"])
    : s && s.estado === "cancelada" ? ["Dada de baja", "text-texto-tenue"]
    : enPrueba ? ["Prueba gratis", "text-acento"]
    : acordado ? ["Acordado con Genez", "text-texto-suave"]
    : ["Sin contratar", "text-ojo"];

  const abrir = (k) => {
    setError(null);
    if (modo === "suscripcion") { setPlan(k); setPeriodo(s.periodo); }
    setPasarA(k);
  };

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

  /* El botón de cada tarjeta. */
  const accion = (k) => {
    if (k === actual || (esMedida(k) && esMedida(actual))) return null;
    if (!esDueno) return null;
    if (esMedida(k)) {
      const href = whatsappA(whatsapp, `Hola, soy de ${cuenta.nombre}. Quiero armar un plan a medida.`);
      return href
        ? <a href={href} target="_blank" rel="noopener noreferrer" data-plan-accion={k}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-borde bg-superficie px-4 py-2.5 text-sm font-semibold hover:bg-superficie-2">
            <MessageCircle size={15} /> Hablemos
          </a>
        : <p className="mt-4 text-xs text-texto-tenue text-center">Escribinos para armarlo.</p>;
    }
    return (
      <button type="button" data-plan-accion={k} onClick={() => abrir(k)}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-acento text-sobre-acento px-4 py-2.5 text-sm font-semibold hover:bg-acento-vivo">
        {modo === "suscripcion" ? `Pasar a ${NOMBRE[k]}` : `Elegir ${NOMBRE[k]}`} <ArrowRight size={15} />
      </button>
    );
  };

  return (
    <div className="space-y-5">
      {/* EL PLAN QUE TENÉS */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className={`${rotulo} text-texto-tenue`}>Tu plan</div>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="f-d text-3xl" data-plan-actual={actual}>{NOMBRE[actual] || actual || "—"}</span>
              <span className={`${rotulo} ${sello[1]}`}>{sello[0]}</span>
            </div>
            {!esMedida(actual) && QUE_TRAE[actual] && <p className="text-sm text-texto-suave mt-1.5">{QUE_TRAE[actual]}</p>}
          </div>
          {vigente && (
            <div className="text-right">
              <div className="f-m text-2xl font-semibold">{money(s.monto)}</div>
              <div className="text-xs text-texto-tenue">por {s.periodo === "anual" ? "año" : "mes"}</div>
            </div>
          )}
        </div>

        <div className="mt-4">
          {vigente && s.proximoCobro && <Fila etiqueta="Próximo cobro">{fecha(s.proximoCobro)}</Fila>}
          {vigente && <Fila etiqueta="Se paga">{s.periodo === "anual" ? "Una vez por año" : "Todos los meses"}, con Mercado Pago</Fila>}
          {congeladoHasta && <Fila etiqueta="Precio congelado hasta">{fecha(congeladoHasta, -1)}</Fila>}
          {vigente && s.montoAnterior && s.ajustadoEn && (
            <Fila etiqueta="Último ajuste por inflación">{fecha(s.ajustadoEn)}: antes <span className="f-m">{money(s.montoAnterior)}</span></Fila>
          )}
          {vigente && s.cambio && (
            <Fila etiqueta="Cambio pendiente">
              {NOMBRE[s.cambio.plan]} {s.cambio.periodo}, <span className="f-m">{money(s.cambio.monto)}</span>: falta autorizarlo en Mercado Pago
            </Fila>
          )}
          {enPrueba && <Fila etiqueta="Prueba gratis">hasta el {fecha(cuenta.pruebaHasta)}</Fila>}
          {s && s.estado === "cancelada" && (
            <Fila etiqueta="Baja">
              {s.bajaCodigo ? <>código <span className="f-m text-texto select-all">{s.bajaCodigo}</span></> : "hecha"}
              {cuenta.pruebaHasta && cuenta.pruebaHasta >= hoy ? `, usás el sistema hasta el ${fecha(cuenta.pruebaHasta)}` : ""}
            </Fila>
          )}
          {acordado && <Fila etiqueta="Cómo se paga">Lo acordaste con Genez</Fila>}
        </div>

        {!esDueno && <p className="text-sm text-texto-tenue mt-4">El plan lo cambia o lo da de baja el dueño del comercio.</p>}
        {s && s.estado === "cancelada" && <p className="text-sm text-texto-suave mt-4">Tus datos quedan guardados 90 días. Podés volver a contratar cuando quieras.</p>}
      </Card>

      {/* LOS PLANES, PARA CAMBIAR */}
      <div>
        <div className={`${rotulo} text-texto-tenue mb-3`}>{modo === "contratar" ? "Elegí tu plan" : "Cambiar de plan"}</div>
        <div className="grid md:grid-cols-3 gap-3">
          {PLANES.map((p) => {
            const tuyo = p.k === actual || (esMedida(p.k) && esMedida(actual));
            return (
              <Card key={p.k} className={`p-5 flex flex-col ${tuyo ? "border-acento" : ""}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="f-d text-lg">{NOMBRE[p.k]}</span>
                  {tuyo && <span className={`${rotulo} text-acento`}>El tuyo</span>}
                </div>
                <div className="mt-1">
                  {esMedida(p.k)
                    ? <span className="text-sm text-texto-suave">Precio a convenir</span>
                    : precio(p.k) != null
                      ? <><span className="f-m text-xl font-semibold">{money(precio(p.k))}</span> <span className="text-xs text-texto-tenue">/ mes</span></>
                      : <span className="text-sm text-texto-tenue">{tarifas === null ? "…" : "Consultar"}</span>}
                </div>
                <ul className="mt-3 space-y-1.5 flex-1">
                  {p.trae.map((t) => (
                    <li key={t} className="flex items-start gap-2 text-sm text-texto-suave"><Check size={14} className="text-acento shrink-0 mt-0.5" /> {t}</li>
                  ))}
                </ul>
                {tuyo ? <div className="mt-4 text-center text-xs text-texto-tenue py-2.5">Es el que tenés</div> : accion(p.k)}
              </Card>
            );
          })}
        </div>
        {modo === "suscripcion" && esDueno && (
          <p className="text-xs text-texto-tenue mt-3">El cambio es en el momento: el plan nuevo rige ya, y su precio se cobra desde el próximo cobro, sin diferencias por los días que faltan.</p>
        )}
        {acordado && esDueno && (
          <p className="text-xs text-texto-tenue mt-3">Pasar a Simple o a Pro es contratarlo con Mercado Pago, sin esperar a nadie. Desde ahí se cobra solo.</p>
        )}
      </div>

      {modo === "suscripcion" && esDueno && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-4">
          {puedeArrepentirse ? (
            <p className="text-xs text-texto-tenue">
              Contrataste hace menos de 10 días: si te arrepentiste, te devolvemos todo desde el <a href="/arrepentimiento" target="_blank" rel="noreferrer" className="text-acento hover:underline">botón de arrepentimiento</a>.
            </p>
          ) : <span />}
          <Boton variant="quiet" onClick={() => { setError(null); setCodigo(null); setBaja(true); }}>Dar de baja</Boton>
        </div>
      )}

      {/* PASAR A OTRO PLAN: la confirmación, o el contratar si no hay suscripción. */}
      <Modal open={!!pasarA} onClose={() => !ocupado && setPasarA(null)}>
        <div className="p-5 md:p-6">
          {pasarA && modo === "contratar" ? (
            <>
              <div className="f-d text-lg mb-4">Contratar {NOMBRE[pasarA]}</div>
              <Contratar cuenta={{ ...cuenta, planElegido: pasarA }} />
            </>
          ) : pasarA ? (
            <>
              <div className="f-d text-lg">Pasar a {NOMBRE[pasarA]}</div>
              <div className="flex flex-wrap gap-2 mt-4">
                {[["mensual", "Por mes"], ["anual", `Por año: pagás ${meses} meses`]].map(([k, n]) => (
                  <button key={k} type="button" onClick={() => setPeriodo(k)}
                    className={`text-sm font-semibold rounded-full border px-3.5 py-1.5 ${periodo === k ? "bg-superficie-3 text-texto border-superficie-3" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>
                    {n}
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-borde p-4 text-sm space-y-2">
                <p>
                  Pasás de <b>{NOMBRE[s.plan]}</b> a <b>{NOMBRE[plan]}</b>: <span className="f-m">{nuevoMonto != null ? money(nuevoMonto) : "—"}</span> por {periodo === "anual" ? "año" : "mes"}
                  {s.proximoCobro ? `, desde el cobro del ${fecha(s.proximoCobro)}` : ""}.
                </p>
                {!otroPeriodo && <p className="text-texto-suave">Es en el momento: el plan y el menú cambian ya, y Mercado Pago cobra el precio nuevo desde el próximo cobro. No se cobran diferencias por los días que faltan.</p>}
                {otroPeriodo && <p className="text-texto-suave">No se cobran diferencias por los días que faltan.</p>}
                {otroPeriodo && (
                  <p className="text-texto-suave">Cambiar a {periodo === "anual" ? "anual" : "mensual"} arma una suscripción nueva: Mercado Pago te va a pedir que la autorices. Hasta entonces sigue la de ahora.</p>
                )}
                {plan === "start" && s.plan !== "start" && (
                  <p className="text-texto-suave">Simple es para una sola persona y un local: los demás usuarios se dan de baja y no hay factura electrónica.</p>
                )}
              </div>
              {error && <p className="text-sm text-mal mt-3" role="alert">{error}</p>}
              <div className="flex justify-end gap-2 mt-5">
                <Boton variant="quiet" onClick={() => setPasarA(null)} disabled={ocupado}>Cancelar</Boton>
                <Boton onClick={cambiar} disabled={igual || ocupado || nuevoMonto == null}>
                  {ocupado ? "Cambiando…" : otroPeriodo ? "Seguir en Mercado Pago" : `Pasar a ${NOMBRE[plan]}`}
                </Boton>
              </div>
            </>
          ) : null}
        </div>
      </Modal>

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
                {s && s.proximoCobro ? ` Seguís usando el sistema hasta el ${fecha(s.proximoCobro, -1)}, el último día que pagaste.` : ""}
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
    </div>
  );
}
