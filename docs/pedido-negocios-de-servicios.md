# Encargo · Genez para negocios de servicios

Qué hay que construir para que Genez sirva a un negocio que vende turnos:
estética, pilates, barbería, tatuajes, gimnasio, consultorio, peluquería
canina. El primer caso es una estética con pilates, pero **el primer caso no
es la especificación**.

Las maquetas de referencia son 23 capturas que tiene el cliente. Hay que
pedírselas: no están en el repositorio.

Ver `ARQUITECTURA.md` para el modelo de datos actual y `DISENO.md` para las
reglas visuales. Lo que este documento diga distinto de esos dos, es porque
lo cambia a propósito y está dicho acá.

## Lo esencial

Un motor único —clientes, servicios, turnos, profesionales, recursos,
ventas, finanzas— con **configuraciones verticales encima**. No un sistema
por rubro.

## Dónde vive el personal

Lo que en este documento se llamó "el módulo de personal" **no es una
sección**: se parte en dos, y el corte es el mismo que usa el resto del
sistema —la operación por un lado, la plata por el otro—.

- **Clientes y equipo → Equipo.** Quiénes son, qué servicios da cada uno,
  horarios, ausencias, vacaciones y suplencias. Es lo que la agenda
  necesita para poder ofrecer un turno.
- **Finanzas → Liquidaciones.** Horas del período, valor hora, total y el
  pago. Con las notas de reemplazo al costado.

Van separadas porque **pagarle a alguien es un egreso**. Con la liquidación
adentro de "Clientes y equipo", Finanzas no se entera del gasto más grande
y más regular del negocio, y los egresos del mes mienten. Al marcarse
pagada, la liquidación genera el movimiento y la caja cierra sola.

Además las usan personas distintas: recepción mira Equipo todos los días
—quién cubre, quién faltó—; el dueño mira Liquidaciones una vez por semana.

Las horas las **propone** la agenda sumando las clases dadas y se corrigen
a mano en la liquidación, que es el momento en que se las mira.

La misma regla que el centro de pedidos: no crear nada paralelo. El
catálogo, los clientes, las operaciones, la caja, los pagos, los permisos y
la impresión ya existen y se reusan.

## Decisiones tomadas (22/08/2026)

1. **El acento es naranja.** Hay maquetas en violeta; se descartan. El
   naranja es lo que está en `index.css` y lo que ya usan Super 25 y el bar.
   Cambiarlo obligaba a repintar el sistema entero, no solo lo nuevo.
2. **El menú es dato, no código.** Ver la sección siguiente.
3. **`DISENO.md` manda.** Las maquetas se adaptan al estilo que ya tiene el
   sistema —esquinas discretas, bordes de 1px, poco color— y no al revés.
4. **Los permisos configurables quedan para después.** Los roles de hoy
   funcionan y el módulo arrastra RLS detrás.
5. **CRM y Comunicaciones quedan últimos**, cuando haya turnos cargados
   sobre los que probarlos.

## El menú es dato

Es el cambio arquitectónico de fondo y la razón de ser de todo lo demás.

Hoy el menú es una lista fija pensada para un minimercado. Si se la
reemplaza por una lista fija pensada para una estética, el tercer rubro
vuelve a romper todo. Así que los grupos, qué módulos caen en cada uno y
cómo se llaman las cosas se definen **por rubro y en la base**, igual que
`canales` define el flujo de un pedido sin un solo `if`.

Los diez grupos de referencia —Inicio, Agenda, Clientes y equipo, Servicios
y recursos, Ventas, Finanzas, CRM y marketing, Comunicaciones, Reportes,
Configuración— son la configuración del rubro servicios. Gastronomía tiene
los suyos, con Salón y Cocina. Comercio, los suyos, con Stock y Compras.

El menú que ve una persona es el cruce de tres cosas:

    grupos del rubro  ∩  módulos que el comercio contrató  ∩  lo que el rol habilita

Las dos últimas ya existen (`empresas.modulos` y `ROLES`). Falta la primera.

**La terminología también es del rubro.** Turno, clase, sesión, cita.
Cliente, paciente, alumno. Profesional, profe, barbero, tatuador. Es el
mismo mecanismo que `VOZ_MESA` y `VOZ_CANAL` en la comanda: una pantalla,
distintas palabras, cero componentes duplicados.

## El mapa

