/* ============================================================
   ONBOARDING · bienvenida, primeros pasos y ayuda (06/10, 0137)
   ============================================================

   Lo pidió Nehuen: que quien entra sepa cómo se usa, cómo funciona y qué
   hace cada cosa. Hasta acá, el que se registraba caía en la pantalla de
   cobro con la caja cerrada y nada le decía por dónde empezar.

   - Bienvenida: la primera vez que una persona entra a un comercio nuevo.
     Distinta para quien configura (el dueño) y para un empleado.
   - PrimerosPasos: en Inicio, para quien configura, mientras el comercio
     es nuevo. Se tilda solo con los datos (src/datos/onboarding.js);
     lo que no se puede saber solo, se tilda a mano.
   - BotonAyuda: "¿Cómo se usa?" arriba de cada sección, con la guía de
     src/ayuda/guias.js.
   - CentroDeAyuda: todas las guías juntas, con buscador y el WhatsApp de
     soporte.

   Lo visto se guarda por persona en la base (0137): no vuelve a salir en
   otra computadora.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, CircleHelp, Search, X, MessageCircle, Sparkles, PlayCircle } from "lucide-react";
import { Boton, Card, Modal } from "../ui/Base.jsx";
import { GUIAS, GENERALES, guiaDe } from "./guias.js";
import { marcarOnboarding, cargarProgreso } from "../datos/onboarding.js";
import { miCuenta } from "../datos/autoservicio.js";
import { cargarTarifasPublicas } from "../datos/tarifas.js";
import { useRecorridos } from "./Recorrido.jsx";
import { PANTALLAS } from "./recorridos.js";

/* Los recorridos guiados de una lista, como botones "Mostrame cómo". */
function Mostrame({ lista, iniciar, alIniciar }) {
  if (!lista.length) return null;
  return (
    <div className="mt-4 border border-borde rounded-lg divide-y divide-borde">
      {lista.map((r) => (
        <button key={r.id} type="button" onClick={() => { if (alIniciar) alIniciar(); iniciar(r.id); }}
          className="w-full text-left px-3 py-2.5 hover:bg-superficie-2 flex items-center gap-3">
          <PlayCircle size={18} className="text-acento shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Mostrame cómo: {r.titulo.charAt(0).toLowerCase() + r.titulo.slice(1)}</span>
            <span className="block text-xs text-texto-suave">{r.d} Paso a paso, en tu pantalla.</span>
          </span>
          <ChevronRight size={15} className="text-texto-tenue shrink-0" />
        </button>
      ))}
    </div>
  );
}

/* ---------- La guía de una sección, en un panel ---------- */

