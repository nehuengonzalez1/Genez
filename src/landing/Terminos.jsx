/* ============================================================
   genez.com.ar/terminos
   ============================================================

   Los términos y condiciones públicos. Salen del borrador de
   docs/legal/terminos-borrador.md, aprobado por Nehuen el 05/10 con tres
   respuestas: el titular es él, Genez no emite factura por los cobros
   hasta que se inscriba en el monotributo (por eso el texto no habla de
   factura), y los plazos del borrador quedaron como estaban.

   La responsabilidad y la jurisdicción se redactaron mirando la
   Disposición 377/2026 (la lista nueva de cláusulas abusivas, marzo de
   2026): ante un consumidor no se puede limitar la responsabilidad ni
   llevarlo a otros tribunales que los de su domicilio (CCyC art. 1109), y
   ninguna cláusula vale para el dolo o la culpa grave (CCyC art. 1743).
   Un comercio que contrata Genez para su negocio en general no es
   consumidor, pero puede serlo: por eso el límite dice a quién se aplica.

   Cada promesa de este texto tiene que existir en el sistema: el botón
   de arrepentimiento, la baja y el cambio de plan en Ajustes, el código
   de baja, el ajuste por inflación y el borrado a los 90 días. Si se
   cambia una, se cambia acá y la fecha de arriba.

   Va en el bundle de la landing, como /privacidad (ver main.jsx).
   ============================================================ */

import React from "react";
import { LogoGenez } from "../ui/Logo.jsx";
import { estaOscuro } from "./tema.js";

const ACTUALIZADA = "5 de octubre de 2026";

/* Los datos del titular, cargados el 06/10. Es CUIL porque Nehuen todavía
   no está inscripto: al inscribirse en el monotributo ARCA usa el mismo
   número como CUIT, y acá solo cambia la palabra (CLAVE_FISCAL). La
   ciudad es la de los tribunales: Tres de Febrero es del Departamento
   Judicial de San Martín. */
const TITULAR = "Nehuen Gonzalez";
const CLAVE_FISCAL = "CUIL";
const CUIT = "20-40460947-6";
const DOMICILIO = "José Murias 2271, partido de Tres de Febrero, provincia de Buenos Aires";
const CIUDAD = "del Departamento Judicial de San Martín, provincia de Buenos Aires";
const EMAIL = "contacto@genez.com.ar";

const WHATSAPP = "+54 9 11 2485-9144";
const LINK_WA = "https://wa.me/5491124859144";

function Seccion({ n, titulo, children }) {
  return (
    <section className="space-y-3" id={`t${n}`}>
      <h2 className="text-xl font-bold">{n}. {titulo}</h2>
      <div className="space-y-3 text-texto-suave leading-relaxed">{children}</div>
    </section>
  );
}

const B = ({ children }) => <b className="text-texto">{children}</b>;
const Lista = ({ children }) => <ul className="list-disc pl-5 space-y-1.5">{children}</ul>;

