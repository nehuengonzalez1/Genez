/* ============================================================
   LA PRUEBA GRATIS · lo que ve el comercio mientras prueba y al terminar
   ============================================================

   Tres piezas (0127, docs/landing-nueva.md punto 6):

   - AvisoDePrueba: arriba del panel mientras corre un plazo: los días de
     prueba, la gracia de un cobro rechazado (0128) o el último día de
     una suscripción dada de baja. Contratar y, si siguen cargados,
     Borrar ejemplos.
   - Contratar: Simple o Pro, por mes o por año, y el mail de Mercado
     Pago. El servidor crea la suscripción y la persona la autoriza en
     Mercado Pago; los avisos de Mercado Pago activan la cuenta (0128).
     Hasta el 05/10 era "Ya pagué" y Genez activaba a mano.
   - PantallaSinAcceso: lo único que ve quien quedó afuera (prueba o
     gracia vencida, cuenta suspendida). La base ya no le da datos; esto
     sale de mi_cuenta().

   El precio sale de `tarifas` (plan:start, plan:pro), lo mismo que la
   landing y lo que cobra el servidor.
   ============================================================ */

import React, { useEffect, useState } from "react";
import { Clock, MessageCircle, Trash2, LogOut, CreditCard } from "lucide-react";
import { Boton, Modal } from "../ui/Base.jsx";
import { LogoGenez } from "../ui/Logo.jsx";
import { money } from "../utils/helpers.js";
import { cargarTarifasPublicas } from "../datos/tarifas.js";
import { miCuenta, diasDePrueba, borrarEjemplos, contratarSuscripcion, MP_MIS_SUSCRIPCIONES } from "../datos/autoservicio.js";

const hoyEnBuenosAires = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

function enlaceWhatsApp(numero, texto) {
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null;
}

/* ---------- Contratar ---------- */

/* Desde 0128 se contrata solo: plan, período y el mail de la cuenta de
   Mercado Pago; el servidor crea la suscripción con el precio de `tarifas`
   y la persona la autoriza en Mercado Pago. Los avisos de Mercado Pago
   activan la cuenta. Ya no hay "Ya pagué" ni activación a mano.

   El mail es el de la cuenta de Mercado Pago de quien paga, que puede no
   ser el del usuario de Genez: se completa con el del usuario y se puede
   cambiar. Empresa no se contrata acá: se habla. */
const PLANES_CONTRATABLES = [
  { k: "start", n: "Simple", d: "Un usuario y un local. Sin factura electrónica." },
  { k: "pro", n: "Pro", d: "Factura electrónica ARCA, varios usuarios y sucursales." },
];