| Hoy | Va a | Qué pasa |
|---|---|---|
| `Inicio.jsx` | Inicio | Se rehacen los indicadores; la estructura de tarjetas se reusa |
| — | **Agenda** | Nuevo. Sobre `reservas`, `recursos` e `items` |
| `Clientes.jsx` | Clientes y equipo → Clientes | Primero hay que migrarlo a la base |
| — | Clientes y equipo → Equipo, Suplencias | Nuevo |
| `Productos.jsx` | Servicios y recursos → Servicios | Misma tabla `items`, otra vista: duración y capacidad en vez de stock |
| `PlanoSalon.jsx` | Servicios y recursos → Salas | El editor de plano se reusa entero |
| `Vender.jsx` | Ventas → Venta rápida | Se conserva |
| — | Ventas → Presupuestos, Abonos, Packs | `operaciones.tipo` ya admite `presupuesto`. Los abonos son nuevos |
| `Caja.jsx` | Finanzas → Caja | Se conserva y gana pestañas hermanas |
| — | Finanzas → Ingresos, Egresos, Pendientes | Vistas nuevas sobre `movimientos_caja` |
| `Reportes.jsx` | Reportes | Se conserva el armazón; las métricas se rehacen |
| `Ajustes.jsx` | Configuración | Se conserva |
| `Comandas`, `CentroPedidos`, `Stock`, `Compras` | Grupos de gastronomía y comercio | No se tocan y no se le muestran a una estética |

Nada se borra. Lo que era un módulo suelto pasa a ser una vista de un grupo.

## Lo que se reutiliza sin tocar

`Card`, `Boton`, `Modal`, `Tabs`, `Kpi`, `Vacio`, `TablaSimple` y los campos.
El sistema de colores por variables. La impresión de comandera. El lector de
códigos. La cola de ventas sin internet. Toda la capa `src/datos/`. El
editor de plano, tal cual, para dibujar salas y boxes.

De la base: `items` (con `tipo = 'servicio'` y `duracion_min`, que ya estaba
previsto para esto), `recursos`, `reservas`, `clientes`, `operaciones`,
`pagos`, `movimientos_caja`, `sesiones_caja`, `bitacora`.

## Lo que hay que construir

### Tablas nuevas

- **`personal`** — la persona. Nombre, tipo (profesional o recepción),
  modalidad de pago, valor, y un `perfil_id` **opcional**: hoy los profes no
  entran al sistema, pero si mañana uno quiere, se le engancha una cuenta sin
  migrar nada. Dejarlo previsto ahora cuesta una columna; agregarlo después
  cuesta una migración de datos.
- **`personal_servicios`** — quién puede dar qué.
- **`horarios`** — de una persona o de un recurso: día, desde, hasta.
  Sin esto no se puede ofrecer un turno, ni siquiera a mano.
- **`excepciones`** — ausencias, vacaciones, feriados.
- **`franjas`** — el hueco agendado: cuándo, qué servicio, quién lo da, en
  qué sala, cuántos lugares. **Con cupo 1 es un turno individual y con cupo 6
  es una clase de pilates.** Un solo modelo para los dos casos, y de paso
  sirve para un gimnasio con cupo 20.
- **`abonos`** — el crédito del cliente: cuántas clases, cuántas usó, cuándo
  vence, qué operación lo pagó.
- **`lista_espera`** — quién quiere entrar a una franja llena, y en qué orden.
- **`horas`** — las horas de cada persona por día, con su origen: propuestas
  desde la agenda o cargadas a mano.
- **`liquidaciones`** — período, persona, horas, valor, total, estado.
- **`liquidacion_notas`** — los reemplazos y lo que haga falta, **pegados al
  período que se está liquidando**. Ahí es donde tienen sentido: son la
  explicación de por qué esas horas no cierran con lo habitual.
- **`suplencias`** — franja, titular, suplente, motivo.
- **`menu_rubro`** — los grupos y módulos de cada rubro, y las palabras.

### Cambios sobre lo que existe

`reservas` gana `franja_id`, `personal_id`, `item_id` y `abono_id`: hoy sabe
la sala pero no quién atiende ni qué se hace.

Los planes y los packs **son items del catálogo**, con `tipo = 'plan'`.
Abajo siempre son un item —así entran en el cobro, la caja y los informes
sin nada nuevo— y lo que el comercio elige es desde qué pantalla los
administra. Un modelo, dos puertas.

### Funciones de Postgres

Por la regla 5 de `ARQUITECTURA.md`, lo que toca varias tablas no se resuelve
con varias llamadas desde el navegador:

