# Cómo está construido Genez

Escrito para que quien retome el proyecto no tenga que deducirlo leyendo
todo. Responde las preguntas que hay que hacerse antes de agregar un
módulo nuevo.

## La pila

- **React + Vite**. No hay framework de más alto nivel ni router: la
  navegación es estado dentro de `Sistema`.
- **Supabase**: Postgres, autenticación y RLS. Sin ORM — se habla con
  `supabase-js` directo desde `src/datos/`.
- **Tailwind**, con los colores como variables CSS (ver `DISENO.md`).
- Sin librería de estado, sin React Query. El estado vive en `Sistema` y
  baja por props.

## Dónde está cada cosa

| Carpeta | Qué contiene |
|---|---|
| `src/datos/` | La capa de datos. Un archivo por dominio. **Es el único lugar que habla con Supabase.** |
| `src/modulos/` | Una pantalla por archivo. |
| `src/ui/` | Componentes compartidos: `Card`, `Boton`, `Modal`, `Tabs`, `Apagado`, campos. |
| `src/genez/PanelGenez.jsx` | `Login`, `PanelGenez` (plataforma) y `Sistema`, que es el contenedor de estado de un comercio. |
| `supabase/migrations/` | El esquema, numerado. Se aplica con `node scripts/aplicar-sql.mjs <archivo>`. |
| `scripts/probar-*.mjs` | Las pruebas. Corren contra la base real. |

## Las pruebas

```bash
node scripts/probar-rls.mjs        # seguridad, con identidad de un usuario real
node scripts/probar-venta.mjs      # las dos entradas de cobro
node scripts/probar-cocina.mjs     # agrupado por comanda
node scripts/probar-descuento.mjs  # descuento y comensales
node scripts/probar-agrupado.mjs   # líneas repetidas
node scripts/probar-pedidos.mjs    # estados, flujo por canal e historial
node scripts/probar-comanda.mjs    # dividir la cuenta, cerrar y auditoría
node scripts/probar-salon.mjs      # los cinco estados de una mesa y la reserva
```

`probar-rls.mjs` toma la identidad de un usuario con `set local role
authenticated`, así las políticas se aplican igual que desde el navegador.
Las demás corren como administrador y **saltean RLS**: sirven para la
lógica, no para los permisos. Esa diferencia ya dejó pasar un bug.

## El modelo de datos

### Multiempresa
`empresas` → `sucursales` → `perfiles` (que son los usuarios, con `rol` y
`es_plataforma`). Todo lo demás cuelga de `empresa_id`.

El aislamiento lo garantiza **RLS**, no la aplicación: la misma consulta
devuelve distinto según quién la haga.

### Catálogo
`items` cubre productos **y** servicios (columna `tipo`). Tiene
`descripcion`, `controla_stock`, `duracion_min` y `campos_extra`.

`historial_costos` e `historial_precios` los escribe un disparador cuando
el valor cambia: ninguna pantalla tiene que acordarse.

`items_vista` arma el producto ya calculado —stock, costo anterior,
rotación— y es lo que consume el front.

### Operaciones — **acá está la clave**
`operaciones` es toda transacción: `venta`, `comanda`, `presupuesto`,
`pedido`, `compra`, `orden_trabajo`, `devolucion`.

Ya tiene: `canal` (apunta a `canales.clave`), `referencia` (el número del
pedido externo), `recurso_id` (la mesa), `comensales`, `descuento`,
`descuento_pct`, `cliente_id`, `usuario_id`, `actualizada_en` y
`actualizada_por`.

`operacion_lineas` tiene `estado` (`borrador`, `pedido`, `preparando`,
`listo`, `entregado`, `anulada`), `modificadores`, `notas` y `destino`
(cocina o barra).

**Un pedido de take away ya es una `operacion`.** No hace falta un modelo
nuevo, y crear uno duplicaría ventas, stock y caja.

### El pedido

`operaciones.estado_pedido` es la etapa del pedido —`pendiente`,
`en_preparacion`, `listo`, `en_camino`, `completado`, `cancelado`— y no
se deduce de las líneas: hay estados que las líneas no pueden expresar y
los tiempos hay que poder medirlos.

`pedido_estados` guarda cada transición con su hora, su motivo y quién la
hizo. La escribe un disparador, así que vale para cualquier camino.

`canales` son las filas de por dónde entra un pedido, una lista por
comercio. Cada canal trae su `flujo`: los estados por los que pasa. Por
eso mostrador no tiene "en camino" y delivery sí, sin un solo `if`.

`pedidos_vista` arma la tarjeta entera del tablero —canal, cliente,
platos, total, hace cuánto que está donde está— en una sola lectura.

### Lo demás
- `pagos`, `movimientos_caja`, `sesiones_caja` — la caja
- `movimientos_stock` — el stock es la suma de sus movimientos, nunca un
  campo que se pisa
- `recursos` (mesas, habitaciones, sillones) y `plano_elementos`
- `reservas` — una mesa comprometida para más tarde
- `canales` y `pedido_estados` — ver "El pedido", más arriba
- `bitacora` — solo admite insertar y leer

