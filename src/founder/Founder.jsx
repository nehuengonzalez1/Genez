/* ============================================================
   GENEZ FOUNDER · el marco
   ============================================================

   El sistema interno de la empresa Genez, no de un comercio. Se abre
   desde el panel de plataforma, y solo si la sesión es miembro del
   equipo interno (interno_miembros, 0113). Se carga aparte (React.lazy
   en Genezapp): la computadora de un comercio nunca descarga este
   código. Aun así, lo que protege los datos es la base, no esto.

   El naranja de Founder es el de la marca, #F4510B, y vale solo acá
   adentro: .founder redefine el acento (index.css) sin tocar el del
   resto del sistema.

   El menú muestra solo lo que ya funciona. Cada fase suma sus
   secciones; no hay entradas vacías "próximamente".
   ============================================================ */

import React, { useEffect, useState } from "react";
import { Home, Users, Columns3, ListChecks, CalendarDays, Store, LifeBuoy, Boxes, BookOpen, Target, Megaphone, BarChart3, Wallet, Compass, Settings, ArrowLeftRight, LogOut } from "lucide-react";
import { LogoGenez } from "../ui/Logo.jsx";
import { puedeArea } from "../datos/interno.js";
import { InicioFounder } from "./Inicio.jsx";
import { ConfiguracionFounder } from "./Configuracion.jsx";
import { Prospectos } from "./Prospectos.jsx";
import { Ficha } from "./Ficha.jsx";
import { Pipeline } from "./Pipeline.jsx";
import { Tareas } from "./Tareas.jsx";
import { Agenda } from "./Agenda.jsx";
import { Clientes } from "./Clientes.jsx";
import { FichaCliente } from "./FichaCliente.jsx";
import { Soporte, Ticket } from "./Soporte.jsx";
import { Producto } from "./Producto.jsx";
import { FichaElemento, FichaProyecto } from "./FichaProducto.jsx";
import { Documentos, Documento } from "./Documentos.jsx";
import { Objetivos } from "./Objetivos.jsx";
import { Marketing, FichaContenido } from "./Marketing.jsx";
import { Informes } from "./Informes.jsx";
import { Finanzas } from "./Finanzas.jsx";
import { Prospector } from "./Prospector.jsx";

const SECCIONES = [
  { k: "inicio", n: "Inicio", i: Home, area: null },
  { k: "prospectos", n: "Prospectos", i: Users, area: "crm" },
  { k: "prospector", n: "Prospector", i: Compass, area: "crm" },
  { k: "pipeline", n: "Pipeline", i: Columns3, area: "crm" },
  { k: "tareas", n: "Tareas", i: ListChecks, area: "tareas" },
  { k: "agenda", n: "Agenda", i: CalendarDays, area: "agenda" },
  { k: "objetivos", n: "Objetivos", i: Target, area: "crm" },
  { k: "informes", n: "Informes", i: BarChart3, area: "crm" },
  { k: "clientes", n: "Clientes", i: Store, area: "clientes" },
  { k: "soporte", n: "Soporte", i: LifeBuoy, area: "soporte" },
  { k: "producto", n: "Producto", i: Boxes, area: "producto" },
  { k: "documentos", n: "Documentos", i: BookOpen, area: "docs" },
  { k: "marketing", n: "Marketing", i: Megaphone, area: "marketing" },
  { k: "finanzas", n: "Finanzas", i: Wallet, area: "finanzas" },
  { k: "config", n: "Configuración", i: Settings, area: "config" },
];

