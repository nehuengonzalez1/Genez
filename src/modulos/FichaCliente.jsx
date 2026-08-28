/* ============================================================
   9 quater. LA FICHA DEL CLIENTE
   ============================================================

   En una estética esto es la mitad del valor del sistema: qué se le hizo,
   cuándo, con qué y si hay algo que no se le puede hacer.

   Ocupa la pantalla entera en vez de ir en un panel al costado. No es
   capricho: son cinco listas —turnos, abonos, pagos, notas— y en un
   drawer hay que desplazar para ver cualquier cosa, que es justo lo
   contrario de lo que se le pide a una ficha.

   Las alertas van arriba de todo y fuera de las pestañas. Una
   contraindicación adentro de una pestaña es una contraindicación que
   nadie ve.
   ============================================================ */

import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, Plus, AlertTriangle, Trash2, Calendar, Ticket,
  Receipt, StickyNote, Phone, Mail, MapPin, Smartphone,
} from "lucide-react";
import { cargarFicha, anotarEnFicha, borrarNota, invitarALaApp, quitarLaApp } from "../datos/clientes.js";
import { estadoDe } from "../datos/agenda.js";
import { estadoAbono } from "../datos/abonos.js";
import { money, nf, pct, linkWhatsapp } from "../utils/helpers.js";
import { Card, Kpi, Boton, Vacio, Tabs, Sello, Cargando, ErrorEstado } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";