## Las funciones de la base

Lo que toca varias tablas a la vez vive en Postgres, no en el navegador:

| Función | Qué hace |
|---|---|
| `registrar_venta(jsonb)` | Venta completa en una transacción. Idempotente. |
| `cerrar_comanda(...)` | Cobra una mesa. Calcula totales de las líneas. |
| `confirmar_operacion(...)` | Lo común a las dos: caja, pagos, stock. |
| `abrir_comanda(jsonb)` | Ocupa una mesa o abre un pedido sin mesa. |
| `registrar_pago(...)` | Un pago sobre una cuenta abierta. Dividir es esto, varias veces. |
| `mover_pedido(...)` | Cambia el estado: valida el flujo del canal, mueve la cocina y deja historial. |
| `estadisticas_pedidos(...)` | Pedidos, ventas, tiempos y evolución de un período. |
| `informe_ocupacion(...)` | Cuánto de lo que se podía vender se vendió, por profesional y por sala. Ver abajo. |
| `sembrar_canales(uuid)` | Los canales con los que arranca un comercio. |
| `enviar_a_cocina(uuid)` | Despacha solo lo que falta despachar. |
| `aplicar_descuento(...)` | Por porcentaje o por importe. |
| `guardar_plano(jsonb)` | Acomoda el salón en una transacción. |
| `unir_mesas` / `separar_mesa` | Con sus validaciones. |

## Reglas que no se pueden romper

1. **El stock no se guarda, se deriva.** Un campo mutable se corrompe
   apenas dos cajas sincronizan tarde.
2. **Las ventas son append-only.** RLS impide editar una operación
   confirmada; anular crea una devolución que la referencia.
3. **El id lo genera el dispositivo.** Es lo que permite cobrar sin
   internet y que un reintento no duplique.
4. **No se cobra sin caja abierta.** Se verifica en la base.
5. **Lo que toca varias tablas va en una función**, no en varias llamadas
   desde el navegador.
6. **Toda consulta de lista filtra por `empresa_id`, explícito.** RLS
   contesta *si podés ver algo*, no *de qué comercio es*. Para un usuario
   de comercio las dos respuestas coinciden, y por eso apoyarse en la
   política parecía alcanzar. No alcanza: el dueño de plataforma ve todo, y
   entrando como Almha se le cargaban los 972 productos de Super 25 —la
   Coca-Cola apareciendo en el informe de una estética—. Las funciones de
   `src/datos/` que traen listas revientan si no reciben la empresa, a
   propósito: un id olvidado tiene que fallar ahí y no convertirse en datos
   de otro negocio. Lo cubre `probar-rls.mjs`, en "Alcance de la
   plataforma".

## El salón

`salon_vista` resuelve el **estado de cada mesa**, y lo resuelve ahí y no
en la pantalla: el plano, la lista de mesas y el recuento de abajo tienen
que decir lo mismo, y si cada uno lo dedujera por su cuenta, un día dejan
de coincidir.

Son cinco y hay un orden entre ellos, porque una mesa puede cumplir dos
condiciones a la vez: **cuenta** (pagó y sigue sentada) gana a **entregar**
(algo listo esperando en la cocina), que gana a **ocupada**, que gana a
**reservada**; lo que queda es **libre**. El criterio es qué hay que hacer
ahora, no qué pasó antes.

Ninguno se escribe: salen de la comanda, de sus líneas, de `pagos` y de
`reservas`. Por eso el color de una mesa no se puede tocar desde la
pantalla, solo empujar desde el servicio.

## La comanda

`Pedido`, dentro de `src/modulos/Comandas.jsx`, es la misma pantalla para
una mesa y para un delivery: lo único que cambia son las palabras
(`VOZ_MESA` y `VOZ_CANAL`) y el encabezado.

**Dividir la cuenta no parte la operación.** Una mesa que paga entre tres
sigue siendo una comanda con tres pagos: partirla duplicaría líneas,
descuadraría el stock y dejaría dos comandas donde hubo una. Lo que se
divide es la plata, con `registrar_pago`, que exige caja abierta y no
deja cobrar más que el saldo. `cuenta_vista` dice cuánto va, cuánto se
pagó y cuánto falta.

**Lo que achica una cuenta queda escrito.** Anular una línea, bajar una
cantidad y aplicar un descuento van a la bitácora con quién y cuándo: es
por donde se va la plata de un local. El alta no se anota porque la línea
misma ya es el registro, y ahora lleva `usuario_id`.

## El centro de pedidos

`src/modulos/CentroPedidos.jsx` es el tablero de take away y mostrador:
columnas por estado, canales a la izquierda, historial, estadísticas y la
configuración de canales. Se entra desde la pantalla de comanda.

Tres cosas que conviene no romper:

**El color de la tarjeta es el estado, no el canal.** A un metro de
distancia lo que hay que ver es qué falta hacer. El canal se lee después,
en el sello y el nombre.

**Completar un pedido es cobrarlo.** `mover_pedido` rechaza que alguien lo
complete a mano: se completa por `cerrar_comanda`, que es donde viven la
caja obligatoria, el stock y la numeración. Sin eso habría dos formas de
terminar un pedido y una de ellas no dejaría plata en ninguna caja.

