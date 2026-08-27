/* ============================================================
   ACCESOS · dar de alta a la gente del comercio
   ============================================================

   La otra mitad de Permisos. Ahí se define qué puede hacer un rol; acá,
   quién entra y con cuál. Hasta esta pantalla los usuarios se creaban a
   mano con SQL, que es la razón por la que cada comercio tenía uno solo.

   TRES CAPAS, Y LA TERCERA SE VE ACÁ
   ----------------------------------
   El rol dice lo general y la excepción dice lo puntual: al cajero de la
   tarde se le da cerrar caja y a los otros tres no. Sin esto hay que
   inventar el rol "cajero que cierra", y a la larga un rol por persona,
   que es no tener roles.

   La excepción se guarda como diferencia contra el rol, no como foto. Por
   eso la pantalla muestra siempre qué dice el rol al lado de lo que quedó:
   quien decide tiene que ver que está apartándose de algo.

   LO QUE NO SE PUEDE HACER DESDE ACÁ
   ----------------------------------
   Tocarse a uno mismo el rol, los permisos o darse de baja. Lo rechaza la
   base (0048 §4) y la pantalla lo muestra apagado antes de que alguien lo
   intente. Es el mismo accidente que ya cubría 0045 §6 con los roles, por
   la otra puerta: el que administra se queda afuera del sistema que
   administra y hace falta que otro entre por SQL a devolvérselo.
   ============================================================ */

import React, { useState, useEffect, useCallback } from "react";
import { UserPlus, KeyRound, Mail, Lock, Ban, RotateCcw } from "lucide-react";
import {
  cargarAccesos, crearAcceso, cambiarRol, guardarExcepciones,
  cambiarActivo, ponerClaveProvisional, FORMAS,
} from "../datos/accesos.js";
import { BANDERAS } from "../datos/permisos.js";
import {
  Card, Boton, Vacio, Cargando, ErrorEstado, Sello, Modal,
} from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";

const ROTULO = "text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold";

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

/* ------------------------------------------------------------
   El alta
   ------------------------------------------------------------ */