export function Contratar({ cuenta }) {
  const [tarifas, setTarifas] = useState(null);
  const elegidoAntes = cuenta.planElegido === "start" || cuenta.planElegido === "pro" ? cuenta.planElegido : "pro";
  const [plan, setPlan] = useState(elegidoAntes);
  const [periodo, setPeriodo] = useState("mensual");
  const [email, setEmail] = useState("");
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;
    cargarTarifasPublicas().then((t) => { if (vigente) setTarifas(t); }).catch(() => { if (vigente) setTarifas(false); });
    import("../datos/supabase.js").then(({ supabase }) => supabase.auth.getUser())
      .then(({ data }) => { if (vigente && data && data.user && data.user.email) setEmail((e) => e || data.user.email); })
      .catch(() => {});
    return () => { vigente = false; };
  }, []);

  const precioDe = (k) => (tarifas && tarifas.planes ? tarifas.planes[k] : null);
  const meses = (tarifas && tarifas.anualMeses) || 12;
  const precio = precioDe(plan);
  const total = precio == null ? null : periodo === "anual" ? precio * meses : precio;
  const enPrueba = cuenta.pruebaHasta && cuenta.pruebaHasta >= hoyEnBuenosAires() && !(cuenta.suscripcion && cuenta.suscripcion.pagoFallidoDesde);
  const whatsapp = tarifas && tarifas.whatsapp;
  const dudas = enlaceWhatsApp(whatsapp, `Hola, soy de ${cuenta.nombre}. Tengo una duda para contratar Genez.`);

  const pagar = async () => {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Escribí el mail de tu cuenta de Mercado Pago.");
    setYendo(true);
    try {
      const { link } = await contratarSuscripcion({ plan, periodo, email: email.trim() });
      window.location.href = link;
    } catch (e) {
      setError(e.message);
      setYendo(false);
    }
  };

  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-texto-suave font-bold">Contratar Genez</div>
      <div className="grid sm:grid-cols-2 gap-2 mt-3">
        {PLANES_CONTRATABLES.map((p) => {
          const elegido = plan === p.k;
          const pr = precioDe(p.k);
          return (
            <button key={p.k} type="button" onClick={() => setPlan(p.k)}
              className={`text-left rounded-xl border p-3.5 transition-colors ${elegido ? "border-acento bg-acento-suave" : "border-borde hover:bg-superficie-2"}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{p.n}</span>
                <span className="f-m text-sm">{pr != null ? `${money(pr)} / mes` : tarifas === null ? "…" : "Consultar"}</span>
              </div>
              <div className="text-xs text-texto-suave mt-1">{p.d}</div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {[["mensual", "Por mes"], ["anual", `Por año: pagás ${meses} meses`]].map(([k, n]) => (
          <button key={k} type="button" onClick={() => setPeriodo(k)}
            className={`text-sm font-semibold rounded-full border px-3.5 py-1.5 ${periodo === k ? "bg-superficie-3 text-texto border-superficie-3" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>
            {n}
          </button>
        ))}
      </div>

      <label className="block mt-4">
        <span className="block text-sm font-medium text-texto-suave mb-1.5">El mail de tu cuenta de Mercado Pago</span>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email"
          className="w-full rounded-lg border border-borde-fuerte bg-superficie px-3 py-2.5 text-base outline-none focus:border-acento" />
      </label>

      <div className="mt-4 rounded-xl border border-borde p-3.5 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-texto-suave">Vas a pagar</span>
          <span className="f-m text-lg">{total != null ? money(total) : "—"} <span className="text-sm text-texto-suave">/ {periodo === "anual" ? "año" : "mes"}</span></span>
        </div>
        <p className="text-xs text-texto-suave mt-1.5">
          {enPrueba ? `El primer cobro es cuando termina tu prueba, el ${fechaCorta(cuenta.pruebaHasta, 1)}. ` : ""}
          Se cobra solo con Mercado Pago. Sin permanencia: la das de baja cuando quieras desde tu cuenta de Mercado Pago.
          {tarifas && tarifas.congeladoMeses ? ` El precio queda congelado ${tarifas.congeladoMeses} meses; después se ajusta por inflación cada 3 meses.` : ""}
        </p>
      </div>

      {cuenta.suscripcion && cuenta.suscripcion.estado === "pendiente" && (
        <p className="text-xs text-texto-suave mt-3">
          Ya empezaste a contratar. Si no terminaste en Mercado Pago, volvé a tocar el botón: el link anterior deja de valer.
        </p>
      )}
      {error && <p className="text-sm text-mal mt-3" role="alert">{error}</p>}

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <Boton onClick={pagar} disabled={yendo || total == null}>
          {yendo ? "Abriendo Mercado Pago…" : "Pagar con Mercado Pago"}
        </Boton>
        {dudas && (
          <a href={dudas} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-texto-suave hover:text-texto">
            <MessageCircle size={15} /> ¿Dudas? Escribinos
          </a>
        )}
      </div>
    </div>
  );
}

/* AAAA-MM-DD (+ días) a "12/10". */
function fechaCorta(fecha, mas = 0) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + mas);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/* ---------- El aviso arriba del panel ---------- */