**El tablero no edita el pedido.** Cargar platos, descontar y cobrar pasa
por la pantalla de comanda, que es la misma para una mesa y para un
delivery. El tablero la abre; no la duplica.

Los cuatro huecos que tenía el sistema quedaron cerrados: estado propio
del pedido (0021), historial de transiciones (0021), tiempo real (0022) y
canales como filas (0020).

## El informe de un negocio de servicios

`src/modulos/Informes.jsx` es el informe del rubro servicios.
`Reportes.jsx` sigue siendo el del minimercado y el bar y **no se toca**:
son dos módulos distintos porque no comparten una sola métrica. Uno mira
margen por producto; el otro, horas. Misma decisión que Finanzas: una
clave nueva en el menú del rubro antes que un `if` adentro de una
pantalla compartida.

Tres cosas que conviene no romper:

**Un abono no es un turno.** Un pack es plata que entró hoy por horas que
se van a dar en ocho semanas. Mezclarlos hace que un mes de muchas
renovaciones parezca un mes de mucha actividad, y el siguiente un
derrumbe. Por eso el corte entre abonos y turnos está arriba del gráfico
y no escondido.

**Hay dos ocupaciones y las dos son ciertas.** Una sala de mat para ocho
con tres personas adentro está usada el 100% del tiempo y al 37% de su
capacidad. La primera dice si hay lugar para abrir otra clase; la
segunda, si esa clase conviene que exista. `informe_ocupacion` devuelve
las dos y la pantalla las muestra separadas.

**Una clase ocupa una vez.** Seis inscripciones a la misma clase de
reformer no son seis horas de sala: son una. Es el mismo criterio con el
que `liquidar` cuenta las horas del equipo, y tiene que seguir siendo el
mismo: si dejan de coincidir, la ocupación de una profesora y lo que se
le paga cuentan cosas distintas del mismo día de trabajo.

Las horas que ofrece una **sala** salen de cuándo abre el local —de la
primera a la última hora en que hay alguien trabajando ese día—, porque
nadie carga el horario de una sala: se carga el de la gente. Si algún día
se cargan horarios propios de un espacio, mandan esos.

**Este módulo usa la fecha real**, no el `HOY` congelado del prototipo.

## Lo que ya funciona y no hay que rehacer

Comandas de salón y mostrador, centro de pedidos con estados reales y
tiempo real, cocina agrupada por pedido, despacho incremental, descuento
por porcentaje o importe, comensales, pre cuenta, plano de mesas
configurable, juntar y separar mesas, cobro con caja obligatoria, venta
sin internet con cola y reintento, numeración correlativa por punto de
venta, bitácora automática.

## Datos para desarrollar

`supabase/seed/pedidos.sql` siembra un mediodía de pedidos en el Bar
Rivadavia para poder mirar el tablero lleno. Queda marcado y se borra con
`delete from operaciones where campos_extra->>'demo' = 'pedidos'`.

`supabase/seed/almha_historia.sql` le da a Almha cuatro meses enteros de
operación —clientes, turnos, clases, abonos, ventas, caja y
liquidaciones— armados sobre el catálogo que ya tiene cargado. Se niega a
correr si el comercio no está marcado `demo` en su configuración, que es
la regla del proyecto puesta donde sirve y no en un comentario. El azar
va sembrado con `setseed`, así que dos corridas dan lo mismo y una
captura de pantalla sigue valiendo.

Arranca el 1 de un mes y no "hace 120 días": con la ventana corrida, el
primer mes queda cortado por la mitad y el informe mensual muestra una
caída que nunca pasó.

`supabase/seed/salon.sql` dibuja el local del Bar Rivadavia —paredes,
barra, cocina, terraza y dieciocho mesas— para que el mapa se vea como un
local. Todo en un solo sistema de coordenadas: los sectores son zonas del
mismo plano, no planos separados, porque con un origen por sector "Todo
el piso" los superpone. Las mesas se acomodan, no se recrean: borrar una
deja en null el `recurso_id` de sus ventas y se pierde en qué mesa se
vendió cada cosa.

`scripts/fotos-carta.mjs` le pone una foto a cada plato, bajándolas de
Wikimedia Commons con su atribución. Las elige a mano: la búsqueda
automática devuelve hamburguesas mordidas y ensaladas que son fettuccine.
`--ver` deja las candidatas en una carpeta para mirarlas antes de aplicar,
y `--borrar` las saca.

Cuando las imágenes las trae el comercio —que es como tiene que ser— van
a `fotos/` con el nombre del producto y las carga
`scripts/fotos-propias.mjs`. Esa carpeta no va al repositorio.

**Un recorte sin fondo se guarda como PNG y una foto como JPEG**, y de eso
depende cómo se ve: el recorte flota sobre la tarjeta —como en la
maqueta— y la foto se lleva hasta el borde, porque tiene fondo propio.
Convertir un PNG con transparencia a JPEG le pone fondo negro, así que al
subir una foto el navegador mira si tiene alfa antes de elegir formato.
