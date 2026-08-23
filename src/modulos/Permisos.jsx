/* ============================================================
   23. PERMISOS Y AUDITORÍA
   ============================================================

   Lo último del encargo y lo que más cuidado pide, porque es el único
   módulo cuyo error no se ve: una pantalla mal hecha se nota, un permiso
   mal dado no se nota hasta que alguien hizo algo que no tenía que hacer.

   LO QUE SE VE ACÁ TIENE SU POLÍTICA ATRÁS
   ----------------------------------------
   Es la regla del proyecto: un permiso de interfaz que no tenga RLS
   detrás no protege nada. Los dos pesados —ver la auditoría y configurar
   el comercio— los verifica la base, no el navegador. Los otros seis son
   de pantalla y están dichos como tales: apagan botones, no cierran
   puertas.

   Esa distinción está a la vista y no escondida en un comentario. Quien
   configura tiene que saber cuál de las dos cosas está apagando.

   NO SE PUEDE UNO DEJAR AFUERA
   ----------------------------
   Sacarle "configurar" al rol propio lo rechaza la base. La pantalla lo
   avisa antes, pero el que manda es el disparador: una validación acá se
   la saltea cualquier otro camino.

   VOLVER AL ORIGINAL ES BORRAR, NO COPIAR
   ---------------------------------------
   Un rol sin cambios no existe en la tabla de cambios. Así, el día que se
   corrija un valor de fábrica, el comercio que nunca lo tocó se lleva la
   corrección.
   ============================================================ */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Shield, RotateCcw, Lock } from "lucide-react";
import {
  cargarRoles, guardarRol, restaurarRol, cargarBitacora,
  BANDERAS, FAMILIAS, nombreAccion,
} from "../datos/permisos.js";
import { nf } from "../utils/helpers.js";
import {
  Card, Boton, Tabs, Vacio, Cargando, ErrorEstado, Sello, TablaSimple,
} from "../ui/Base.jsx";

const ROTULO = "text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold";

const fechaHora = (d) =>
  d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) + " · " +
  d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

/* Un interruptor. No es un checkbox porque un permiso no es un campo de
   formulario: se prende y se apaga, y se tiene que leer prendido o
   apagado de un vistazo y de lejos. */
