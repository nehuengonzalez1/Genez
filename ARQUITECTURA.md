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
| `src/cliente/` | La otra aplicación: la del cliente del comercio. Entrada aparte (`cliente.html`). Ver "La app del cliente". |
| `api/` | Lo que necesita una credencial de servidor: el modelo, Mercado Pago, el alta de accesos, el manifest y el ícono de la PWA. |
| `middleware.js` | Lo único que corre antes que el resto: decide, por el host, cuál de las dos aplicaciones se sirve. |
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
node scripts/probar-dominio.mjs    # qué aplicación sirve cada host
node scripts/probar-arca.mjs       # factura electrónica: candado, permisos y homologación
node scripts/probar-cuenta-corriente.mjs  # fiado: cobrar, anular, ajustar, límite y permisos por rol
node scripts/probar-codigos.mjs    # códigos de barras propios: no pisan, no se repiten
node scripts/probar-devoluciones.mjs  # devoluciones y notas de crédito/débito, y contra ARCA de pruebas
node scripts/probar-iva.mjs        # el IVA por alícuota de un comprobante: cuentas a mano y diez mil al azar (sin base)
node scripts/probar-factura-ab.mjs # el pedido de la A y la B a ARCA, con una base y un ARCA de mentira (sin base, sin red)
node scripts/probar-arca-ab.mjs    # la A, la B y una nota A contra el ARCA de pruebas (punto de venta 6; ver el archivo)
node scripts/probar-caea.mjs       # cuándo una factura sale con CAEA y con qué número, informar y cerrar la quincena (sin base, sin red)
node scripts/probar-arca-caea.mjs  # el CAEA contra el ARCA de pruebas: pedirlo, emitir con ARCA "caído", informarlo
node scripts/probar-planillas.mjs  # las planillas para el contador: columnas, notas restando, totales (sin base)
node scripts/probar-cajas.mjs      # varias cajas: una sesión abierta por caja, la app de antes, la caja de otro comercio
node scripts/probar-lista-proveedor.mjs  # leer la lista de un proveedor: títulos, columnas, importes, cruce por EAN (sin base)
node scripts/probar-promociones.mjs      # la cuenta de las promos: 2x1, segunda, pack, porcentaje, orden, cuándo valen (sin base)
node scripts/probar-promociones-base.mjs # la tabla de promos: lo que acepta, lo que no, y quién puede cargarlas
node scripts/probar-carta-qr.mjs   # la carta QR como la página pública: leer, pedir, y todo lo que no se tiene que poder
node scripts/probar-happy-hour.mjs # el horario de las promos, la hora de cada renglón y la cuenta de la mesa con la promo
node scripts/probar-promos-comanda.mjs  # qué renglones de una mesa recalcula la promo y cuáles no toca (sin base)
node scripts/probar-catalogo-base.mjs   # las reglas del nombre y el rubro, la consulta que no traba el alta y los permisos de la tabla
node scripts/probar-qr-dinamico.mjs    # api/mp/qr.js contra un Mercado Pago de mentira (orden, estados, cancelar pagada) y 0107
node scripts/probar-multi-sucursal.mjs  # 0108: lo viejo completado, la sucursal que viaja sola, pasar mercadería, informes por sucursal y quién
node scripts/probar-conteo.mjs         # 0109: el conteo contra lo que hay ahora, lo que no entra, y sin sesión no se llama
node scripts/probar-indicadores.mjs    # 0110: comandas y devoluciones en la venta, stock_cargado, la planilla de stock y los indicadores
node scripts/probar-ordenes-de-compra.mjs  # 0111: la orden pendiente no mueve stock ni costo, se recibe o se cancela
node scripts/probar-puntos.mjs          # 0112: sumar, canjear, vencer por lotes, devolver (por registrar_devolucion) y las cuentas del mostrador
node scripts/probar-founder-seguridad.mjs  # 0113+: la frontera de Founder con seis perfiles, en todas las tablas interno_*
node scripts/probar-founder-crm.mjs      # 0114: la oportunidad que nace sola, etapas, seguimiento, series de tareas, teléfonos y duplicados, áreas
node scripts/probar-importar-prospectos.mjs  # sin base: columnas, filas con error o aviso, repetidos en la planilla y ya cargados
node scripts/probar-founder-clientes.mjs  # 0115: pasar a cliente, desde un comercio, implementación por módulos, tickets, Storage y áreas
node scripts/probar-founder-producto.mjs  # 0116: proyectos, versiones, roadmap, ticket a producto, documentos con búsqueda y versiones, áreas
node scripts/probar-markdown.mjs        # sin base: el markdown de los documentos no ejecuta nada y entiende lo que dice
node scripts/probar-founder-marketing.mjs  # 0117: el valor real de cada métrica (en días de Buenos Aires), objetivos, planes, contenidos, métricas y lo originado
node scripts/probar-corregir-medio.mjs  # corregir el medio de un cobro: las dos filas, y lo que no se deja
node scripts/probar-cambio-titular.mjs  # cambio de titular fiscal: emisor guardado, notas sobre facturas de otro CUIT, el pase
node scripts/probar-numeracion.mjs  # números de ticket por bloques: no se pisan entre cajas
node scripts/probar-caja-grande.mjs  # el cierre con todos los medios y la caja grande: saldos, permisos, solo de agregar
node scripts/probar-alicuotas.mjs  # la alícuota de IVA: las que acepta ARCA, y de dónde la toma cada renglón
node scripts/backup.mjs            # copia toda la base a C:\Users\<vos>\Genez-backups\ (solo lee)
```

`probar-dominio.mjs` es el único que no toca la base ni la red: le pasa un
host a `middleware.js` y mira qué contesta. Existe porque esa regla se
equivoca donde no se la puede mirar —contra un dominio que en desarrollo
no existe— y las dos formas de equivocarse duelen: de menos, el subdominio
de un comercio sirve la gestión; de más, cada vista previa de
`*.vercel.app` sirve la app del cliente y no queda dónde probar el
sistema.

`probar-rls.mjs` toma la identidad de un usuario con `set local role
authenticated`, así las políticas se aplican igual que desde el navegador.
Las demás corren como administrador y **saltean RLS**: sirven para la
lógica, no para los permisos. Esa diferencia ya dejó pasar un bug.

**Las pruebas corren contra la base de producción, con comercios
vendiendo.** Por eso cada una corre **adentro de una transacción que se
deshace**: nada de lo que escribe se confirma, la aplicación no lo ve
mientras corre, y si se corta a la mitad Postgres lo deshace solo. No hay
limpieza por patrón ni por fecha. Antes limpiaban al final, y eso rompió
datos reales: un barrido de "restos" borró una venta cobrada de Bar
Rivadavia, una caja de prueba que quedó abierta se hizo pasar por la de
Super 25, y borrar la bitácora "desde la hora de arranque" se llevaba las
acciones reales de un cajero en esos segundos.

Tres cosas a tener en cuenta al escribir una:
- **Un error esperado va en su `savepoint`**: adentro de la transacción,
  un error la invalida entera.
- **`now()` queda fijo** durante toda la transacción. Un orden no puede
  salir de la hora (el historial de pedidos se reconstruye con `anterior`).
- **Una mesa, siempre una libre**: en una ocupada, `abrir_comanda` devuelve
  la cuenta real que está ahí.

La excepción es lo que habla con ARCA (`probar-arca.mjs` parte 3,
`probar-devoluciones.mjs` al final): la función del servidor lee por otra
conexión y no ve lo que no está confirmado. Ahí se crea un comercio
temporal y se borra por su id al terminar, pase lo que pase.

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
| `crm_segmentos(uuid)` | A quién conviene escribirle y por qué. Ver abajo. |
| `comunicaciones_pendientes(...)` | Los turnos que vienen y todavía no tienen su aviso. |
| `permisos_de(uuid)` / `permiso(text)` | Qué puede hacer alguien. Lo que consultan las políticas. Ver abajo. |
| `sembrar_canales(uuid)` | Los canales con los que arranca un comercio. |
| `enviar_a_cocina(uuid)` | Despacha solo lo que falta despachar. |
| `aplicar_descuento(...)` | Por porcentaje o por importe, hasta 99,99 %. |
| `tope_descuento(numeric)` | Lo máximo que se puede descontar: 99,99 % en pesos enteros, siempre por debajo del subtotal. Lo usa también un disparador que rechaza toda venta confirmada por encima (0088). |
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

## La carta QR

Migración 0104, `src/cliente/CartaMesa.jsx` (la página),
`src/datos/cartaQr.js`, y en el salón el botón QR (`QrMesas.jsx`).
Cada mesa tiene un QR que abre `/cliente?mesa=<código>`: la carta en el
teléfono, sin cuenta ni descarga, y un pedido que cae en la comanda de
esa mesa.

**Lo que pide la mesa entra en borrador y lo confirma el mozo.** La
página es pública: cualquiera con una foto del QR puede mandar pedidos.
Borrador ya significaba "anotado, todavía no salió" (0018), así que el
mozo lo confirma con el mismo "A cocina" de siempre o lo anula, y un
pedido falso nunca se cocina. La comanda lo marca ("Pidió la mesa por
QR · confirmalo") y el plano del salón pone un "QR n" titilando en la
mesa (`salon_vista.pedidos_qr`).

**Ninguna tabla se abre a quien escanea.** Todo pasa por dos funciones
con security definer: `carta_de_la_mesa` (sin costos) y
`pedir_desde_la_mesa`. El precio lo pone la base, nunca el teléfono.
Topes: 20 renglones por pedido, 20 unidades por renglón y 6 pedidos por
mesa cada 10 minutos (`pedidos_qr`). Si una foto del QR circula, se
renueva el código de esa mesa (`renovar_qr`, pide configurar) y el
impreso deja de servir. Un producto se saca de la carta con
`campos_extra.fuera_de_carta`.

Pagar desde la mesa todavía no: va con Mercado Pago, cuando el comercio
conecte su cuenta.

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

## El CRM

`crm_segmentos` devuelve cinco listas de gente a la que conviene
escribirle, y cada una existe porque tiene una acción distinta detrás: el
que dejó de venir, el que vino una sola vez, el que se queda sin abono,
el que se le venció y no renovó, y el que reserva y no aparece.

**Los segmentos se derivan, no se guardan.** Misma regla que el stock y
que el estado de una mesa. Una columna `es_cliente_dormido` se corrompe
el día que la persona vuelve, y el criterio cambia —hoy son 45 días,
mañana el comercio decide otra cosa— con lo que habría que recalcular el
pasado entero.

**`contactos` es lo que hace que la lista se vacíe.** Sin ella el lunes
aparecen los mismos veinte nombres que el viernes. Escribirle a alguien
lo saca del segmento por tres semanas, y **solo de ese segmento**: que se
le haya avisado que su abono vence no significa que no haya que decirle,
dos meses después, que hace rato no viene.

**Nada se manda solo.** Se abre WhatsApp con el mensaje ya escrito y la
persona aprieta enviar. El texto es editable antes y lo que se guarda es
lo que se mandó, no lo que decía la plantilla. Las plantillas guardadas y
el envío en tanda son de Comunicaciones.

**"No molestar" va en `clientes.campos_extra`**, que es exactamente para
esto, y se filtra una sola vez arriba de todos los segmentos para que no
haya forma de agregar uno que se lo saltee.

`telWhatsapp` en `src/utils/helpers.js` arma el número: `wa.me` necesita
código de país y el `9` de celular, y los teléfonos se cargan como los
dicta la gente. Sin eso el link abre un chat con nadie, que es lo que
venía pasando en la agenda y en la ficha.

## Comunicaciones

CRM contesta a quién conviene escribirle esta semana; esto contesta a
quién hay que avisarle algo ahora. Son dos módulos porque son dos
trabajos: recepción manda los recordatorios de mañana cada tarde, y el
dueño mira lo de CRM una vez por semana. Meterlos en la misma pantalla
sepulta la tarea diaria debajo de la semanal.

**Una sola tabla de mensajes**, `contactos`, para los dos. Dos registros
de mensajes enviados es la forma más rápida de no saber nunca si a
alguien ya se le escribió.

**Se avisa por turno, no por persona.** Por eso `contactos` tiene
`reserva_id`. Sin él, saber si a alguien ya se le recordó su turno del
martes sería mirar si se le escribió "hace poco", y con dos turnos en la
misma semana eso falla siempre. Una clase manda un mensaje por anotado; la
clase en sí no se avisa, no tiene a quién.

**Un recordatorio no es marketing.** `no contactar` frena todo lo de CRM y
no frena esto: quien pidió que no le manden promociones no pidió que no le
avisen que mañana tiene turno a las nueve.

**Las plantillas guardan lo que se cambió, no todo.** Los textos de
fábrica están en `src/datos/comunicaciones.js`; la tabla `plantillas`
guarda solo los que el comercio reescribió. Un comercio nuevo funciona el
primer día sin semilla, "volver al original" es borrar una fila, y si
mañana ese texto mejora, el que nunca lo tocó se lleva la mejora.

**Un hueco que no existe se deja escrito.** `{profe}` en vez de
`{profesional}` aparece tal cual en la vista previa y se corrige solo;
borrarlo en silencio manda un mensaje mocho sin ninguna pista de por qué.

## Los permisos

Los roles salían de una constante de JavaScript. Ahora salen de la base,
y no por prolijidad: **las políticas de RLS los tienen que poder leer**.
Un permiso que solo existe en el navegador no protege nada.

`roles_base` son los cuatro de fábrica y es dato de plataforma, como
`rubros`. `roles` guarda **solo lo que cada comercio cambió** y se fusiona
encima. Volver al original es borrar la fila, así una corrección futura de
un valor de fábrica llega sola al que nunca lo tocó.

**Ninguna política vuelve a nombrar un rol.** `bitacora_leer` y
`empresas_configurar` decían `rol in ('dueno', 'encargado')` y ahora
preguntan por `permiso('verBitacora')` y `permiso('configurar')`. Los
valores de fábrica dan la misma respuesta para la misma gente, así que
nada cambió hasta que alguien edite; lo cubre `probar-rls.mjs`.

`permisos_de(perfil)` toma el perfil por parámetro en vez de mirar solo
`auth.uid()`. Es lo que permite probarla —una función que solo se puede
ejecutar "siendo" cada rol no se prueba, se cruza los dedos— y lo que la
pantalla necesita para dibujar la grilla entera. Es `security definer`
porque lee `perfiles` y `roles`, y por eso se limita a sí mismo o a
perfiles que el que pregunta ya puede ver.

**Dos de los ocho permisos los verifica la base y seis son de pantalla.**
Está dicho así en la interfaz, con un candado al lado de los dos pesados:
quien configura tiene que saber si está apagando un botón o cerrando una
puerta.

**No se puede uno dejar afuera.** Un disparador impide sacarle
`configurar` al rol propio. Está en la base y no en la pantalla porque una
validación de pantalla la saltea cualquier otro camino.

**Y cambiar un permiso queda en la bitácora**, con qué había antes y qué
quedó. Un módulo de permisos sin rastro sería el único que no se puede
auditar.

`bitacora` existía desde 0007 y nunca había tenido pantalla: se escribía
y no la leía nadie. La pestaña de Auditoría es esa lectura.

## Los accesos

Migración 0048. Es la otra mitad de Permisos: ahí se define qué puede un
rol, acá quién entra y con cuál. Hasta 0048 los usuarios se creaban a mano
con SQL, y por eso cada comercio tenía uno solo.

**Lo primero que hizo 0048 fue tapar un agujero, no agregar una función.**
La política de `perfiles` era `for all using (puede_ver(empresa_id))`, y
`puede_ver` da verdadero para cualquier miembro del comercio: un cajero
podía correr un update sobre su propia fila y ponerse `rol = 'dueno'`. El
comentario de 0002 lo decía —"alta y baja de accesos las hace la plataforma
o el dueño, y eso se valida en la aplicación"—, que es exactamente lo que
la regla 1 prohíbe. No se notaba porque no había un segundo usuario. La
primera prueba de la sección "Accesos" de `probar-rls.mjs` es ese ataque.

**Tres capas de permisos, no dos:** `roles_base` (fábrica) → `roles` (lo
que el comercio cambió) → `perfiles.permisos` (la excepción de una
persona). La tercera se guarda como diferencia, igual que la segunda y por
la misma razón: el día que se corrija un valor de fábrica, quien tenga una
excepción sobre otra bandera se lleva igual la corrección. Existe porque el
caso obliga a inventar roles: al cajero de la tarde se le da cerrar caja y
a los otros tres no.

**La política no alcanza sola.** Decide sobre la fila; hay tres cosas que
son sobre el cambio y van en `cuidar_el_acceso()`: nadie se toca a sí mismo
el rol, los permisos ni el alta —el accidente de 0045 §6 por la otra
puerta—; nadie se marca `es_plataforma` desde adentro de un comercio, que
es lo más grave porque `puede_ver` le abriría todos los comercios y la fila
sigue siendo de su empresa; y `empresa_id` no se muda.

**`permiso()` ahora también pide `activo`.** Una persona dada de baja no
tiene permisos, sin importar su rol ni sus excepciones. Se resuelve en la
función por la que pasan todas las políticas y no en cada una.

**Crear el usuario en Auth es lo único que pasa por el servidor.**
`api/usuarios.js`, porque necesita la `service_role` y esa no puede estar
en el navegador. La función no le cree nada al cliente: el `empresa_id`
sale de quién mandó el token y `es_plataforma` es false y punto. El permiso
lo pregunta con la identidad del que llama —abre un segundo cliente con su
token y ejecuta `permiso('configurar')`— para que la respuesta salga de las
mismas tres capas y no de una copia de la regla escrita en JavaScript.

Dos caminos de alta, y ninguno es el correcto: **invitación** por correo
(la persona se pone su clave, nadie más la conoce; necesita SMTP propio,
el de fábrica de Supabase manda dos o tres por hora) y **clave
provisional** (el dueño se la dicta, sirve para un cajero sin correo).
La segunda marca `debe_cambiar_clave` y `Genezapp` no muestra nada del
sistema hasta que la cambie.

En desarrollo `api/` lo sirve un middleware de `vite.config.js`, que antes
no existía: `/api/mp/pagos` daba 404 y por eso Ajustes tiene el botón de
simular un cobro. Para el asistente y Mercado Pago alcanzaba; para dar de
alta un usuario no, porque es la funcionalidad y no un extra.

**Dar accesos es su propio permiso** (0049). 0048 lo había colgado de
`configurar` siguiendo el criterio de 0045 §4, y era el criterio mal
aplicado: cambiar la ficha del negocio y habilitar a una persona a entrar
no son lo mismo. `darAccesos` arranca verdadero solo en el dueño; un
comercio que quiera dárselo a su encargado lo prende.

**Y nadie otorga lo que no tiene**, que es lo que hace que eso signifique
algo. El encargado conserva `configurar`, o sea que edita roles, y podía
editar **el suyo**: `no_dejarse_afuera` solo miraba que nadie se sacara
`configurar` y nunca miró lo que alguien se agrega. Verificado contra la
base antes de escribir la migración: un encargado de fábrica pasaba de
`ajustes: false` a `true` con un insert. Con eso vivo, apagarle
`darAccesos` era decorativo. La regla vale para las dos capas editables
—`roles` y `perfiles.permisos`— porque si valiera para una, la otra es el
camino de al lado. Revocar no se mira: sacar no escala.

Lo que 0049 **no** cierra, dicho para que no sorprenda: el encargado puede
editar el rol del dueño y sacarle `darAccesos`. No se agranda, pero
molesta. Se deja así: el dueño lo vuelve a prender, o le saca `configurar`
al encargado, que es la decisión que corresponde tomar en pantalla.

**El arranque de un comercio** lo hace la plataforma. Para dar un acceso
hay que estar adentro, y un comercio recién creado no tiene a nadie
adentro: ese primer acceso se sembraba por SQL. Es el único caso donde
`api/usuarios.js` acepta un `empresaId` por parámetro, y solo si quien
llama es plataforma. Desde adentro de un comercio nunca: si viniera del
cliente, cualquiera daría de alta un dueño en el comercio de otro.

El panel de plataforma tenía un alta heredada del prototipo que guardaba
en el estado de React con un id inventado y no tocaba la base. Ahora hace
el alta de verdad, y la lista quedó de solo lectura: editar el rol o dar
de baja se hace en el Permisos del comercio, que es donde se ve contra qué
se está cambiando.

## La app del cliente

El segundo lado del producto: lo que ve quien saca el turno y no quien lo
anota. Vive en `src/cliente/`, con su capa de datos en
`src/datos/cliente.js` y su entrada propia, `cliente.html`. El diseño
—incluido lo que quedó abierto— está en
`docs/modelo-identidad-del-cliente.md`, y las migraciones van de 0050 en
adelante.

Es **un motor, no una app por comercio**: la marca, los módulos y los
datos salen de la base. No hay una versión de Almha, hay una fila de
Almha.

**Dos entradas y dos bundles.** El teléfono de alguien que quiere ver a
qué hora tiene turno no tiene por qué bajarse el punto de venta, el salón
y los gráficos. Mismo repositorio igual, para que los colores, el cliente
de Supabase y la sesión sean los mismos y no se desincronicen.

**El cliente no lee tablas, lee funciones.** `mis_fichas`, `mis_turnos`,
`mis_abonos`, `catalogo_de`, `huecos_del_cliente`. Una política de RLS
decide sobre la fila y deja pasar todas sus columnas —el costo de un
servicio, las notas internas de recepción—, y peor: cada columna que se
agregue mañana quedaría expuesta sola. Un `.from("reservas")` en
`src/datos/cliente.js` está mal aunque funcione. La explicación larga está
en el encabezado de ese archivo.

**Un cliente nunca tiene una fila en `perfiles`.** `perfiles` significa
"trabaja en este comercio", y de eso cuelga `puede_ver`. No es un permiso
mal dado: es la categoría equivocada.

**Y una función interna no se cierra con `revoke ... from public`.** Esta
base tiene `alter default privileges ... grant execute on functions to
anon, authenticated, service_role`, que lo pone Supabase: toda función
nueva nace con esos tres roles adentro, y sacarle `public` no les toca
nada. Verificado contra `pg_proc.proacl` cuando la prueba de 0067 se puso
en rojo. Vale para cualquier función que no tenga que poder llamarse
desde el navegador.

### El turno, del lado del cliente

Tres verbos y ninguno escribe en `reservas` directo:
`reservar_como_cliente`, `cancelar_como_cliente` y
`reprogramar_como_cliente`. Las reglas del comercio —anticipación,
historial, aviso del mismo día, hasta cuándo se cancela— salen de
`reglas_de`, que es fábrica del rubro con lo que el comercio cambió
encima.

**Mover no es cancelar y volver a sacar.** Un turno individual mueve su
propia fila con `mover_turno`, que es la misma que usa el mostrador: así
conserva su id, y con él el recordatorio ya enviado —`contactos.reserva_id`,
de Comunicaciones— y su enlace con el abono. Solo una inscripción a una
clase se cambia por otra, porque no hay fila que correr de hora y el cupo
vive adentro de `inscribir`.

**Mover y cancelar comparten la ventana y no la respuesta.** Las dos se
pueden hasta `cancelacionHoras` antes. Pasada esa hora cancelar sigue
estando y cuesta; mover ya no se puede. Cobrarlo sería descontar la clase
*y además* dar otro lugar, y dejarlo gratis sería la puerta de al lado
para esquivar el costo de cancelar tarde.

**Cada horario dice si entra en el plan de quien pregunta**, y lo dice
`horarios_libres` antes de que elija. El caso lo destapó una captura: con
el abono venciéndole el 31, a la clienta se le ofrecían cuatro horarios de
septiembre que no podía tomar y se enteraba al confirmar. La marca
significa distinto según de dónde se venga —reservando se toma igual y se
paga aparte; moviendo no se puede, porque el plan del turno es el que es—
y por eso `horarios_libres` recibe el turno que se está moviendo.

**La marca y el rechazo salen de la misma función.** `abono_cubre`
envuelve a `revisar_abono` y contesta si levantó. No se copia su lógica:
`revisar_abono` tiene que seguir siendo la única respuesta porque además
dice *cuál* de las tres reglas falló, que es el mensaje que lee la
persona. Un "entra en tu plan" calculado aparte se desincroniza, y el día
que pase la pantalla miente con cara de saber.

### El host decide cuál de las dos aplicaciones se sirve

`almha.genez.com.ar/` es la app del cliente y `genez.com.ar/` el sistema
de gestión. Son dos HTML en el mismo despliegue y lo único que los separa
es el host.

**Eso no se puede resolver con un rewrite de `vercel.json`, y ahí se fue
un rato.** Había una regla con la condición de host y no tomaba nunca, ni
con lookahead ni con el nombre exacto: el problema no era la condición.
Los rewrites se evalúan **después** del sistema de archivos, y `/`
encuentra `index.html` publicado antes de que la regla se mire. La prueba
está en el mismo despliegue: el rewrite de `/cliente` sí funciona, y la
única diferencia es que `/cliente` no existe como archivo.

Lo hace `middleware.js`, que es lo único que corre antes. Y no dice
"almha": si dijera, cada comercio nuevo sería un despliegue. Alcanza con
saber que el host es un subdominio del dominio de la plataforma —de ahí
la lista de reservados y el corte por `genez.com.ar`, que es lo que deja
afuera a los `*.vercel.app` de cada vista previa—. Cuál comercio es lo
resuelve la app después, con `marca_de`.

### La PWA es del comercio

`api/manifest.js` arma el manifest por comercio: en la pantalla de inicio
del teléfono tiene que decir Almha y no Genez. Sale de `marca_de`, que es
pública por diseño —un manifest lo lee el navegador antes de que nadie
inicie sesión— y si algo falla se sirve el genérico: una app instalable
con nombre feo es mejor que una que no se puede instalar.

`api/icono.js` dibuja una inicial sobre el naranja mientras el comercio no
suba su ícono cuadrado. Es un lugar ocupado y se nota que lo es:
inventarle un logo quedaría en la pantalla de inicio de sus clientas como
si fuera la marca del local.

`public/sw.js` cachea **el envase y nunca el contenido**. Nada de Supabase
ni de `/api`: un turno cancelado hace una hora que se muestra como vigente
es peor que no mostrar nada, y son datos de una persona en un caché que
sobrevive al cierre de sesión.

## La factura electrónica

Migraciones 0082 y 0083, `api/arca/` y Caja → Facturas. Hasta 0082 el
cobro fabricaba el CAE con una cuenta y lo imprimía con un QR dibujado;
eso se sacó. "Factura" aparece en el cobro solo si el comercio tiene fila
en `arca_conexiones` y le corresponde la C.

**Una venta es factura o ticket desde el mostrador, y no cambia.** Viaja
marcada en `operaciones.comprobante.fiscal`, y el servidor factura solo
las marcadas. Sin internet o con ARCA caído la venta se cobra igual y la
factura queda esperando; **no se imprime nada hasta tener el CAE**. Así el
cliente se lleva un solo papel de cada venta, y es la factura.

**Los CAE se piden todos y en orden**, de la venta más vieja a la más
nueva, y se corta en el primer error. No hay forma de pedir uno suelto:
pasaría adelante de los que esperan y la numeración dejaría de seguir el
orden de las ventas. Se piden solos después de cada factura, cuando vuelve
internet y al entrar; y con el botón de Caja → Facturas. "Esperando CAE"
no se guarda: `facturas_vista` es una venta marcada sin comprobante
autorizado.

**El CAE lo escribe solo el servidor.** `comprobantes` no tiene política
de escritura para `authenticated`: la escribe `api/arca/facturar.js` con
la service_role y la respuesta de ARCA en la mano. `arca_conexiones` —con
qué CUIT y qué punto de venta factura cada comercio— la escribe solo la
plataforma, porque ese CUIT es la identidad fiscal de alguien.

**El navegador manda el id de la venta y nada más.** El total sale de
`operaciones`, la condición del comercio de `empresas.config.fiscal` y la
del comprador de su ficha.

**La factura va aparte de la venta** porque la venta es append-only y el
CAE puede llegar mucho después, si se cortó internet. Una venta tiene a lo
sumo una factura no rechazada; anularla será una nota de crédito.

**El número lo pone ARCA, y el candado es un índice.** Se pregunta el
último autorizado y se pide el siguiente; dos cajas a la vez oirían el
mismo. `comprobantes_un_pendiente_por_serie` deja un solo pendiente por
serie: el segundo choca y espera. Si el servidor se cae esperando a ARCA,
la fila pendiente queda y el próximo intento le pregunta a ARCA qué pasó
con ese número antes de pedir otro.

### Producción: el certificado de cada comercio

Migración 0084, `api/arca/conexion.js` y Ajustes → Factura electrónica.
Cada comercio le habla a ARCA **directo** (`_directo.js`: WSAA y WSFEv1
por SOAP) con su propio certificado. Afip SDK queda solo para el ambiente
de pruebas con su CUIT compartido: en producción resuelve la
autenticación en sus servidores y para eso les manda la clave privada del
comercio, que es su firma fiscal.

**La clave la genera Genez y no sale del servidor.** El comercio se lleva
el pedido (CSR), lo sube a ARCA con su Clave Fiscal y trae el
certificado. `arca_credenciales` no tiene políticas y se le sacaron los
permisos a `anon` y `authenticated`; además la clave y el pase de WSAA van
cifrados con `ARCA_CLAVE_MAESTRA` (AES-256-GCM, `_cifrado.js`). Esa llave
tiene que ser la misma en el `.env` y en Vercel: la base es una sola.

**El CUIT no se tipea, sale del certificado.** Por eso el comercio se
puede conectar solo, con `configurar`: ARCA emite un certificado para un
CUIT solo a quien tiene esa Clave Fiscal, y el certificado solo sirve con
la clave que generó Genez. Ya en producción, renovar no puede cambiar de
CUIT: eso es un cambio de titular (abajo).

**El pedido nuevo vive al lado del certificado en uso** (`pedido_*`): se
renueva sin dejar de facturar, y el nuevo reemplaza al viejo recién
cuando llega.

**El pase de WSAA se guarda y se comparte.** Dura 12 horas y ARCA no da
otro mientras haya uno vigente; si cada función de Vercel pidiera el suyo,
la segunda recibiría `coe.alreadyAuthenticated`.

**Probar conexión no emite nada**: servidores, certificado, autorización
(WSAA), punto de venta de web service y numeración, cortando en el primero
que falla y diciendo qué hacer. Activar exige una prueba bien de las
últimas 24 horas con ese punto de venta, el mismo CUIT en los datos
fiscales —es el que va impreso— y ninguna factura de prueba esperando
CAE, que si no saldría de verdad.

**El TLS de ARCA**: el WSFE de producción negocia una clave DH que el
OpenSSL de Node rechaza ("dh key too small"). El agente de `_directo.js`
baja el nivel solo para hablar con ARCA.

**La alícuota de cada producto (0097)** es el primer paso de la A y la
B. Son dos columnas, `iva` y `iva_condicion` (gravado, exento, no
gravado), porque ARCA informa en campos distintos lo gravado al 0%, lo
exento y lo no gravado; en pantalla es un solo selector (`ALICUOTAS` en
`helpers.js`). La base solo acepta las alícuotas de ARCA (0, 2,5, 5,
10,5, 21, 27). **El renglón vendido la toma de la base, no del
navegador**: el disparador `renglon_con_su_iva` la copia del producto, o
del renglón original en una devolución, para que la nota de crédito
cierre contra la factura aunque el producto haya cambiado después. Se
corrigen de a muchos desde Productos → Editar en tabla, filtrando por
rubro.

**El IVA por alícuota** lo calcula `desglosarIva` (`src/utils/iva.js`),
una función pura sin imports para que la pueda cargar el servidor. Los
precios ya traen el IVA: se saca de adentro. El descuento y el recargo
de la operación se reparten en proporción, con el mismo criterio que la
devolución (total ÷ subtotal), para que una nota calcule igual que su
factura; está pendiente que lo confirme un contador. Todo en centavos
enteros y con reparto por mayor resto, porque ARCA rechaza un total que
no sea exactamente la suma de sus partes. `importesParaArca` lo pasa a
los campos de WSFEv1 según la letra.

**La A y la B (0098).** `_arca.js` lee los renglones de la venta, los
pasa por `desglosarIva` y manda el IVA por alícuota en el pedido; el
comprobante guarda el desglose entero en `detalle_iva`, que es lo que
imprime el papel y lo que va a leer el Libro IVA. La C no cambió: todo
neto, sin `Iva`, `detalle_iva` en null. Las notas A y B salen por el
mismo camino, con la letra y el comprador de su factura.

**La A sin CUIT no sale, y se frena antes de cobrar.** ARCA la rechaza,
pero para entonces la venta ya estaría cobrada y su factura trabaría la
fila de CAE, que corta en el primer error. El cobro no deja confirmarla;
el servidor lo vuelve a mirar antes de reservar número.

Un responsable inscripto se activa igual que un monotributista, y
"Probar conexión" mira la numeración de la A y la B en vez de la C.

**El papel imprime el IVA que se informó, no lo recalcula.** Sale de
`detalle_iva` (también por `facturas_vista`, para reimprimir): si mañana
cambia la alícuota de un producto, una factura reimpresa dice lo mismo
que tiene ARCA. La A va con centavos: cada renglón sin IVA y con su
alícuota —(21%), (EX), (NG)—, el subtotal sin IVA, el descuento o
recargo sin IVA (lo que falta para llegar al neto informado, así cierra
al centavo) y el neto y el IVA de cada alícuota. Si a algún renglón le
falta la alícuota (uno suelto, un papel viejo), los renglones van con
IVA y el pie igual se discrimina. La B va como un ticket, más "IVA
contenido" (Ley 27.743); "otros impuestos nacionales indirectos" no se
imprime porque Genez no los conoce, y está pendiente de contador. La C
no cambió.

**La letra sale de una sola regla** (`src/utils/fiscal.js`), que usan la
pantalla y el servidor; antes estaba copiada y las dos copias le hacían B a
un monotributista. Un inscripto emite A (o M) a otro inscripto **y a un
monotributista** (RG 5003, con la leyenda de la Ley 27.618 en el papel), y
B a consumidor final y exento. La clase la asigna ARCA y se carga en
Ajustes → datos fiscales (`claseInscripto`: A, A con leyenda "Operación
sujeta a retención" o M; RG 1575 y 5716/2025): con M se piden los tipos
51 a 53 (0099). Desde $10.000.000 hay que identificar a quien compra, en
cualquier letra (RG 5700/2025): el cobro lo frena antes de cobrar y el
servidor antes de reservar número. La B imprime "IVA Contenido" y "Otros
Impuestos Nacionales Indirectos" (RG 5614), la segunda en cero hasta que
Genez conozca los impuestos internos. El análisis normativo está en el doc
"Genez: consulta fiscal sobre facturas A y B" (27/09/2026).

Las notas de crédito y de débito C están desde 0089 (ver abajo).

### El CAEA: cuando ARCA no contesta

Migración 0100, `api/arca/_caea.js`, la tarea diaria `api/arca/caea.js`
y Ajustes → Factura electrónica. Desde el 01/08/2026 (RG 5782/2025,
corrida por la 5852/2026) es la primera opción de contingencia. Antes, con
ARCA caído la factura esperaba y no salía ningún papel.

**Se activa por comercio, cargando un punto de venta propio de tipo
CAEA** (`arca_conexiones.punto_venta_caea`), que el titular crea en ARCA.
Sin él, todo sigue como antes. En producción se verifica contra ARCA que
el punto sea de este CUIT, de tipo CAEA y **sin estrenar**: la numeración
del punto CAEA la lleva la base, sin preguntarle a ARCA, que cuando se usa
está caído. No sirve para la M (art. 3).

**Solo se pasa al CAEA si ARCA no contestó antes de pedirle nada.** La
primera pregunta al facturar es el último número, que no emite: si no
vuelve, esa venta seguro no tiene CAE y se emite con el CAEA de la
quincena, y el papel sale en el momento. Si ARCA contestó que no (un error
con código) o se cayó después de mandar el pedido del CAE, no: la venta
queda como siempre. Con CAEA se facturaría dos veces.

**Las obligaciones las cumple la tarea diaria** (cron de Vercel, 8 de la
mañana): tener el CAEA de la quincena y, desde 5 días antes, el de la
siguiente (con ARCA caído no se puede pedir); informar cada comprobante
emitido con CAEA (`FECAEARegInformativo`, en orden de número); y cerrar
las quincenas sin uso con "sin movimiento". Plazo: 8 días después de la
quincena. Lo informado vive en `caea_informes` y no en `comprobantes`,
porque lo autorizado no se toca. Lo que falla queda en
`arca_conexiones.caea_estado` y Ajustes lo muestra en rojo. La tarea
necesita `CRON_SECRET` en Vercel.

El papel dice CAEA en vez de CAE y el QR lleva `tipoCodAut` "A".

### Las planillas para el contador

Caja → Para el contador (`ParaElContador.jsx`), solo para quien ve costos.
Tres Excel de un mes: comprobantes emitidos (con CAE o CAEA y el IVA por
alícuota de `detalle_iva`; las notas de crédito restan; "CUIT emisor"
aparece si en el mes hubo dos titulares), ventas totales (por día, con
los tickets y lo cobrado por medio, más los últimos 12 meses) y compras
cargadas (avisando que no es un libro fiscal).

**No se arma el archivo del Libro IVA Digital, a propósito.** Desde
noviembre de 2025 lo reemplazó IVA Simple (RG 5705/2025), que ARCA
precarga con los comprobantes electrónicos: las facturas de Genez ya le
llegan solas. Lo que el contador necesita es controlarlas, y lo que ARCA
no ve: los tickets, que para un monotributista también son ingresos. Las
compras de Genez no sirven para lo fiscal (son remitos cargados: sin
letra, IVA ni percepciones); registrarlas bien es otro trabajo.

Las filas las arma `src/utils/planillasContador.js` (puro, se prueba sin
base); lo que se lee, `src/datos/contador.js`; bajar el Excel,
`src/utils/planilla.js`, que comparte con el catálogo de productos.

### El cambio de titular

Migración 0093 y la acción `certificado` con `cambiarTitular` en
`api/arca/conexion.js`. Un comercio que pasa a facturar con otro CUIT
(Super 25, septiembre de 2026).

**Lo hace la plataforma, y apaga la facturación.** El pedido del CUIT
nuevo se genera al lado del certificado en uso, como una renovación, y el
titular lo lleva a ARCA con su Clave Fiscal. Cargar ese certificado borra
la conexión: el cobro deja de ofrecer "Factura" hasta que se pruebe y se
active con el CUIT nuevo, y activar exige que los datos fiscales ya lo
digan. No puede haber nada esperando CAE: se cobró con el titular
anterior. El certificado viejo se descarta.

**Cada comprobante guarda su emisor** (`comprobantes.emisor`): razón
social, CUIT, IIBB, inicio, domicilio y condición con que se pidió el
CAE. El papel usa esos y no los Ajustes de hoy; si no, una factura
reimpresa después del cambio sale con el titular nuevo y el número del
viejo. Y `_arca.js` no factura si el CUIT de los datos fiscales no es el
de la conexión, que es lo que pasa a mitad de un cambio.

**Una factura del titular anterior no admite notas desde Genez.**
`nota_posible()` compara la factura con la conexión de hoy. La devolución
se hace igual —stock y plata— pero sin nota de crédito, y queda anotado
que la hace quien emitió la factura, desde ARCA; la nota de débito no se
deja. Si la nota entrara en la fila de CAE, ARCA la rechazaría y la fila,
que corta en el primer error, no autorizaría nada más. Lo mismo con una
factura de homologación cuando ya se factura de verdad. Sin conexión, en
pleno cambio, la devolución de una factura espera.

## Devoluciones, notas de crédito y notas de débito

Migración 0089, `registrar_devolucion` y `registrar_nota_debito` en la
base, y el detalle de un movimiento de Caja (`DetalleMovimiento.jsx`),
que es desde donde se hacen.

**Nada de la venta original se toca.** Una devolución es otra operación,
`tipo = 'devolucion'`, que apunta a la venta (`origen_id`) y a cada
renglón que vuelve (`origen_linea_id`). Así se sabe cuánto queda por
devolver, y la base no deja pasar de lo vendido. Reintegra lo cobrado por
esos renglones con el descuento o recargo de la venta repartido.

**Dónde va la plata.** Un reintegro sale como egreso de la caja abierta.
A cuenta corriente no sale plata: se registra un ajuste de descuento,
porque el saldo (0085) suma los pagos a cuenta de las operaciones del
cliente y un pago en una devolución lo habría subido en vez de bajarlo.

**La nota de crédito la pide el mismo camino que las facturas.** Si la
venta fue factura, la devolución queda marcada `fiscal` con `nota:
credito`, entra en `facturas_vista` y `facturarVenta` la manda como tipo
13 con `CbtesAsoc` apuntando a la factura, con su letra y su comprador.
La nota de débito es una venta de un renglón libre, `nota: debito`, sobre
una factura (tipo 12). ARCA las numera aparte de las facturas.

Las dos piden el permiso `anular`, la caja abierta, y que la factura
original ya tenga CAE. Las numera la base: DEV-… y ND-….

**Los informes restan las devoluciones (0090).** `ventas_diarias`,
`ventas_por_item`, el total del día (`resumenDelDia`), el informe de
servicios y el Inicio de servicios toman `tipo in ('venta', 'comanda',
'devolucion')` con la devolución en negativo, el día en que se hizo. No
cuenta como ticket ni como operación. Una consulta nueva que sume ventas
tiene que hacer lo mismo, o va a mostrar plata que se devolvió.

Lo que falta: devolver una parte de un producto por peso; hoy se devuelve
el renglón entero.

### Corregir el medio de pago

Migración 0092, `corregir_medio_pago` en la base, y "Corregir medio" en
cada pago del detalle de una venta en Caja. Es para el botón mal tocado:
se cobró en efectivo y quedó en débito.

**Se cambian dos filas juntas**: el pago (`pagos`, lo que leen los
informes) y su ingreso en la caja (`movimientos_caja`, lo que suma el
arqueo). El importe y el total no se tocan. Por eso no se deja con
recargo de ningún lado —cambiaría el total— ni hacia o desde cuenta
corriente, que es deuda y no plata en la caja: eso va por devolución o
por pago. Tampoco con la caja de esa venta cerrada, porque el arqueo ya
se contó con ese medio.

**Pide `anular`**, como las devoluciones, y queda en la bitácora
(`venta.medio_corregido`). No es un detalle: de efectivo a débito es
exactamente cómo se tapa un faltante del cajón.

## El cierre de caja y la caja grande

Migración 0095, `cerrar_caja` y las funciones de `caja_grande` en la
base, Caja → Caja del día / Caja grande.

**El cierre cuenta todos los medios.** El efectivo se cuenta y arranca
vacío —si arrancara en lo esperado, cuadraría sin que nadie contara—;
Mercado Pago y las tarjetas arrancan en lo esperado y se corrigen con lo
que dicen el resumen de Mercado Pago y el posnet. Se guarda lo declarado
de cada medio (`sesiones_caja.declarado`) y el fondo que queda en el
cajón (`fondo_siguiente`), que la próxima apertura propone. Lo esperado
no se guarda: sale de los movimientos, como siempre.

**Cerrar es una función, no una fila.** El cierre mueve plata a la caja
grande y tiene que pasar entero o no pasar: un disparador rechaza cualquier
cambio a `sesiones_caja` que venga del navegador —una pestaña vieja falla
y pide actualizar, en vez de "cerrar" sin cerrar—. Pide
`cerrarCaja`, que hasta 0095 solo apagaba un botón.

**La caja grande es la plata del negocio fuera del cajón**, en tres
cuentas: efectivo guardado, Mercado Pago y banco. Al cerrar, el efectivo
menos el fondo va al efectivo, Mercado Pago a la suya, y las tarjetas y
las transferencias al banco, con la comisión estimada de cada medio como
egreso. En el día se puede pasar efectivo del cajón (`pasar_a_caja_grande`:
egreso de la caja del día e ingreso de la grande, juntos). A mano: pagos,
retiros del dueño, aportes, pases entre cuentas y ajustes.

**Solo de agregar.** No se edita ni se borra: un error se corrige con un
ajuste, que se carga como el saldo real de la cuenta. Verla y moverla pide
`cajaGrande` (de fábrica dueño y encargado), verificado por la base en la
política y en cada función. Lo que entra desde el cierre o desde el cajón
no lo pide: lo hace quien tiene la caja del día.

## Promociones

Migración 0102, `src/utils/promociones.js` (la cuenta),
`src/datos/promociones.js` y Productos → Promociones. Cuatro clases:
NxM (2x1, 3x2), segunda unidad con descuento, porcentaje y pack (N por
$P), sobre productos sueltos y/o rubros enteros, con fechas y días de la
semana.

**La cuenta la hace el mostrador**, no la base: se cobra sin internet y
el ticket sale en el momento. Las promos se cargan con el resto y quedan
también en el navegador, para una caja que se recarga sin red.

**Reglas**, para que no haya sorpresas: no entran los renglones con
precio a mano, precio por cantidad o precio abierto (ya tienen su
descuento); cada unidad va en una sola promo, en el orden NxM, pack,
segunda, porcentaje; en un NxM o una segunda, lo gratis o lo rebajado es
lo más barato del grupo; lo que se vende por peso solo entra en el
porcentaje.

**Dónde queda**: el descuento baja el total de cada renglón y se suma a
su `descuento` (que ya leen el IVA de la factura y los informes), y qué
promo fue y cuánto, en `operaciones.campos_extra.promos`, que
`registrar_venta` ya guardaba (0010): no se tocó el cobro. El ticket
imprime "PROMO …" restando debajo de cada renglón (en la A no: ahí va en
el descuento del pie).

Cargarlas pide `cambiarPrecios`, en la base. No se borran: se apagan.

**Por medio de pago (0103)**: "10% con débito los miércoles" es una
clase más (`tipo = 'medio'`), sobre toda la compra. Se aplica al cobrar
(`descuentoPorMedio`): después de las promos de producto y del
descuento a mano, antes del recargo del medio, que se calcula sobre lo
que queda. Con varias para el mismo medio, la mayor. No aplica a un pago
combinado. Queda en el descuento de la venta (el IVA de la factura lo
reparte entre alícuotas), topeado a 99,99% (0088), y el ticket la
imprime aparte del descuento manual. La pantalla de pago la muestra al
lado de cada medio, antes de elegir.

**En la comanda y con horario (0105)**: una promo puede tener horario
("2x1 de 18 a 20", o cruzando la medianoche), y en una mesa se decide
con la hora en que se pidió cada renglón (`operacion_lineas.pedida_en`),
no con la del cobro: la pinta de las 19:50 conserva el 2x1 aunque la
mesa pague a las 21. Los renglones de antes no tienen hora y usan la de
apertura de la mesa. `aplicarPromosEnComanda` la recalcula cada vez
que la pantalla de la comanda la lee —todo cambio termina en una
lectura— y la guarda en el `descuento` y el `total` del renglón (con
el nombre en `campos_extra.promo`). La cuenta, el descuento de la mesa,
los pagos parciales y el cierre suman `total`, así que no se tocaron.
Solo toca renglones con promo o que la tenían: un descuento que no vino
de una promo queda como está. Lo que pidió una mesa por QR se recalcula
la próxima vez que alguien abre esa comanda. La precuenta muestra el
importe entero y la promo restando.

## Remarcar precios

Productos → Editar en tabla. Todo cambio masivo va al **borrador** y se
guarda después de mirarlo, con el mismo botón: el markup sobre el costo,
el IVA, el **remarcado por porcentaje** y la **lista de un proveedor**.

**Remarcar** sube o baja un porcentaje lo que está filtrado (rubro,
búsqueda, proveedor), sobre el precio general, una lista o el costo. Es
sobre el precio de hoy y no sobre el costo porque casi ningún comercio
tiene los costos cargados (Super 25, 29/09: 12 de 1.415). El redondeo
acompaña la dirección: subiendo, hacia arriba; bajando, hacia abajo.

**La lista de un proveedor** (`ListaProveedor.jsx`, la lectura en
`src/utils/listaProveedor.js`) acepta la planilla como la manda el
proveedor: busca la fila de títulos, adivina las columnas (se pueden
corregir), lee importes con coma o con punto y cruza por código de
barras. El importe puede ser costo (con IVA o sin, y opcionalmente el
precio con markup) o precio de venta. Lo que el catálogo no tiene se
lista y no se da de alta solo. Los cambios caen en el borrador con el
filtro "Sin guardar".

Al guardar precios aparece "Imprimir sus etiquetas", que abre las de
góndola con "cambiaron desde hoy": la góndola tiene que decir lo mismo
que la caja, y es el paso que se olvida.

## Varias cajas

Migración 0101, `src/datos/caja.js`, Ajustes → Cajas (`Cajas.jsx`) y
la pantalla de caja. Un comercio puede tener varias cajas abiertas a la
vez, una por mostrador, cada una con su sesión y su arqueo.

**La caja es de la computadora, no de quien entra.** Cada una elige una
vez cuál es y queda en su navegador (`cajaDeEsteEquipo`). Con una sola
caja activa no se pregunta nada. Con varias y ninguna elegida no se abre
ni se cobra sobre ninguna: con cualquier sesión que se mostrara, podría
ser la del otro mostrador.

**Una sesión abierta por caja**, con un índice
(`sesiones_caja_una_abierta_por_caja`). Antes la regla de "una por
comercio" la aplicaba solo `sesionAbierta`, y dos equipos abriendo a
la vez podían crear dos. Las funciones de la base ya recibían la sesión
como dato, así que no cambiaron.

**Los cierres son de cada caja**: el fondo que se sugiere al abrir es el
que quedó en ese cajón. La caja grande recibe de todas.

Cada comercio arrancó con su "Caja 1" y todas sus sesiones son de ella;
uno nuevo la recibe al crearse. Una sesión que llega sin caja va a la
primera del comercio: así 0101 se pudo aplicar antes que la aplicación
nueva. No se borran cajas: se desactivan. Sin límite por ahora: se
decide con los precios.

## El catálogo base

Migración 0106, `src/utils/catalogo.js` (las reglas), `src/datos/catalogo.js`
(la consulta) y `scripts/cargar-catalogo-base.mjs` (la carga). Cuando se
escanea un código que el comercio no tiene, el alta aparece con el nombre,
la marca y el rubro puestos, y solo falta el precio.

**Sale de SEPA** (Precios Claros, Res. 678/2020), lo que las cadenas
grandes publican por obligación, con licencia CC-BY 4.0: hay que citar la
fuente, y por eso el alta dice de dónde salió lo sugerido. Medido el 29/09,
un solo día de SEPA tenía el 79% de los códigos de Super 25.

**No guarda precios ni costos, ni nada de ningún comercio.** El precio de
una cadena grande no le sirve a un almacén de barrio. Y que el catálogo
creciera con las altas de los comercios sería pasarle datos de uno a otro:
se decidió dejarlo para después.

**Es dato de plataforma**, como `roles_base`: lo lee quien tiene sesión, no
lo lee anon y no lo escribe nadie desde el navegador. Los grants están
revocados además de no haber políticas, para que escribir dé "permiso
denegado" y no cero filas en silencio.

**Sugiere, nunca pisa.** El alta se abre vacía como siempre y la sugerencia
se completa encima, solo en los campos que nadie tocó. Si el cajero ya
empezó a escribir el nombre, no se le cambia ni se le mueve el cursor. Al
editar un producto no se consulta: lo cargado es del comercio. La consulta
se rinde al segundo y medio y un fallo no se recuerda, así que un mostrador
sin internet no se traba.

**El rubro solo se pone si el comercio ya usa ese nombre** (o si todavía no
tiene ninguno). A un comercio con sus propios rubros no le sirve que
aparezca uno más escrito parecido.

**Por ahora se carga sin rubro.** SEPA no lo trae. Las palabras clave
de `rubroDe()` acertaban el 56% contra los rubros de Super 25 y dejaban
sin rubro dos de cada tres productos, y un rubro equivocado sugerido es
peor que el campo vacío. `scripts/clasificar-catalogo.mjs` lo hace con
Haiku (nombre y rubro, de a cien) y mide contra Super 25; la carga usa
lo del modelo solo con `--modelo`. Está escrito y sin correr: la cuenta
de la API no tenía crédito.

**El código se guarda sin ceros adelante.** La pistola lee un UPC de doce
dígitos como trece con un cero, y SEPA publica de las dos formas. La tabla
lo exige con un check.

**La carga es a mano.** Cada archivo diario de SEPA pesa unos 320 MB y trae
distintas cadenas; el script baja los siete días de a uno, los borra
después de leerlos, elige la descripción que usan más cadenas (a igualdad,
la que trae marca y está escrita con la norma) y la pasa a como la escribe
un comercio: "FIDEOS TIRABUZÓN MATARAZZO PAQ 400 GRM" queda "Fideos
tirabuzón Matarazzo 400 g". Sin `--escribir` solo mide contra Super 25
(cobertura y acierto del rubro), leyendo en solo lectura. Con `--escribir`
carga en una transacción.

## El QR dinámico de Mercado Pago

Migración 0107, `api/mp/qr.js`, `CobroQr` en `Vender.jsx` y Ajustes →
Cajas. Con el QR fijo el cliente escanea y tipea el monto: puede
equivocarse, pagar dos veces o pagar lo de otro, y el cajero confirma a
ojo cuando suena el aviso. Con el dinámico cada venta arma una orden con
el monto adentro, y la venta se registra sola cuando Mercado Pago dice
que está pagada.

**Usa una caja que ya existe en la cuenta del comercio**, la del QR fijo
que tienen pegado: no se crean sucursales ni cajas en la cuenta de
nadie. Cada caja de Genez guarda el `external_id` de la suya
(`cajas.mp_caja`), que es como la nombra la Orders API; con dos
mostradores, el QR de uno no puede salir en el otro. Sin elegir, esa
caja cobra con Mercado Pago como antes.

**Se valida antes de mostrar el QR.** `finalizar` hace las mismas
verificaciones de siempre (CUIT para la A, los $10 millones, el límite
de crédito) y con `antesDeCobrar` devuelve el total en vez de cobrar.
Al revés, el cliente pagaría y la venta podría rechazarse después.

**Cancelar no pierde plata.** Volver cancela la orden para que nadie la
pague después; si justo se pagó, Mercado Pago no la deja cancelar, la
función contesta "pagada" y la venta se registra igual. La referencia
de la venta es la clave de idempotencia: un reintento no arma dos
órdenes.

**Nunca traba el mostrador.** Si Mercado Pago no contesta, el cajero
cobra con el QR fijo, como antes. Si el pago entra pero la venta no se
puede registrar (caja cerrada), lo dice con el número de orden. La
orden queda en `campos_extra.mp` de la venta.

El aviso de cobro de siempre (el sondeo de `api/mp/pagos.js`) suena
también con estos pagos; no carga plata en la caja, así que no duplica.

Una función aparte y no una acción de `api/mp/conexion.js`, porque
aquella pide `configurar` y cobrar lo hace el cajero. Con esta son 11
funciones; el plan Hobby de Vercel admite 12.

Se prueba en "Super 25 Pruebas", la réplica de Nehuen, nunca en Super 25.

## Varias sucursales

Migración 0108, `src/datos/sucursales.js`, Ajustes → Sucursales y
Cajas, Stock → Sucursales, y el filtro en Reportes e Informes. Un
comercio con dos locales tiene el stock, las cajas y las ventas de cada
uno. Con una sola sucursal no aparece nada nuevo en ninguna pantalla.

**La sucursal sale de la caja.** Cada caja es de una sucursal
(`cajas.sucursal_id`, obligatoria). La sesión la toma de su caja y el
movimiento de caja de su sesión. La venta no guarda su sesión: la conoce
por su movimiento de caja, así que cuando ese movimiento entra, un
disparador pasa la venta y su stock a la sucursal de la caja donde se
cobró (`registrar_venta` escribe primero la venta y el stock, y recién
después la caja). El mostrador igual la manda, pero decide la base: una
venta que esperó sin internet llega bien aunque el navegador no la sepa.
Lo que no tiene de dónde sacarla —un ajuste de stock, un pedido sin
caja— va a la primera sucursal del comercio.

**Lo viejo quedó en la sucursal de cada comercio.** 0108 completó las
ventas, el stock, las sesiones y la caja que estaban sin sucursal (690
movimientos y 314 ventas de Super 25). Sin cambiarles la fecha de
modificación: `tocar_operacion` saltea las filas mientras dura la
bandera `genez.completando`.

**Quién.** La política vieja dejaba a cualquier usuario del comercio
crear, cambiar y borrar sucursales. Ahora es configurar (o la
plataforma, que crea la "Principal" en el alta). No se borran; la base
no deja apagar la última activa ni una con cajas activas.

**Pasar mercadería** es `transferir_stock`: sale de una y entra en la
otra en la misma transacción, con tipo `transferencia`. No controla que
haya stock en el origen: el stock de un almacén casi nunca está al día,
y frenar el pase porque el sistema dice 3 cuando hay 10 no ayuda. Stock
→ Sucursales lee `stock_actual` (el real de la base, de a mil filas) y
no el estado en memoria.

**Los informes.** `ventas_diarias_rango` y `ventas_por_item_rango`
aceptan `p_sucursal`; null es todas, como antes. En Informes (servicios)
el filtro alcanza a la plata, lo vendido y la agenda; los cuadros de
ocupación y equipo son de todas, porque sus funciones no conocen la
sucursal. El ticket dice la sucursal solo cuando hay más de una. Una
compra entra a la sucursal de la caja de esa computadora, y la pantalla
lo avisa.

Quedó afuera, a propósito: precios distintos por sucursal, y limitar a
un empleado a su local. Productos sigue mostrando el stock total.

## Lo que quedaba del prototipo en Stock

Migración 0109. Tres botones de Stock venían del prototipo y cambiaban
solo la memoria del navegador, en un comercio que ya los usaba de verdad:

**El conteo de inventario se guarda.** `ajustar_stock` recibe lo contado
y escribe un movimiento de tipo `ajuste` por la diferencia contra lo que
hay en esa sucursal en ese momento, con quién lo hizo. La diferencia la
calcula la base y no la pantalla: el número que tenía la pantalla puede
ser de hace una hora, con ventas en el medio. Contar lo mismo que hay no
escribe nada. Dos personas contando el mismo producto se ordenan con un
lock.

**"Poner 30% menos"** (antes "Poner en promo") crea una promoción de
verdad sobre ese producto hasta que vence. Antes pisaba el precio en la
memoria: el mostrador de esa computadora cobraba el 30% menos y la base
seguía con el precio de antes. Vencido, no se ofrece.

**"No reponer"** queda en el producto (`campos_extra.noReponer`): sale de
"para reponer" y del pedido sugerido, y se sigue vendiendo lo que queda.
Antes lo desactivaba en la memoria, y dejaba de aparecer en el mostrador
hasta refrescar.

**Los pedidos de picking arrancan vacíos.** Arrancaban con los que
inventa el generador, y el menú contaba pendientes que nadie hizo.

Los indicadores de Stock (reponer, vencimientos, sin rotación) siguen
calculándose con la serie simulada y `HOY`: es lo que falta migrar.

## Los indicadores de stock

Migración 0110, `calcular()` en `src/utils/diagnostico.js`, el aviso de Stock y
`StockInicial.jsx`. Los indicadores ya salían de la base (`items_vista` y la serie
diaria); lo que estaba mal era qué contaban.

**La venta de cada producto** (`u30`, de donde sale la velocidad) contaba solo ventas
de mostrador: las comandas cerradas no existían y el bar tenía todo "sin movimiento".
Ahora cuenta venta, comanda y devolución (en negativo), solo confirmadas; la última
venta no cuenta una devolución.

**Stock cargado.** Un comercio que nunca cargó su stock lo tiene en cero, y cada venta
lo deja en negativo: Super 25 tenía 381 productos bajo cero y "Para reponer" le mostraba
cien que nadie había contado. `items_vista.stock_cargado` dice si el producto tuvo
alguna vez un movimiento que no sea venta ni devolución. Sin eso no entra en "Para
reponer", en el pedido sugerido, en "Sin movimiento" ni en el valor del inventario, que
además ya no resta stock negativo. Va aparte (`k.sinCargar`), y Stock lo avisa arriba:
si no, "para reponer" vacío parecería una buena noticia.

**Cargar desde una planilla.** Código y cantidad, en Stock → Conteo de inventario. Se
muestra qué cruzó y qué no antes de cargar; un código repetido suma (dos góndolas).
`ajustar_stock_lote` pasa cada fila por `ajustar_stock` (0109), de a mil por
transacción: queda igual que un conteo a mano, con quién lo hizo, y sirve también para
un recuento general. Una fila mala frena su lote entero.

## Las órdenes de compra

Migración 0111, `src/datos/compras.js` y Compras → Órdenes de compra. La orden vivía en
la memoria del navegador, con la fecha fija del prototipo, y se perdía al refrescar.

**Es una operación de tipo `compra` en estado `pendiente`**, con sus renglones y su
proveedor, marcada con `campos_extra.orden` para no confundirla con una compra cargada
directo (que nace confirmada). No mueve stock ni costo: eso lo hace la recepción, que
registra la compra de siempre (`registrarCompra`, confirmada) y pasa la orden a
`recibida`, con la compra que la recibió. Una que no va más queda `cancelada`. Lo
hace la aplicación con las políticas de siempre, que dejan cambiar una operación
mientras está pendiente; cerrada, ya no se toca. El número sigue al último del
comercio (OC-0001…).

**El costo de reposición** (0077) tomaba la última compra sin mirar el estado: un
producto que nunca se había comprado tomaba el costo de una orden que todavía no
llegó. 0111 lo limita a compras confirmadas. La planilla del contador y los
indicadores ya miraban solo lo confirmado.

Si la compra se registra pero marcar la orden falla, la mercadería no se pierde: la
orden sigue pendiente y la pantalla avisa que se refresque antes de recibirla de nuevo.

## La pantalla de pruebas

`vite --mode pruebas` (ver CLAUDE.md), `src/pruebas/` y un plugin en `vite.config.js`.
Hasta acá ninguna pantalla se podía ver sin un usuario real, y así se publicó una
que se caía al montar.

**Cambia una sola cosa:** el plugin resuelve `src/datos/supabase.js` a
`src/pruebas/supabaseFalso.js`, un cliente que entiende lo que usa la aplicación
(eq, in, is, gte/lte, order, range, single, insert, update, delete, upsert, rpc) contra
tablas en memoria. Todo lo demás —`src/datos/`, las pantallas, `Genezapp`— es el
código de producción, sin cambios. Lo que no entiende (filtros sobre tablas anidadas,
or, not) lo deja pasar sin filtrar; las funciones de la base que hacen falta para
arrancar y cobrar tienen una respuesta armada y las demás contestan vacío.

**Nada sale del navegador:** en ese modo no se sirve `api/`, así que Mercado Pago,
ARCA y la base real no se enteran. La página lo dice abajo, siempre. El build de
producción no la ve (se verificó: nada de `src/pruebas/` en `dist/`).

**Qué detecta:** `window.__genezErrores` junta los errores (de React, de la consola y
los no atrapados) y `window.__genezAvisos` los toasts rojos, que se van solos.
`window.__genezRecorrer()` entra a cada sección y los reporta por sección. Se probó
reintroduciendo la pantalla en negro: la detecta en el arranque. Lo que se llamó queda
en `window.__genezPruebas.registro`, y las tablas en `window.__genezPruebas.tablas`.

Los datos son un comercio inventado por rubro (`src/pruebas/datos.js`). Lo único que
viene de la base es lo de plataforma: los rubros y los roles de fábrica.

## Puntos para los clientes

Migración 0112, `src/utils/puntos.js` (las cuentas del mostrador), `src/datos/puntos.js`,
Ajustes → Puntos y el cobro. Cada venta con cliente suma puntos y en el cobro se canjean
como descuento. Apagado de fábrica; la regla está en `empresas.config.puntos` porque la
lee la base: 1 punto cada $1.000, vale $10 (vuelve el 1%), se canjea desde 100, vence a
los 12 meses.

**Lo hace la base.** Un disparador sobre la operación confirmada suma (la venta de
`registrar_venta`, que puede llegar tarde si no había internet, y la comanda al cerrarse),
registra el canje (`campos_extra.puntos.usados`) y, en una devolución, resta en proporción
lo que había dado la venta. `registrar_devolucion` crea la devolución con total 0 y después
se lo pone: el disparador corre también en ese cambio de total y espera a tenerlo. Una sola
vez por operación, aunque se reintente. Un canje que llega sin saldo (una venta sin
internet) se registra igual —la mercadería ya se fue— y queda con `sin_saldo`.

**El saldo vence por lotes** (`saldo_puntos`): lo ganado vence a los doce meses de
ganarlo, un canje consume lo más viejo primero, y lo que vence sin usarse se pierde. Es la
única cuenta que no le quita a nadie puntos que ya gastó ni le deja usar puntos vencidos.
Devuelve también lo que vence en los próximos 30 días.

**En el mostrador**, el canje se suma al descuento del pedido: el total baja en todos lados
(combinado, vuelto, factura) sin tocar cada cuenta. Para identificar alcanza con el DNI o el
teléfono y Enter: si el cliente no existe, se crea con ese dato. Sin internet el saldo no se
consulta y se cobra igual, sin ofrecer el canje. El ticket dice el canje y lo que suma.

Nadie escribe movimientos desde el navegador; corregir a mano es `ajustar_puntos`, con el
permiso de ajustar cuentas, desde la pestaña Puntos de la ficha del cliente (solo con los
puntos prendidos). Ahí se ven el saldo, lo que vence pronto y cada movimiento; una corrección
queda como uno más, con su motivo, y no se edita ni se borra nada. Los puntos en la app del cliente, para
después.

## GENEZ FOUNDER

Migración 0113 (la base), `src/founder/`, `src/datos/interno.js` y
`scripts/probar-founder-seguridad.mjs`. El sistema interno de la empresa Genez
—CRM, agenda, tareas y lo que se sume por fases—, no un módulo de los comercios.
Se abre desde el panel de plataforma con el botón "Founder", solo si la sesión es
miembro del equipo interno.

**La llave no es "plataforma".** `puede_ver(empresa)` devuelve verdadero para la
plataforma en cualquier comercio: es la del soporte para "entrar como". Si Founder
usara esa llave, el primer vendedor que se sume vería ventas, caja y clientes de todos
los comercios. Founder tiene su propia frontera: `interno_miembros` (perfil, rol,
áreas, activo) y `es_interno(área)`, que mira solo esa tabla. Un miembro que no es
plataforma no ve nada de los comercios; un usuario de comercio no ve nada interno.
Nadie se cambia su propia membresía (ni el fundador: no se deja afuera sin querer).

**Denegado por defecto.** Toda tabla `interno_*` tiene RLS, políticas por área
(`es_interno('config')` para configurar, `es_interno()` para leer lo común) y nada para
anon; los permisos que Supabase da solo a anon y public se revocan en la migración.
No se borra nada: se desactiva. Quién y cuándo lo pone la base (`interno_sellar`), y
cada alta y cambio queda en `interno_historial` (`interno_anotar`), que nadie escribe a
mano. `probar-founder-seguridad.mjs` ataca la API directo con seis perfiles —el
fundador, la plataforma sin membresía, dos dueños de comercio, anon y un miembro con
una sola área que además es de un comercio— y recorre todas las tablas `interno_*`
que existan, así las de fases siguientes quedan cubiertas solas.

**Configurable sin una tabla por lista:** `interno_listas` (zonas, rubros, fuentes,
motivos de pérdida, tipos de actividad y de evento, categorías, etiquetas; la clave no
cambia al renombrar) e `interno_etapas` (el pipeline, con la probabilidad del valor
ponderado y si es abierta, ganada, perdida o pausada).

**Carga aparte y con su naranja.** `Genezapp` lo importa con `React.lazy`: la pantalla
va en su propio archivo y la computadora de un comercio no la descarga. `.founder`
redefine el acento a #F4510B solo adentro; el resto del sistema sigue con el suyo.
El menú muestra solo lo que funciona: cada fase suma sus secciones.

La pantalla de pruebas lo muestra con `?sesion=plataforma`.

### El CRM y la agenda (0114)

`src/datos/internoCrm.js`, las secciones Inicio, Prospectos (con su ficha), Pipeline,
Tareas y Agenda, y `scripts/probar-founder-crm.mjs`. Prospectos, contactos,
oportunidades, la línea de tiempo (`interno_actividades`), tareas y eventos, cada uno con
su área (`crm`, `tareas`, `agenda`): un miembro sin `tareas` ve el CRM sin las tareas, y
el Inicio se arma igual con lo que tenga.

**Lo automático lo hace la base, una sola vez.** Un prospecto nace con su oportunidad en
la primera etapa abierta. Mover una oportunidad de etapa toma la probabilidad de la
etapa, la cierra si es ganada o perdida (perdida exige motivo, y la pantalla lo pide
antes de mover) y anota el cambio en la línea de tiempo. Un contacto registrado (no una
nota interna) actualiza el último contacto y el próximo paso del prospecto y de la
oportunidad. Completar una tarea que se repite crea la siguiente, con un índice único
por serie y vencimiento: tildarla dos veces no duplica. Nada de eso se repite en la
pantalla; si se repitiera, el día que alguien cargue por la API faltaría.

**Los duplicados, antes de crear.** `interno_posibles_duplicados` compara teléfono,
mail y nombre + localidad normalizados. El teléfono se lleva al número nacional de
diez (`interno_norm_tel`): "011 15-4444-5555" y "+54 9 11 4444-5555" son el mismo
celular, y quedarse con los últimos diez dígitos no alcanzaba porque el 15 corre el
número. `utils/importarProspectos.js` tiene la misma función en JavaScript; si se
cambia una, se cambia la otra.

**La importación es de revisar y confirmar**, como todo lo que viene de afuera: se
adivina qué columna es cada campo, se corrige a mano, y la vista previa marca fila por
fila lo que falta, lo que ya estaba (aunque esté archivado) y lo que se repite en la
misma planilla. Solo frena la falta de nombre; un rubro que no está en las listas o un
mail mal escrito quedan vacíos con un aviso, no se inventan. Se inserta de a cien.

**Los números del Inicio salen de los registros.** Contactos, demos y propuestas son
actividades del período; las ventas y el recurrente, oportunidades ganadas en el
período; el embudo, la foto de hoy. El ponderado del pipeline se presenta como
estimación, no como plata. La meta contra el resultado llega con Objetivos (fase 4):
no hay una meta inventada.

**Las fechas son de Buenos Aires.** Los horarios se guardan `timestamptz` y los
formularios leen y escriben con `-03:00` (`founder/util.js`): "hoy", "vencido" y la
grilla de la agenda se calculan con el día argentino, no con el del navegador.

### Clientes, implementación y soporte (0115)

`src/datos/internoClientes.js`, las secciones Clientes (con su ficha) y Soporte (con el
ticket), `founder/Adjuntos.jsx` y `scripts/probar-founder-clientes.mjs`. Áreas nuevas:
`clientes`, `soporte` y `docs` (esta última, para la fase 3b).

**Un cliente es un prospecto que compró.** `interno_clientes` apunta al prospecto y no
copia el negocio: nombre, teléfonos, contactos y la línea de tiempo comercial son los
del prospecto, y la ficha del cliente los lee de ahí (el botón "Historial comercial").
Guarda solo lo que nace con la venta: importe mensual, plan, alta, renovación, estado,
responsable. Un prospecto es cliente una sola vez, y un comercio tiene un solo cliente.

**Los módulos se leen del comercio, no se copian.** El comercio real ya dice qué plan y
qué módulos tiene; una lista en Founder se desincronizaba. El cliente se vincula por
`empresa_id` e `interno_comercio()` devuelve nombre, rubro, plan, módulos y sucursales
—nunca ventas, caja, clientes ni configuración— a quien tenga el área `clientes`. Es la
única ventana de Founder a los comercios, y es security definer para que la frontera la
ponga esa función y no la llave de plataforma.

**Pasar a cliente es una transacción** (`interno_convertir_en_cliente`): el cliente, la
implementación armada y los recordatorios (primer seguimiento, revisión de uso,
testimonio, renovación) como tareas comunes, que aparecen en Mi día. Se ofrece al ganar
una oportunidad en el pipeline y queda el botón en la ficha del prospecto. Los comercios
que ya eran clientes antes de Founder entran con `interno_cliente_desde_comercio`, sin
implementación: su oportunidad pasa a ganada y queda en la línea de tiempo.

**Implementación a medida.** Diez etapas (lista configurable) y pasos que salen de
`interno_impl_modelo` filtrado por rubro y módulos: a un pilates no le toca el stock.
`interno_impl_armar` suma lo que falte sin tocar lo tildado: se usa al convertir, al
vincular el comercio y después de cambiar el modelo. Lo que igual no corresponde se
marca "no aplica". Una etapa bloqueada tiene que decir qué la bloquea (check). Con todo
hecho o sin aplicar, el cliente pasa de implementación a activo solo.

**Requiere atención** se calcula en la pantalla (`motivosDeAtencion`) con los conteos
de `interno_clientes_vista`, y dice el motivo: en riesgo, implementación bloqueada,
tickets urgentes, tareas vencidas, renovación cerca, un mes en implementación o un mes
sin contacto (sin contactos, se cuenta desde el alta). Los conteos pasan por las
políticas de quien mira: sin `soporte`, los tickets dan cero.

**Soporte.** Tickets numerados con su conversación. Las fechas de resolución y cierre
las pone la base, y no se resuelve ni se cierra sin escribir la solución (check): es lo
que se lee la próxima vez. Los parecidos se buscan por palabras en común
(`interno_palabras`), sin `pg_trgm`, para no sumar una extensión a producción. Un ticket
genera tareas (`interno_tareas.ticket_id`) sin perder al cliente.

**Adjuntos en Storage**, bucket privado `interno`: la primera carpeta es el área y la
política de `storage.objects` pide `es_interno` de esa área y que sea una de las que
existen. Hasta 10 MB; imágenes, PDF, texto y planillas; ni HTML ni SVG. Se abren con un
link firmado de diez minutos. Sin política de borrar: se archiva el registro en
`interno_adjuntos`.

**Lo que se escribe pasa por una lista de columnas** (`COLUMNAS` en
`internoClientes.js`), no por "todo menos lo leído": las vistas traen `nombre` y otros
campos que en otras tablas son columnas de verdad. Las fechas sin hora (alta,
renovación, la fecha de una etapa) viajan como `AAAA-MM-DD`; convertidas a `Date` caen
a la medianoche de Londres, que acá es el día anterior.

### Producto y documentación (0116)

`src/datos/internoProducto.js`, las secciones Producto (roadmap, bugs, proyectos,
versiones) y Documentos, `founder/FichaProducto.jsx`, `utils/markdown.js` con
`founder/Markdown.jsx`, y `scripts/probar-founder-producto.mjs` y `probar-markdown.mjs`.

**El roadmap es una tabla con tipo**, no siete: idea, funcionalidad, mejora, bug, pedido
de cliente, deuda técnica e integración comparten casi todo y pasan por los mismos
estados. Los campos del bug (entorno, pasos, esperado, actual, gravedad) quedan vacíos
en lo demás. `version_id` es la versión en la que sale o, en un bug, en la que se
corrigió. Es qué construir y para quién, no el seguimiento del código.

**Del ticket a producto** con `interno_ticket_a_producto`: un error entra como bug con
sus pasos y su gravedad, un pedido como solicitud, y queda atado al ticket en
`interno_roadmap_tickets`. "Lo piden N clientes" cuenta los clientes distintos de los
tickets atados; no es un número que alguien escribe. Es security invoker: hace falta
ver el ticket (soporte) y escribir en el roadmap (producto).

**Documentos en markdown propio, sin HTML.** `utils/markdown.js` no produce HTML sino
bloques que `Markdown.jsx` convierte en elementos de React, que escapan todo el texto:
un `<script>` o un `onerror=` se ve escrito, no se ejecuta, y los links solo pueden ser
http, https o mailto. No usar `dangerouslySetInnerHTML` ni una librería que arme HTML
para esto. `probar-markdown.mjs` lo comprueba.

**Buscar y versionar lo hace la base.** `busqueda` es un tsvector en castellano (título
y etiquetas pesan más que el contenido; "impresoras" encuentra "impresora"). Las
etiquetas pasan por `interno_etiquetas_texto`, declarada inmutable porque
`array_to_string` no lo es y la columna generada lo exige. Cambiar título o contenido
guarda la versión anterior en `interno_documentos_versiones`, que no tiene política de
escritura; restaurar una versión es guardar una nueva. No hay columna "público".

### Objetivos, informes y marketing (0117)

`src/datos/internoMarketing.js`, las secciones Objetivos, Informes y Marketing, y
`scripts/probar-founder-marketing.mjs`.

**El avance de un objetivo no se guarda: se calcula.** `interno_objetivo_valor()`
cuenta los registros reales entre dos días de Buenos Aires (prospectos creados,
contactos, demos, propuestas, ventas ganadas, recurrente de clientes dados de alta,
clientes vigentes con importe). La única carga a mano es la métrica `manual`, que la
pantalla marca como tal, y un check impide cargar a mano las demás. Es la regla del
brief de no inventar porcentajes, puesta en la base.

**El plan de 30 días** crea el plan, la meta de ventas del período y, por semana, las
metas de ritmo (prospectos, contactos, demos, propuestas) que se completaron; la quinta
"semana" (dos días) se prorratea. Las actividades son tareas atadas al objetivo.

**Los informes leen por cohorte**: los prospectos que entraron en el período y hasta
dónde llegó cada uno. Pérdidas y días hasta cerrar miran lo cerrado en el período. Se
calculan en la pantalla con los mismos datos del CRM; no hay tablas de informes.

**Marketing.** Ideas y calendario son una tabla (`interno_contenidos`): una idea es un
contenido en estado `idea`. Las métricas se cargan a mano, una a los 7 días y otra a
los 30 (`interno_contenido_metricas`): no hay integración con redes y la pantalla lo
dice. Lo real es lo originado: un prospecto puede nombrar su contenido de origen
(`interno_prospectos.contenido_id`), y de ahí salen demos y clientes por publicación.
Las columnas de la vista con número (`vis_semana`, no `vis_7d`): el pasaje a camelCase
de `src/datos/` no toca un guion bajo seguido de un dígito, y el campo no llegaba.

## La cuenta corriente

Migraciones 0075 y 0085, `src/datos/cuentas.js` y la sección Cuenta
corriente (módulo `cuentas`). Es el fiado: vender a alguien que paga
después, cobrarle, y corregir cuando algo se cargó mal.

**El saldo no se guarda**, igual que el stock: `saldo_cliente` suma las
ventas pagadas con `cuenta_corriente`, los cargos manuales, y resta los
descuentos manuales y los pagos. Lo anulado no cuenta. Por eso la ficha
del cliente, el cobro y la sección dicen el mismo número.

**Nada se borra.** Un pago o un ajuste se anula —con quién, cuándo y por
qué, y en la bitácora—. Si el pago había entrado a la caja, la anulación
lo saca con un egreso del mismo medio en la caja abierta. Las tablas no
tienen política de escritura: todo pasa por funciones `security definer`
que verifican el comercio a mano.

**Un fiado siempre tiene cliente**, lo exige un disparador sobre `pagos`
—no solo el cobro: también presupuestos y comandas—. Y en una comanda
abierta no se fía como pago parcial: `registrar_pago` metería eso en la
caja como plata cobrada.

**Dos permisos.** `ajustarCuentas` (anular, cargar o perdonar deuda,
fijar el límite) lo verifica la base; de fábrica, dueño y encargado.
`fiar` y el límite de crédito los controla el cobro y no la base, a
propósito: una venta hecha sin internet llega a la base después, y
rechazarla ahí no devuelve la mercadería. Cobrar una deuda lo puede
cualquiera que vea la sección: es tarea de mostrador.

**La caja** no suma el fiado —no entró al cajón— y muestra aparte lo
fiado y lo cobrado de cuentas en el día.

Lo que falta: devolver una venta fiada (hoy una compra fiada se corrige
desde la venta), y un informe mensual en Reportes más allá de los
indicadores de la sección.

## Abrir un movimiento de caja

`src/modulos/DetalleMovimiento.jsx`. Cada renglón de "Movimientos de hoy"
se abre. Si viene de una venta (`movimientos_caja.operacion_id`) se ve qué
se vendió, cómo se pagó, quién la cobró y la factura con su CAE, y se
vuelve a imprimir. Si es un gasto, un retiro o un cobro de cuenta, se ve
el movimiento y se imprime un comprobante de caja, con renglón de firma
cuando es un egreso.

**No hay un listado de ventas aparte**, a propósito: hubo uno y se sacó.
El cajero ya mira los movimientos. La contracara: lo fiado no pasa por el
cajón, así que una venta fiada no tiene movimiento y no se abre desde acá.

**No hay tabla ni migración nueva.** La venta es `cargarVenta` (cliente,
cajero y la factura no rechazada de `comprobantes`) más
`cargarTicketDeVenta`, lo mismo que imprime Caja → Facturas. La consulta
nombra la relación `perfiles!usuario_id` porque `operaciones` tiene dos
hacia `perfiles` (`usuario_id` y `actualizada_por`) y sin eso PostgREST no
sabe cuál. El movimiento que el cobro suma en pantalla lleva el id de la
venta, como los que vienen de la base; si la venta todavía está en la
cola sin internet, se abre como movimiento con un aviso.

**Se reimprime igual que salió**, sin marca de copia: una factura
reimpresa es la misma factura. La que espera CAE no se imprime tampoco
desde acá, por lo mismo que en el cobro. Reimprimir no pide permiso: es
tarea de mostrador.

## Las actualizaciones llegan solas

`src/ui/actualizacion.js`, el plugin `publicarVersion` de
`vite.config.js` y el aviso de `Genezapp.jsx`.

La gestión no se cachea —el HTML se revalida siempre—, así que un F5
común trae lo nuevo. El problema es que en un local la pestaña queda
abierta días. Cada build publica `/version.json` con el mismo número que
lleva adentro el bundle; la página pregunta cada cinco minutos y al
volver a la pestaña, y si cambió muestra un aviso y **se recarga sola
cuando la caja está libre**: dos minutos sin que nadie toque nada, nadie
marcado ocupado (`useOcupado`: el cobro con productos o a medio pagar) y
nada abierto encima (cualquier `.fixed.inset-0`, que es como están hechos
todos los cuadros, o un campo con texto). Lo explícito es para lo que no
se ve; lo genérico, para que una pantalla nueva no tenga que acordarse.

Una pantalla con estado que se pierde al recargar y que no vive en un
cuadro tiene que llamar a `useOcupado`. Una venta cobrada nunca se pierde:
la cola la escribe en el equipo antes de mandarla.

## Lo que ya funciona y no hay que rehacer

Comandas de salón y mostrador, centro de pedidos con estados reales y
tiempo real, cocina agrupada por pedido, despacho incremental, descuento
por porcentaje o importe, comensales, pre cuenta, plano de mesas
configurable, juntar y separar mesas, cobro con caja obligatoria, venta
sin internet con cola y reintento, numeración por punto de venta con
bloques que reparte la base (0094: dos cajas no repiten, y sigue sin
internet), bitácora automática, alta de accesos por el propio comercio con
excepciones por persona.

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
