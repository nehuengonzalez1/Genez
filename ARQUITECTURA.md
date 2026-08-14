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

`scripts/fotos-carta.mjs` le pone una foto a cada plato, bajándolas de
Wikimedia Commons con su atribución. Las elige a mano: la búsqueda
automática devuelve hamburguesas mordidas y ensaladas que son fettuccine.
`--ver` deja las candidatas en una carpeta para mirarlas antes de aplicar,
y `--borrar` las saca. Un comercio de verdad carga las suyas desde la
ficha del producto.