| Función | Qué hace |
|---|---|
| `disponibilidad(...)` | Los huecos reales, cruzando horarios, franjas, salas y excepciones. La usan la agenda y el turno online |
| `reservar_turno(jsonb)` | Valida cupo, sala, profesional y tope del plan; descuenta del abono |
| `marcar_asistencia(...)` | Aplica la política de ausencias y consume el crédito |
| `cancelar_turno(...)` | Aplica la ventana de cancelación, libera el lugar y avisa a la lista de espera |
| `vender_abono(...)` | Crea el crédito al confirmar la venta |
| `liquidar(...)` | Arma la liquidación de un período y genera el egreso al pagarla |

## Lo que es configuración, no código

Cada comercio decide, y el sistema soporta las variantes desde el principio:

- **Ausencias**: pierde la clase, la pierde salvo que avise a tiempo, o la
  recupera. El tercero obliga a llevar un saldo de clases a recuperar aparte
  del crédito normal, y por eso hay que preverlo ahora.
- **Ventanas**: cuántas horas antes se confirma y hasta cuándo se cancela sin
  perder. Las maquetas usan 12 y 24 horas.
- **Planes**: libres o con tope semanal. El tope se controla **al reservar**,
  no al cobrar: es la diferencia entre un sistema que sirve y uno que
  registra.
- **Vencimiento de packs.**
- **Modalidad de pago al personal**: por hora, por clase, por comisión sobre
  el servicio, o sueldo fijo. Las cuatro, y por persona. **Por hora es el
  valor de fábrica** —es lo que usa el primer negocio— pero ninguna puede
  estar escrita en el código: una maqueta muestra "40% de comisión" y un
  comercio va a querer fijo. Es un sistema que se adapta, no que impone.
- **Reemplazos**: si al titular se le paga igual o no. Por defecto cobra
  quien trabajó.
- **Cierre de la semana de liquidación** y **redondeo de horas**: una clase
  de 55 minutos, ¿es una hora? ¿el hueco entre dos clases cuenta?

## Las etapas

Cada una tiene que dejar algo usable.

0. **Clientes a la base** y **el menú como dato**. Habilita todo lo demás y
   le sirve también a los comercios que ya existen.
1. **Servicios, salas, personal y horarios.** El catálogo del rubro.
2. **Agenda.** Turnos individuales y grupales, cupo, estados, asistencia.
   Con esto solo ya reemplaza el cuaderno.
3. **Ventas.** Abonos, packs y planes; cobrar desde el turno; presupuestos.
   Sin esto la plata no cierra.
4. **Finanzas.** Ingresos, egresos, pendientes y el corte mensual.
5. **Personal.** Horas, liquidación semanal, suplencias y notas.
6. **Lista de espera y reprogramación.**
7. **Turnos online.** Página pública sin login.
8. **CRM y Comunicaciones.**
9. **Permisos configurables y auditoría.**

El orden no es negociable en un punto: los turnos online van después de los
horarios y de la asistencia. Ofrecer turnos sin horarios cargados no se
puede, y sin asistencia la agenda se llena de gente que no viene.

## Dos cosas que arrastra el proyecto

**Los clientes están en memoria.** La tabla existe en la base pero la
pantalla usa datos simulados que se pierden al refrescar. Un turno sin
cliente de verdad no sirve, así que migrarlos es la primera tarea.

**La fecha congelada.** Varios cálculos usan un "hoy" fijo del 9 de agosto
de 2026, heredado del prototipo. Una agenda no puede vivir con eso: este
módulo usa la fecha real y va a convivir un tiempo con pantallas que todavía
usan la vieja.

## Fuera de alcance por ahora

Cobro recurrente automático de cuotas, autenticación en dos pasos, sesiones
activas, campañas automatizadas, y cualquier integración de mensajería que
no sea abrir WhatsApp con el mensaje ya escrito.

## Lo que todavía falta saber

- **Los datos reales del negocio, que son todos.** Lo que se ve en las
  maquetas —los nueve servicios con su precio, las salas, los profesionales,
  los packs— es inventado, confirmado por el cliente. Hasta que lleguen los
  de verdad, la semilla va marcada como demo y se borra de una, igual que la
  del Bar Rivadavia. Hacen falta: servicios con duración y precio, salas con
  capacidad, la gente con su valor hora, los horarios de cada uno, y los
  planes y packs que vende hoy.
- Si se cobra seña al reservar online.
- Cuántas sucursales.
- El nombre exacto del rubro, que es lo que después permite vender "Genez
  para gimnasios" sin tocar nada.
