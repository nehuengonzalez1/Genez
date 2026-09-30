/* ============================================================
   genez.com.ar/privacidad
   ============================================================

   La política de privacidad pública. Existe porque Meta la pide para
   poner la app de WhatsApp en modo Live (URL de política de privacidad
   y forma de pedir que se borren los datos), pero cuenta todo lo que
   Genez hace con datos, no solo el WhatsApp: una política que solo habla
   del canal que la exigió no le sirve a nadie más.

   Va en el bundle de la landing (main.jsx elige por la ruta) y no en
   una entrada propia: es texto, y no justifica otro HTML ni otro build.

   Los proveedores son los que el sistema usa de verdad (ARQUITECTURA.md):
   si se suma o se saca uno, se cambia acá y la fecha de arriba.
   ============================================================ */

import React from "react";
import { LogoGenez } from "../ui/Logo.jsx";
import { estaOscuro } from "./tema.js";

const ACTUALIZADA = "30 de septiembre de 2026";
const WHATSAPP = "+54 9 11 2485-9144";
const LINK_WA = "https://wa.me/5491124859144";

function Seccion({ titulo, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">{titulo}</h2>
      <div className="space-y-3 text-texto-suave leading-relaxed">{children}</div>
    </section>
  );
}

export default function Privacidad() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-borde">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <a href="/landing" aria-label="Genez"><LogoGenez size={28} conNombre claro={estaOscuro()} /></a>
          <a href="/landing" className="text-sm text-texto-suave hover:text-texto">Volver</a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10 space-y-9">
        <div>
          <h1 className="text-3xl font-bold">Política de privacidad</h1>
          <p className="text-sm text-texto-tenue mt-2">Última actualización: {ACTUALIZADA}</p>
        </div>

        <Seccion titulo="Quiénes somos">
          <p>
            Genez es un sistema de gestión para comercios de Argentina (genez.com.ar). Esta política explica qué datos
            personales tratamos, para qué, con quién los compartimos y cómo podés pedir verlos, corregirlos o borrarlos.
            Se rige por la Ley 25.326 de Protección de los Datos Personales.
          </p>
        </Seccion>

        <Seccion titulo="Qué datos tratamos">
          <p><b className="text-texto">Si nos escribís por WhatsApp:</b> tu número, el nombre de tu perfil de WhatsApp, los mensajes que nos mandás y los que te respondemos, y cuándo se entregaron y leyeron.</p>
          <p><b className="text-texto">Si pedís un presupuesto en la web:</b> el tipo de negocio, los módulos que elegiste y los datos de contacto que dejes.</p>
          <p><b className="text-texto">Si sos un comercio que usa Genez:</b> los datos de las personas de tu equipo que dan de alta (nombre, correo) y la información de tu negocio que cargás en el sistema.</p>
          <p>
            <b className="text-texto">Si sos cliente de un comercio que usa Genez:</b> los datos que ese comercio carga (por ejemplo, tu nombre,
            teléfono o tus turnos) son del comercio. Genez los guarda por cuenta de él y no los usa para nada propio. Para verlos o borrarlos,
            pedíselo al comercio; si no te responde, escribinos.
          </p>
          <p>
            Para buscar comercios a los que ofrecerles Genez usamos datos públicos de negocios (nombre, rubro, dirección) de fuentes que
            permiten usarlos, como OpenStreetMap. No compramos bases de datos.
          </p>
        </Seccion>

        <Seccion titulo="Para qué los usamos">
          <p>Para responder tus consultas, armarte un presupuesto, dar el servicio que contrataste, darte soporte y facturarlo.</p>
          <p>
            No te mandamos mensajes de WhatsApp si no nos escribiste primero o no aceptaste recibirlos. No vendemos ni alquilamos datos
            personales a nadie.
          </p>
        </Seccion>

        <Seccion titulo="Con quién los compartimos">
          <p>Solo con los proveedores que necesitamos para que el servicio funcione, y solo lo que cada uno necesita:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><b className="text-texto">Supabase</b>: la base de datos donde se guarda la información.</li>
            <li><b className="text-texto">Vercel</b>: donde está publicado el sitio.</li>
            <li><b className="text-texto">Meta (WhatsApp)</b>: por donde viajan los mensajes de WhatsApp.</li>
            <li><b className="text-texto">Anthropic</b>: el asistente de inteligencia artificial del sistema, cuando un comercio lo usa.</li>
            <li><b className="text-texto">Mercado Pago</b> y el servicio de factura electrónica ante ARCA, cuando un comercio los conecta.</li>
          </ul>
          <p>Algunos de estos proveedores guardan los datos en servidores fuera de Argentina.</p>
          <p>Fuera de eso, solo los entregamos si una autoridad competente lo pide según la ley.</p>
        </Seccion>

        <Seccion titulo="Cuánto tiempo los guardamos">
          <p>
            Mientras haya una conversación, un presupuesto o un servicio en curso, y después el tiempo que exijan las normas contables y
            fiscales. Si pedís que los borremos, los borramos salvo lo que la ley nos obligue a conservar.
          </p>
        </Seccion>

        <Seccion titulo="Tus derechos y cómo pedir que borremos tus datos">
          <p>
            Podés pedir en cualquier momento ver qué datos tenemos tuyos, corregirlos o borrarlos. Escribinos por WhatsApp al{" "}
            <a href={LINK_WA} className="text-acento font-semibold hover:underline">{WHATSAPP}</a> diciendo qué querés hacer.
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Para dejar de recibir mensajes, mandá <b className="text-texto">BAJA</b>. No te escribimos más.</li>
            <li>Para que borremos tus datos, mandá <b className="text-texto">BORRAR MIS DATOS</b>. Te confirmamos cuando esté hecho.</li>
          </ul>
          <p>
            Respondemos los pedidos de acceso dentro de los 10 días corridos y los de corrección o borrado dentro de los 5 días hábiles,
            como fija la Ley 25.326. El acceso es gratuito cada seis meses, salvo que acredites un interés legítimo para pedirlo antes.
          </p>
          <p className="text-sm">
            La Agencia de Acceso a la Información Pública, en su carácter de órgano de control de la Ley 25.326, tiene la atribución de
            atender las denuncias y reclamos que se interpongan con relación al incumplimiento de las normas sobre protección de datos personales.
          </p>
        </Seccion>

        <Seccion titulo="Seguridad">
          <p>
            Los datos viajan cifrados y cada comercio ve solo los suyos: el aislamiento lo controla la base de datos, no la pantalla. Las
            credenciales de los servicios conectados se guardan cifradas.
          </p>
        </Seccion>

        <Seccion titulo="Cambios">
          <p>Si cambiamos esta política, publicamos la versión nueva acá con su fecha.</p>
        </Seccion>
      </main>

      <footer className="border-t border-borde">
        <div className="max-w-3xl mx-auto px-5 py-5 text-xs text-texto-tenue">© {new Date().getFullYear()} Genez · Argentina</div>
      </footer>
    </div>
  );
}
