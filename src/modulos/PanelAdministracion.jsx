/* ============================================================
   ADMINISTRACIÓN: TODO EN UN SOLO LUGAR (08/10)
   ============================================================

   Nehuen comparó con Vendi y Ventario y eligió la forma de Ventario: un
   solo lugar con todo lo que se administra, con un menú propio a la
   izquierda y cada cosa a la derecha. "Que tenga ese aspecto, con una
   visual linda, pero que no sea una copia".

   Lo que se tomó: la estructura (menú interno con título y bajada por
   sección, un encabezado por sección, el estado de la configuración y el
   plan a la vista). Lo que no: los gradientes, las esquinas grandes y el
   color fuerte. Va con las reglas de DISENO.md —borde de 1px, esquinas
   discretas, casi sin sombras, un solo acento—, que son las de todo
   Genez.

   No hay contenido nuevo acá: cada sección es la pantalla que ya existía
   (los apartados de Ajustes, Equipo, Permisos, Mi plan). Esto es el
   marco, y el Resumen que dice qué falta configurar.
   ============================================================ */

import React from "react";
import {
  LayoutDashboard, Store, Receipt, ReceiptText, Tags, Users, Printer, UserCog, ShieldCheck, CreditCard, KeyRound,
  ChevronRight, Check, ArrowRight, Eye, Globe, ShoppingBag,
} from "lucide-react";
import { Card } from "../ui/Base.jsx";

/* Las secciones, en el orden del menú interno y agrupadas. `puerta` es el
   módulo que tiene que poder ver quien entra para que aparezca. */
export const SECCIONES_ADMIN = [
  { grupo: "Tu negocio", k: "resumen", n: "Resumen", d: "Qué está listo y qué falta", i: LayoutDashboard, puerta: "administracion" },
  { grupo: "Tu negocio", k: "negocio", n: "Datos del negocio", d: "Identidad, contacto, datos fiscales y logo", i: Store, puerta: "ajustes" },
  { grupo: "Tu negocio", k: "presencia", n: "Presencia online", d: "Tu página: horarios, contacto, redes y cómo se compra", i: Globe, puerta: "ajustes" },
  { grupo: "Tu negocio", k: "tienda", n: "Tienda online", d: "Qué vendés por internet, cómo se entrega y los pedidos", i: ShoppingBag, puerta: "tienda" },
  { grupo: "Tu negocio", k: "modulos", n: "Módulos", d: "Cuáles se ven en el menú y cuáles ocultás", i: Eye, puerta: "ajustes" },
  { grupo: "Cómo se vende", k: "cobros", n: "Cobros y facturas", d: "Medios de pago, caja, comprobantes y Mercado Pago", i: Receipt, puerta: "ajustes" },
  { grupo: "Cómo se vende", k: "precios", n: "Precios y stock", d: "Listas, redondeos, reposición y margen", i: Tags, puerta: "ajustes" },
  { grupo: "Cómo se vende", k: "clientes", n: "Clientes", d: "Los puntos que suman al comprar", i: Users, puerta: "ajustes" },
  { grupo: "Cómo se vende", k: "ticket", n: "Ticket y factura", d: "Qué sale en el papel, viéndolo mientras lo elegís", i: ReceiptText, puerta: "ajustes" },
  { grupo: "Cómo se vende", k: "equipos", n: "Equipos", d: "Impresora, comandera, balanza y sonidos", i: Printer, puerta: "ajustes" },
  { grupo: "Tu gente", k: "equipo", n: "Equipo", d: "Quién trabaja, accesos y horarios", i: UserCog, puerta: "equipo" },
  { grupo: "Tu gente", k: "permisos", n: "Permisos", d: "Qué puede hacer cada rol", i: ShieldCheck, puerta: "permisos" },
  { grupo: "Tu cuenta", k: "plan", n: "Mi plan", d: "Tu suscripción, cambiarla o darla de baja", i: CreditCard, puerta: "plan" },
  { grupo: "Tu cuenta", k: "cuenta", n: "Mi cuenta", d: "Contraseña y descarga de tus datos", i: KeyRound, puerta: "ajustes" },
];