function Alta({ open, onClose, empresaId, roles, onHecho, toast }) {
  const [forma, setForma] = useState("invitar");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState("cajero");
  const [clave, setClave] = useState("");
  const [yendo, setYendo] = useState(false);

  useEffect(() => {
    if (open) {
      setForma("invitar"); setNombre(""); setEmail("");
      setRol(roles.length ? roles[roles.length - 1].k : "cajero");
      setClave(""); setYendo(false);
    }
  }, [open, roles]);

  async function confirmar() {
    setYendo(true);
    try {
      const r = await crearAcceso({ forma, email, nombre, rol, clave, empresaId });
      toast(r.invitado
        ? `Le mandamos la invitación a ${email}.`
        : `${nombre} ya puede entrar con esa clave.`);
      onHecho();
      onClose();
    } catch (e) {
      toast(e.message || "No se pudo dar el alta.", "mal");
    } finally {
      setYendo(false);
    }
  }

  const listo = nombre.trim() && email.includes("@") &&
    (forma === "invitar" || clave.length >= 8);

  return (
    <Modal open={open} onClose={onClose} ancho="max-w-lg">
      <div className="p-5 space-y-4">
        <h3 className="f-d text-lg">Dar de alta un acceso</h3>

        <div className="grid sm:grid-cols-2 gap-3">
          <Campo label="Nombre">
            <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)}
              placeholder="Como lo van a ver los demás" />
          </Campo>
          <Campo label="Correo">
            <input className={inputCls} type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="con el que va a entrar" />
          </Campo>
        </div>

        <Campo label="Rol">
          <select className={inputCls} value={rol} onChange={(e) => setRol(e.target.value)}>
            {roles.map((r) => <option key={r.k} value={r.k}>{r.n}</option>)}
          </select>
        </Campo>
        <p className="text-[11px] text-texto-tenue -mt-2">
          {(roles.find((r) => r.k === rol) || {}).d}
        </p>

        <div>
          <div className={ROTULO}>Cómo entra la primera vez</div>
          <div className="mt-2 space-y-2">
            {FORMAS.map((f) => (
              <button key={f.k} type="button" onClick={() => setForma(f.k)}
                className={`w-full text-left border rounded-lg p-3 transition-colors ${
                  forma === f.k ? "border-acento bg-superficie-2" : "border-borde hover:border-texto-tenue"
                }`}>
                <div className="text-sm flex items-center gap-2">
                  {f.k === "invitar" ? <Mail size={13} /> : <KeyRound size={13} />}
                  {f.n}
                </div>
                <div className="text-[11px] text-texto-tenue mt-0.5 leading-relaxed">{f.d}</div>
              </button>
            ))}
          </div>
        </div>

        {forma === "crear" && (
          <Campo label="Clave provisional">
            <input className={inputCls} value={clave} onChange={(e) => setClave(e.target.value)}
              placeholder="al menos 8 caracteres" />
            <p className="text-[11px] text-texto-tenue mt-1">
              Se la dictás y la va a tener que cambiar la primera vez que entre.
            </p>
          </Campo>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Boton variant="ghost" onClick={onClose}>Cancelar</Boton>
          <Boton onClick={confirmar} disabled={!listo || yendo}>
            {yendo ? "Dando el alta…" : "Dar el alta"}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------
   Las excepciones de una persona
   ------------------------------------------------------------ */

function Excepciones({ persona, rol, empresaId, onHecho, toast }) {
  const [borrador, setBorrador] = useState(null);

  const delRol = (rol && rol.permisos) || {};
  const actual = borrador || { ...delRol, ...persona.permisos };
  const cuantas = Object.keys(persona.permisos || {}).length;

  async function guardar() {
    try {
      const diff = await guardarExcepciones(empresaId, persona.id, {
        permisosDelRol: delRol, permisos: borrador,
      });
      setBorrador(null);
      await onHecho();
      const n = Object.keys(diff).length;
      toast(n ? `${persona.nombre}: ${n} excepción${n > 1 ? "es" : ""} sobre su rol.`
              : `${persona.nombre} vuelve a seguir su rol.`);
    } catch (e) {
      toast(e.message || "No se pudo guardar.", "mal");
    }
  }

  return (
    <div className="pt-4 mt-4 border-t border-borde">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className={ROTULO}>
          Excepciones sobre el rol {cuantas ? `· ${cuantas}` : ""}
        </div>
        <div className="flex gap-2">
          {borrador ? (
            <>
              <Boton size="sm" onClick={guardar}>Guardar</Boton>
              <Boton size="sm" variant="ghost" onClick={() => setBorrador(null)}>Cancelar</Boton>
            </>
          ) : (
            <Boton size="sm" variant="ghost" disabled={persona.soyYo}
              title={persona.soyYo ? "No podés cambiarte los permisos a vos mismo." : ""}
              onClick={() => setBorrador({ ...delRol, ...persona.permisos })}>
              Editar
            </Boton>
          )}
        </div>
      </div>

      <ul className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-3">
        {BANDERAS.map((b) => {
          const dice = !!delRol[b.k];
          const queda = !!actual[b.k];
          const apartado = dice !== queda;
          return (
            <li key={b.k} className="flex items-start gap-3">
              <Interruptor activo={queda} disabled={!borrador}
                onChange={(v) => setBorrador({ ...actual, [b.k]: v })} />
              <div className="min-w-0">
                <div className="text-sm flex items-center gap-1.5">
                  {b.n}
                  {b.pesado && <Lock size={11} className="text-texto-tenue" />}
                  {apartado && <Sello tono="acento">Excepción</Sello>}
                </div>
                {/* Lo que dice el rol, siempre a la vista: la excepción se
                    guarda como diferencia contra esto, y quien decide tiene
                    que ver de qué se está apartando. */}
                <div className="text-[11px] text-texto-tenue">
                  El rol dice {dice ? "que sí" : "que no"}.
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------
   La lista
   ------------------------------------------------------------ */

export function Accesos({ empresaId, roles, toast }) {
  const [gente, setGente] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [abriendo, setAbriendo] = useState(false);
  const [abierta, setAbierta] = useState(null);   // id de la ficha desplegada
  const [claveDe, setClaveDe] = useState(null);   // persona a la que se le repone la clave
  const [claveNueva, setClaveNueva] = useState("");

  const releer = useCallback(async () => {
    setGente(await cargarAccesos(empresaId));
  }, [empresaId]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    releer()
      .catch((e) => { if (vigente) setError(e.message || "No pudimos cargar los accesos."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [releer]);

  async function cambiar(persona, nuevo) {
    try {
      await cambiarRol(empresaId, persona.id, nuevo);
      await releer();
      toast(`${persona.nombre} ahora es ${(roles.find((r) => r.k === nuevo) || {}).n || nuevo}.`);
    } catch (e) {
      toast(e.message || "No se pudo cambiar el rol.", "mal");
    }
  }

  async function alternar(persona) {
    try {
      await cambiarActivo(empresaId, persona.id, !persona.activo);
      await releer();
      toast(persona.activo
        ? `${persona.nombre} ya no puede entrar.`
        : `${persona.nombre} vuelve a tener acceso.`);
    } catch (e) {
      toast(e.message || "No se pudo cambiar.", "mal");
    }
  }

  async function reponerClave() {
    try {
      await ponerClaveProvisional(empresaId, claveDe.id, claveNueva);
      toast(`${claveDe.nombre} entra con esa clave y la tiene que cambiar.`);
      setClaveDe(null); setClaveNueva("");
      await releer();
    } catch (e) {
      toast(e.message || "No se pudo cambiar la clave.", "mal");
    }
  }

  if (error) return <ErrorEstado onReintentar={releer}>{error}</ErrorEstado>;
  if (cargando && !gente.length) return <Cargando>Cargando los accesos…</Cargando>;

  return (
    <div className="space-y-4">
      <Card className="p-5 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className={ROTULO}>Quién entra a este comercio</div>
          <p className="text-sm text-texto-suave mt-2 leading-relaxed max-w-2xl">
            Cada persona entra con su propio correo y su propia clave. El rol
            decide lo general; si a alguien le hace falta algo distinto, se le
            pone una excepción y no se inventa un rol nuevo.
          </p>
        </div>
        <Boton onClick={() => setAbriendo(true)}>
          <UserPlus size={14} /> Dar de alta
        </Boton>
      </Card>

      {!gente.length && (
        <Vacio>Todavía no hay nadie más que vos. Dale de alta a quien trabaje acá.</Vacio>
      )}

      {gente.map((p) => {
        const rol = roles.find((r) => r.k === p.rol);
        const cuantas = Object.keys(p.permisos || {}).length;
        const desplegada = abierta === p.id;

        return (
          <Card key={p.id} className={`overflow-hidden ${p.activo ? "" : "opacity-60"}`}>
            <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <h3 className="f-d flex items-center gap-2 flex-wrap">
                  {p.nombre}
                  {p.soyYo && <Sello tono="info">Sos vos</Sello>}
                  {!p.activo && <Sello tono="mal">Sin acceso</Sello>}
                  {p.invitadoEn && <Sello tono="tenue">Invitación mandada</Sello>}
                  {p.debeCambiarClave && <Sello tono="acento">Tiene que cambiar la clave</Sello>}
                  {cuantas > 0 && <Sello tono="acento">{cuantas} excepción{cuantas > 1 ? "es" : ""}</Sello>}
                </h3>
                <p className="text-xs text-texto-suave mt-1">
                  {p.email}
                  {p.personalNombre && ` · ficha de equipo: ${p.personalNombre}`}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  className={`${inputCls} !mt-0 !w-auto`}
                  value={p.rol}
                  disabled={p.soyYo}
                  title={p.soyYo ? "No podés cambiarte el rol a vos mismo." : ""}
                  onChange={(e) => cambiar(p, e.target.value)}>
                  {roles.map((r) => <option key={r.k} value={r.k}>{r.n}</option>)}
                </select>

                <Boton size="sm" variant="ghost" onClick={() => setClaveDe(p)}>
                  <KeyRound size={14} /> Clave
                </Boton>

                <Boton size="sm" variant="ghost" disabled={p.soyYo}
                  title={p.soyYo ? "No podés darte de baja solo." : ""}
                  onClick={() => alternar(p)}>
                  {p.activo ? <><Ban size={14} /> Quitar acceso</> : <><RotateCcw size={14} /> Devolver</>}
                </Boton>

                <Boton size="sm" variant="ghost"
                  onClick={() => setAbierta(desplegada ? null : p.id)}>
                  {desplegada ? "Cerrar" : "Permisos"}
                </Boton>
              </div>
            </div>

            {desplegada && (
              <div className="px-5 pb-5">
                <Excepciones persona={p} rol={rol} empresaId={empresaId}
                  onHecho={releer} toast={toast} />
              </div>
            )}
          </Card>
        );
      })}

      <Alta open={abriendo} onClose={() => setAbriendo(false)} empresaId={empresaId} roles={roles}
        onHecho={releer} toast={toast} />

      <Modal open={!!claveDe} onClose={() => { setClaveDe(null); setClaveNueva(""); }}>
        <div className="p-5 space-y-4">
          <h3 className="f-d text-lg">Clave provisional</h3>
          <p className="text-sm text-texto-suave leading-relaxed">
            Se la dictás a {claveDe && claveDe.nombre} y la va a tener que cambiar
            la próxima vez que entre. La clave anterior deja de servir.
          </p>
          <Campo label="Clave nueva">
            <input className={inputCls} value={claveNueva}
              onChange={(e) => setClaveNueva(e.target.value)} placeholder="al menos 8 caracteres" />
          </Campo>
          <div className="flex justify-end gap-2">
            <Boton variant="ghost" onClick={() => { setClaveDe(null); setClaveNueva(""); }}>Cancelar</Boton>
            <Boton onClick={reponerClave} disabled={claveNueva.length < 8}>Cambiarla</Boton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
