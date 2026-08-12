/* ============================================================
   14. APP + 0. GENEZ · plataforma, comercios, roles y permisos
   ============================================================ */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  LayoutDashboard, Barcode, Package, Boxes, Truck, Wallet, BarChart3,
  Sparkles, Settings, Plus, Check, AlertTriangle, ChevronLeft, Upload,
  ArrowRight, Store, CalendarDays, ClipboardList, Users, Sun, Moon, LogOut, ZapOff
} from "lucide-react";
import { mulberry32, uid, HOY, DATA, PEDIDOS_INICIALES, PROV_INFO, fdatel } from "../datos/generador.js";
import { entrar as autenticar } from "../datos/sesion.js";
import { CLIENTES_INICIALES, MEDIOS_INICIALES, FISCAL_INICIAL, LISTAS_INICIALES, money, nf, numeroALetras } from "../utils/helpers.js";
import { cargarProductos, guardarProducto, crearProducto } from "../datos/items.js";
import { armarVenta, registrarVenta, siguienteNumero, ponerNumeradorAlDia, resumenDelDia } from "../datos/ventas.js";
import { encolar, quitar, cuantasPendientes, vigilarCola } from "../datos/cola.js";
import { calcular, insights } from "../utils/diagnostico.js";
import { ScanCtx, useScanner, beep, campanita, hablar, Boton, Modal, Vacio } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";
import { Inicio } from "../modulos/Inicio.jsx";
import { POS, FormProducto } from "../modulos/Vender.jsx";
import { Productos } from "../modulos/Productos.jsx";
import { Stock } from "../modulos/Stock.jsx";
import { Compras, Picking } from "../modulos/Compras.jsx";
import { Clientes } from "../modulos/Clientes.jsx";
import { Caja } from "../modulos/Caja.jsx";
import { Reportes } from "../modulos/Reportes.jsx";
import { Asistente } from "../modulos/Asistente.jsx";
import { Ajustes, FichaRapida, AvisoCobro } from "../modulos/Ajustes.jsx";
/* ============================================================
   14. APP
   ============================================================ */

/* ============================================================
   0. GENEZ · plataforma, comercios, roles y permisos
   ============================================================

   El sistema del comercio es un inquilino dentro de Genez. Quién entra
   determina a qué comercio accede, qué módulos ve y qué puede hacer adentro.

   Hoy los datos viven en memoria: alcanza para mostrar el producto completo,
   pero la validación real tiene que correr en el servidor. Mientras eso no
   exista, no repartir credenciales fuera de una demo acompañada.           */

const MODULOS = [
  { k: "cobro", n: "Cobro", d: "Punto de venta, tickets y vuelto", base: true },
  { k: "caja", n: "Caja", d: "Arqueo, gastos y cierre", base: true },
  { k: "ajustes", n: "Ajustes", d: "Configuración del negocio", base: true },
  { k: "productos", n: "Productos", d: "Catálogo, precios y listas" },
  { k: "stock", n: "Stock", d: "Alertas, vencimientos e inventario" },
  { k: "compras", n: "Compras", d: "Remitos, costos y proveedores" },
  { k: "pedidos", n: "Pedidos", d: "Preparación con pistola" },
  { k: "clientes", n: "Clientes", d: "Facturación A, B y C" },
  { k: "reportes", n: "Informes", d: "Ventas, márgenes y rubros" },
  { k: "asistente", n: "Asistente", d: "Diagnóstico y consultas" },
];

const MODULOS_BASE = MODULOS.filter((m) => m.base).map((m) => m.k);

/* Cada rol define qué módulos alcanza y qué acciones puede ejecutar.
   "todos" evita tener que actualizar el rol del dueño cada vez que se agrega
   un módulo nuevo. */
const ROLES = [
  {
    k: "dueno", n: "Dueño", d: "Acceso completo al comercio",
    modulos: "todos",
    permisos: { verCostos: true, descuentos: true, anular: true, cerrarCaja: true, cambiarPrecios: true, ajustes: true },
  },
  {
    k: "encargado", n: "Encargado", d: "Todo menos la configuración",
    modulos: ["cobro", "caja", "productos", "stock", "compras", "pedidos", "clientes", "reportes", "asistente"],
    permisos: { verCostos: true, descuentos: true, anular: true, cerrarCaja: true, cambiarPrecios: true, ajustes: false },
  },
  {
    k: "cajero", n: "Cajero", d: "Cobra, sin ver costos ni ganancias",
    modulos: ["cobro", "caja", "pedidos", "clientes"],
    permisos: { verCostos: false, descuentos: false, anular: false, cerrarCaja: false, cambiarPrecios: false, ajustes: false },
  },
  {
    k: "repositor", n: "Repositor", d: "Stock y preparación de pedidos",
    modulos: ["stock", "pedidos", "productos"],
    permisos: { verCostos: false, descuentos: false, anular: false, cerrarCaja: false, cambiarPrecios: false, ajustes: false },
  },
];

const rolPorK = (k) => ROLES.find((r) => r.k === k) || ROLES[ROLES.length - 1];

/* Lo que puede hacer una sesión: cruce entre lo que el comercio contrató y lo
   que el rol habilita. Un módulo no contratado no lo ve ni el dueño. */
function permisosDe(sesion) {
  if (!sesion) return { modulos: [], permisos: {}, esPlataforma: false };
  if (sesion.tipo === "plataforma") {
    return { modulos: MODULOS.map((m) => m.k), permisos: rolPorK("dueno").permisos, esPlataforma: true };
  }
  const rol = rolPorK(sesion.rol);
  const contratados = sesion.comercio.modulos || [];
  const delRol = rol.modulos === "todos" ? contratados : rol.modulos;
  return {
    modulos: contratados.filter((k) => delRol.includes(k)),
    permisos: rol.permisos,
    esPlataforma: false,
  };
}

