/* ============================================================
   LA PRUEBA GRATIS · lo que ve el comercio mientras prueba y al terminar
   ============================================================

   Tres piezas (0127, docs/landing-nueva.md punto 6):

   - AvisoDePrueba: arriba del panel mientras dura la prueba. Cuántos días
     quedan, Contratar y, si siguen cargados, Borrar ejemplos.
   - Contratar: el plan con su precio y cómo pagar. Mientras dure el
     lanzamiento Genez activa a mano: el link de pago lo manda por
     WhatsApp, y "Ya pagué" lo anota en el panel de la plataforma.
   - PantallaSinAcceso: lo único que ve quien tiene la prueba vencida o la
     cuenta suspendida. La base ya no le da datos; esto sale de mi_cuenta().

   El precio sale de las mismas funciones que la landing, sobre los módulos
   que el comercio tiene: lo que está probando es lo que va a pagar.
   ============================================================ */

import React, { useEffect, useState } from "react";
import { Clock, MessageCircle, Trash2, Check, LogOut } from "lucide-react";
import { Boton, Modal } from "../ui/Base.jsx";
import { LogoGenez } from "../ui/Logo.jsx";
import { money } from "../utils/helpers.js";
import { MODULOS, MODULOS_BASE } from "../datos/modulos.js";
import { presupuestar, textoDescuento } from "../datos/presupuesto.js";
import { cargarTarifasPublicas } from "../datos/tarifas.js";
import { miCuenta, diasDePrueba, borrarEjemplos, avisarPago } from "../datos/autoservicio.js";

const NOMBRE_PLAN = { start: "Start", pro: "Pro", empresa: "Empresa", medida: "A medida", base: "Base" };
const hoyEnBuenosAires = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
const nombreModulo = (k) => (MODULOS.find((m) => m.k === k) || { n: k }).n;

function enlaceWhatsApp(numero, texto) {
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null;
}

/* ---------- Contratar ---------- */

export function Contratar({ cuenta, alAvisar }) {
  const [tarifas, setTarifas] = useState(null);
  const [avisando, setAvisando] = useState(false);
  const [avisado, setAvisado] = useState(!!cuenta.pagoAvisado);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;
    cargarTarifasPublicas().then((t) => { if (vigente) setTarifas(t); }).catch(() => { if (vigente) setTarifas(false); });
    return () => { vigente = false; };
  }, []);

  const pre = tarifas ? presupuestar(tarifas, cuenta.modulos) : null;
  const plan = NOMBRE_PLAN[cuenta.plan] || cuenta.plan;
  const whatsapp = tarifas && tarifas.whatsapp;
  const pedirLink = enlaceWhatsApp(whatsapp, `Hola, soy de ${cuenta.nombre}. Quiero contratar Genez (plan ${plan}). ¿Me pasan el link de pago?`);

  const yaPague = async () => {
    setError(null); setAvisando(true);
    try {
      await avisarPago();
      setAvisado(true);
      if (alAvisar) alAvisar();
      const link = enlaceWhatsApp(whatsapp, `Hola, soy de ${cuenta.nombre}. Ya pagué Genez (plan ${plan}).`);
      if (link) window.open(link, "_blank", "noopener");
    } catch (e) {
      setError(e.message);
    } finally {
      setAvisando(false);
    }
  };

  const extras = cuenta.modulos.filter((k) => !MODULOS_BASE.includes(k));

  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-texto-suave font-bold">Tu plan</div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mt-1">
        <div className="f-d text-xl">Plan {plan}</div>
        {pre && pre.mensual != null && (
          <div className="text-right">
            {pre.conDescuento != null && <div className="f-m text-xs text-texto-tenue line-through">{money(pre.mensual)}</div>}
            <div><span className="f-m text-xl">{money(pre.conDescuento != null ? pre.conDescuento : pre.mensual)}</span> <span className="text-sm text-texto-suave">/ mes</span></div>
            {pre.descuento && <div className="text-xs text-acento">{textoDescuento(pre.descuento)}</div>}
          </div>
        )}
        {tarifas === null && <div className="text-sm text-texto-tenue">Calculando…</div>}
      </div>
      <p className="text-sm text-texto-suave mt-2">
        Cobro, caja y ajustes{extras.length ? `, más ${extras.map(nombreModulo).join(", ")}` : ""}. Sin permanencia: cancelás cuando quieras.
      </p>

      <div className="mt-5 border border-borde rounded-xl p-4">
        <div className="font-semibold text-sm">Cómo se paga</div>
        <p className="text-sm text-texto-suave mt-1">
          Te mandamos el link de pago por WhatsApp. Cuando pagues, tocá "Ya pagué" y activamos tu cuenta en el día,
          con todo lo que cargaste.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {pedirLink && (
            <a href={pedirLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl font-semibold text-sm px-3.5 py-2 bg-acento text-sobre-acento hover:bg-acento-vivo">
              <MessageCircle size={16} /> Pedir el link de pago
            </a>
          )}
          <Boton variant="ghost" onClick={yaPague} disabled={avisando || avisado}>
            {avisado ? <><Check size={16} /> Avisaste que pagaste</> : avisando ? "Avisando…" : "Ya pagué"}
          </Boton>
        </div>
        {avisado && <p className="text-xs text-texto-suave mt-2">Lo vemos y te activamos. Si pasó un día y seguís sin entrar, escribinos.</p>}
        {error && <p className="text-sm text-mal mt-2" role="alert">{error}</p>}
      </div>
    </div>
  );
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
    nombre: comercio.nombre, plan: comercio.plan, modulos: comercio.modulos, pagoAvisado: null,
  };

  return (
    <>
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 border border-borde rounded-xl bg-superficie ${compacto ? "mb-3 px-3 py-2" : "mb-5 px-4 py-3"}`}>
        <Clock size={16} className="text-acento shrink-0" />
        <div className="text-sm min-w-0 flex-1">
          <span className="font-semibold">
            {dias > 1 ? `Te quedan ${dias} días de prueba.` : dias === 1 ? "Hoy es el último día de tu prueba." : "Tu prueba terminó."}
          </span>{" "}
          <span className={`text-texto-suave ${compacto ? "hidden md:inline" : ""}`}>
            {cuenta && cuenta.ejemplos
              ? "Los productos, clientes y ventas que ves son de ejemplo."
              : "Lo que cargues queda guardado cuando contrates."}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {!compacto && cuenta && cuenta.ejemplos && (
            <Boton size="sm" variant="ghost" onClick={() => setBorrar(true)}><Trash2 size={14} /> Borrar ejemplos y empezar</Boton>
          )}
          <Boton size="sm" onClick={() => setContratar(true)}>Contratar</Boton>
        </div>
      </div>

      <Modal open={contratar} onClose={() => setContratar(false)}>
        <div className="p-5 md:p-6">
          <Contratar cuenta={cuentaParaContratar} alAvisar={() => setCuenta((c) => (c ? { ...c, pagoAvisado: new Date().toISOString() } : c))} />
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
          {vencida ? (
            <>
              <div className="f-d text-2xl">Tu prueba de {cuenta.nombre} terminó</div>
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
