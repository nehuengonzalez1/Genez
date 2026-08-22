/* ============================================================
   TABLERO · lo que el negocio necesita saber al abrir
   ============================================================

   Una sola función arma el tablero entero. La pantalla recibe un objeto y
   dibuja: no sabe —ni tiene por qué— qué salió de la base y qué todavía
   no existe.

   Eso es lo que permite ir migrando de a un indicador por vez. Cuando
   exista la tabla de turnos, `turnosHoy` deja de venir del generador y
   pasa a ser una consulta, y no hay que tocar una línea de la vista.

   REGLA DE LOS DATOS DE EJEMPLO
   ----------------------------
   Solo se completan con ejemplos los comercios marcados `demo` en su
   configuración. Hoy es únicamente Almha. Un comercio real ve sus
   números reales aunque sean cero: mostrarle turnos inventados a alguien
   que está por decidir con eso sería mucho peor que mostrarle un tablero
   vacío.

   Cada campo dice si es de ejemplo. La pantalla hoy no lo muestra, pero
   el dato está para el día que se quiera distinguir a simple vista.
   ============================================================ */

import { supabase } from "./supabase.js";
import { mulberry32 } from "./generador.js";

const dia = 86400000;

function alArrancarElDia(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const suma = (xs, f) => xs.reduce((s, x) => s + Number(f(x) || 0), 0);

/* Un dato del tablero. `demo` viaja con el valor y no aparte: si viajara
   aparte, en algún refactor se iban a separar y nadie se iba a enterar. */
const dato = (valor, extra = {}) => ({ valor, demo: false, ...extra });
const ejemplo = (valor, extra = {}) => ({ valor, demo: true, ...extra });

/* Un tablero en cero, con la forma completa. Lo usa quien tiene que
   dibujar algo aunque la consulta se haya caído: con esto cada bloque
   muestra su estado vacío, que es honesto. Sin esto, la pantalla se queda
   colgada en el esqueleto de carga. */
export function tableroVacio() {
  return {
    facturacionHoy: dato(0, { delta: null, serie: [], operaciones: 0 }),
    ingresosMes: dato(0, { delta: null, serie: [] }),
    ticketPromedio: dato(0, { delta: null }),
    ingresosPorArea: dato([]),
    topServicios: dato([]),
    clientesNuevos: dato([]),
    pagosPendientes: dato(0, { clientes: 0, operaciones: 0 }),
    turnosHoy: dato(0),
    asistenciaHoy: dato(0, { sobre: 0 }),
    proximosTurnos: dato(0),
    huecos: dato(0),
    listaEspera: dato(0),
    abonosPorVencer: dato(0),
    agendaHoy: dato([]),
    utilizacionSalas: dato([]),
    turnosPorEstado: dato([]),
    rendimiento: dato({ ingresos: 0, asistencia: null, conversion: null }),
    acciones: dato([]),
    alertas: dato([]),
  };
}

/* ------------------------------------------------------------
   Lo que ya sale de la base
   ------------------------------------------------------------ */

async function operacionesDesde(empresaId, desde) {
  const { data, error } = await supabase
    .from("operaciones")
    .select("id, total, fecha, cliente_id")
    .eq("empresa_id", empresaId)
    /* Una mesa cobrada es venta del día aunque su tipo siga siendo
       'comanda': lo que decide es el estado, no el tipo. Mismo criterio
       que `resumenDelDia`. */
    .in("tipo", ["venta", "comanda"])
    .eq("estado", "confirmada")
    .gte("fecha", desde.toISOString())
    .limit(5000);
  if (error) throw error;
  return data || [];
}

/* Serie por día para los gráficos chiquitos de las tarjetas. */
function serieDiaria(ops, dias, hasta) {
  const fin = alArrancarElDia(hasta).getTime();
  const acum = new Array(dias).fill(0);
  for (const o of ops) {
    const d = Math.round((fin - alArrancarElDia(new Date(o.fecha)).getTime()) / dia);
    if (d >= 0 && d < dias) acum[dias - 1 - d] += Number(o.total || 0);
  }
  return acum;
}

async function lineasDelMes(empresaId, desde) {
  const { data, error } = await supabase
    .from("operacion_lineas")
    .select("descripcion, cantidad, total, item_id, items(categoria), operaciones!inner(fecha, estado)")
    .eq("empresa_id", empresaId)
    .eq("operaciones.estado", "confirmada")
    .gte("operaciones.fecha", desde.toISOString())
    .limit(5000);
  if (error) throw error;
  return data || [];
}

async function clientesNuevos(empresaId) {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, razon_social, creado_en")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("creado_en", { ascending: false })
    .limit(5);
  if (error) throw error;
  return data || [];
}

/* Lo cobrado se compara contra el total de cada operación. No hay una
   columna "saldo" a propósito: sería un número copiado que se desincroniza
   con los pagos apenas alguien registre uno a mano. */
async function pendientesDeCobro(empresaId, desde) {
  const { data, error } = await supabase
    .from("operaciones")
    .select("id, total, cliente_id, fecha, pagos(monto)")
    .eq("empresa_id", empresaId)
    .in("tipo", ["venta", "comanda"])
    .eq("estado", "confirmada")
    .gte("fecha", desde.toISOString())
    .limit(2000);
  if (error) throw error;

  const deudas = (data || [])
    .map((o) => ({ ...o, falta: Number(o.total || 0) - suma(o.pagos || [], (p) => p.monto) }))
    .filter((o) => o.falta > 1);   // el 1 evita arrastrar centavos de redondeo

  return {
    monto: suma(deudas, (o) => o.falta),
    clientes: new Set(deudas.map((o) => o.cliente_id).filter(Boolean)).size,
    operaciones: deudas.length,
  };
}

/* ------------------------------------------------------------
   El tablero
   ------------------------------------------------------------ */

export async function cargarTablero({ empresaId, demo = false }) {
  const ahora = new Date();
  const hoy = alArrancarElDia(ahora);
  const ayer = new Date(hoy.getTime() - dia);
  const mes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const mesPrevio = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
  const hace90 = new Date(hoy.getTime() - 90 * dia);

  const [ops, lineas, nuevos, pendiente] = await Promise.all([
    operacionesDesde(empresaId, mesPrevio),
    lineasDelMes(empresaId, mes),
    clientesNuevos(empresaId),
    pendientesDeCobro(empresaId, hace90),
  ]);

  const deHoy = ops.filter((o) => new Date(o.fecha) >= hoy);
  const deAyer = ops.filter((o) => { const f = new Date(o.fecha); return f >= ayer && f < hoy; });
  const delMes = ops.filter((o) => new Date(o.fecha) >= mes);
  const delPrevio = ops.filter((o) => { const f = new Date(o.fecha); return f >= mesPrevio && f < mes; });

  const totalHoy = suma(deHoy, (o) => o.total);
  const totalAyer = suma(deAyer, (o) => o.total);
  const totalMes = suma(delMes, (o) => o.total);
  const totalPrevio = suma(delPrevio, (o) => o.total);
  const ticket = delMes.length ? totalMes / delMes.length : 0;
  const ticketPrevio = delPrevio.length ? totalPrevio / delPrevio.length : 0;

  /* Sin base contra la que comparar no hay variación. Un "+100%" contra
     cero no informa nada y encima alarma. */
  const variacion = (hoy_, antes) => (antes > 0 ? hoy_ / antes - 1 : null);

  const porArea = new Map();
  const porServicio = new Map();
  for (const l of lineas) {
    const area = (l.items && l.items.categoria) || "Otros";
    porArea.set(area, (porArea.get(area) || 0) + Number(l.total || 0));
    const k = l.descripcion;
    const s = porServicio.get(k) || { nombre: k, cantidad: 0, total: 0 };
    s.cantidad += Number(l.cantidad || 0);
    s.total += Number(l.total || 0);
    porServicio.set(k, s);
  }

  const base = {
    facturacionHoy: dato(totalHoy, { delta: variacion(totalHoy, totalAyer), serie: serieDiaria(ops, 14, ahora), operaciones: deHoy.length }),
    ingresosMes: dato(totalMes, { delta: variacion(totalMes, totalPrevio), serie: serieDiaria(delMes, 14, ahora) }),
    ticketPromedio: dato(Math.round(ticket), { delta: variacion(ticket, ticketPrevio) }),
    ingresosPorArea: dato([...porArea.entries()]
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)),
    topServicios: dato([...porServicio.values()].sort((a, b) => b.total - a.total).slice(0, 5)),
    clientesNuevos: dato(nuevos.map((c) => ({ id: c.id, nombre: c.razon_social, alta: c.creado_en ? new Date(c.creado_en) : null }))),
    pagosPendientes: dato(pendiente.monto, { clientes: pendiente.clientes, operaciones: pendiente.operaciones }),

    /* Lo que todavía no tiene tabla. En un comercio real se muestran en
       cero y el estado vacío lo dice; en uno de demostración los completa
       el generador de abajo. */
    turnosHoy: dato(0),
    asistenciaHoy: dato(0, { sobre: 0 }),
    proximosTurnos: dato(0),
    huecos: dato(0),
    listaEspera: dato(0),
    abonosPorVencer: dato(0),
    agendaHoy: dato([]),
    utilizacionSalas: dato([]),
    turnosPorEstado: dato([]),
    rendimiento: dato({ ingresos: totalMes, asistencia: null, conversion: null }),
    acciones: dato([]),
    alertas: dato([]),
  };

  return demo ? await completarConEjemplos(base, empresaId, ahora) : base;
}