function FormUsuario({ abierto, inicial, modulosComercio, onGuardar, onCerrar }) {
  const [d, setD] = useState({});
  useEffect(() => { if (abierto) setD({ rol: "cajero", ...(inicial || {}) }); }, [abierto, inicial]);
  if (!abierto) return null;
  const rol = rolPorK(d.rol);
  const alcance = rol.modulos === "todos" ? modulosComercio : modulosComercio.filter((k) => rol.modulos.includes(k));

  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-5">
        <h3 className="f-d text-lg">{d.id ? "Editar acceso" : "Nuevo acceso"}</h3>
        <div className="space-y-3 mt-4">
          <Campo label="Nombre de la persona">
            <input value={d.nombre || ""} onChange={(e) => setD({ ...d, nombre: e.target.value })} autoFocus className={inputCls} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Usuario">
              <input value={d.usuario || ""} onChange={(e) => setD({ ...d, usuario: e.target.value.replace(/\s/g, "").toLowerCase() })} className={`${inputCls} f-m`} />
            </Campo>
            <Campo label="Contraseña">
              <input value={d.clave || ""} onChange={(e) => setD({ ...d, clave: e.target.value })} className={`${inputCls} f-m`} />
            </Campo>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Rol</span>
            <div className="grid sm:grid-cols-2 gap-2 mt-1.5">
              {ROLES.map((r) => (
                <button key={r.k} onClick={() => setD({ ...d, rol: r.k })}
                  className={`text-left px-3 py-2 rounded-xl border ${d.rol === r.k ? "border-orange-400 bg-orange-50" : "border-stone-200 hover:bg-stone-50"}`}>
                  <div className="text-sm font-semibold">{r.n}</div>
                  <div className="text-[11px] text-stone-500">{r.d}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
          <div className="text-[11px] uppercase tracking-widest text-stone-400 font-bold mb-2">Con este rol va a ver</div>
          <div className="flex flex-wrap gap-1.5">
            {alcance.length === 0 && <span className="text-sm text-stone-400">Ningún módulo: el comercio no tiene contratado nada de lo que este rol alcanza.</span>}
            {alcance.map((k) => (
              <span key={k} className="text-[11px] px-2 py-0.5 rounded-lg bg-white border border-stone-200 text-stone-700">{(MODULOS.find((m) => m.k === k) || {}).n}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-stone-500">
            {[["verCostos", "Ver costos y márgenes"], ["descuentos", "Dar descuentos"], ["anular", "Anular ventas"],
              ["cerrarCaja", "Cerrar caja"], ["cambiarPrecios", "Cambiar precios"], ["ajustes", "Configuración"]].map(([k, n]) => (
              <span key={k} className={rol.permisos[k] ? "text-emerald-700 font-semibold" : "text-stone-400 line-through"}>{n}</span>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => onGuardar(d)} disabled={!d.nombre || !d.usuario || !d.clave}><Check size={15} /> Guardar</Boton>
        </div>
      </div>
    </Modal>
  );
}

function PanelGenez({ sesion, comercios, setComercios, onEntrarComo, onSalir, tema, setTema, imagenFondo, setImagenFondo }) {
  const [abierto, setAbierto] = useState(null);       // comercio en detalle
  const [altaUsuario, setAltaUsuario] = useState(null);
  const [altaComercio, setAltaComercio] = useState(false);
  const archivoFondo = useRef(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const c = comercios.find((x) => x.id === abierto) || null;

  const actualizar = (id, cambios) => setComercios((cs) => cs.map((x) => (x.id === id ? { ...x, ...cambios } : x)));

  const alternarModulo = (k) => {
    if (MODULOS_BASE.includes(k)) return;             // el piso mínimo no se saca
    const tiene = c.modulos.includes(k);
    actualizar(c.id, { modulos: tiene ? c.modulos.filter((x) => x !== k) : [...c.modulos, k] });
  };

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <header className="border-b border-stone-800 px-4 md:px-6 py-3 flex items-center gap-3">
        <LogoGenez size={34} claro conNombre />
        <span className="text-[10px] uppercase tracking-widest text-orange-400 font-bold border border-orange-500/40 rounded px-1.5 py-0.5">Administración</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-stone-400 hidden sm:block">{sesion.nombre}</span>
          <BotonTema tema={tema} setTema={setTema} oscuroFijo />
          <button onClick={onSalir} className="text-sm text-stone-400 hover:text-white">Salir</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6">
        {!c ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
              <div>
                <h1 className="f-d text-2xl">Comercios</h1>
                <p className="text-sm text-stone-400">{comercios.length} cuentas · {comercios.filter((x) => x.activo).length} activas</p>
              </div>
              <button onClick={() => { setAltaComercio(true); setNombreNuevo(""); }}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-stone-950 font-bold rounded-xl px-3.5 py-2 text-sm">
                <Plus size={15} /> Nuevo comercio
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              {comercios.map((x) => (
                <button key={x.id} onClick={() => setAbierto(x.id)}
                  className="text-left bg-stone-900 border border-stone-800 hover:border-stone-700 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{x.nombre}</div>
                      <div className="text-[11px] text-stone-500">Alta {x.alta} · {x.usuarios.length} usuario{x.usuarios.length !== 1 ? "s" : ""}</div>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border shrink-0 ${
                      x.activo ? "border-emerald-500/40 text-emerald-400" : "border-stone-700 text-stone-500"}`}>
                      {x.activo ? "Activo" : "Suspendido"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {x.modulos.filter((k) => !MODULOS_BASE.includes(k)).map((k) => (
                      <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">{(MODULOS.find((m) => m.k === k) || {}).n}</span>
                    ))}
                    {x.modulos.filter((k) => !MODULOS_BASE.includes(k)).length === 0 && (
                      <span className="text-[11px] text-stone-500">Solo los módulos base</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <section className="mt-8">
              <h2 className="text-[11px] uppercase tracking-widest text-stone-500 font-bold mb-2">Imagen del login</h2>
              <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="w-40 h-28 rounded-xl overflow-hidden border border-stone-800 shrink-0 relative bg-stone-950">
                    {imagenFondo
                      ? <img src={imagenFondo} alt="Fondo del login" className="w-full h-full object-cover" />
                      : <div className="absolute inset-0 flex items-center justify-center text-[11px] text-stone-600 text-center px-2">Panel generado por el sistema</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-stone-400">
                      Podés reemplazar el panel izquierdo del login por una imagen propia. Se recorta al centro,
                      así que dejá los bordes sin nada importante.
                    </p>
                    <ul className="text-[11px] text-stone-500 mt-2 space-y-0.5">
                      <li><strong className="text-stone-400">Medida ideal:</strong> 1400 × 2000 px (vertical, proporción 7:10).</li>
                      <li><strong className="text-stone-400">Zona segura:</strong> los 200 px del borde derecho se funden con el fondo.</li>
                      <li><strong className="text-stone-400">Peso:</strong> hasta 2 MB. JPG o PNG.</li>
                      <li>En celular no se muestra: ahí el login va a pantalla completa.</li>
                    </ul>
                    <div className="flex items-center gap-2 mt-3">
                      <input ref={archivoFondo} type="file" accept="image/*" className="hidden"
                        onChange={(e) => {
                          const f = e.target.files[0]; e.target.value = "";
                          if (!f) return;
                          if (f.size > 2 * 1024 * 1024) return alert("La imagen supera los 2 MB. Reducila y volvé a intentar.");
                          const lector = new FileReader();
                          lector.onload = () => setImagenFondo(lector.result);
                          lector.readAsDataURL(f);
                        }} />
                      <button onClick={() => archivoFondo.current && archivoFondo.current.click()}
                        className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-stone-950 font-bold rounded-xl px-3.5 py-2 text-sm">
                        <Upload size={15} /> Cargar imagen
                      </button>
                      {imagenFondo && (
                        <button onClick={() => setImagenFondo(null)}
                          className="text-sm text-stone-400 hover:text-white px-2">Volver al panel del sistema</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            <button onClick={() => setAbierto(null)} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-white mb-4">
              <ChevronLeft size={16} /> Todos los comercios
            </button>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="f-d text-2xl">{c.nombre}</h1>
                <p className="text-sm text-stone-400">Alta {c.alta}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => actualizar(c.id, { activo: !c.activo })}
                  className={`text-sm font-semibold rounded-xl px-3 py-2 border ${c.activo ? "border-stone-700 text-stone-300 hover:bg-stone-900" : "border-emerald-500/40 text-emerald-400"}`}>
                  {c.activo ? "Suspender" : "Reactivar"}
                </button>
                <button onClick={() => onEntrarComo(c)}
                  className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-stone-950 font-bold rounded-xl px-3.5 py-2 text-sm">
                  Entrar al sistema <ArrowRight size={15} />
                </button>
              </div>
            </div>

            <section className="mt-6">
              <h2 className="text-[11px] uppercase tracking-widest text-stone-500 font-bold mb-2">Módulos contratados</h2>
              <div className="grid sm:grid-cols-2 gap-2">
                {MODULOS.map((m) => {
                  const tiene = c.modulos.includes(m.k);
                  return (
                    <button key={m.k} onClick={() => alternarModulo(m.k)} disabled={m.base}
                      className={`text-left px-3.5 py-2.5 rounded-xl border flex items-center gap-3 ${
                        m.base ? "border-stone-800 bg-stone-900/50 cursor-default"
                        : tiene ? "border-orange-500/50 bg-orange-500/10" : "border-stone-800 bg-stone-900 hover:border-stone-700"}`}>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">{m.n}</div>
                        <div className="text-[11px] text-stone-500">{m.d}</div>
                      </div>
                      {m.base
                        ? <span className="text-[10px] uppercase tracking-wider text-stone-500 shrink-0">incluido</span>
                        : <span className={`w-9 h-5 rounded-full shrink-0 relative transition-colors ${tiene ? "bg-orange-500" : "bg-stone-700"}`}>
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${tiene ? "left-4.5" : "left-0.5"}`} style={{ left: tiene ? 18 : 2 }} />
                          </span>}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[11px] uppercase tracking-widest text-stone-500 font-bold">Accesos</h2>
                <button onClick={() => setAltaUsuario({})} className="text-sm font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1">
                  <Plus size={14} /> Nuevo acceso
                </button>
              </div>
              <ul className="bg-stone-900 border border-stone-800 rounded-2xl divide-y divide-stone-800 overflow-hidden">
                {c.usuarios.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{u.nombre}</div>
                      <div className="f-m text-[11px] text-stone-500">{u.usuario} · {rolPorK(u.rol).n}</div>
                    </div>
                    <button onClick={() => setAltaUsuario(u)} className="text-xs text-stone-400 hover:text-white">Editar</button>
                    <button onClick={() => actualizar(c.id, { usuarios: c.usuarios.filter((x) => x.id !== u.id) })}
                      className="text-xs text-stone-600 hover:text-red-400">Quitar</button>
                  </li>
                ))}
                {c.usuarios.length === 0 && <li className="px-4 py-6 text-center text-sm text-stone-500">Sin accesos: nadie puede entrar todavía.</li>}
              </ul>
              <p className="text-[11px] text-stone-600 mt-2">
                El dueño del comercio puede crear los suyos desde adentro del sistema.
              </p>
            </section>
          </>
        )}
      </main>

      <FormUsuario abierto={!!altaUsuario} inicial={altaUsuario} modulosComercio={c ? c.modulos : []}
        onCerrar={() => setAltaUsuario(null)}
        onGuardar={(d) => {
          if (d.id) actualizar(c.id, { usuarios: c.usuarios.map((u) => (u.id === d.id ? { ...u, ...d } : u)) });
          else actualizar(c.id, { usuarios: [...c.usuarios, { ...d, id: "u" + uid() }] });
          setAltaUsuario(null);
        }} />

      <Modal open={altaComercio} onClose={() => setAltaComercio(false)} ancho="max-w-md">
        <div className="p-5">
          <h3 className="f-d text-lg">Nuevo comercio</h3>
          <p className="text-sm text-stone-500 mt-1">Arranca con los módulos base. Los demás se activan después.</p>
          <input value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} autoFocus placeholder="Nombre del comercio"
            className={`${inputCls} mt-3`} />
          <div className="flex justify-end gap-2 mt-4">
            <Boton variant="quiet" onClick={() => setAltaComercio(false)}>Cancelar</Boton>
            <Boton disabled={!nombreNuevo.trim()} onClick={() => {
              const nuevo = {
                id: "cm" + uid(), nombre: nombreNuevo.trim(), plan: "Base", modulos: [...MODULOS_BASE],
                alta: `${String(HOY.getMonth() + 1).padStart(2, "0")}/${HOY.getFullYear()}`, activo: true, usuarios: [],
              };
              setComercios((cs) => [...cs, nuevo]);
              setAltaComercio(false); setAbierto(nuevo.id);
            }}><Check size={15} /> Crear</Boton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function BotonTema({ tema, setTema, oscuroFijo = false }) {
  const oscuro = tema === "oscuro";
  return (
    <button
      onClick={() => setTema(oscuro ? "claro" : "oscuro")}
      title={oscuro ? "Pasar a modo claro" : "Pasar a modo oscuro"}
      aria-label={oscuro ? "Pasar a modo claro" : "Pasar a modo oscuro"}
      className={`shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${
        oscuroFijo
          ? "border-stone-700 text-stone-400 hover:text-white hover:border-stone-600"
          : "border-stone-200 text-stone-500 hover:text-stone-900 hover:bg-stone-50"}`}>
      {oscuro ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

/* El isotipo va incrustado como imagen para no depender de archivos sueltos
   que se puedan perder al mover el proyecto. Dos versiones del mismo trazo:
   oscura para fondos claros y clara para fondos oscuros. La palabra GENEZ va
   como texto, así se mantiene nítida a cualquier tamaño. */
const GENEZ_OSCURO = "data:image/png;base64,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";
const GENEZ_CLARO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHIAAABuCAYAAAD7yUedAAALjElEQVR42u2dTWhc1xXHf+eNrC5KqSGkOy8SuslGdpDcbIJc2mUSfRhGm1CS0kWwZYNsQTZtlHRoNqGxBI0isihtFiVgQfRBukyIRDZJLCwPgWxCBPUuxaCS3Vgzp4u57/nN85vRvHfvzLx58y4Mkj9m3sdv/uece+595wgZHqo65v8uIicx/3YemAbOAU+Z1wRQBaaC//ymqFSo61WmEL6MHOYQ4T8o3wP3Ub5A+U42OG453golvgU2aQho1u7VWJYBhuFFwE0Dsx0+YsJ/v6qO8W3Hw13gDM8Gf6qhCOg1dlH2ArCVR2B1hRKAVKgXIDvA8wGav3sReOUUcNFRTXTwWozCzjALzAZgF1kD9viBf/sAswRUMqq+SeBlYMnio8cDRS6IymZb09rlpyEG+CHwOcpH8j53ALRMiWcGC3Rs0BAj6rtu1DeROXv/SLUXGOdZaizpNXZp8HYWgI4NEmCgmCwD7AT1DLPUmHkM6AolKv0Nirx+A/Qhmt9vAHeAd4cGYjugwpd6jS29ypRUqAuo70NzBTKiwrmhBnga0EWW9ApnpUK9XzC9AajwFvBxLgC2AzrOLTw+9dWpK5R6DdTrswprlpHo8AAd51lfnVKhLhXqWu4dTK/XECMqHJ0RUqdeY0uvcFY2e2dqvR5DnDS+sN8qrGYK6Blm8XgQNrWZBhnxh3PA1wPyhRMdJ/aDUmfT1M5Ihbpe4aw6TMh4LiH6GZoMmNKdloTDJo3mSfIdD9kx2ZnDFrj+q9djnG1dZEk2OGYFzxVMcQnRjE2S5UVtTehnwH3gyPy8F10piT3nDzjDIT9F+CXC8zRXUH5tMjcSyea4hinUWJV1lrVMycWKiriAGMrQ9APiDrBvXrHQwqm/lr8HYQWvU9ZFl3iah8wgXEKZCeVYewfTQSZIhkSJVeBDYF9EDjqcA755P/XcQVBgAY9nzPsiOVKTZH8eeLcnQCMwbXK0knGIOwbgJ5HkeiJoia4rFFEGy1VXOIvHq8DvTMJcHcO8Keus2cCUjELcAT4Uke24YKpfEVN0vVHLlPgF150rtPlZc7LOblqYkhZiKDp1OUesAm/5AAcBr60ZXsGLKPQN5/Nj5Tl5nztapiSbyWCmAtkjiGvA66HAaeAATwW6yAyw5VSdDZ5gg/+Fj+N8HhmZ7C85VOFFEbnpQwxv98jSEGhu4lJELzEm6+zS4AkesuNkDjqO4PEpAHtIkjmmlwLipMPJ/howJSIH4awQGR8iqOxxomVKssGxvMc8NVatYfrJ9kX+KnucsNI9H+kWYuiPdxyl3ZZFZLXTvG8Yhr9NUjap6yJLNNdYXYx5WWe3W38pCdW45ShCvSwi21n1hWmBSoV64Ddd+csn+bGbZIGXAOKcI4gXfYhZ9YWpzK1JhMs6u8C8I3/5hlSod2NiJYFJrTmCeDDMpvTUL/4VzsoGx86U2eWU5HTSzRu+WUDsUpkbHIeUuWwVAI0jCB+onv4ZXp9M6uVRgNgCc4WSrLNmFc36Uew1XpLNzltFvE4m1fx8y1VgMwoQg1GhoWVK/MDr1LhrOTV5U0H85H4iRZqb/o7lVGN5JCGa5AE0pyUor6XO/DyaW77UaQOX10GNk5bZmx0RWY1bZhoZmGazldmBvtxLVUoH32ibSx2PqHskh4JQNmueD/jKahmsQwTrdfCNNhAv+/BGGWKLia1YmtjmvPKPXfvIkG+0Makj6Rc7mtjbxsQKu6lMbA1FmQn2x0asqdcDNf5llP1i2/ENqCI0eNtSla8CRLM9Xowar1uc7pq/p6ZQY0SVFeos4JnAZ80i8PkeIPo4vUQVid3qRhHgdBH8BI/c/Zefdf3GJ/nRX2WhUxbH/JxT1UbK163IF6IYnSJZx++VyJTDZpmqUGMSIIqkwdl2OSsc5FiocatQ42CHFwLwok2kWtzKDIA0pvCVlJ9RBe4V88YBgwxtP0zrGz8rAGZEkZZm9V/FbcwOyKdszGpxG7MDcjrl+4/Cm4qL2zlAkMY/plXkfnELs6PI86RPyRUgMwTynMX7C/+YkWFjVqt+MmGY/GNes09jLgKdYYKY16DMBsLRMF1opGjF+ZxxvGdjWu8Pmzk1P2s5FGTVI49VGmOGMannc3p5EzaVr46GCaIxrQc0H67N5fRjZIaBeTOPMEcGZLhOTw5hVkdKkTEwdwpFpo92MwMTKOcE5pENyHPDrkwzyjkws0cjp8g4mDkws/dHFmTOzOy+qOqhRVJgPA8LywMsHOxqjHuWE/tcZEpifGZ1iE5/R0RObEGeIycj8jzn1BDBPPKnHzbJ72lyNCJuYlhg7vsgbRT5mzwmDYYM5icA4mBpZzyPO+n6sH55Dvsqm1URuaCqY360VrWIXK8DqzlX5kEPvigu3NKH/i+eOdHPLD7sFXI6Qr29XL8mcVMOdD/67bB5wLWhqpP+SVKMU+erqrpleb8fe5TRz+zYbtt4udhp3rXPnXOUcGhRo4QOYJPhgeKJ5VOVaIarCtQtQaYX5zjTBj0FwFMTDu84grj22EwhXHvOgd0eK3xlW7/o4v4GMUlU6V5kY5Jt9v+dQpWxEMeAvzv62J22tW8dlWdp+20pQOotl2rsaPVCZvHQ8kCHhYl1Lo7uq6eEDnzDwQFHuniSo5I36axdJPNw6OCgc6MIswf3MXktox6Yg5Hzl71UYyJ35TiNdBiJ3Ar/2C9XFU7sujIJoxD8aJlSuBusQ5jpg8cehM1beVZmC8CY0qmWAWT6WKNHDjt3MFURv32DLjKji82lKV2hpKHKmxaisI/+e5RaOgwHQMMMNNx/QxdZ0hs09AaNMMzodSaMO9zNxx3PLR8zF8OoTgUJIJUp6TW2DMC6LlI3vy+B6cWc3sIlivilG5iOe0cGGXwy3lM5ToV+KWq9yhTCB7F9PMIt6f3udcmWshK3oZJuVdnlCSQdVeAPfkH7zDbJDrWxT9jxfD7ckj6yoavdvVwTkZtJN7Ml7eg6CXzdg3sVqDNLQH0/GKiw2RPyzYTddNrBjLuXOyIyn+b6u66q3QeYAMvA3wYJNGiBdJuGSBOWXmUKjz9yhtlUPTv8VkidYVZp7qMlzTUnKo/eJ5hVmrsVHgOa9iK7mUaw0OxfJZVH7RgCgMqM8Xua8hCHNPitbHDs+9nIHp7pcLyQ5vok+UW3nMDHPRbIGrAvItsd/HZiuH6ncr/zWwu8FUo84AWE3zsAGA5+7gYwI8qM3ts0h5B03+C+KDNOpfvAvbiL7Ua1fvOUWLAPeAG4BCwFXXJsAbaByZP8yJ+bpjt83jaWJn0jkf7DbAkKDNQj/GcfkiiyGXlOA08jXAqU5xpeHMyH7Mh7zOttSrLQoatOwpF6Mh7e66OqF2nuSelXFa3ZyJy2qqoYsEe+OQ6+bCuUqNDgCj/H41PgQktvqhraU4CtZmFPQZy0H3ehyBhljpGtp32DfZ8siMomdb3KFD/hq75BazWrGp2KuDyEdZ2dcKQlIvNko0JG+0fhBgPxLspzss6u3nYP0QnIMMxQIaLLAwY5+EKJj3zuKj/wq2AeueAeopWPbBf+G5jbqjrOcBZWcKnC10y/SHphTp0r8hRTe5nhKq7gQoU3+eZRNkdBegmxJyBjTO22ST2tjQDAVeML12SPE1+FbVsFZh2kDzOizpvARXJUyC8A+JAdA3DZV2E0Y9Tr0fNF3ch64wEwb5IIfxpa/+lPJ5oA35Z14wfLlKL52tyAjAZCMUBfxq7Ler/NpxoT+lEWAPYV5ClAD1T1dZpFJaYzpdIwvKb6/kGDfdngOCsABwKyA9ATmpVBVo1Kp2kWmUg7H6xagWuFt0eDf/rw/KlEv31gJkG2AxpWqYHqtwyeplmcqVuwE4kV1/x5F/gc2AsrL4D3LbBJI0sAMwEyCjQG6gmwbV6EihedM3CfMq+JOEUGn/VM7GEPqfE5cB/lC5TvwuDCysua+uLG/wEf8o9JOTCICwAAAABJRU5ErkJggg==";

/* La palabra también sale del logo original: escribirla con otra tipografía
   rompía la identidad de la marca. Proporción 537x56 del archivo. */
const PALABRA_OSCURO = "data:image/png;base64,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";
const PALABRA_CLARO = "data:image/png;base64,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";

/* Quién está adentro y cómo salir. En un mostrador se turnan varias personas
   en el mismo equipo: si no hay forma visible de cerrar sesión, el que llega
   después queda trabajando con el usuario del anterior. */
function Sesion({ sesion, onSalir, oscuro = false }) {
  const rol = sesion.comoAdmin ? "Administrador de Genez" : rolPorK(sesion.rol).n;
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="text-right leading-tight hidden sm:block">
        <div className={`text-xs font-semibold ${oscuro ? "text-white" : "text-stone-700"}`}>{sesion.nombre}</div>
        <div className="text-[10px] text-stone-400">{rol}</div>
      </div>
      <button onClick={onSalir} title="Cerrar sesión"
        className={`flex items-center gap-1.5 text-xs font-semibold rounded-xl px-2.5 py-2 border ${
          oscuro ? "border-white/20 text-white/80 hover:text-white hover:border-white/40"
                 : "border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50"}`}>
        <LogOut size={15} /> <span className="hidden sm:inline">Salir</span>
      </button>
    </div>
  );
}

function LogoGenez({ size = 40, claro = false, conNombre = false }) {
  const marca = (
    <img src={claro ? GENEZ_CLARO : GENEZ_OSCURO} alt="Genez"
      width={size} height={size} style={{ width: size, height: size, objectFit: "contain" }} />
  );
  if (!conNombre) return marca;
  // La palabra es muy alargada (537x56), así que a igual altura ocupa mucho
  // más ancho que el símbolo. Con 0.30 queda equilibrada al lado del isotipo.
  const altoPalabra = Math.round(size * 0.30);
  return (
    <span className="flex items-center" style={{ gap: size * 0.2 }}>
      {marca}
      <img src={claro ? PALABRA_CLARO : PALABRA_OSCURO} alt="Genez" aria-hidden="true"
        style={{ height: altoPalabra, width: altoPalabra * (537 / 56) }} />
    </span>
  );
}

/* Panel hexagonal del login.
   El relieve se logra con dos cosas: un degradado diagonal por celda (claro
   arriba-izquierda, oscuro abajo-derecha para los salientes, invertido para
   los hundidos) y una sombra propia en el borde inferior. Cada hexágono
   recibe una profundidad al azar pero estable, así el panel no "baila" entre
   recargas.
   Se puede reemplazar por una imagen propia desde Ajustes de la plataforma. */
function FondoHexagonal({ imagen }) {
  if (imagen) {
    return <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${imagen})` }} aria-hidden="true" />;
  }

  const filas = 11, columnas = 8, r = 62;
  const anchoHex = Math.sqrt(3) * r, altoHex = 2 * r;
  const centro = { x: 200, y: 520 };
  const rnd = mulberry32(7);

  const celdas = [];
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const x = c * anchoHex + (f % 2 ? anchoHex / 2 : 0);
      const y = f * altoHex * 0.75;
      const d = Math.hypot(x - centro.x, y - centro.y);
      const luz = Math.pow(Math.max(0, 1 - d / 380), 2);
      const v = rnd();
      // Tres alturas: hundido, al ras y saliente. Da la textura irregular.
      const rel = v < 0.34 ? -1 : v < 0.62 ? 0 : 1;
      celdas.push({ x, y, luz, rel, esc: rel === 1 ? 0.985 : 0.955 });
    }
  }

  const puntos = (x, y, k) => Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(x + r * k * Math.cos(a)).toFixed(1)},${(y + r * k * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 760 1080" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id="caraAlta" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#2A2A2A" /><stop offset="55%" stopColor="#181818" /><stop offset="100%" stopColor="#0E0E0E" />
        </linearGradient>
        <linearGradient id="caraBaja" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#070707" /><stop offset="45%" stopColor="#101010" /><stop offset="100%" stopColor="#1E1E1E" />
        </linearGradient>
        <linearGradient id="caraPlana" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#1A1A1A" /><stop offset="100%" stopColor="#121212" />
        </linearGradient>
        <radialGradient id="halo" cx={centro.x / 760} cy={centro.y / 1080} r="0.4">
          <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.34" />
          <stop offset="60%" stopColor="#FF6B00" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#FF6B00" stopOpacity="0" />
        </radialGradient>
        <filter id="difuso" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      <rect width="760" height="1080" fill="#070707" />

      {/* Sombra propia: lo que da la sensación de que la pieza está apoyada */}
      {celdas.filter((h) => h.rel === 1).map((h, k) => (
        <polygon key={"s" + k} points={puntos(h.x + 3, h.y + 5, h.esc)} fill="#000" opacity="0.75" />
      ))}

      {celdas.map((h, k) => (
        <g key={k}>
          <polygon points={puntos(h.x, h.y, h.esc)}
            fill={h.rel === 1 ? "url(#caraAlta)" : h.rel === -1 ? "url(#caraBaja)" : "url(#caraPlana)"} />
          {/* Filo superior claro: el canto que devuelve la luz */}
          <polygon points={puntos(h.x, h.y, h.esc)} fill="none"
            stroke={h.rel === 1 ? "#3A3A3A" : "#000"} strokeOpacity={h.rel === 0 ? 0.5 : 0.9} strokeWidth="1" />
          {h.luz > 0.02 && (
            <>
              <polygon points={puntos(h.x, h.y, h.esc)} fill="none" stroke="#FF6B00"
                strokeOpacity={Math.min(1, 0.2 + h.luz * 1.9)} strokeWidth={h.luz > 0.45 ? 2.6 : 1.7} />
              {h.luz > 0.3 && (
                <polygon points={puntos(h.x, h.y, h.esc)} fill="none" stroke="#FFA24D"
                  strokeOpacity={h.luz} strokeWidth="3.5" filter="url(#difuso)" />
              )}
            </>
          )}
        </g>
      ))}

      <rect width="760" height="1080" fill="url(#halo)" />
    </svg>
  );
}

function Login({ onEntrar, imagenFondo, errorInicial }) {
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState(errorInicial || "");
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    if (cargando) return;
    if (!usuario.trim() || !clave) return setError("Completá correo y contraseña.");

    setCargando(true);
    setError("");
    try {
      onEntrar(await autenticar(usuario, clave));
    } catch (e) {
      setError(e.message || "No pudimos validar tus datos. Probá de nuevo.");
      setCargando(false);
    }
  };

  const campo = "w-full bg-transparent border rounded-xl px-4 py-3.5 text-base mt-2 outline-none text-white transition-colors";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex">
      {/* El panel decorativo se esconde en celular: ahí manda el formulario */}
      <div className="hidden lg:block relative w-[46%] max-w-[680px] overflow-hidden">
        <FondoHexagonal imagen={imagenFondo} />
        {/* Degradado de salida: sin esto se ve un borde recto entre el panel
            y el formulario, y el conjunto parece dos piezas pegadas. */}
        <div className="absolute inset-y-0 right-0 w-56 pointer-events-none"
          style={{ background: "linear-gradient(to right, rgba(10,10,10,0) 0%, rgba(10,10,10,0.75) 55%, #0A0A0A 100%)" }} />
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <LogoGenez size={64} claro conNombre />
            <p className="text-stone-400 mt-4">Sistemas de gestión para comercios.</p>

            <div className="mt-9 space-y-5">
              <label className="block">
                <span className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">Correo</span>
                <input type="email" value={usuario} onChange={(e) => { setUsuario(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && entrar()} autoFocus autoCapitalize="none" autoCorrect="off"
                  autoComplete="username" disabled={cargando}
                  className={`${campo} border-orange-500/70 focus:border-orange-500`} />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">Contraseña</span>
                <input type="password" value={clave} onChange={(e) => { setClave(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && entrar()}
                  autoComplete="current-password" disabled={cargando}
                  className={`${campo} bg-white/5 border-white/10 focus:border-orange-500`} />
              </label>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/40 border border-red-900/60 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={15} className="shrink-0" /> {error}
                </div>
              )}

              <button onClick={entrar} disabled={cargando}
                className="w-full bg-orange-500 hover:bg-orange-400 active:bg-orange-600 disabled:opacity-60 text-stone-950 font-bold rounded-xl px-4 py-4 text-lg transition-colors">
                {cargando ? "Entrando…" : "Entrar"}
              </button>
            </div>
          </div>
        </div>

        <footer className="px-6 py-4 text-center text-[11px] text-stone-600">
          Genez · sistemas de gestión
        </footer>
      </div>
    </div>
  );
}

const NAV = [
  { k: "inicio", n: "Inicio", i: LayoutDashboard },
  { k: "pedidos", n: "Pedidos", i: ClipboardList },
  { k: "clientes", n: "Clientes", i: Users },
  { k: "productos", n: "Productos", i: Package },
  { k: "stock", n: "Stock", i: Boxes },
  { k: "compras", n: "Compras", i: Truck },
  { k: "caja", n: "Caja", i: Wallet },
  { k: "reportes", n: "Informes", i: BarChart3 },
  { k: "asistente", n: "Asistente", i: Sparkles },
  { k: "ajustes", n: "Ajustes", i: Settings },
];

const TITULOS = {
  inicio: ["Inicio", "Cómo viene el negocio hoy"],
  pedidos: ["Pedidos", "Preparación con pistola y control de faltantes"],
  clientes: ["Clientes", "Para emitir facturas A, B o C según corresponda"],
  productos: ["Productos", "Costos, precios y margen de todo tu catálogo"],
  stock: ["Stock", "Qué reponer, qué vence y qué no se mueve"],
  compras: ["Compras", "Cargar remitos, pedidos sugeridos y proveedores"],
  caja: ["Caja", "Ingresos, egresos y arqueo del día"],
  reportes: ["Informes", "Qué se vende, qué deja plata y qué cambió"],
  asistente: ["Asistente", "Tus datos explicados y qué conviene hacer"],
  ajustes: ["Ajustes", "Configuración del negocio y del sistema"],
};

/* Los formularios entregan texto y la base espera números: una cadena
   vacía en una columna numérica la rechaza el servidor, no el navegador. */
const numero = (v, x = 0) => (v === "" || v == null ? x : Number(v) || x);

function aDatosDeBase(d) {
  return {
    ...d,
    barcode: String(d.barcode || "").replace(/\D/g, ""),
    costo: numero(d.costo),
    precio: numero(d.precio),
    stock: numero(d.stock),
    stockMin: numero(d.stockMin),
    bulto: numero(d.bulto, 1),
    iva: numero(d.iva, 21),
    precios: Object.fromEntries(
      Object.entries(d.precios || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])
    ),
  };
}

function Sistema({ sesion, onSalir, setComercios, tema, setTema }) {
  const { modulos, permisos, esPlataforma } = permisosDe(sesion);
  const puedeVer = (k) => k === "inicio" || modulos.includes(k);
  const [vista, setVista] = useState(modulos.includes("cobro") ? "cobro" : "panel");
  const [tab, setTab] = useState("inicio");
  const [foco, setFoco] = useState(null);
  const [productos, setProductos] = useState([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [pendientes, setPendientes] = useState(cuantasPendientes());
  /* Lo vendido hoy sale de la base, no de los tickets de esta pantalla:
     si se cuenta lo de la sesión, refrescar borra la mitad del día y
     cambiar de equipo muestra otra cifra. */
  const [resumenDia, setResumenDia] = useState({ total: 0, tickets: 0 });
  const [pedidos, setPedidos] = useState([]);
  const [pedidosCli, setPedidosCli] = useState(PEDIDOS_INICIALES);
  const [provs, setProvs] = useState(PROV_INFO);
  const [clientes, setClientes] = useState(CLIENTES_INICIALES);
  const [altaProd, setAltaProd] = useState(null);
  const [ajustes, setAjustes] = useState({ negocio: "Super 25", cuit: "20-41564841-0", arca: false, medios: MEDIOS_INICIALES, fiscal: FISCAL_INICIAL, cobertura: 14, ancho: 80, sonido: true, listas: LISTAS_INICIALES, desc2: 10 });
  const [toasts, setToasts] = useState([]);

  const hoyDiario = DATA.diario[DATA.diario.length - 1];
  const [caja, setCaja] = useState(() => {
    const reparto = { efectivo: 0.42, debito: 0.17, credito: 0.12, mp: 0.25, transferencia: 0.04 };
    const movs = Object.entries(reparto).map(([medio, f], i) => ({
      id: uid(), tipo: "ingreso", medio, monto: Math.round(hoyDiario.ventas * f),
      detalle: "Ventas registradas · turno mañana", hora: `1${i}:0${i}`,
    }));
    movs.push({ id: uid(), tipo: "egreso", medio: "efectivo", monto: 18500, detalle: "Flete de bebidas", hora: "09:40", clase: "gasto" });
    return { abierta: true, saldoInicial: 50000, hora: "07:30", movimientos: movs, cierres: [] };
  });

  const [ficha, setFicha] = useState(null);
  const [pendientePOS, setPendientePOS] = useState(null);
  const pila = useRef([]);
  const push = useCallback((fn) => {
    pila.current.push(fn);
    return () => { pila.current = pila.current.filter((f) => f !== fn); };
  }, []);

  const [cobrosMP, setCobrosMP] = useState([]);
  const [mp, setMp] = useState({ activo: true, voz: true, configurado: null, ultimoChequeo: null, error: null });
  const vistos = useRef(new Set());
  const primeraVuelta = useRef(true);
  const abiertoDesde = useRef(Date.now());

  const toast = (texto, tono = "ok") => {
    const id = uid();
    setToasts((t) => [...t, { id, texto, tono }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  const empresaId = sesion.comercio.id;

  /* El catálogo ya no viene del generador: se pide a la base al montar.
     App remonta Sistema con cada comercio (key), así que una sola carga
     por comercio alcanza. */
  useEffect(() => {
    let vigente = true;
    setCargandoProductos(true);
    cargarProductos()
      .then((ps) => { if (vigente) setProductos(ps); })
      .catch((e) => {
        if (!vigente) return;
        setProductos([]);
        toast(e.message || "No pudimos cargar el catálogo.", "mal");
      })
      .finally(() => { if (vigente) setCargandoProductos(false); });
    return () => { vigente = false; };
  }, [empresaId]);

  /* Se cambia en pantalla primero y se confirma después con lo que devuelve
     la base, que es la que recalcula el costo anterior y el margen. Si el
     guardado falla se relee todo el catálogo: seguir mostrando un cambio que
     no se guardó es peor que perder lo que el usuario tenía en pantalla. */
  const actualizarProducto = useCallback(async (id, cambios, msg) => {
    setProductos((ps) => ps.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
    try {
      const fresco = await guardarProducto(id, cambios);
      if (fresco) {
        setProductos((ps) => ps.map((p) => {
          if (p.id !== id) return p;
          /* La relectura no trae el historial de costos, que lo escribe un
             disparador. Se conserva el que ya estaba y se le suma el punto
             nuevo, para no vaciar el gráfico hasta el próximo refresco. */
          const ultimo = p.historial[p.historial.length - 1];
          const sumar = fresco.costo > 0 && (!ultimo || ultimo.costo !== fresco.costo);
          return { ...fresco, historial: sumar ? [...p.historial, { fecha: new Date(), costo: fresco.costo }] : p.historial };
        }));
      }
      if (msg) toast(msg);
    } catch (e) {
      toast(e.message || "No se pudo guardar el producto.", "mal");
      try {
        const ps = await cargarProductos();
        setProductos(ps);
      } catch { /* el error ya se avisó; el catálogo queda como estaba */ }
    }
  }, []);

  const agregarProducto = useCallback(async (datos, msg) => {
    try {
      const p = await crearProducto(empresaId, aDatosDeBase(datos));
      setProductos((ps) => [...ps, p]);
      // Con msg en null el alta no avisa: la usa quien importa muchos de una.
      if (msg !== null) toast(msg || `${p.nombre} creado.`);
      return p;
    } catch (e) {
      toast(e.message || "No se pudo crear el producto.", "mal");
      return null;
    }
  }, [empresaId]);

  const k = useMemo(() => calcular(productos, DATA.diario, ajustes.cobertura), [productos, ajustes.cobertura]);
  const ins = useMemo(() => insights(k), [k]);

  const movCaja = (m) => setCaja((c) => ({
    ...c,
    movimientos: [...c.movimientos, { id: uid(), hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }), ...m }],
  }));

  const cobrar = ({ items, sub, desc, total, medio, ganancia, recibe, pagos, recargo, recargoNombre, fiscal, cliente }) => {
    const nro = siguienteNumero(empresaId, (ajustes.fiscal || FISCAL_INICIAL).puntoVenta || "0001");
    const ps = pagos && pagos.length ? pagos : [{ medio, monto: total }];
    const esFiscal = fiscal != null ? fiscal : !!ajustes.arca;
    const cae = String(74300000000000 + tickets.length * 137);

    /* La venta se arma antes que el ticket para que compartan el id: lo que
       se imprime en el mostrador y lo que queda en la base son la misma cosa,
       y por eso reintentar el envío no duplica nada. */
    const venta = armarVenta({
      empresaId,
      sucursalId: null,
      numero: nro,
      items, sub, desc, recargo: recargo || 0, total,
      pagos: ps, medio: ps[0].medio,
      fiscal: esFiscal,
      /* El cliente todavía vive en memoria y su id no es un uuid: mandarlo
         como cliente_id haría fallar la venta entera. Viaja en el
         comprobante hasta que Clientes se migre. */
      comprobante: { fiscal: esFiscal, cae, cliente: cliente ? { nombre: cliente.razonSocial, doc: cliente.doc } : null },
    });

    /* Primero al disco, después el ticket. Guardar es sincrónico, así que
       cuando esta línea termina la venta ya sobrevive a un corte de luz.
       Al revés habría un instante donde el ticket salió impreso y la venta
       no existe en ningún lado. */
    const guardada = encolar(venta);

    const t = {
      id: venta.id, nro, cae,
      hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      items, sub, desc, total, medio: ps[0].medio, pagos: ps, ganancia, recibe: recibe || null,
      recargo: recargo || 0, recargoNombre: recargoNombre || "", fiscal: esFiscal,
      cliente: cliente || null, sincronizada: null,
    };
    setTickets((x) => [t, ...x]);
    /* Se suma acá y no se relee del servidor: el encabezado tiene que
       moverse en el mismo momento en que se cobra, con conexión o sin ella.
       Al abrir la próxima vez, el número vuelve a salir de la base. */
    setResumenDia((r) => ({ total: r.total + t.total, tickets: r.tickets + 1 }));

    /* Sin lugar donde guardar (cuota llena, modo privado) la red pasa a ser
       la única red de contención. Hay que decirlo, no seguir como si nada. */
    if (!guardada) toast(`No se pudo guardar la venta ${nro} en este equipo. Si falla la conexión, se pierde.`, "mal");
    // Un movimiento de caja por medio de pago: así el arqueo y el reporte
    // por medio siguen cerrando aunque la venta se haya cobrado partida.
    ps.forEach((p) => movCaja({ tipo: "ingreso", medio: p.medio, monto: p.monto, detalle: `Venta ${nro}${ps.length > 1 ? " (parte)" : ""}` }));

    /* Se manda sin esperar: la venta ya ocurrió en el mostrador y el ticket
       tiene que salir ahora. Si no entra queda en la cola y se reintenta
       sola, así que no hace falta interrumpir a quien está cobrando. */
    const marcar = (ok) => setTickets((x) => x.map((v) => (v.id === t.id ? { ...v, sincronizada: ok } : v)));
    registrarVenta(venta)
      .then(() => { quitar(venta.id); marcar(true); })
      .catch(() => marcar(false))
      .finally(() => setPendientes(cuantasPendientes()));

    return t;
  };

  /* Antes de emitir el primer comprobante hay que saber por dónde va la
     numeración: si este equipo es nuevo, o le borraron el almacenamiento,
     su contador arranca en uno y repetiría números ya usados. */
  useEffect(() => {
    ponerNumeradorAlDia(empresaId, (ajustes.fiscal || FISCAL_INICIAL).puntoVenta || "0001");
  }, [empresaId]);

  useEffect(() => {
    let vigente = true;
    resumenDelDia(empresaId)
      .then((r) => { if (vigente) setResumenDia(r); })
      .catch(() => { /* sin conexión se arranca en cero y lo del día suma encima */ });
    return () => { vigente = false; };
  }, [empresaId]);

  /* La cola se vacía sola: al abrir, cuando el navegador avisa que volvió
     la conexión, y cada tanto por reloj. Lo último no sobra: el aviso no
     llega cuando el wifi sigue conectado pero sin salida a internet, que
     es la forma en que suele fallar en un local. */
  useEffect(() => vigilarCola((r) => {
    setPendientes(cuantasPendientes());
    if (r.enviadas) {
      toast(r.enviadas === 1
        ? "Se guardó en el servidor una venta que había quedado pendiente."
        : `Se guardaron en el servidor ${r.enviadas} ventas que habían quedado pendientes.`);
    }
    r.rechazadas.forEach((x) =>
      toast(`La venta ${x.venta.numero} quedó sin guardar: ${x.motivo}`, "mal"));
  }), []);

  // Un cobro que entra: suena, se lee en voz alta, se muestra y se registra.
  const recibirCobro = (c) => {
    if (vistos.current.has(c.id)) return;
    // Solo se anuncia lo que entró después de abrir la caja. Sin esto, un pago
    // anterior que Mercado Pago indexa con demora sonaría como si fuera nuevo.
    const cuando = new Date(c.fecha).getTime();
    if (isFinite(cuando) && cuando < abiertoDesde.current) { vistos.current.add(c.id); return; }
    vistos.current.add(c.id);
    setCobrosMP((x) => [...x, c]);
    campanita(ajustes.sonido);
    hablar(`Recibiste un pago de ${numeroALetras(c.monto)} pesos`, mp.voz && ajustes.sonido);
    movCaja({ tipo: "ingreso", medio: "mp", monto: c.monto, detalle: `Mercado Pago${c.pagador ? " · " + c.pagador : ""}` });
  };

  /* Se consulta siempre una ventana de los últimos minutos, no "lo nuevo desde
     la última vez". Mercado Pago tarda unos segundos en indexar el pago: con
     una ventana que avanza, el aviso aparece justo después de que la ventana
     pasó de largo y se pierde para siempre. Con ventana fija y solapada, el
     pago se ve igual aunque llegue tarde, y los repetidos los filtra `vistos`.
     La primera vuelta se marca como vista sin avisar, para no gritar cobros
     viejos al abrir la caja. */
  useEffect(() => {
    if (!mp.activo) return;
    let vivo = true;
    const consultar = async () => {
      try {
        const desde = new Date(Date.now() - 5 * 60000).toISOString();
        const r = await fetch(`/api/mp/pagos?desde=${encodeURIComponent(desde)}&t=${Date.now()}`);
        const d = await r.json();
        if (!vivo) return;
        setMp((m) => ({ ...m, configurado: !!d.configurado, ultimoChequeo: new Date(), error: d.error ? d.error.message : null }));
        const pagos = (d.pagos || []).slice().reverse();
        if (primeraVuelta.current) {
          pagos.forEach((p) => vistos.current.add(p.id));
          primeraVuelta.current = false;
        } else {
          pagos.forEach(recibirCobro);
        }
      } catch (e) {
        if (vivo) setMp((m) => ({ ...m, configurado: false, error: "Sin conexión con el servidor." }));
      }
    };
    consultar();
    const id = setInterval(consultar, 6000);
    // Chrome frena los temporizadores en pestañas de fondo: al volver a la
    // pestaña se consulta enseguida en vez de esperar el próximo turno.
    const alVolver = () => { if (document.visibilityState === "visible") consultar(); };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    return () => {
      vivo = false; clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
  }, [mp.activo, mp.voz, ajustes.sonido]);

  const simularCobro = () => recibirCobro({
    id: "sim-" + uid(),
    monto: [4500, 12300, 24500, 8750, 51200][Math.floor(Math.random() * 5)],
    fecha: new Date().toISOString(),
    pagador: ["Marta Gómez", "Rubén Ledesma", "Nico", ""][Math.floor(Math.random() * 4)],
    detalle: "Simulación",
  });

  const ir = (t, f) => { setVista("panel"); setTab(t); setFoco(f || null); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const cobrar_ = () => { setVista("cobro"); window.scrollTo({ top: 0 }); };

  // Un único lector para todo el sistema: si la pantalla activa sabe qué hacer
  // con el código, se lo queda; si no, abre la ficha rápida del producto.
  useScanner((cod) => {
    const h = pila.current[pila.current.length - 1];
    if (h) return h(cod);
    const p = productos.find((x) => x.barcode === cod);
    if (p) { beep(true, ajustes.sonido); setFicha(p.id); }
    else { beep(false, ajustes.sonido); setAltaProd({ barcode: cod }); }
  }, true);

  const ventasHoy = resumenDia.total;
  const ticketsHoy = resumenDia.tickets;
  const [titulo, bajada] = TITULOS[tab];
  const alertasAltas = ins.filter((i) => i.sev === "alta").length;

  useEffect(() => {
    const h = (e) => {
      if (e.key === "F10" && vista === "panel") { e.preventDefault(); cobrar_(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [vista]);

  return (
    <ScanCtx.Provider value={{ push }}>
    <div className="f-ui min-h-screen bg-stone-50 text-stone-900">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Inter+Tight:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .f-ui { font-family: 'Inter Tight', ui-sans-serif, system-ui, -apple-system, sans-serif; }
        .f-d { font-family: 'Bricolage Grotesque', 'Inter Tight', sans-serif; font-weight: 700; letter-spacing: -0.02em; }
        .f-m { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
        input, select, button { font-family: inherit; }
        /* iOS hace zoom si un campo tiene menos de 16px: se fuerza en pantallas chicas */
        @media (max-width: 767px) { input, select, textarea { font-size: 16px !important; } }
        .seguro-abajo { padding-bottom: env(safe-area-inset-bottom, 0px); }
        .bajo-seguro { bottom: calc(env(safe-area-inset-bottom, 0px)); }
        html { -webkit-text-size-adjust: 100%; }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 8px; border: 3px solid transparent; background-clip: content-box; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
        /* La impresión se hace en un documento aparte (ver imprimirComandera),
           así que acá no hace falta ocultar nada. */
        @media print { .no-print { display: none !important; } }

        /* --- Modo oscuro -------------------------------------------------
           El sistema tiene miles de clases de color escritas a mano. En vez
           de duplicarlas todas, se remapean acá los tonos que realmente se
           usan. Un solo lugar para mantener, y el resto del código no se
           entera de que existe un tema.                                    */
        .tema-oscuro { color-scheme: dark; }
        .tema-oscuro .bg-stone-50, .tema-oscuro .hover\:bg-stone-50:hover { background-color: #1c1917 !important; }
        .tema-oscuro .bg-white { background-color: #1c1917 !important; }
        .tema-oscuro .bg-stone-100, .tema-oscuro .hover\:bg-stone-200:hover { background-color: #292524 !important; }
        .tema-oscuro .bg-stone-200 { background-color: #44403c !important; }
        .tema-oscuro .text-stone-900 { color: #fafaf9 !important; }
        .tema-oscuro .text-stone-800, .tema-oscuro .text-stone-700 { color: #e7e5e4 !important; }
        .tema-oscuro .text-stone-600, .tema-oscuro .text-stone-500 { color: #a8a29e !important; }
        .tema-oscuro .text-stone-400, .tema-oscuro .text-stone-300 { color: #78716c !important; }
        .tema-oscuro .border-stone-200, .tema-oscuro .border-stone-100 { border-color: #292524 !important; }
        .tema-oscuro .divide-stone-100 > * + *, .tema-oscuro .divide-stone-200 > * + * { border-color: #292524 !important; }
        .tema-oscuro .focus\:border-orange-400:focus { border-color: #fb923c !important; }
        /* Los fondos suaves de aviso pierden contraste en oscuro */
        .tema-oscuro .bg-amber-50 { background-color: #2b1f0a !important; }
        .tema-oscuro .bg-emerald-50 { background-color: #04231a !important; }
        .tema-oscuro .bg-red-50 { background-color: #2a0f0f !important; }
        .tema-oscuro .bg-orange-50 { background-color: #2a1608 !important; }
        .tema-oscuro .text-amber-800, .tema-oscuro .text-amber-700 { color: #fcd34d !important; }
        .tema-oscuro .text-emerald-800, .tema-oscuro .text-emerald-700 { color: #6ee7b7 !important; }
        .tema-oscuro .text-red-800, .tema-oscuro .text-red-700, .tema-oscuro .text-red-600 { color: #fca5a5 !important; }
        .tema-oscuro .border-amber-200 { border-color: #78350f !important; }
        .tema-oscuro .border-emerald-200 { border-color: #065f46 !important; }
        .tema-oscuro .border-red-200 { border-color: #7f1d1d !important; }
        .tema-oscuro .border-orange-200 { border-color: #7c2d12 !important; }
        .tema-oscuro .shadow-sm, .tema-oscuro .shadow-lg, .tema-oscuro .shadow-xl { box-shadow: 0 1px 3px rgba(0,0,0,.5) !important; }
        .tema-oscuro body, .tema-oscuro .bg-stone-25 { background-color: #0c0a09 !important; }
      `}</style>

      {/* ============ PANTALLA DE COBRO (la de todo el día) ============ */}
      {vista === "cobro" && (
        <div className="min-h-screen flex flex-col">
          <header className="sticky top-0 z-30 bg-stone-900 text-white">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center"><Store size={17} /></div>
                <div>
                  <div className="f-d text-sm leading-tight">{ajustes.negocio}</div>
                  <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Cobro · {fdatel(HOY)}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 md:gap-5 ml-auto order-3 md:order-2 w-full md:w-auto overflow-x-auto">
                {[["Vendido hoy", money(ventasHoy)], ["Tickets", nf.format(ticketsHoy)],
                  ["Caja", caja.abierta ? "abierta" : "cerrada"]].map(([l, v]) => (
                  <div key={l} className="shrink-0">
                    <div className="text-[9px] uppercase tracking-widest text-stone-500 font-bold">{l}</div>
                    <div className="f-m text-sm">{v}</div>
                  </div>
                ))}
                {/* Solo aparece cuando hay algo pendiente. Un indicador que
                    está siempre deja de mirarse, y este tiene que llamar la
                    atención el día que la conexión se corta. */}
                {pendientes > 0 && (
                  <div className="shrink-0 flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/40 rounded-lg px-2.5 py-1">
                    <ZapOff size={13} className="text-amber-400 shrink-0" />
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-amber-500/80 font-bold">Sin guardar</div>
                      <div className="f-m text-sm text-amber-300">{pendientes}</div>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => { setVista("panel"); setTab("inicio"); }}
                className="order-2 md:order-3 relative inline-flex items-center gap-2 text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3.5 py-2 transition-colors">
                <LayoutDashboard size={16} className="text-orange-400" /> Panel
                {alertasAltas > 0 && <span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold bg-orange-500 rounded-full px-1.5">{alertasAltas}</span>}
              </button>

              <div className="order-2 md:order-4">
                <Sesion sesion={sesion} onSalir={onSalir} oscuro />
              </div>
            </div>
          </header>

          <main className="flex-1 p-3 md:p-5">
            <POS productos={productos} setProductos={setProductos} cobrar={cobrar} ajustes={ajustes}
              toast={toast} ir={ir} pendiente={pendientePOS} setPendiente={setPendientePOS}
              aPanel={() => { setVista("panel"); setTab("inicio"); }} clientes={clientes} setClientes={setClientes} permisos={permisos} />
          </main>

          <footer className="hidden md:block px-4 py-2 text-center text-[11px] text-stone-400 border-t border-stone-200 bg-white">
            F1 muestra todos los atajos · F2 cobra · F10 abre el Panel
          </footer>
        </div>
      )}

      {/* ============ PANEL (todo lo que no es cobrar) ============ */}
      {vista === "panel" && (
      <div className="flex">
        {/* Barra lateral */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0 bg-white border-r border-stone-200 p-3">
          <div className="flex items-center gap-2 px-2 py-3">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white"><Store size={17} /></div>
            <div className="min-w-0">
              <div className="f-d text-sm truncate">{ajustes.negocio}</div>
              <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">1 caja · {nf.format(productos.length)} art.</div>
            </div>
          </div>
          <Boton className="w-full mt-2" size="lg" onClick={cobrar_}><Barcode size={17} /> Cobrar <kbd className="f-m text-[10px] border border-white/30 rounded px-1 py-0.5">F10</kbd></Boton>
          <nav className="mt-3 space-y-0.5">
            {NAV.filter((n) => puedeVer(n.k)).map((n) => (
              <button key={n.k} onClick={() => ir(n.k)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-colors ${tab === n.k ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}>
                <n.i size={16} className={tab === n.k ? "text-orange-400" : "text-stone-400"} /> {n.n}
                {n.k === "compras" && k.criticos.filter((x) => x.cobertura < 4).length > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-orange-500 text-white rounded-full px-1.5">{k.criticos.filter((x) => x.cobertura < 4).length}</span>
                )}
                {n.k === "pedidos" && pedidosCli.filter((p) => p.estado !== "entregado").length > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-orange-500 text-white rounded-full px-1.5">{pedidosCli.filter((p) => p.estado !== "entregado").length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-auto px-2.5 py-3 border-t border-stone-200">
            <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Caja</div>
            <div className={`text-sm font-semibold ${caja.abierta ? "text-emerald-600" : "text-stone-400"}`}>{caja.abierta ? "Abierta" : "Cerrada"}</div>
            <div className="text-[11px] text-stone-400 mt-1">Prototipo · datos simulados</div>
          </div>
        </aside>

        {/* Navegación móvil */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 overflow-x-auto seguro-abajo">
          <div className="flex">
            <button onClick={cobrar_} className="flex flex-col items-center gap-0.5 px-3.5 py-2 text-[10px] font-semibold shrink-0 text-white bg-orange-500">
              <Barcode size={17} /> Cobrar
            </button>
            {NAV.filter((n) => puedeVer(n.k)).map((n) => (
              <button key={n.k} onClick={() => ir(n.k)}
                className={`flex flex-col items-center gap-0.5 px-3.5 py-2 text-[10px] font-semibold shrink-0 ${tab === n.k ? "text-orange-600" : "text-stone-400"}`}>
                <n.i size={17} /> {n.n}
              </button>
            ))}
          </div>
        </div>

        <main className="flex-1 min-w-0 p-4 md:p-6 pb-24 md:pb-8">
          <header className="flex flex-wrap items-end justify-between gap-3 mb-5">
            <div className="min-w-0">
              <h1 className="f-d text-xl md:text-2xl">{titulo}</h1>
              <p className="text-sm text-stone-500">{bajada}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <CalendarDays size={14} /> {fdatel(HOY)}
              <span className="text-stone-300">·</span>
              <span className="f-m">{money(ventasHoy)} hoy</span>
              <BotonTema tema={tema} setTema={setTema} />
              <Boton size="sm" variant="dark" className="md:hidden" onClick={cobrar_}><Barcode size={14} /> Cobrar</Boton>
              <Sesion sesion={sesion} onSalir={onSalir} />
            </div>
          </header>

          {tab === "inicio" && <Inicio k={k} ins={ins} ventasHoy={ventasHoy} ticketsHoy={ticketsHoy} ir={ir} negocio={ajustes.negocio} aCobrar={cobrar_} />}
          {tab === "pedidos" && <Picking pedidos={pedidosCli} setPedidos={setPedidosCli} productos={productos} setProductos={setProductos} cobrar={cobrar} ajustes={ajustes} toast={toast} />}
          {tab === "clientes" && <Clientes clientes={clientes} setClientes={setClientes} tickets={tickets} ajustes={ajustes} toast={toast} />}
          {tab === "productos" && (cargandoProductos
            ? <Vacio>Cargando catálogo…</Vacio>
            : <Productos key={foco || "todos"} productos={productos}
                actualizarProducto={actualizarProducto} agregarProducto={agregarProducto}
                toast={toast} focoInicial={foco} provs={provs} ajustes={ajustes} />)}
          {tab === "stock" && <Stock productos={productos} setProductos={setProductos} k={k} toast={toast} />}
          {tab === "compras" && <Compras productos={productos} setProductos={setProductos} k={k} pedidos={pedidos} setPedidos={setPedidos} movCaja={movCaja} toast={toast} cobertura={ajustes.cobertura} provs={provs} setProvs={setProvs} />}
          {tab === "caja" && (
            <Caja caja={caja} movCaja={movCaja} toast={toast} ajustes={ajustes}
              abrirCaja={(s) => setCaja((c) => ({ ...c, abierta: true, saldoInicial: s, movimientos: [], hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) }))}
              cerrarCaja={(esperado, contado) => setCaja((c) => ({ ...c, abierta: false, cierres: [{ fecha: HOY, esperado, contado, dif: contado - esperado }, ...c.cierres] }))} />
          )}
          {tab === "reportes" && <Reportes productos={productos} k={k} ir={ir} />}
          {tab === "asistente" && <Asistente k={k} ins={ins} ir={ir} negocio={ajustes.negocio} />}
          {tab === "ajustes" && <Ajustes ajustes={ajustes} setAjustes={setAjustes} productos={productos} setProductos={setProductos} toast={toast} mp={mp} setMp={setMp} simularCobro={simularCobro} />}
        </main>
      </div>
      )}

      <AvisoCobro cobros={cobrosMP} onCerrar={(id) => setCobrosMP((x) => x.filter((c) => c.id !== id))} />

      <FormProducto abierto={!!altaProd} inicial={altaProd} productos={productos} provs={provs} ajustes0={ajustes}
        onClose={() => setAltaProd(null)}
        onGuardar={(d, faltan) => {
          agregarProducto(d, faltan.length ? `${d.nombre} creado. Falta ${faltan.join(", ")}.` : `${d.nombre} creado.`);
          setAltaProd(null);
        }} />

      <FichaRapida p={productos.find((x) => x.id === ficha)} onClose={() => setFicha(null)}
        setProductos={setProductos} movCaja={movCaja} toast={toast}
        vender={(p) => { setFicha(null); setPendientePOS({ id: p.id, t: Date.now() }); cobrar_(); }}
        verFicha={(p) => { setFicha(null); ir("productos"); }} />

      <div className="fixed bottom-44 md:bottom-5 right-4 md:right-5 z-50 space-y-2 max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-center gap-2 text-sm px-3.5 py-2.5 rounded-xl shadow-lg border ${t.tono === "mal" ? "bg-red-600 text-white border-red-700" : "bg-stone-900 text-white border-stone-800"}`}>
            {t.tono === "mal" ? <AlertTriangle size={15} /> : <Check size={15} className="text-emerald-400" />} {t.texto}
          </div>
        ))}
      </div>
    </div>
    </ScanCtx.Provider>
  );
}

export { Login, Sistema, PanelGenez };