const fecha = (d) => (d ? d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");
const fechaHora = (d) => `${fecha(d)} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}`;

const iniciales = (nombre) =>
  String(nombre || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

const haceCuanto = (d) => {
  if (!d) return "nunca vino";
  const dias = Math.floor((Date.now() - d) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
};

/* ------------------------------------------------------------
   El acceso a la app

   Lo que faltaba para que la app del cliente sirva: hasta hoy enlazar una
   ficha con una cuenta era correr SQL a mano, así que la app estaba
   publicada y no la podía usar nadie.

   VA EN LA FICHA Y NO EN UNA PANTALLA DE "USUARIOS DE LA APP"
   Porque no es una lista aparte de gente: es un dato de esta persona, al
   lado de su teléfono y su correo. Una pantalla propia obligaría a
   buscarla dos veces —una para ver su historia y otra para invitarla— y
   a mantener sincronizadas dos listas de lo mismo.

   EL CORREO SE PUEDE CORREGIR ANTES DE MANDAR
   Es el único momento en que alguien lo mira sabiendo que de eso depende
   a quién le llega el acceso a la historia de esta persona. La ficha
   propone el suyo; quien invita confirma. Esa confirmación es la firma
   que el modelo de identidad pide en §4.
   ------------------------------------------------------------ */

function AccesoApp({ cliente, onInvitar, onQuitar, puede, toast }) {
  const [abierto, setAbierto] = useState(false);
  const [correo, setCorreo] = useState(cliente.email || "");
  const [yendo, setYendo] = useState(false);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);

  async function invitar() {
    if (yendo) return;
    setYendo(true);
    try {
      const r = await onInvitar(correo.trim());
      toast(r.invitada
        ? `Le mandamos la invitación a ${r.email}.`
        : `Esa cuenta ya existía, así que ${cliente.razonSocial} ya puede entrar con su contraseña de siempre.`);
      setAbierto(false);
    } catch (e) {
      toast(e.message, "mal");
    } finally {
      setYendo(false);
    }
  }

  async function quitar() {
    if (yendo) return;
    setYendo(true);
    try {
      await onQuitar();
      toast("Le quitamos el acceso a la app. La ficha queda como estaba.");
      setConfirmandoQuitar(false);
    } catch (e) {
      toast(e.message, "mal");
    } finally {
      setYendo(false);
    }
  }

  /* Ya la tiene: lo único que hay para hacer es sacársela, y eso no se
     ofrece como un botón al mismo nivel que el resto. */
  if (cliente.tieneApp) {
    return (
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Smartphone size={16} className="text-bien shrink-0" />
            <span className="text-sm">
              Tiene la app
              {cliente.enlazadaEn && (
                <span className="text-texto-tenue"> · desde el {fecha(cliente.enlazadaEn)}</span>
              )}
            </span>
          </div>
          {puede && (
            confirmandoQuitar ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-texto-suave">¿Le sacamos el acceso?</span>
                <Boton size="sm" variant="ghost" onClick={() => setConfirmandoQuitar(false)}>No</Boton>
                <Boton size="sm" onClick={quitar} disabled={yendo}>
                  {yendo ? "Sacando…" : "Sí, sacar"}
                </Boton>
              </div>
            ) : (
              <button onClick={() => setConfirmandoQuitar(true)}
                className="text-xs text-texto-tenue hover:text-mal">
                Quitar el acceso
              </button>
            )
          )}
        </div>
      </Card>
    );
  }

  /* Sin permiso no se ofrece nada, y tampoco se dice "no tiene la app":
     es una fila de ruido para quien no puede hacer nada al respecto. */
  if (!puede) return null;

  return (
    <Card className="p-4">
      {!abierto ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Smartphone size={16} className="text-texto-tenue shrink-0" />
            <span className="text-sm text-texto-suave">
              Todavía no tiene la app para ver sus turnos.
            </span>
          </div>
          <Boton size="sm" variant="ghost" onClick={() => { setCorreo(cliente.email || ""); setAbierto(true); }}>
            Darle la app
          </Boton>
        </div>
      ) : (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">
            Invitar a {cliente.razonSocial}
          </div>
          <p className="text-sm text-texto-suave mt-2 leading-relaxed">
            Le va a llegar un correo con un link para poner su contraseña. Con eso
            entra a ver sus turnos y su plan, y nada más.
          </p>

          {/* El correo, editable y confirmado a mano. De acá depende a quién
              le llega el acceso a la historia de esta persona. */}
          <label className="block mt-3">
            <span className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">
              A qué correo
            </span>
            <input type="email" value={correo} autoFocus
              onChange={(e) => setCorreo(e.target.value)}
              className={`${inputCls} mt-1`} placeholder="ejemplo@correo.com" />
          </label>
          {!cliente.email && (
            <p className="text-[11px] text-texto-tenue mt-1.5">
              La ficha no tenía correo. El que pongas acá queda guardado en ella.
            </p>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Boton size="sm" variant="ghost" onClick={() => setAbierto(false)} disabled={yendo}>
              Cancelar
            </Boton>
            <Boton size="sm" onClick={invitar} disabled={yendo || !correo.includes("@")}>
              {yendo ? "Mandando…" : "Mandar la invitación"}
            </Boton>
          </div>
        </div>
      )}
    </Card>
  );
}


export function FichaCliente({ empresaId, clienteId, onVolver, onEditar, permisos, toast }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [pestana, setPestana] = useState("historial");
  const [nota, setNota] = useState("");
  const [alerta, setAlerta] = useState(false);

  const releer = useCallback(async () => {
    const d = await cargarFicha(empresaId, clienteId);
    setDatos(d);
  }, [empresaId, clienteId]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    releer()
      .catch((e) => { if (vigente) setError(e.message || "No pudimos cargar la ficha."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [releer]);

  if (cargando) return <Card><Cargando /></Card>;
  if (error) return <Card><ErrorEstado onReintentar={() => releer().catch((e) => setError(e.message))}>{error}</ErrorEstado></Card>;
  if (!datos) return null;

  const { cliente: c, turnos, abonos, ventas, notas } = datos;
  const alertas = notas.filter((n) => n.destacada);
  const debe = ventas.reduce((s, v) => s + Math.max(0, v.falta), 0);

  async function anotar() {
    if (!nota.trim()) return;
    try {
      await anotarEnFicha(empresaId, clienteId, nota.trim(), alerta);
      setNota("");
      setAlerta(false);
      await releer();
    } catch (e) {
      toast(e.message || "No se pudo anotar.", "mal");
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={onVolver}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-texto-suave hover:text-texto">
        <ChevronLeft size={16} /> Volver a clientes
      </button>

      {/* ---------- Encabezado ---------- */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="w-14 h-14 shrink-0 rounded-full bg-superficie-2 flex items-center justify-center text-lg font-bold text-texto-suave">
            {iniciales(c.razonSocial)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="f-d text-xl">{c.razonSocial}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-texto-suave">
              {c.tel && <span className="inline-flex items-center gap-1.5"><Phone size={13} /> {c.tel}</span>}
              {c.email && <span className="inline-flex items-center gap-1.5"><Mail size={13} /> {c.email}</span>}
              {c.domicilio && <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> {c.domicilio}</span>}
            </div>
            <p className="text-[11px] text-texto-tenue mt-1.5">
              Cliente desde {fecha(c.alta)} · {haceCuanto(c.ultima)}
              {c.proxima && ` · próximo turno ${fechaHora(c.proxima)}`}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {linkWhatsapp(c.tel) && (
              <a href={linkWhatsapp(c.tel)} target="_blank" rel="noreferrer"
                className="text-xs font-semibold px-3 py-2 rounded-lg border border-borde text-texto-suave hover:bg-superficie-2">
                WhatsApp
              </a>
            )}
            <Boton size="sm" variant="ghost" onClick={() => onEditar(c)}>Editar datos</Boton>
          </div>
        </div>
      </Card>

      {/* ---------- El acceso a la app ---------- */}
      <AccesoApp cliente={c} puede={!!permisos.darAppClientes} toast={toast}
        onInvitar={async (correo) => {
          const r = await invitarALaApp(empresaId, c.id, correo);
          /* Se relee en vez de dar por hecho que quedó: lo que decide si
             tiene la app es la columna, y lo que la pantalla tiene que
             mostrar es lo que quedó escrito, no lo que se pidió. */
          await releer();
          return r;
        }}
        onQuitar={async () => { await quitarLaApp(empresaId, c.id); await releer(); }} />

      {/* ---------- Las alertas, fuera de las pestañas ---------- */}
      {alertas.length > 0 && (
        <Card className="p-4 border-mal">
          <div className="flex gap-3">
            <AlertTriangle size={18} className="text-mal shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-widest text-mal font-bold">
                {alertas.length === 1 ? "Atención" : "Atención"}
              </div>
              <ul className="mt-1.5 space-y-1">
                {alertas.map((a) => (
                  <li key={a.id} className="text-sm text-texto">{a.texto}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* ---------- Las cuentas ---------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Turnos" icono={Calendar} valor={nf.format(c.turnos)}
          sub={`${nf.format(c.asistio)} asistió · ${nf.format(c.ausencias)} faltó`} />
        <Kpi label="Asistencia" valor={c.asistencia === null ? "—" : pct(c.asistencia)}
          tono={c.asistencia === null ? "neutro" : c.asistencia >= 0.8 ? "bien" : c.asistencia >= 0.6 ? "neutro" : "mal"}
          sub={c.asistencia === null ? "sin turnos pasados" : "de los que ya pasaron"} />
        <Kpi label="Gastado" icono={Receipt} valor={money(c.gastado)}
          sub={`${nf.format(c.compras)} ${c.compras === 1 ? "operación" : "operaciones"}`} />
        <Kpi label="Debe" valor={money(debe)} tono={debe > 0 ? "mal" : "neutro"}
          icono={Ticket} sub={c.abonosActivos > 0 ? `${nf.format(c.abonosActivos)} abonos activos` : "sin abonos activos"} />
      </div>

      <Tabs value={pestana} onChange={setPestana} items={[
        { k: "historial", n: "Historial", badge: turnos.length || null },
        { k: "abonos", n: "Abonos", badge: abonos.length || null },
        { k: "pagos", n: "Pagos", badge: ventas.length || null },
        { k: "notas", n: "Notas", badge: notas.length || null },
      ]} />

      <Card className="overflow-hidden">
        {/* ---------- Historial ---------- */}
        {pestana === "historial" && (
          turnos.length === 0 ? (
            <Vacio>Todavía no tuvo ningún turno.</Vacio>
          ) : (
            <ul className="divide-y divide-borde">
              {turnos.map((t) => (
                <li key={t.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <span className="f-m text-xs text-texto-tenue w-20 shrink-0">{fecha(t.desde)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-texto truncate">{t.servicio || "Turno"}</div>
                    <div className="text-[11px] text-texto-tenue truncate">
                      {[t.profesional, t.sala].filter(Boolean).join(" · ") || "sin detalle"}
                      {t.conAbono && " · con abono"}
                    </div>
                  </div>
                  {t.precio > 0 && !t.conAbono && (
                    <span className="f-m text-xs text-texto-tenue shrink-0">{money(t.precio)}</span>
                  )}
                  <Sello tono={estadoDe(t.estado).tono}>{estadoDe(t.estado).n}</Sello>
                </li>
              ))}
            </ul>
          )
        )}

        {/* ---------- Abonos ---------- */}
        {pestana === "abonos" && (
          abonos.length === 0 ? (
            <Vacio>Nunca compró un abono.</Vacio>
          ) : (
            <ul className="divide-y divide-borde">
              {abonos.map((a) => (
                <li key={a.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-texto">{a.nombre}</div>
                    <div className="f-m text-[11px] text-texto-tenue">
                      {a.clases === null ? "libre" : `${a.usadas} de ${a.clases} usadas`}
                      {a.vence && ` · vence ${fecha(a.vence)}`}
                    </div>
                  </div>
                  {a.clases !== null && a.estado === "activo" && (
                    <span className="f-m text-sm text-texto shrink-0">{a.restantes} restantes</span>
                  )}
                  <Sello tono={estadoAbono(a.estado).tono}>{estadoAbono(a.estado).n}</Sello>
                </li>
              ))}
            </ul>
          )
        )}

        {/* ---------- Pagos ---------- */}
        {pestana === "pagos" && (
          ventas.length === 0 ? (
            <Vacio>Todavía no se le facturó nada.</Vacio>
          ) : (
            <ul className="divide-y divide-borde">
              {ventas.map((v) => (
                <li key={v.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <span className="f-m text-xs text-texto-tenue w-20 shrink-0">{fecha(v.fecha)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-texto">{v.numero || "Sin número"}</div>
                    <div className="f-m text-[11px] text-texto-tenue">
                      pagó {money(v.pagado)} de {money(v.total)}
                    </div>
                  </div>
                  {v.falta > 1 && <Sello tono="mal">Debe {money(v.falta)}</Sello>}
                  <span className="f-m text-sm text-texto shrink-0">{money(v.total)}</span>
                </li>
              ))}
            </ul>
          )
        )}

        {/* ---------- Notas ---------- */}
        {pestana === "notas" && (
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex gap-2">
                <input value={nota} onChange={(e) => setNota(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") anotar(); }}
                  placeholder="Prefiere a Carla · alérgica al glicólico · consulta por reformer avanzado"
                  className={inputCls} />
                <Boton size="sm" disabled={!nota.trim()} onClick={anotar}><Plus size={14} /> Anotar</Boton>
              </div>
              <label className="flex items-center gap-2 text-sm text-texto-suave">
                <input type="checkbox" checked={alerta} onChange={(e) => setAlerta(e.target.checked)} />
                Es algo que hay que ver antes de atenderla
              </label>
              {alerta && (
                <p className="text-xs text-texto-suave">
                  Las alertas se muestran arriba de todo y también al agendarle un turno. Es para lo que no se puede descubrir tarde.
                </p>
              )}
            </div>

            {notas.length === 0 ? (
              <Vacio>Sin notas. Acá va lo que conviene recordar de esta persona.</Vacio>
            ) : (
              <ul className="space-y-2.5">
                {notas.map((x) => (
                  <li key={x.id} className="flex gap-3 items-start">
                    {x.destacada
                      ? <AlertTriangle size={15} className="text-mal shrink-0 mt-0.5" />
                      : <StickyNote size={15} className="text-texto-tenue shrink-0 mt-0.5" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-texto">{x.texto}</p>
                      <span className="f-m text-[11px] text-texto-tenue">{fecha(x.fecha)}</span>
                    </div>
                    <button onClick={async () => {
                      try { await borrarNota(x.id); await releer(); }
                      catch (e) { toast(e.message || "No se pudo borrar.", "mal"); }
                    }} title="Borrar"
                      className="shrink-0 p-1.5 rounded-lg text-texto-tenue hover:text-mal hover:bg-superficie-2">
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