/* Lo que se mira para decir "terminá de configurarlo". Solo lo que se ve
   en la config del comercio; cada uno lleva a donde se completa. */
export function estadoDeConfiguracion(ajustes) {
  const f = ajustes.fiscal || {};
  const c = ajustes.contacto || {};
  const m = ajustes.marca || {};
  return [
    { n: "Nombre del negocio", ok: !!String(ajustes.negocio || "").trim(), ir: "negocio" },
    { n: "Logo", ok: !!(m.logoParaOscuro || m.logoParaClaro || m.logo), ir: "negocio" },
    { n: "Razón social y CUIT", ok: !!(String(f.razonSocial || "").trim() && String(f.cuit || "").replace(/\D/g, "").length === 11), ir: "negocio" },
    { n: "Condición frente al IVA", ok: !!f.condicion, ir: "negocio" },
    { n: "Dirección y teléfono", ok: !!(String(c.direccion || f.domicilio || "").trim() && String(c.telefono || c.whatsapp || "").trim()), ir: "negocio" },
  ];
}

const rotulo = "text-[11px] uppercase tracking-[0.1em] font-bold";

export function CentroAdministracion({ negocio, plan, secciones, actual, onElegir, aparte = null, children }) {
  const s = secciones.find((x) => x.k === actual) || secciones[0];
  const grupos = [...new Set(secciones.map((x) => x.grupo))];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[272px_1fr] gap-6 items-start">
      {/* El menú propio. En la computadora queda fijo al costado; en el
          celular es una tira que se desliza, para no tapar el contenido. */}
      <div className="lg:sticky lg:top-4">
        <Card className="p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-borde">
            <div className={`${rotulo} text-acento`}>Administración</div>
            <div className="f-d text-xl mt-1 truncate">{negocio || "Tu negocio"}</div>
            <p className="text-xs text-texto-tenue mt-1 leading-relaxed">La identidad y el funcionamiento de tu negocio, en un solo lugar.</p>
            {plan && <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-texto-suave border border-borde rounded-md px-2 py-0.5"><CreditCard size={12} /> {plan}</div>}
          </div>
          <nav className="hidden lg:block p-2">
            {grupos.map((g) => (
              <div key={g} className="mb-1">
                <div className={`${rotulo} text-texto-tenue px-3 pt-3 pb-1.5`}>{g}</div>
                {secciones.filter((x) => x.grupo === g).map((x) => {
                  const aca = x.k === s.k;
                  return (
                    <button key={x.k} data-seccion={x.k} onClick={() => onElegir(x.k)}
                      className={`relative w-full flex items-start gap-3 text-left rounded-lg px-3 py-2.5 transition-colors ${aca ? "bg-acento-suave" : "hover:bg-superficie-2"}`}>
                      {aca && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-acento" />}
                      <x.i size={17} className={`mt-0.5 shrink-0 ${aca ? "text-acento" : "text-texto-tenue"}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${aca ? "font-semibold text-texto" : "font-medium text-texto"}`}>{x.n}</span>
                        <span className="block text-xs text-texto-tenue leading-snug mt-0.5">{x.d}</span>
                      </span>
                      <ChevronRight size={15} className={`mt-1 shrink-0 ${aca ? "text-acento" : "text-texto-tenue"}`} />
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </Card>
        <div className="lg:hidden flex gap-1.5 overflow-x-auto mt-3 -mx-1 px-1 pb-1 [-webkit-overflow-scrolling:touch]">
          {secciones.map((x) => (
            <button key={x.k} data-seccion={x.k} onClick={() => onElegir(x.k)}
              className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold rounded-md border px-3 py-2 ${x.k === s.k ? "border-acento bg-acento-suave text-texto" : "border-borde text-texto-suave"}`}>
              <x.i size={14} /> {x.n}
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-0 space-y-5">
        {/* El encabezado de la sección: de qué se trata antes del detalle. */}
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 max-w-2xl">
              <div className={`${rotulo} text-acento flex items-center gap-1.5`}><s.i size={13} /> {s.grupo}</div>
              <h1 className="f-d text-2xl md:text-[28px] leading-tight mt-1.5">{s.n}</h1>
              <p className="text-sm text-texto-suave mt-1.5 leading-relaxed">{s.d}.</p>
            </div>
            {aparte}
          </div>
        </Card>
        {children}
      </div>
    </div>
  );
}

/* El resumen: lo que falta configurar, el plan y los atajos a cada sección. */
export function ResumenAdministracion({ ajustes, secciones, onElegir, plan, pruebaHasta }) {
  const items = estadoDeConfiguracion(ajustes);
  const hechos = items.filter((x) => x.ok).length;
  const pct = Math.round((hechos / items.length) * 100);
  const otras = secciones.filter((x) => x.k !== "resumen");
  /* Un cajero entra a Administración por Equipo: lo que no puede tocar
     (los datos del negocio, el plan) no se le muestra. */
  const hay = (k) => secciones.some((x) => x.k === k);
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">
      <div className="grid sm:grid-cols-2 gap-3">
        {otras.map((x) => (
          <button key={x.k} onClick={() => onElegir(x.k)} className="text-left group">
            <Card className="p-5 h-full transition-shadow group-hover:shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-md border border-borde flex items-center justify-center shrink-0"><x.i size={16} className="text-acento" /></span>
                <span className="font-semibold flex-1">{x.n}</span>
                <ArrowRight size={15} className="text-texto-tenue group-hover:text-texto" />
              </div>
              <p className="text-sm text-texto-suave mt-2 leading-relaxed">{x.d}.</p>
            </Card>
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {hay("negocio") && <Card className="p-5">
          <div className={`${rotulo} text-texto-tenue`}>Estado de la configuración</div>
          <div className="f-d text-lg mt-1">{pct === 100 ? "Está todo listo" : "Terminá de configurarlo"}</div>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1 h-1.5 rounded-full bg-superficie-3 overflow-hidden"><div className="h-full rounded-full bg-acento" style={{ width: `${pct}%` }} /></div>
            <span className="f-m text-sm font-semibold">{pct}%</span>
          </div>
          <ul className="mt-4 space-y-1">
            {items.map((x) => (
              <li key={x.n}>
                <button onClick={() => onElegir(x.ir)} className="w-full flex items-center gap-2.5 text-left text-sm rounded-md px-2 py-1.5 -mx-2 hover:bg-superficie-2">
                  {x.ok
                    ? <Check size={14} className="text-bien shrink-0" />
                    : <span className="w-2 h-2 rounded-full bg-ojo shrink-0 mx-[3px]" />}
                  <span className={`flex-1 ${x.ok ? "text-texto-tenue" : "text-texto"}`}>{x.n}</span>
                  {!x.ok && <span className="text-[11px] text-texto-tenue">completar</span>}
                </button>
              </li>
            ))}
          </ul>
        </Card>}

        {plan && hay("plan") && (
          <Card className="p-5 bg-superficie-2">
            <div className={`${rotulo} text-texto-tenue`}>Tu plan</div>
            <div className="f-d text-2xl mt-1">{plan}</div>
            {pruebaHasta && <p className="text-xs text-texto-suave mt-1">Prueba hasta el {pruebaHasta.split("-").reverse().join("/")}.</p>}
            <button onClick={() => onElegir("plan")}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-md bg-acento text-sobre-acento text-sm font-semibold px-4 py-2.5 hover:opacity-90">
              Ver mi plan <ArrowRight size={15} />
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}