export default function Terminos() {
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
          <h1 className="text-3xl font-bold">Términos y condiciones</h1>
          <p className="text-sm text-texto-tenue mt-2">Última actualización: {ACTUALIZADA}</p>
        </div>

        <Seccion n={1} titulo="Quiénes somos">
          <p>
            Genez es un sistema de gestión para comercios —cobro, caja, stock, compras, clientes, pedidos, informes y otros
            módulos— que se usa desde el navegador en genez.com.ar. Lo presta {TITULAR}, {CLAVE_FISCAL} {CUIT}, con domicilio en {DOMICILIO}
            ("Genez", "nosotros").
          </p>
          <p>
            Contacto: <a href={`mailto:${EMAIL}`} className="text-acento font-semibold hover:underline">{EMAIL}</a> · WhatsApp <a href={LINK_WA} className="text-acento font-semibold hover:underline">{WHATSAPP}</a>.
          </p>
        </Seccion>

        <Seccion n={2} titulo="Aceptación">
          <p>
            Al crear una cuenta aceptás estos términos y la <a href="/privacidad" className="text-acento font-semibold hover:underline">política
            de privacidad</a>. Si usás Genez en nombre de un comercio, declarás que podés obligarlo.
          </p>
        </Seccion>

        <Seccion n={3} titulo="La cuenta">
          <Lista>
            <li>Para registrarte tenés que ser mayor de 18 años y dar datos verdaderos.</li>
            <li>Cada registro crea un comercio. Quien lo registra es su <B>dueño</B>, y es quien contrata, cambia de plan o da de baja.</li>
            <li>Sos responsable de tu contraseña y de lo que hagan las personas a las que les des acceso desde Permisos.</li>
            <li>Si detectás un uso que no autorizaste, avisanos enseguida.</li>
          </Lista>
        </Seccion>

        <Seccion n={4} titulo="Prueba gratis">
          <Lista>
            <li>Al registrarte tenés <B>10 días gratis del plan Pro</B>, sin cargar tarjeta.</li>
            <li>
              Durante la prueba <B>no se puede conectar la factura electrónica de ARCA</B>: los comprobantes que se emiten con tu CUIT son
              reales y no se pueden borrar. Se habilita al contratar Pro.
            </li>
            <li>Durante la prueba, el asistente con inteligencia artificial tiene un tope de 20 preguntas y 5 remitos por foto en total.</li>
            <li>Te avisamos por mail tres días antes de que termine y cuando terminó.</li>
            <li>
              Si al terminar no contrataste, <B>el comercio se suspende</B>: no vas a poder entrar hasta contratar. Tus datos se guardan
              como dice el punto 9.
            </li>
            <li>Los datos de ejemplo que trae la prueba se pueden borrar en cualquier momento.</li>
          </Lista>
        </Seccion>

        <Seccion n={5} titulo="Planes">
          <p>Los planes y lo que incluye cada uno son los publicados en genez.com.ar al momento de contratar. Hoy son:</p>
          <Lista>
            <li><B>Simple:</B> un usuario y un local. Sin factura electrónica ni asistente con inteligencia artificial.</li>
            <li>
              <B>Pro:</B> varios usuarios con roles, factura electrónica de ARCA, hasta 2 sucursales incluidas y asistente con
              inteligencia artificial con un tope de 150 preguntas y 30 remitos por foto por mes. Desde la tercera sucursal, cada una se
              cobra aparte, $ 14.900 por mes.
            </li>
            <li><B>Empresa:</B> a medida, con un acuerdo aparte. Lo que se acuerde ahí manda sobre estos términos.</li>
          </Lista>
          <p>Los productos son ilimitados en todos los planes.</p>
          <p>
            <B>Simple es de un solo usuario.</B> Si pasás a Simple y tenías a otras personas dadas de alta, queda solo el acceso del
            dueño y los demás se dan de baja. No se borran: si después pasás a Pro, los volvés a dar de alta.
          </p>
          <p>
            <B>Los topes del asistente</B> se renuevan el día 1 de cada mes, en horario de Buenos Aires, y lo que no se usa no se
            acumula. Al llegar al tope el resto del sistema sigue igual: los indicadores y diagnósticos no dependen del asistente.
          </p>
        </Seccion>

        <Seccion n={6} titulo="Precio y pago">
          <Lista>
            <li><B>Precios:</B> Simple $ 29.900 por mes y Pro $ 59.900 por mes, precios finales.</li>
            <li><B>Pago anual:</B> pagás 10 meses y usás 12.</li>
            <li>
              <B>Precio congelado:</B> el precio con el que contratás queda fijo por <B>6 meses</B>. Después se ajusta <B>cada 3
              meses</B> por la variación del índice de precios al consumidor (IPC, nivel general) que publica el INDEC, de los últimos 3
              meses publicados. Te avisamos el precio nuevo por mail al menos 10 días antes de cobrarlo. En el pago anual, el ajuste
              se aplica en la renovación.
            </li>
            <li>
              <B>Cómo se paga:</B> con una suscripción de Mercado Pago, que cobra sola cada mes o cada año con el medio de pago que
              elijas ahí. Si contratás durante la prueba, el primer cobro es cuando la prueba termina.
            </li>
            <li>
              <B>Si un cobro falla:</B> Mercado Pago lo vuelve a intentar y el sistema te avisa. Tenés <B>5 días</B> para
              resolverlo; pasados esos días, el comercio se suspende hasta que el pago se acredite.
            </li>
            <li>
              <B>Otros cambios de precio:</B> fuera del ajuste por inflación, si cambiamos el precio de tu plan te avisamos con al menos
              30 días de anticipación, y podés darte de baja antes sin ningún costo. El cambio nunca alcanza a lo que ya pagaste.
            </li>
          </Lista>
        </Seccion>

        <Seccion n={7} titulo="Cambiar de plan">
          <p>
            El dueño puede pasar a cualquier otro plan, o de mensual a anual y al revés, desde <B>Ajustes → Mi cuenta</B>. El plan nuevo
            rige desde ese momento y su precio se cobra desde el próximo cobro: no pagás diferencias por los días que faltan.
          </p>
          <p>
            Pasar de mensual a anual, o de anual a mensual, arma una suscripción nueva en Mercado Pago que reemplaza a la anterior. Para
            pasar al plan Empresa, escribinos.
          </p>
        </Seccion>

        <Seccion n={8} titulo="Arrepentimiento y baja">
          <p>
            <B>Arrepentimiento.</B> Podés revocar la contratación dentro de los <B>10 días corridos</B> desde que la hiciste, sin dar
            motivos y sin ningún costo, desde el <a href="/arrepentimiento" className="text-acento font-semibold hover:underline">botón
            de arrepentimiento</a> que está en la página principal. No hace falta entrar al sistema. Te damos un código de
            arrepentimiento en el momento, damos de baja la suscripción y te devolvemos lo que se haya cobrado por el mismo medio de
            pago. (Ley 24.240, art. 34; Código Civil y Comercial, arts. 1110 a 1116; Resolución 424/2020.)
          </p>
          <p>
            <B>Baja.</B> Podés darte de baja cuando quieras, sin permanencia mínima, desde <B>Ajustes → Mi cuenta → Dar de baja</B>, desde
            tus suscripciones en Mercado Pago o escribiéndonos. Te damos un <B>código de baja</B> en el momento y te lo mandamos por mail.
          </p>
          <Lista>
            <li>
              La baja rige al terminar el período que ya pagaste: hasta ese día seguís usando el sistema. No se devuelve la parte no
              usada de ese período, tampoco en el pago anual, salvo que ejerzas el arrepentimiento.
            </li>
            <li>Una suscripción pausada en Mercado Pago funciona como una baja: seguís entrando hasta el último día pago.</li>
            <li>Podés volver a contratar cuando quieras mientras tus datos sigan guardados (punto 9).</li>
          </Lista>
        </Seccion>

        <Seccion n={9} titulo="Tus datos y los de tus clientes">
          <Lista>
            <li>
              Los datos que cargás (productos, ventas, clientes, proveedores y demás) <B>son del comercio</B>. Los guardamos y los
              procesamos solo para prestarte el servicio, como explica la política de privacidad. Respecto de los datos de tus
              clientes, el comercio es el responsable y Genez los trata por su cuenta.
            </li>
            <li>Podés pedirnos una copia de tus datos en cualquier momento.</li>
            <li>
              Cuando el comercio queda suspendido o se da de baja, guardamos sus datos <B>90 días</B> por si volvés. Pasado ese plazo los
              borramos, salvo lo que la ley nos obligue a conservar, como los comprobantes fiscales emitidos.
            </li>
            <li>
              Si cargás datos de tus clientes, sos responsable de tener su consentimiento y de cumplir con la Ley 25.326 de Protección
              de los Datos Personales.
            </li>
          </Lista>
        </Seccion>

        <Seccion n={10} titulo="Uso correcto">
          <p>
            No se puede usar Genez para actividades ilegales, para cargar datos que no tenés derecho a usar, para intentar acceder a
            datos de otros comercios, para sobrecargar o vulnerar el sistema, ni para revender el acceso. Si pasa, podemos suspender la
            cuenta: te avisamos el motivo y, salvo que el caso sea grave o urgente, te damos un plazo para corregirlo.
          </p>
        </Seccion>

        <Seccion n={11} titulo="Factura electrónica, Mercado Pago e inteligencia artificial">
          <Lista>
            <li>
              <B>Factura electrónica (Pro):</B> el sistema emite comprobantes con tu certificado de ARCA y tu punto de venta. Tus datos
              fiscales, el certificado y lo que facturás son responsabilidad del comercio. Si ARCA o internet no responden, la factura
              queda guardada y se pide después.
            </li>
            <li>
              <B>Mercado Pago para cobrar:</B> si conectás tu cuenta, guardamos tu credencial cifrada y la usamos solo para consultar
              tus cobros. Podés desconectarla cuando quieras.
            </li>
            <li>
              <B>Asistente con inteligencia artificial (Pro):</B> las preguntas y las fotos de remitos se procesan con un proveedor de
              inteligencia artificial (Anthropic). Las respuestas son orientativas y no reemplazan tu criterio ni el de un contador. Lo
              que se lee de un remito nunca se carga solo: lo revisás y lo confirmás vos.
            </li>
          </Lista>
        </Seccion>

        <Seccion n={12} titulo="Disponibilidad">
          <p>
            Trabajamos para que Genez funcione siempre y hacemos copias de seguridad diarias de la base de datos. Si se corta internet,
            las ventas se guardan en el equipo y se mandan cuando vuelve la conexión. Aun así puede haber interrupciones por
            mantenimiento o por fallas de proveedores (hosting, base de datos, internet, ARCA, Mercado Pago). Avisamos con anticipación
            el mantenimiento programado siempre que podamos.
          </p>
        </Seccion>

        <Seccion n={13} titulo="Responsabilidad">
          <p>
            Genez es una herramienta: los datos que cargás, los precios que ponés, lo que facturás y las decisiones que tomás son del
            comercio. Respondemos por los daños que causemos por no prestar el servicio como dicen estos términos.
          </p>
          <p>
            No respondemos por lo que no depende de nosotros: cortes de internet o de luz del comercio, fallas de ARCA, de Mercado Pago
            o de otros servicios externos, ni por el uso indebido de contraseñas que el comercio no cuidó.
          </p>
          <p>
            Cuando el comercio contrata Genez para su actividad comercial y no como consumidor final, nuestra responsabilidad se limita
            al daño directo y hasta el total que pagó por Genez en los 12 meses anteriores al hecho. Este límite no se aplica a los
            daños causados con dolo o culpa grave (Código Civil y Comercial, art. 1743), ni restringe ninguno de los derechos que la Ley
            24.240 de Defensa del Consumidor le reconoce a quien sea consumidor.
          </p>
        </Seccion>

        <Seccion n={14} titulo="Cambios en estos términos">
          <p>
            Si cambiamos estos términos, te avisamos por mail y en el sistema con al menos 30 días de anticipación, diciéndote qué
            cambia. Si no estás de acuerdo, podés darte de baja antes de esa fecha sin ningún costo. Los cambios no alcanzan a lo que ya
            pagaste.
          </p>
        </Seccion>

        <Seccion n={15} titulo="Ley y jurisdicción">
          <p>
            Rigen las leyes de la República Argentina. Si sos consumidor, son competentes los tribunales de tu domicilio (Código Civil
            y Comercial, art. 1109), y podés hacer tu reclamo ante la autoridad de Defensa del Consumidor de tu jurisdicción. En los
            demás casos, son competentes los tribunales ordinarios {CIUDAD}.
          </p>
          <p>Antes de cualquier reclamo, escribinos: casi todo se resuelve hablando.</p>
        </Seccion>
      </main>

      <footer className="border-t border-borde">
        <div className="max-w-3xl mx-auto px-5 py-5 text-xs text-texto-tenue flex flex-wrap gap-4">
          <span>© {new Date().getFullYear()} Genez · Argentina</span>
          <a href="/privacidad" className="hover:text-texto">Privacidad</a>
          <a href="/arrepentimiento" className="hover:text-texto">Botón de arrepentimiento</a>
        </div>
      </footer>
    </div>
  );
}