/* `compacto` es para cobro y comandas, las pantallas de todo el día: una
   línea y Contratar. Un minimercado entra directo a cobrar, y sin esto
   quien prueba no se enteraba nunca de cuántos días le quedaban. */
export function AvisoDePrueba({ comercio, comoAdmin, compacto = false }) {
  const [cuenta, setCuenta] = useState(null);
  const [contratar, setContratar] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState(null);

  const enPrueba = !!comercio.pruebaHasta;

  useEffect(() => {
    if (!enPrueba || comoAdmin) return;
    let vigente = true;
    miCuenta().then((c) => { if (vigente) setCuenta(c); }).catch(() => {});
    return () => { vigente = false; };
  }, [enPrueba, comoAdmin]);

  if (!enPrueba) return null;
  const dias = diasDePrueba(comercio.pruebaHasta, hoyEnBuenosAires());

  const confirmarBorrado = async () => {
    setError(null); setBorrando(true);
    try {
      await borrarEjemplos();
      /* Lo que está en memoria (productos, clientes, el tablero) todavía
         tiene los ejemplos: se vuelve a cargar todo de la base. */
      window.location.reload();
    } catch (e) {
      setError(e.message);
      setBorrando(false);
    }
  };

  const cuentaParaContratar = cuenta || {
    nombre: comercio.nombre, plan: comercio.plan, modulos: comercio.modulos, pruebaHasta: comercio.pruebaHasta,
    planElegido: null, suscripcion: null,
  };

  /* `pruebaHasta` es el día límite de tres cosas distintas (0128): la
     prueba, la gracia de un cobro rechazado y el último día pago de una
     suscripción dada de baja. La suscripción dice cuál. */
  const sus = cuenta && cuenta.suscripcion;
  const gracia = !!(sus && sus.pagoFallidoDesde);
  const baja = !!(sus && (sus.estado === "cancelada" || sus.estado === "pausada"));
  const hasta = fechaCorta(comercio.pruebaHasta);
  const titulo = gracia
    ? `Tu último pago no pasó. Actualizalo en Mercado Pago antes del ${hasta} para no perder el acceso.`
    : baja
      ? `Tu suscripción está dada de baja. Podés usar Genez hasta el ${hasta}.`
      : dias > 1 ? `Te quedan ${dias} días de prueba.` : dias === 1 ? "Hoy es el último día de tu prueba." : "Tu prueba terminó.";
  const bajada = sus && sus.estado === "pendiente" && !gracia
    ? "Si ya autorizaste el pago en Mercado Pago, en unos minutos se confirma."
    : cuenta && cuenta.ejemplos
      ? "Los productos, clientes y ventas que ves son de ejemplo."
      : "Lo que cargues queda guardado cuando contrates.";

  return (
    <>
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 border border-borde rounded-xl bg-superficie ${compacto ? "mb-3 px-3 py-2" : "mb-5 px-4 py-3"}`}>
        {gracia ? <CreditCard size={16} className="text-mal shrink-0" /> : <Clock size={16} className="text-acento shrink-0" />}
        <div className="text-sm min-w-0 flex-1">
          <span className="font-semibold">{titulo}</span>{" "}
          {!gracia && !baja && <span className={`text-texto-suave ${compacto ? "hidden md:inline" : ""}`}>{bajada}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {!compacto && !gracia && !baja && cuenta && cuenta.ejemplos && (
            <Boton size="sm" variant="ghost" onClick={() => setBorrar(true)}><Trash2 size={14} /> Borrar ejemplos y empezar</Boton>
          )}
          {gracia ? (
            <a href={MP_MIS_SUSCRIPCIONES} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl font-semibold text-xs px-2.5 py-1.5 bg-acento text-sobre-acento hover:bg-acento-vivo">
              Ir a Mercado Pago
            </a>
          ) : (
            <Boton size="sm" onClick={() => setContratar(true)}>{baja ? "Volver a contratar" : "Contratar"}</Boton>
          )}
        </div>
      </div>

      <Modal open={contratar} onClose={() => setContratar(false)}>
        <div className="p-5 md:p-6">
          <Contratar cuenta={cuentaParaContratar} />
          <div className="flex justify-end mt-5">
            <Boton variant="quiet" onClick={() => setContratar(false)}>Cerrar</Boton>
          </div>
        </div>
      </Modal>

      <Modal open={borrar} onClose={() => !borrando && setBorrar(false)}>
        <div className="p-5 md:p-6">
          <div className="f-d text-lg">¿Borrar los ejemplos?</div>
          <p className="text-sm text-texto-suave mt-2">
            Se van los productos, clientes y ventas de ejemplo. Lo que cargaste vos queda. No se puede deshacer.
          </p>
          {error && <p className="text-sm text-mal mt-3" role="alert">{error}</p>}
          <div className="flex justify-end gap-2 mt-5">
            <Boton variant="quiet" onClick={() => setBorrar(false)} disabled={borrando}>Cancelar</Boton>
            <Boton variant="danger" onClick={confirmarBorrado} disabled={borrando}>{borrando ? "Borrando…" : "Borrar ejemplos"}</Boton>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ---------- Sin acceso: prueba vencida o cuenta suspendida ---------- */

export function PantallaSinAcceso({ sesion, onSalir }) {
  const { cuenta } = sesion;
  const vencida = cuenta.activo && !!cuenta.pruebaHasta;
  const [tarifas, setTarifas] = useState(null);

  useEffect(() => {
    if (vencida) return;
    cargarTarifasPublicas().then(setTarifas).catch(() => {});
  }, [vencida]);

  const escribir = tarifas && enlaceWhatsApp(tarifas.whatsapp, `Hola, soy de ${cuenta.nombre}. Mi cuenta de Genez aparece suspendida.`);

  return (
    <div className="min-h-screen bg-fondo text-texto flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-borde">
        <LogoGenez size={26} claro conNombre />
        <Boton variant="quiet" size="sm" onClick={onSalir}><LogOut size={14} /> Salir</Boton>
      </header>
      <main className="flex-1 flex items-start md:items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-lg bg-superficie border border-borde rounded-2xl p-5 md:p-7">
          {vencida && cuenta.suscripcion && cuenta.suscripcion.pagoFallidoDesde ? (
            <>
              <div className="f-d text-2xl">No pudimos cobrar la suscripción de {cuenta.nombre}</div>
              <p className="text-sm text-texto-suave mt-2">
                Tus datos siguen guardados. Actualizá la tarjeta en Mercado Pago: cuando el cobro pase, volvés a entrar solo.
              </p>
              <a href={MP_MIS_SUSCRIPCIONES} target="_blank" rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-xl font-semibold text-sm px-3.5 py-2 bg-acento text-sobre-acento hover:bg-acento-vivo">
                <CreditCard size={16} /> Ir a Mercado Pago
              </a>
            </>
          ) : vencida ? (
            <>
              <div className="f-d text-2xl">{cuenta.suscripcion && cuenta.suscripcion.estado !== "pendiente"
                ? `La suscripción de ${cuenta.nombre} terminó` : `Tu prueba de ${cuenta.nombre} terminó`}</div>
              <p className="text-sm text-texto-suave mt-2 mb-6">
                Todo lo que cargaste sigue guardado. Contratá y seguís desde donde lo dejaste.
              </p>
              <Contratar cuenta={cuenta} />
            </>
          ) : (
            <>
              <div className="f-d text-2xl">La cuenta de {cuenta.nombre} está suspendida</div>
              <p className="text-sm text-texto-suave mt-2">
                Tus datos siguen guardados. Escribinos y lo resolvemos.
              </p>
              {escribir && (
                <a href={escribir} target="_blank" rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl font-semibold text-sm px-3.5 py-2 bg-acento text-sobre-acento hover:bg-acento-vivo">
                  <MessageCircle size={16} /> Escribir por WhatsApp
                </a>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
