# Encargo · Take away / Mostrador — Centro de pedidos

Especificación del cliente, guardada tal cual para no perderla entre
sesiones. La imagen de referencia la tiene él y hay que pedírsela.

Ver `ARQUITECTURA.md` para las fases 1 y 2 (análisis y qué reutilizar),
que ya están resueltas, y `DISENO.md` para las reglas visuales.

## Lo esencial del encargo

Un centro operativo de pedidos para gastronomía, nativo de Genez. Tablero
tipo kanban con columnas por estado, barra lateral con el conteo por
canal, filtros, buscador y KPIs abajo. Todo con datos reales.

**Regla principal:** no crear un sistema paralelo. Reutilizar productos,
clientes, ventas, stock, caja, comandas, usuarios, permisos y reportes que
ya existen. Extender lo que haga falta sin romper lo que anda.

## Canales

Mostrador, delivery propio, PedidosYa, Rappi, Uber Eats, pasar a buscar.
No deben estar escritos en el código: tienen que poder agregarse WhatsApp,
web, Instagram y marketplaces sin tocar el sistema.

## Estados y flujo

`PENDIENTE → EN_PREPARACION → LISTO → EN_CAMINO → COMPLETADO`, más
`CANCELADO`. El flujo varía por canal: mostrador y pasar a buscar no pasan
por "en camino"; delivery y aplicaciones sí.

Los estados tienen que ser reales y persistentes, no mover una tarjeta en
pantalla. Cada cambio actualiza la base, registra historial, y refresca
contadores y estadísticas.

## Color

**El color de la tarjeta es el estado, no el canal.** Pendiente rojo, en
preparación ámbar, listo dorado, en camino verde, completado gris. El
canal se distingue por ícono y una insignia chica.

## Integraciones exigidas

Comandas (un pedido de mostrador o take away nace como pedido real y
aparece en pendientes), mesas (diferenciadas sin mezclarse), cocina
(realtime, sin sondeo agresivo), ventas, stock, caja, permisos por rol y
auditoría.

## Además

Detalle en panel con las acciones válidas para cada estado. Arrastrar
entre columnas con alternativa por botones para pantallas táctiles.
Historial con filtros. Estadísticas integradas a Reportes: pedidos, ticket
promedio, por canal, tiempos de preparación y entrega, cancelaciones,
evolución por hora y por día.

## Identidad

Negro `#08090A`, superficies `#111315` y `#17191B`, naranja `#FF7300`,
blanco `#F5F5F5`. Optimizado para 1440, 1600 y 1920. En pantallas chicas,
scroll horizontal antes que romper la estructura.

## Orden pedido

Analizar, planificar, implementar backend, integrar con comandas, ventas,
stock y caja, estados y auditoría, realtime, interfaz, filtros, historial,
estadísticas, permisos, y recién ahí probar el flujo completo.

## Criterio de éxito

Un módulo funcional con datos reales, no un prototipo, visualmente lo más
fiel posible a la referencia.