/* ------------------------------------------------------------
   Los ejemplos

   Se arman con el catálogo y las salas de verdad del comercio, no con
   nombres inventados: así el tablero de demostración muestra las mismas
   prestaciones que están cargadas, y el día que aparezcan los turnos
   reales el salto es menos brusco.

   El azar va sembrado con la fecha para que los números no bailen en cada
   pestañeo de la pantalla: dentro del mismo día son siempre los mismos.
   ------------------------------------------------------------ */

const NOMBRES = [
  "Florencia Silva", "Martina López", "Agustín Pérez", "Belén Acosta",
  "Julieta Román", "Camila Torres", "Valentina Rojas", "Lucía Fernández",
];

async function completarConEjemplos(base, empresaId, ahora) {
  const [{ data: items }, { data: salas }] = await Promise.all([
    supabase.from("items").select("nombre, duracion_min, precio, categoria")
      .eq("empresa_id", empresaId).eq("tipo", "servicio").eq("activo", true).limit(20),
    supabase.from("recursos").select("nombre, capacidad")
      .eq("empresa_id", empresaId).eq("activo", true).order("orden").limit(10),
  ]);

  const servicios = items && items.length ? items : [{ nombre: "Turno", duracion_min: 60, precio: 0, categoria: "Servicios" }];
  const espacios = salas && salas.length ? salas : [{ nombre: "Sala", capacidad: 1 }];

  const r = mulberry32(Number(`${ahora.getFullYear()}${ahora.getMonth() + 1}${ahora.getDate()}`));
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  const elegir = (xs) => xs[Math.floor(r() * xs.length)];

  const turnos = ri(18, 28);
  const asistieron = Math.round(turnos * (0.7 + r() * 0.15));
  const ausentes = ri(1, 3);
  const noShow = ri(0, 2);
  const cancelados = ri(1, 4);
  const confirmados = Math.max(0, turnos - asistieron - ausentes - noShow - cancelados);

  const agenda = [];
  for (let i = 0; i < 6; i++) {
    const s = elegir(servicios);
    const e = elegir(espacios);
    const cupo = Math.max(1, e.capacidad || 1);
    const hora = 9 + i * 2;
    agenda.push({
      hora: `${String(hora).padStart(2, "0")}:00`,
      servicio: s.nombre,
      sala: e.nombre,
      persona: elegir(NOMBRES),
      estado: hora <= ahora.getHours() && hora + 1 > ahora.getHours() ? "en curso" : "confirmado",
      ocupados: cupo === 1 ? 1 : ri(Math.ceil(cupo / 2), cupo),
      cupo,
    });
  }

  const utilizacion = espacios.slice(0, 5).map((e) => ({ nombre: e.nombre, pct: ri(58, 92) / 100 }));
  const huecos = ri(2, 5);
  const espera = ri(6, 16);
  const abonos = ri(1, 4);

  return {
    ...base,
    turnosHoy: ejemplo(turnos, { delta: (ri(-8, 20)) / 100 }),
    asistenciaHoy: ejemplo(asistieron, { sobre: turnos }),
    proximosTurnos: ejemplo(ri(3, 8)),
    huecos: ejemplo(huecos),
    listaEspera: ejemplo(espera),
    abonosPorVencer: ejemplo(abonos),
    agendaHoy: ejemplo(agenda),
    utilizacionSalas: ejemplo(utilizacion),
    turnosPorEstado: ejemplo([
      { k: "confirmados", n: "Confirmados", v: confirmados, tono: "info" },
      { k: "asistieron", n: "Asistieron", v: asistieron, tono: "bien" },
      { k: "ausentes", n: "Ausentes", v: ausentes, tono: "ojo" },
      { k: "noshow", n: "No show", v: noShow, tono: "mal" },
      { k: "cancelados", n: "Cancelados", v: cancelados, tono: "tenue" },
    ]),
    rendimiento: ejemplo({
      ingresos: base.ingresosMes.valor,
      asistencia: asistieron / Math.max(1, turnos),
      conversion: ri(38, 62) / 100,
    }),
    acciones: ejemplo([
      { k: "inactivos", n: "Contactar clientes inactivos", d: `${ri(3, 9)} hace más de 30 días que no vienen.`, accion: "Ver clientes", tab: "clientes" },
      { k: "huecos", n: "Ofrecer huecos disponibles", d: `${huecos} lugares libres hoy que podés ofrecer.`, accion: "Enviar ofertas", tab: null },
      { k: "abonos", n: "Recordar abonos por vencer", d: `${abonos} vencen esta semana.`, accion: "Enviar recordatorios", tab: null },
      { k: "espera", n: "Mover la lista de espera", d: `${espera} personas esperando un lugar.`, accion: "Ver lista", tab: null },
    ]),
    alertas: ejemplo([
      { k: "abonos", n: `${abonos} abonos por vencer`, d: "Vencen en los próximos 7 días.", accion: "Ver abonos", tab: null, tono: "ojo" },
      { k: "noshow", n: `${noShow} no show hoy`, d: "Impacta en el consumo de abonos.", accion: "Ver asistencia", tab: null, tono: "mal" },
      { k: "cobros", n: "Pagos pendientes", d: `${base.pagosPendientes.clientes || ri(2, 6)} clientes con saldo.`, accion: "Ver caja", tab: "caja", tono: "info" },
    ]),
  };
}