export default function Founder({ sesion, onComercios, onSalir }) {
  const interno = sesion.interno;
  const visibles = SECCIONES.filter((s) => !s.area || puedeArea(interno, s.area));
  const [seccion, setSeccionCruda] = useState("inicio");
  /* Las fichas (prospecto, cliente, ticket) se abren encima de cualquier
     sección, apiladas: del cliente a un ticket y "volver" vuelve al
     cliente, no a la lista. Cambiar de sección vacía la pila. "nuevo" es
     una acción rápida: abre la sección con el alta ya abierta, una vez. */
  const [pila, setPila] = useState([]);
  const [nuevo, setNuevo] = useState(null);
  const encima = pila[pila.length - 1];
  const apilar = (tipo) => (id) => { if (id) setPila((p) => [...p, { tipo, id }]); };
  const volver = () => setPila((p) => p.slice(0, -1));
  const setSeccion = (k) => { setPila([]); setNuevo(null); setSeccionCruda(k); };
  const abrir = apilar("prospecto");
  const abrirCliente = apilar("cliente");
  const abrirTicket = apilar("ticket");
  const abrirElemento = apilar("elemento");
  const abrirProyecto = apilar("proyecto");
  const abrirDocumento = apilar("documento");
  const abrirContenido = apilar("contenido");
  /* Un documento nuevo no tiene id todavía: se apila con lo que ya se sabe
     (desde un proyecto, su proyecto; desde el roadmap, su elemento). */
  const nuevoDocumento = (inicial) => setPila((p) => [...p, { tipo: "documento", id: null, inicial, n: Date.now() }]);
  const crear = (que, para) => {
    const destino = { prospecto: "prospectos", tarea: "tareas", evento: "agenda", ticket: "soporte" }[que];
    setPila([]); setSeccionCruda(destino); setNuevo({ que, para });
  };
  const nuevoQue = nuevo && nuevo.que;
  const [avisos, setAvisos] = useState([]);
  const toast = (texto, tono = "bien") => {
    const id = Math.random().toString(36).slice(2);
    setAvisos((a) => [...a, { id, texto, tono }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 3200);
  };
  const actual = visibles.find((s) => s.k === seccion) || visibles[0];
  /* En el teléfono el menú es una fila que se desliza: la sección actual
     tiene que quedar a la vista, también cuando se llega desde un atajo. */
  useEffect(() => {
    const b = document.querySelector(".founder nav [data-activa]");
    if (b) b.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [actual && actual.k]);

  return (
    <div className="founder min-h-screen bg-fondo text-texto md:flex">
      <aside className="md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 border-b md:border-b-0 md:border-r border-borde bg-superficie flex md:flex-col">
        <div className="px-3 md:px-4 py-3 md:py-4 flex items-center gap-2.5 shrink-0">
          <LogoGenez size={28} claro />
          <div className="leading-tight hidden md:block">
            <div className="f-d text-base">Genez</div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-acento">Founder</div>
          </div>
        </div>
        <nav className="flex md:flex-col gap-0.5 px-2 md:py-2 overflow-x-auto md:overflow-visible flex-1">
          {visibles.map((s) => {
            const I = s.i;
            const activa = actual && actual.k === s.k;
            return (
              <button key={s.k} onClick={() => setSeccion(s.k)} data-activa={activa || undefined}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${activa ? "bg-acento-suave text-texto font-semibold" : "text-texto-suave hover:bg-superficie-2 hover:text-texto"}`}>
                <I size={16} className={activa ? "text-acento" : ""} /> {s.n}
              </button>
            );
          })}
        </nav>
        <div className="hidden md:block px-2 py-3 border-t border-borde space-y-0.5">
          <div className="px-3 pb-2 text-[11px] text-texto-tenue truncate">{sesion.nombre} · {interno.rol}</div>
          <button onClick={onComercios} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-texto-suave hover:bg-superficie-2 hover:text-texto">
            <ArrowLeftRight size={16} /> Comercios
          </button>
          <button onClick={onSalir} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-texto-suave hover:bg-superficie-2 hover:text-texto">
            <LogOut size={16} /> Salir
          </button>
        </div>
        <div className="md:hidden flex items-center gap-1 px-2">
          <button onClick={onComercios} aria-label="Comercios" className="p-2 text-texto-suave"><ArrowLeftRight size={18} /></button>
          <button onClick={onSalir} aria-label="Salir" className="p-2 text-texto-suave"><LogOut size={18} /></button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-8 max-w-6xl">
        {encima && encima.tipo === "prospecto" && <Ficha key={encima.id} id={encima.id} volver={volver} abrirCliente={abrirCliente} toast={toast} />}
        {encima && encima.tipo === "cliente" && <FichaCliente key={encima.id} id={encima.id} volver={volver} abrirProspecto={abrir} abrirTicket={abrirTicket}
          nuevoTicket={(clienteId) => crear("ticket", clienteId)} toast={toast} />}
        {encima && encima.tipo === "ticket" && <Ticket key={encima.id} id={encima.id} volver={volver} abrirCliente={abrirCliente} abrirTicket={abrirTicket}
          abrirElemento={abrirElemento} puedeProducto={puedeArea(interno, "producto")} toast={toast} />}
        {encima && encima.tipo === "elemento" && <FichaElemento key={encima.id} id={encima.id} volver={volver} abrirTicket={abrirTicket} abrirProyecto={abrirProyecto}
          abrirDocumento={abrirDocumento} nuevoDocumento={puedeArea(interno, "docs") ? nuevoDocumento : null} toast={toast} />}
        {encima && encima.tipo === "proyecto" && <FichaProyecto key={encima.id} id={encima.id} volver={volver} abrirElemento={abrirElemento}
          abrirDocumento={abrirDocumento} nuevoDocumento={puedeArea(interno, "docs") ? nuevoDocumento : null} toast={toast} />}
        {encima && encima.tipo === "contenido" && <FichaContenido key={encima.id} id={encima.id} volver={volver} abrirProspecto={abrir} toast={toast} />}
        {encima && encima.tipo === "documento" && <Documento key={encima.id || encima.n} id={encima.id} inicial={encima.inicial} volver={volver} abrirDocumento={abrirDocumento} toast={toast} />}
        {!encima && <>
          {actual && actual.k === "inicio" && <InicioFounder sesion={sesion} ir={setSeccion} abrir={abrir} abrirCliente={abrirCliente} toast={toast} nuevo={crear} />}
          {actual && actual.k === "prospectos" && <Prospectos key={nuevoQue || "p"} abrir={abrir} toast={toast} nuevoAlAbrir={nuevoQue === "prospecto"} />}
          {actual && actual.k === "prospector" && <Prospector abrir={abrir} toast={toast} />}
          {actual && actual.k === "pipeline" && <Pipeline abrir={abrir} abrirCliente={abrirCliente} puedeClientes={puedeArea(interno, "clientes")} toast={toast} />}
          {actual && actual.k === "tareas" && <Tareas key={nuevoQue || "t"} abrir={abrir} toast={toast} nuevaAlAbrir={nuevoQue === "tarea"} />}
          {actual && actual.k === "agenda" && <Agenda key={nuevoQue || "a"} abrir={abrir} toast={toast} nuevoAlAbrir={nuevoQue === "evento"} />}
          {actual && actual.k === "clientes" && <Clientes abrirCliente={abrirCliente} toast={toast} />}
          {actual && actual.k === "objetivos" && <Objetivos toast={toast} />}
          {actual && actual.k === "informes" && <Informes />}
          {actual && actual.k === "finanzas" && <Finanzas toast={toast} />}
          {actual && actual.k === "marketing" && <Marketing abrirContenido={abrirContenido} toast={toast} />}
          {actual && actual.k === "producto" && <Producto abrirElemento={abrirElemento} abrirProyecto={abrirProyecto} toast={toast} />}
          {actual && actual.k === "documentos" && <Documentos abrirDocumento={abrirDocumento} nuevoDocumento={nuevoDocumento} />}
          {actual && actual.k === "soporte" && <Soporte key={nuevoQue === "ticket" ? `n${nuevo.para || ""}` : "s"} abrirTicket={abrirTicket} toast={toast}
            nuevoPara={nuevoQue === "ticket" ? nuevo.para || "" : undefined} />}
          {actual && actual.k === "config" && <ConfiguracionFounder interno={interno} toast={toast} />}
        </>}
      </main>

      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {avisos.map((t) => (
          <div key={t.id} data-aviso={t.tono === "mal" ? "mal" : "bien"}
            className={`text-sm px-3.5 py-2.5 rounded-lg shadow-lg border ${t.tono === "mal" ? "bg-mal-suave text-mal border-mal" : "bg-superficie-3 text-texto border-borde-fuerte"}`}>
            {t.texto}
          </div>
        ))}
      </div>
    </div>
  );
}
