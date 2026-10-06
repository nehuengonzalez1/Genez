/* ============================================================
   genez.com.ar/arrepentimiento · el botón de arrepentimiento
   ============================================================

   Lo exige la Resolución 424/2020 a quien vende servicios por internet:
   un link a la vista desde la página principal, un formulario que no
   pida registrarse ni entrar, y un código de arrepentimiento dentro de
   las 24 horas por el mismo medio. El código se da acá mismo, en la
   pantalla, y se manda por mail si el mail está configurado.

   No da de baja nada por sí solo: el formulario no pide sesión, así que
   cualquiera que sepa el mail de un dueño podría cortarle el servicio.
   El pedido queda anotado y Genez lo resuelve desde el panel de la
   plataforma (Pruebas gratis → Arrepentimientos): cancela la suscripción
   y devuelve lo cobrado. Ver api/_mi_plan.js.

   Va en el bundle de la landing, como /privacidad y /terminos.
   ============================================================ */

import React, { useState } from "react";
import { LogoGenez } from "../ui/Logo.jsx";
import { estaOscuro } from "./tema.js";

const CAMPO = "w-full rounded-lg border border-borde-fuerte bg-superficie px-3 py-2.5 text-base outline-none focus:border-acento";

export default function Arrepentimiento() {
  const [d, setD] = useState({ nombre: "", email: "", comercio: "", telefono: "", motivo: "", sitio: "" });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [codigo, setCodigo] = useState(null);
  const cambiar = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    if (!d.nombre.trim()) return setError("Escribí tu nombre.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return setError("Escribí el mail con el que contrataste.");
    setEnviando(true);
    try {
      const r = await fetch("/api/founder?publico=arrepentimiento", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(d),
      });
      const datos = await r.json().catch(() => null);
      if (!r.ok) throw new Error((datos && datos.error && datos.error.message) || "No se pudo mandar el pedido.");
      setCodigo(datos.codigo);
    } catch (err) {
      setError(`${err.message} Si no anda, escribinos por WhatsApp al +54 9 11 2485-9144.`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-borde">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <a href="/landing" aria-label="Genez"><LogoGenez size={28} conNombre claro={estaOscuro()} /></a>
          <a href="/landing" className="text-sm text-texto-suave hover:text-texto">Volver</a>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 py-10">
        <h1 className="text-3xl font-bold">Botón de arrepentimiento</h1>
        <p className="text-texto-suave leading-relaxed mt-3">
          Si contrataste Genez hace 10 días corridos o menos, podés revocar la contratación sin dar motivos y sin ningún costo. Damos
          de baja la suscripción y te devolvemos lo que se haya cobrado por el mismo medio de pago. No hace falta entrar al sistema.
        </p>
        <p className="text-sm text-texto-tenue mt-2">
          Ley 24.240, art. 34 · Resolución 424/2020. Más de 10 días: podés darte de baja cuando quieras desde Ajustes → Mi plan (ver
          los <a href="/terminos" className="text-acento hover:underline">términos</a>).
        </p>

        {codigo ? (
          <div className="mt-8 rounded-xl border border-borde p-5">
            <div className="text-sm text-texto-suave">Recibimos tu pedido. Tu código de arrepentimiento es</div>
            <div className="f-m text-2xl font-bold mt-1 select-all">{codigo}</div>
            <p className="text-sm text-texto-suave mt-3 leading-relaxed">
              Guardalo: es la constancia de tu pedido. También te lo mandamos a {d.email.trim()}. Te escribimos cuando la suscripción
              esté dada de baja y la devolución hecha.
            </p>
          </div>
        ) : (
          <form onSubmit={enviar} className="mt-8 space-y-4" noValidate>
            <label className="block">
              <span className="block text-sm font-medium text-texto-suave mb-1.5">Tu nombre</span>
              <input value={d.nombre} onChange={cambiar("nombre")} autoComplete="name" className={CAMPO} maxLength={120} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-texto-suave mb-1.5">El mail con el que contrataste</span>
              <input value={d.email} onChange={cambiar("email")} type="email" autoComplete="email" className={CAMPO} maxLength={200} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-texto-suave mb-1.5">Nombre del comercio <span className="text-texto-tenue">(opcional)</span></span>
              <input value={d.comercio} onChange={cambiar("comercio")} className={CAMPO} maxLength={120} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-texto-suave mb-1.5">Teléfono <span className="text-texto-tenue">(opcional)</span></span>
              <input value={d.telefono} onChange={cambiar("telefono")} type="tel" autoComplete="tel" className={CAMPO} maxLength={40} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-texto-suave mb-1.5">¿Algo que quieras contarnos? <span className="text-texto-tenue">(opcional)</span></span>
              <textarea value={d.motivo} onChange={cambiar("motivo")} rows={3} className={CAMPO} maxLength={1000} />
            </label>
            {/* Para los robots: una persona no lo ve ni lo completa. */}
            <input value={d.sitio} onChange={cambiar("sitio")} tabIndex={-1} autoComplete="off" aria-hidden="true"
              className="absolute -left-[9999px] w-px h-px opacity-0" />
            {error && <p className="text-sm text-mal" role="alert">{error}</p>}
            <button type="submit" disabled={enviando}
              className="w-full rounded-xl bg-acento text-sobre-acento font-semibold py-3 hover:bg-acento-vivo disabled:opacity-60">
              {enviando ? "Mandando…" : "Me arrepiento: revocar la contratación"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