function Interruptor({ activo, onChange, disabled }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!activo)} disabled={disabled}
      className={`w-9 h-5 rounded-full border transition-colors shrink-0 relative ${
        activo ? "bg-acento border-acento" : "bg-superficie-2 border-borde"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}>
      <span className={`block w-3.5 h-3.5 rounded-full bg-superficie absolute top-0.5 transition-all ${
        activo ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

export function Permisos({ empresaId, modulosComercio, catalogoModulos, miRol, esPlataforma, toast }) {
  const [pestana, setPestana] = useState("roles");
  const [roles, setRoles] = useState([]);
  const [bitacora, setBitacora] = useState([]);
  const [familia, setFamilia] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [borrador, setBorrador] = useState(null);   // { k, modulos, permisos }

  const releer = useCallback(async () => {
    const [r, b] = await Promise.all([
      cargarRoles(empresaId),
      cargarBitacora(empresaId, { familia: familia || null, dias: 60 }),
    ]);
    setRoles(r);
    setBitacora(b);
  }, [empresaId, familia]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    releer()
      .catch((e) => { if (vigente) setError(e.message || "No pudimos cargar los permisos."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [releer]);

  /* Solo las familias que este comercio tiene registradas: un negocio de
     turnos no tiene pedidos y no tiene por qué ver ese filtro. */
  const familias = useMemo(() => {
    const hay = new Set(bitacora.map((b) => String(b.accion).split(".")[0]));
    return FAMILIAS.filter((f) => hay.has(f.k) || f.k === familia);
  }, [bitacora, familia]);

  function editar(rol) {
    setBorrador({
      k: rol.k,
      modulos: rol.todos ? null : [...(rol.modulos || [])],
      permisos: { ...rol.permisos },
    });
  }

  async function guardar(rol) {
    try {
      await guardarRol(empresaId, rol, borrador);
      setBorrador(null);
      await releer();
      toast("Permisos guardados.");
    } catch (e) {
      toast(e.message || "No se pudo guardar.", "mal");
    }
  }

  async function restaurar(rol) {
    try {
      await restaurarRol(empresaId, rol.k);
      setBorrador(null);
      await releer();
      toast(`${rol.n} volvió a los valores de fábrica.`);
    } catch (e) {
      toast(e.message || "No se pudo restaurar.", "mal");
    }
  }

  if (error) return <ErrorEstado onReintentar={releer}>{error}</ErrorEstado>;
  if (cargando && !roles.length) return <Cargando>Cargando los permisos…</Cargando>;

  const cambiados = roles.filter((r) => r.propio).length;

  return (
    <div className="space-y-5">
      <Tabs value={pestana} onChange={setPestana} items={[
        { k: "roles", n: "Roles", badge: cambiados || undefined },
        { k: "auditoria", n: "Auditoría", badge: bitacora.length },
      ]} />

      {pestana === "roles" && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className={ROTULO}>Cómo leer esta pantalla</div>
            <p className="text-sm text-texto-suave mt-2 leading-relaxed">
              Lo que ve una persona es el cruce de tres cosas: los módulos que el
              comercio contrató, los que su rol alcanza y lo que estas banderas
              habilitan. Un módulo no contratado no lo ve ni el dueño.
            </p>
            <p className="text-sm text-texto-suave mt-2 leading-relaxed">
              Los dos permisos marcados con <Lock size={11} className="inline mb-0.5" /> los
              verifica la base de datos. El resto apaga botones en la pantalla:
              sirve para evitar errores, no para frenar a alguien decidido.
            </p>
          </Card>

          {roles.map((rol) => {
            const editando = borrador && borrador.k === rol.k;
            const d = editando ? borrador : rol;
            const esMiRol = !esPlataforma && miRol === rol.k;

            return (
              <Card key={rol.k} className="overflow-hidden">
                <div className="px-5 py-4 border-b border-borde flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <h3 className="f-d flex items-center gap-2">
                      {rol.n}
                      {rol.propio && <Sello tono="acento">Cambiado</Sello>}
                      {esMiRol && <Sello tono="info">Es tu rol</Sello>}
                    </h3>
                    <p className="text-xs text-texto-suave mt-1">{rol.d}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {editando ? (
                      <>
                        <Boton size="sm" onClick={() => guardar(rol)}>Guardar</Boton>
                        <Boton size="sm" variant="ghost" onClick={() => setBorrador(null)}>Cancelar</Boton>
                      </>
                    ) : (
                      <>
                        {rol.propio && (
                          <Boton size="sm" variant="ghost" onClick={() => restaurar(rol)}
                            title="Vuelve a los valores de fábrica">
                            <RotateCcw size={14} /> Volver al original
                          </Boton>
                        )}
                        <Boton size="sm" variant="ghost" onClick={() => editar(rol)}>Editar</Boton>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-5 grid lg:grid-cols-2 gap-6">
                  <div>
                    <div className={ROTULO}>Qué puede hacer</div>
                    <ul className="mt-3 space-y-3">
                      {BANDERAS.map((b) => (
                        <li key={b.k} className="flex items-start gap-3">
                          <Interruptor
                            activo={!!d.permisos[b.k]}
                            disabled={!editando}
                            onChange={(v) => setBorrador({ ...borrador, permisos: { ...borrador.permisos, [b.k]: v } })} />
                          <div className="min-w-0">
                            <div className="text-sm flex items-center gap-1.5">
                              {b.n}
                              {b.pesado && <Lock size={11} className="text-texto-tenue" />}
                            </div>
                            <div className="text-[11px] text-texto-tenue leading-relaxed">{b.d}</div>
                            {editando && esMiRol && b.k === "configurar" && d.permisos[b.k] === false && (
                              <div className="text-[11px] text-mal mt-1">
                                Es tu propio rol: si lo apagás te quedás afuera, y la base lo va a rechazar.
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className={ROTULO}>Qué secciones alcanza</div>
                    {rol.todos && !editando ? (
                      <p className="text-sm text-texto-suave mt-3">
                        Todas las que el comercio tenga contratadas, incluidas las que
                        se agreguen más adelante.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {catalogoModulos.map((m) => {
                          const alcanza = d.modulos === null || d.modulos.includes(m.k);
                          const contratado = modulosComercio.includes(m.k);
                          return (
                            <button key={m.k} type="button" disabled={!editando}
                              title={contratado ? m.d : "El comercio no tiene contratado este módulo"}
                              onClick={() => {
                                const xs = borrador.modulos === null
                                  ? catalogoModulos.map((x) => x.k)
                                  : [...borrador.modulos];
                                setBorrador({
                                  ...borrador,
                                  modulos: alcanza ? xs.filter((k) => k !== m.k) : [...xs, m.k],
                                });
                              }}
                              className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                                alcanza
                                  ? "border-acento text-acento bg-acento-suave"
                                  : "border-borde text-texto-tenue"
                              } ${!contratado ? "opacity-40" : ""} ${editando ? "hover:bg-superficie-2" : "cursor-default"}`}>
                              {m.n}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {editando && rol.todos && (
                      <p className="text-[11px] text-texto-tenue mt-3">
                        Este rol alcanzaba todo. Al tocar una sección pasa a ser una
                        lista, y las que se agreguen más adelante ya no entran solas.
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {pestana === "auditoria" && (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => setFamilia("")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                familia === ""
                  ? "bg-superficie-3 text-texto border-superficie-3"
                  : "bg-superficie border-borde text-texto-suave hover:bg-superficie-2"}`}>
              Todo
            </button>
            {familias.map((f) => (
              <button key={f.k} onClick={() => setFamilia(f.k)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  familia === f.k
                    ? "bg-superficie-3 text-texto border-superficie-3"
                    : "bg-superficie border-borde text-texto-suave hover:bg-superficie-2"}`}>
                {f.n}
              </button>
            ))}
          </div>

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-borde">
              <h3 className="f-d flex items-center gap-2"><Shield size={16} className="text-acento" /> Lo que se hizo</h3>
              <p className="text-xs text-texto-suave mt-1">
                Últimos 60 días. La bitácora solo admite escribir y leer: nada de
                esto se puede corregir ni borrar, que es la única forma de que
                sirva para algo.
              </p>
            </div>
            {!bitacora.length ? (
              <div className="p-6"><Vacio>No hay nada registrado en este período.</Vacio></div>
            ) : (
              <TablaSimple
                cols={["Qué se hizo", "Quién", "Cuándo", "Detalle"]}
                filas={bitacora.map((b) => [
                  <span key="a" className="font-medium">{nombreAccion(b.accion)}</span>,
                  <span className="text-texto-suave">{b.usuario}</span>,
                  <span className="f-m text-texto-suave">{fechaHora(b.fecha)}</span>,
                  <span className="text-[11px] text-texto-tenue block max-w-sm truncate f-m"
                    title={JSON.stringify(b.detalle)}>
                    {resumen(b)}
                  </span>,
                ])}
                vacio="Sin registros."
              />
            )}
          </Card>

          <p className="text-xs text-texto-tenue">
            {nf.format(bitacora.length)} registro{bitacora.length === 1 ? "" : "s"}.
          </p>
        </>
      )}
    </div>
  );
}

/* El detalle en una línea. Un JSON crudo en una tabla no lo lee nadie, y
   esconderlo del todo deja la auditoría sin lo único que importa: qué
   cambió exactamente. */
function resumen(b) {
  const d = b.detalle || {};
  if (b.accion.startsWith("permisos.")) {
    const cambios = Object.keys(d.despues || {});
    return d.rol + (cambios.length ? " · " + cambios.join(", ") : " · volvió al original");
  }
  if (d.monto != null) return "$" + d.monto;
  if (d.motivo) return String(d.motivo);
  const claves = Object.keys(d);
  return claves.length ? claves.map((k) => `${k}: ${d[k]}`).join(" · ") : "—";
}