function Guia({ g }) {
  return (
    <div>
      <p className="text-sm text-texto-suave">{g.para}</p>
      {g.pasos && g.pasos.length > 0 && (
        <ol className="mt-4 space-y-3">
          {g.pasos.map((p, i) => (
            <li key={i} className="flex gap-3">
              <span className="f-m shrink-0 w-6 h-6 rounded-full border border-borde text-xs flex items-center justify-center text-texto-suave">{i + 1}</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{p.t}</div>
                <div className="text-sm text-texto-suave">{p.d}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {g.consejos && g.consejos.length > 0 && (
        <div className="mt-4 border-t border-borde pt-3 space-y-1.5">
          {g.consejos.map((c, i) => <p key={i} className="text-xs text-texto-suave">· {c}</p>)}
        </div>
      )}
    </div>
  );
}

export function BotonAyuda({ k, rubro }) {
  const [abierto, setAbierto] = useState(false);
  const { disponibles, iniciar } = useRecorridos();
  const g = guiaDe(k, rubro);
  if (!g) return null;
  /* Primero el recorrido de la pantalla (todas lo tienen), después los de
     las tareas que se hacen en ella. */
  const deAca = [
    ...(PANTALLAS[k] ? [{ id: `pantalla-${k}`, titulo: "Recorrer esta pantalla", d: "Qué es cada parte." }] : []),
    ...disponibles.filter((r) => r.modulo === k),
  ];
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1 text-xs font-semibold text-texto-suave hover:text-texto border border-borde rounded-full px-2.5 py-1 hover:bg-superficie-2">
        <CircleHelp size={13} /> ¿Cómo se usa?
      </button>
      {abierto && (
        <Modal open onClose={() => setAbierto(false)} ancho="max-w-lg">
          <div className="p-6">
            <div className="flex items-start justify-between gap-3">
              <h3 className="f-d text-lg">{g.titulo}: cómo se usa</h3>
              <button type="button" onClick={() => setAbierto(false)} className="text-texto-tenue hover:text-texto" aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="mt-3"><Guia g={g} /></div>
            <Mostrame lista={deAca} iniciar={iniciar} alIniciar={() => setAbierto(false)} />
          </div>
        </Modal>
      )}
    </>
  );
}

/* ---------- El Centro de ayuda ---------- */

const normal = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const textoDe = (g) => normal([g.titulo, g.para, ...(g.pasos || []).flatMap((p) => [p.t, p.d]), ...(g.consejos || [])].join(" "));

export function CentroDeAyuda({ rubro, secciones, ir, onCerrar }) {
  const { disponibles, iniciar } = useRecorridos();
  const [busca, setBusca] = useState("");
  const [abierta, setAbierta] = useState(null);
  const [whatsapp, setWhatsapp] = useState(null);
  useEffect(() => {
    cargarTarifasPublicas().then((t) => setWhatsapp((t && t.whatsapp) || null)).catch(() => setWhatsapp(null));
  }, []);

  /* Las de las secciones que este comercio tiene, en el orden del menú,
     y después las generales. */
  const todas = useMemo(() => [
    ...GENERALES,
    ...secciones.map((k) => guiaDe(k, rubro)).filter(Boolean),
  ], [secciones, rubro]);
  const q = normal(busca.trim());
  const lista = q ? todas.filter((g) => textoDe(g).includes(q)) : todas;
  const guia = abierta && todas.find((g) => g.k === abierta);

  return (
    <Modal open onClose={onCerrar} ancho="max-w-2xl">
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="f-d text-lg">{guia ? guia.titulo : "Ayuda"}</h3>
            {!guia && <p className="text-sm text-texto-suave">Cómo se usa cada parte de Genez.</p>}
          </div>
          <button type="button" onClick={onCerrar} className="text-texto-tenue hover:text-texto" aria-label="Cerrar"><X size={18} /></button>
        </div>

        {guia ? (
          <div className="mt-3">
            <Guia g={guia} />
            <Mostrame lista={disponibles.filter((r) => r.modulo === guia.k)} iniciar={iniciar} />
            <div className="flex flex-wrap gap-2 mt-5">
              <Boton size="sm" variant="ghost" onClick={() => setAbierta(null)}>Volver a la ayuda</Boton>
              {GUIAS[guia.k] && <Boton size="sm" onClick={() => { onCerrar(); ir(guia.k); }}>Ir a {guia.titulo} <ChevronRight size={14} /></Boton>}
            </div>
          </div>
        ) : (
          <>
            <label className="mt-4 flex items-center gap-2 border border-borde rounded-md px-3 py-2 bg-superficie focus-within:border-acento">
              <Search size={15} className="text-texto-tenue" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus placeholder="Buscá: stock, impresora, factura, descuento…"
                className="flex-1 bg-transparent outline-none text-sm" />
            </label>
            {!q && disponibles.length > 0 && (
              <div className="mt-4">
                <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">Paso a paso, en tu pantalla</div>
                <div className="mt-2 grid sm:grid-cols-2 gap-2">
                  {disponibles.map((r) => (
                    <button key={r.id} type="button" onClick={() => iniciar(r.id)}
                      className="text-left border border-borde rounded-lg px-3 py-2 hover:bg-superficie-2 flex items-center gap-2.5">
                      <PlayCircle size={17} className="text-acento shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold truncate">{r.titulo}</span>
                        <span className="block text-xs text-texto-suave truncate">{r.d}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mt-4">Las guías</div>
              </div>
            )}
            <ul className="mt-3 divide-y divide-borde border border-borde rounded-lg max-h-[50vh] overflow-y-auto">
              {lista.map((g) => (
                <li key={g.k}>
                  <button type="button" onClick={() => setAbierta(g.k)} className="w-full text-left px-4 py-3 hover:bg-superficie-2 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{g.titulo}</div>
                      <div className="text-xs text-texto-suave truncate">{g.para}</div>
                    </div>
                    <ChevronRight size={15} className="text-texto-tenue shrink-0" />
                  </button>
                </li>
              ))}
              {!lista.length && <li className="px-4 py-6 text-sm text-texto-suave text-center">No encontramos nada con "{busca}". Probá con otra palabra, o escribinos.</li>}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-texto-suave">¿No encontrás lo que buscás?</span>
              <div className="flex gap-2">
                {whatsapp && (
                  <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola, tengo una consulta sobre Genez.")}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-borde hover:bg-superficie-2">
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                )}
                <a href="mailto:soporte@genez.com.ar" className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-borde hover:bg-superficie-2">
                  soporte@genez.com.ar
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------- La bienvenida ---------- */

const PRIMERO = {
  minimercado: "cargar tus productos",
  gastronomia: "cargar tu carta y dibujar tu salón",
  servicios: "cargar tus servicios y los horarios de tu equipo",
};

export function Bienvenida({ nombre, comercio, rubro, configura, alListo }) {
  const [paso, setPaso] = useState(0);
  /* La pantalla de los ejemplos, solo si el comercio los tiene: uno armado
     a mano por Genez arranca vacío. Mientras no se sabe, no se muestra. */
  const [conEjemplos, setConEjemplos] = useState(false);
  useEffect(() => {
    if (!configura) return undefined;
    let vigente = true;
    miCuenta().then((c) => { if (vigente) setConEjemplos(!!(c && c.ejemplos)); }).catch(() => {});
    return () => { vigente = false; };
  }, [configura]);
  const quien = String(nombre || "").trim().split(" ")[0];
  const pantallas = configura ? [
    { t: `Hola${quien ? `, ${quien}` : ""}. Bienvenido a Genez`, d: [
      `Este es el sistema de ${comercio}: cobrar, controlar el stock, la caja y ver cómo te va, todo en un lugar.`,
      "Te mostramos en un minuto cómo está organizado." ] },
    conEjemplos && { t: "Lo que ves son datos de ejemplo", d: [
      "Cargamos productos, clientes y ventas de muestra para que veas cómo se ve con datos. Probá todo: nada de eso es real.",
      "Cuando quieras, los borrás con \"Borrar ejemplos\" en el aviso de arriba. Lo que cargues vos queda." ] },
    { t: "Cómo está organizado", d: [
      "El menú tiene una sección por tarea. La primera vez que entres a cada una, te la mostramos paso a paso, sola. Después, \"¿Cómo se usa?\" arriba de cada pantalla te la vuelve a explicar cuando quieras.",
      "El botón naranja de arriba es para cobrar. Y el signo de pregunta, junto a tu nombre, abre toda la ayuda." ] },
    { t: "Por dónde empezar", d: [
      `En Inicio vas a ver tus primeros pasos: lo que conviene dejar listo, empezando por ${PRIMERO[rubro] || PRIMERO.minimercado}. Se tildan solos a medida que los hacés.`,
      "Si te trabás, escribinos por WhatsApp desde la ayuda." ] },
  ].filter(Boolean) : [
    { t: `Hola${quien ? `, ${quien}` : ""}. Bienvenido a Genez`, d: [
      `Este es el sistema de ${comercio}. Ves las secciones que tu rol tiene habilitadas.`,
      "Arriba de cada pantalla, \"¿Cómo se usa?\" te explica qué se hace ahí, paso a paso." ] },
    { t: "Si necesitás ayuda", d: [
      "El signo de pregunta, junto a tu nombre, abre todas las guías con un buscador.",
      "Si te falta una sección o un permiso, pedíselo a quien configura el comercio." ] },
  ];
  const p = pantallas[paso];
  const ultima = paso === pantallas.length - 1;
  return (
    <Modal open onClose={() => alListo(null)} ancho="max-w-md">
      <div className="p-6">
        <div className="flex items-center gap-2 text-acento"><Sparkles size={16} /><span className="text-[11px] uppercase tracking-widest font-semibold">{paso + 1} de {pantallas.length}</span></div>
        <h3 className="f-d text-xl mt-2">{p.t}</h3>
        <div className="mt-3 space-y-2">{p.d.map((x, i) => <p key={i} className="text-sm text-texto-suave">{x}</p>)}</div>
        <div className="mt-6 flex items-center justify-between gap-2">
          <button type="button" onClick={() => alListo(null)} className="text-xs text-texto-tenue hover:text-texto">Saltear</button>
          <div className="flex gap-2">
            {paso > 0 && <Boton variant="ghost" onClick={() => setPaso(paso - 1)}>Atrás</Boton>}
            {!ultima && <Boton onClick={() => setPaso(paso + 1)}>Seguir</Boton>}
            {ultima && configura && <Boton variant="ghost" onClick={() => alListo("cobro")}>Ir a cobrar</Boton>}
            {/* Un empleado se queda donde entró: puede no tener Inicio. */}
            {ultima && <Boton onClick={() => alListo(configura ? "inicio" : null)}>{configura ? "Ver mis primeros pasos" : "Empezar"}</Boton>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Los primeros pasos ---------- */

/* `hecho(progreso, ctx)` dice si ya está; los que no se pueden saber
   solos (`manual`) se tildan con "Ya lo hice". `ir` es la sección. */
function pasosDe(rubro, ctx) {
  const datos = { k: "datos", t: "Completá los datos del negocio", d: "Dirección, teléfono y horarios: salen en el ticket.", ir: "ajustes",
    hecho: () => !!(ctx.contacto.direccion || ctx.contacto.telefono) };
  const ejemplos = { k: "ejemplos", t: "Borrá los datos de ejemplo", d: "Cuando ya viste cómo funciona: así ves solo lo tuyo.", accion: "ejemplos",
    hecho: () => ctx.ejemplos === false };
  const equipo = { k: "equipo", t: "Sumá a tu equipo", d: "Que cada uno entre con su usuario y vea solo lo que le toca.", ir: "permisos", opcional: true,
    hecho: (p) => p.personas > 1 };
  const ticket = { k: "ticket", t: "Probá la impresora", d: "Elegí el ancho del papel en Ajustes e imprimí un ticket de prueba.", ir: "ajustes", manual: true, opcional: true };
  const cobros = { k: "cobros", t: "Configurá cómo te pagan", d: "Las comisiones de tus medios de pago, y Mercado Pago o factura electrónica si los usás.", ir: "ajustes", manual: true, opcional: true };

  if (rubro === "servicios") return [
    datos,
    { k: "servicios", t: "Cargá tus servicios", d: "Qué ofrecés, cuánto dura y cuánto sale.", ir: "servicios", hecho: (p) => p.servicios > 0 },
    { k: "horarios", t: "Cargá a tu equipo y sus horarios", d: "La agenda solo ofrece turnos en los horarios cargados.", ir: "equipo", manual: true },
    { k: "turno", t: "Dá tu primer turno", d: "Desde la agenda, en un horario libre.", ir: "agenda", hecho: (p) => p.turnos > 0 },
    ejemplos, equipo, cobros,
  ];
  if (rubro === "gastronomia") return [
    datos,
    { k: "productos", t: "Cargá tu carta", d: "Platos y bebidas con su precio. Con una planilla va más rápido: Productos → Exportar, completar e Importar.", ir: "productos", hecho: (p) => p.productos >= 5 },
    { k: "salon", t: "Dibujá tu salón", d: "Las mesas como están en tu local, para tomar pedidos tocando la mesa.", ir: "comandas", manual: true, opcional: true },
    { k: "venta", t: "Hacé tu primer pedido", d: "Por mostrador o en una mesa, y cobralo.", ir: "comandas", hecho: (p) => p.ventas > 0 },
    ejemplos, ticket, equipo, cobros,
  ];
  return [
    datos,
    { k: "productos", t: "Cargá tus productos", d: "Con una planilla va más rápido: Productos → Exportar, completala e Importar. O de a uno, escaneando el código.", ir: "productos", hecho: (p) => p.productos >= 5 },
    { k: "stock", t: "Contá tu stock", d: "Cuánto hay de cada producto, en Stock → Conteo de inventario. Así sabés qué reponer.", ir: "stock", manual: true, opcional: true },
    { k: "venta", t: "Hacé tu primera venta", d: "Abrí la caja y cobrá algo, aunque sea de prueba.", ir: "cobro", hecho: (p) => p.ventas > 0 },
    ejemplos, ticket, equipo, cobros,
  ];
}

/* `cobrar` abre la pantalla de cobro, que no es una sección del menú. */
/* Qué recorrido guiado enseña cada paso (07/10). */
const RECORRIDO_DEL_PASO = { productos: "cargar-producto", stock: "contar-stock", turno: "dar-turno", equipo: "sumar-equipo" };

export function PrimerosPasos({ empresaId, creadaEn, rubro, ajustes, onboarding, setOnboarding, ir, cobrar, secciones }) {
  const { disponibles, iniciar } = useRecorridos();
  const recorridoDe = (k) => {
    const id = k === "venta" ? (rubro === "gastronomia" ? "tomar-pedido" : "primera-venta") : RECORRIDO_DEL_PASO[k];
    return id && disponibles.some((r) => r.id === id) ? id : null;
  };
  const [progreso, setProgreso] = useState(null);
  const [ejemplos, setEjemplos] = useState(null);
  useEffect(() => {
    let vigente = true;
    cargarProgreso(empresaId, creadaEn).then((p) => { if (vigente) setProgreso(p); }).catch(() => { if (vigente) setProgreso({}); });
    miCuenta().then((c) => { if (vigente) setEjemplos(c ? !!c.ejemplos : null); }).catch(() => {});
    return () => { vigente = false; };
  }, [empresaId, creadaEn]);

  if (!progreso) return null;
  const hechosAMano = Array.isArray(onboarding.pasos_hechos) ? onboarding.pasos_hechos : [];
  const ctx = { contacto: ajustes.contacto || {}, ejemplos };
  /* Un paso que lleva a una sección que este comercio no tiene no se
     muestra: sería mandarlo a una pantalla que no existe. */
  const pasos = pasosDe(rubro, ctx)
    .filter((p) => !p.ir || p.ir === "cobro" || secciones.includes(p.ir))
    .filter((p) => p.k !== "ejemplos" || ejemplos !== null)
    .map((p) => ({ ...p, listo: hechosAMano.includes(p.k) || (p.hecho ? !!p.hecho(progreso, ctx) : false) }));
  const hechos = pasos.filter((p) => p.listo).length;
  if (!pasos.length || hechos === pasos.length) return null;

  const guardar = async (clave, valor) => {
    try { setOnboarding(await marcarOnboarding(clave, valor)); } catch { /* sin guardar no se rompe nada: vuelve a salir */ }
  };
  const tildar = (k) => guardar("pasos_hechos", [...new Set([...hechosAMano, k])]);

  return (
    <Card className="p-4 mb-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">Primeros pasos</div>
          <p className="text-sm text-texto-suave mt-0.5">Lo que conviene dejar listo para arrancar. Se tilda solo a medida que lo hacés.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="f-m text-sm">{hechos} de {pasos.length}</span>
          <button type="button" onClick={() => guardar("pasos_ocultos", true)} className="text-xs text-texto-tenue hover:text-texto">Ocultar</button>
        </div>
      </div>
      <div className="mt-2 h-1.5 bg-superficie-2 rounded-full overflow-hidden">
        <div className="h-full bg-acento rounded-full" style={{ width: `${(hechos / pasos.length) * 100}%` }} />
      </div>
      <ul className="mt-3 divide-y divide-borde">
        {pasos.map((p) => (
          <li key={p.k} className="py-2.5 flex items-center gap-3">
            <span className={`w-5 h-5 shrink-0 rounded-full border flex items-center justify-center ${p.listo ? "bg-bien border-bien text-sobre-acento" : "border-borde"}`}>
              {p.listo && <Check size={12} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-medium ${p.listo ? "text-texto-tenue line-through" : ""}`}>
                {p.t}{p.opcional && !p.listo && <span className="text-texto-tenue font-normal"> · si lo usás</span>}
              </div>
              {!p.listo && <div className="text-xs text-texto-suave">{p.d}</div>}
            </div>
            {!p.listo && (
              <div className="flex gap-1.5 shrink-0">
                {p.manual && <Boton size="sm" variant="quiet" onClick={() => tildar(p.k)}>Ya lo hice</Boton>}
                {recorridoDe(p.k) && <Boton size="sm" variant="quiet" onClick={() => iniciar(recorridoDe(p.k))}><PlayCircle size={14} /> Mostrame</Boton>}
                {p.ir && <Boton size="sm" variant="ghost" onClick={() => (p.ir === "cobro" ? cobrar() : ir(p.ir))}>Ir</Boton>}
                {p.accion === "ejemplos" && <span className="text-[11px] text-texto-tenue self-center">En el aviso de arriba</span>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
