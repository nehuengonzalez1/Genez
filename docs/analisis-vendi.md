# Vendi: análisis completo y comparativa con Genez

Relevado el 07/10/2026 en una cuenta de prueba de Vendi (plan FREE, prueba hasta el 06/11). La primera vuelta recorrió cada sección del menú, la guía de usuario, la página pública y la pantalla de venta, sin registrar ventas. La segunda, con permiso de Nehuen, **operó**: ventas en los dos modos, un fiado, un egreso, el cierre, el asistente con IA y las promociones. Está en la sección 11.

> **Corrección del 07/10 (Nehuen).** La primera versión subestimó a Vendi en siete cosas que hace mejor que Genez:
>
> - tiene página web y app;
> - tiene un **asistente con IA** adentro (en la prueba a fondo se vio que no es abierto: ver sección 11);
> - los **módulos están mejor distribuidos** y el **menú lateral, mejor seccionado** (5 grupos con rótulo; Genez: una lista sin grupos);
> - tiene **más configuración**;
> - tiene un **área de Administración aparte** (Panel Admin, Suscripción, Configuración), mientras que Genez mezcla todo en el mismo menú;
> - tiene un **marketing muy completo**;
> - se **instala en el escritorio** (el sistema de gestión de Genez no).
>
> Las secciones 6 a 9 ya lo incluyen. La comparativa de los tres está en `docs/analisis-ventario.md`.

---

## 1. Qué es Vendi

- **Producto:** sistema de gestión para comercio minorista argentino (kioscos/almacenes, ferreterías, vinotecas, repuestos, distribuidoras). Solo retail: no tiene gastronomía (mesas, comandas) ni servicios (turnos).
- **Promesa:** "Tu negocio más simple. Tus ventas más grandes." "Configuración en 5 minutos". "+700 comercios activos".
- **Hecho en:** Next.js (React), tipografía IBM Plex Sans, se instala como app de escritorio (PWA).
- **Prueba:** 30 días sin tarjeta (Genez: 10).
- **Planes (precios de "lanzamiento"):**

| Plan | Precio | Qué agrega |
|---|---|---|
| Solo app de clientes | $19.900/mes | Aparecer en "Vendi App" con hasta 6 promos, productos ilimitados |
| PRO | $29.900/mes (tachado $49.900) | Productos ilimitados, Excel, IA de stock y precios, reportes |
| PRO MAX ("más elegido") | $59.900/mes (tachado $119.000) | Foto de compras con IA, bot WhatsApp, fidelización, tienda online, multi-sucursal, roles, ARCA* |
| ENTERPRISE | a medida | Sucursales/usuarios ilimitados, dominio propio, app con su marca |

\* **Inconsistencia:** la página pública pone "Facturación ARCA" en PRO; adentro, en Suscripción, figura recién en PRO MAX.

- **Anual:** "2 meses gratis". **Programa Embajador:** referí negocios, hasta 6 meses gratis.

---

## 2. Estructura

Menú lateral con 20 secciones en 5 grupos (los grupos se pliegan):

- **Sin grupo:** Inicio, Asistencia Vendi, Inventario, Ventas, Historial Ventas, Caja, Clientes, Proveedores, Herramientas.
- **Comprobantes:** Facturas, Tickets.
- **Marketing y canales:** Marketing, Promociones, Mi Tienda Online, Vendi App (próximamente).
- **Negocio:** Rendimiento, Sucursales, Auditoría Total.
- **Administración:** Panel Admin, Suscripción, Configuración.

Abajo del menú: "Instalar en escritorio", "Modo Oscuro", el usuario y "Cerrar sesión". En celular: barra inferior con Inicio, Inventario, Ventas, Rendimiento y "Más".

Patrón de navegación muy repetido: **páginas "hub" de tarjetas** (Herramientas, Rendimiento, Sucursales, Marketing, Panel Admin, Mi Tienda) que llevan a la función.

## 3. Visual

- Fondo beige cálido (#F4F1EA), tarjetas blancas, esquinas redondeadas, acento verde, mucho aire.
- **Modo claro de fábrica**, oscuro opcional. Elegís el color del tema entre 9.
- Íconos: mezcla de íconos de línea y **muchos emojis** en tarjetas y productos (📦 🥤 ✍️ ✨ 📷).
- Botones de acción grandes y verdes; upsells con insignias "PRO", "PRO MAX", "PRÓXIMAMENTE", "NUEVO".
- En Ventas el menú se achica a íconos para darle espacio a la caja.

---

## 4. Sección por sección

### Inicio
Cuatro indicadores (valor del inventario, ventas de hoy, de la semana, del mes), gráfico de ingresos contra egresos (semana/mes/personalizado), últimas ventas, ticket promedio. Arriba: aviso "Instalá Vendi en tu computadora", banner de prueba gratis, tarjeta de bienvenida, accesos a "Guía de Usuario" y "Programa Embajador", botón "Asistente Vendi".
**Se le escapa texto de programador:** "El gráfico aparece cuando el backend incluya órdenes por día".

### Asistencia Vendi (la "pizarra")
Seis pestañas:
- **Pizarra:** calendario comercial de los próximos 30 días con una acción sugerida y un botón: feriado (promo 20% bebidas y snacks → "Crear promo"), Día de la Madre (combo perfumería + bombones → "Armar combo"), Halloween, inicio de mes / cobro de sueldos, Cyber Monday.
- **Hoy:** lo que tenés que hacer, ordenado por urgencia ("Abrí la caja para empezar a vender") + "Sabías que…".
- **Negocio, Marketing:** novedades (vacías).
- **Noticias:** próximamente (tracker del dólar, noticias del rubro).
- **Actualizaciones:** **changelog público**, 40 novedades de marzo a octubre 2026, y "En camino" (bot de WhatsApp esperando a Meta, partidos de la Selección en la pizarra). Ritmo: 13 novedades en septiembre.

### Inventario
- **Vacío:** "Cargar mi primer producto" → página **"Cargá tus productos"** con 4 tarjetas: **A mano**, **Por lista (Excel, PDF, imagen)** con IA, **Escaneando** con la cámara, **Desde el catálogo**.
- **Catálogo precargado:** tabla con casilla, costo, venta, stock y "Agregar". Viene de **lo que cargaron otros comercios**: 543 rubros y 1.267 marcas, **con mucho ruido** ("7up/7Up/7UP", "9 de Oro" ×3, nombres con precios adentro, el mismo producto dos veces). Lo bueno: **trae costo y venta sugeridos con el promedio de otros comercios** ("prom. de otros comercios"), y al poner el costo sugiere la venta (+35%).
- **Carga por Excel:** asistente de 4 pasos (subir, analizar, revisar, listo), plantilla de ejemplo a la vista (nombre, stock, costo, venta), arrastrar archivo, guía. PDF/imagen solo en PRO MAX.
- **Ficha del producto** en pestañas: General (nombre, rubro, código de barras con botón escanear y botón IA, PLU de balanza Systel, marca, código y código de proveedor, "precio editable en el POS"), **Precios** (costo, **precio efectivo y precio tarjeta**, dolarizado, mayorista, tienda web), **Stock** (unidad, kg o metro, control, inicial, mínimo, vencimiento, **presentaciones de compra** —caja, pack— y **venta suelta**: abrir una bolsa de 20 kg y vender por kilo), Imagen (hasta 6 fotos, quitar fondo), Proveedores (precio de cada proveedor).
- Antes de la ficha pregunta "¿Qué vas a crear hoy?": **Producto unitario** u **Oferta** (combos, 2x1, packs).
- **Listado:** SKU generado solo (PLAY-YERB-KKD9), **emoji según el rubro**, rubro asignado solo, costo, precio, **utilidad en $ y %**, stock con mínimo 5 de fábrica, vencimiento. Filtros: rubro, orden, tipo, moneda, control de stock. Tabla o grilla, ocultar imágenes, ver más datos.
- **Botones:** Gestionar categorías, Imprimir etiquetas, Imprimir precios, Compartir catálogo.
- **Configuración:** ubicación de productos (pasillo, estantería, estante por sucursal).
- **Mantenimiento:** duplicados (consolidar), eliminados (recuperar), sin disponibilidad, ocultar, categorías con IA, historial.

### Ventas (punto de venta)
- Bloqueado sin productos ("No hay productos para vender → Ir a Inventario").
- **No obliga a abrir la caja.** La caja se abre y se cierra sola (cierre automático 00:00).
- Primera vez: tarjeta "¡Bienvenido al Punto de Venta!" con 4 pasos.
- **Vista clásica:** izquierda la tabla de productos (efectivo, tarjeta, stock, "Agregar") con buscador, rubro y orden; derecha el carrito (selector "Precio normal"/listas, cliente, renglones con −/+ y cantidad, precio con candado, descuento en $ o %, subtotal, "Agregar producto NO registrado", "Cupón, descuento y recargo", total efectivo, COBRAR, "MAXIMIZAR").
- **Cobrar:** ventana "Confirmar venta" con el total y **5 tarjetas grandes** (Efectivo, Transferencia, Tarjeta, QR, Cuenta corriente/Fiado), "Combinar pagos", asignar cliente, comprobante (sin ticket, ticket, **WhatsApp, QR**), "Registrar venta". En efectivo: "¿Cuánto te dio el cliente?" con el total cargado y **montos rápidos** ($6.000, $6.350, $10.000, $10.350: redondeos a mil y a diez mil, con y sin los sueltos), "Pago exacto ✓".
- **Modo teclado:** muestra la leyenda de atajos y la tecla en cada botón: F2 buscar, ↑↓ elegir, Enter agregar, + cantidad, F3 producto no registrado, F9 cliente, F4 cobro rápido, F8 cobrar/registrar, número = medio de pago, Enter registra, Esc vuelve.
- **Modo rápido:** **la venta entera en una pantalla, sin ventana de cobro**: carrito grande a la izquierda con SKU y stock por renglón y barra "Total a pagar"; a la derecha cliente (F9), promoción, "Alt A Ajustes de la venta", **medios con su casilla de monto** (Alt 1 Efectivo ya trae el total, Alt 2 Transferencia, Alt 3 Tarjeta, Alt 4 QR; "+" en una casilla se lleva lo que falta), Alt 5 Cuenta corriente, Otros, comprobante y "F8 Registrar venta".
- **Atajos configurables:** en Panel Admin → Métodos de pago, Alt 1 a Alt 9, a cada uno le asignás un medio o acción (facturar, sin ticket, imprimir).
- **Cobro rápido** (opcional, en Política de ventas): un botón que registra la venta en efectivo, sin vuelto ni cliente.
- Precio efectivo arriba y precio tarjeta abajo en ámbar en cada renglón; total desglosado efectivo/tarjeta.
- Mayorista por renglón (casilla), PLU visible, vender sin stock con aviso.
- **Lento:** la búsqueda tarda uno o dos segundos en filtrar (va al servidor).

### Historial de ventas
Filtros por período, mostrar anuladas, ventas/tickets/devoluciones, tabla o grilla, exportar a Excel.

### Caja
Primera vez: explicador de 3 pasos. "Cierre automático a las 00:00", abrir caja general o **por categoría**, últimas cajas cerradas.

### Clientes
Total, deudores, saldo a cobrar; exportar e importar; **vista fidelización**. Política de ventas suma **saldo a favor (billetera)**, **mercadería a favor**, **límite de deuda**, exigir cliente en cada venta.

### Proveedores
Pensado como **carrito de reposición**: Catálogo (productos para reponer, orden por menor stock), Mis pedidos, Proveedores, **Deudas**. "Generar pedido de compra" o "Cargar como ya recibida". El pedido sale como imagen para mandar por WhatsApp o mail.

### Herramientas (hub de 25 tarjetas)
- Inventario: edición masiva, stock rápido, carga masiva, auditar stock, stock valorizado, transferencias.
- Precios: **ajuste USD**, **actualizar con la lista del proveedor** ("ideal para ajustar semanalmente por inflación"), modificar por batch, listas de precios, **grupos de precio** (sincronizar precios), mayorista por %, precios para la tienda web.
- Clientes: ajustes de precio fiado (cuando sube un producto vendido al fiado).
- IA Logística (PRO): pronóstico de ventas a 7 días, inteligencia de inventario, ventas, precios, demanda.
- IA Marketing (PRO): posts para redes desde una foto, calendario de contenido, historial con métricas.

### Comprobantes
Tickets ("desde acá podés facturar una venta que no tiene factura", "Configurar ticket") y Facturas.

### Marketing y canales
- Marketing (PRO MAX): fidelización (puntos), grupos con descuento, promociones, bot de WhatsApp (próximamente).
- Promociones con "modo de aplicación" avanzado; cupones con límite por cliente; **avisa si la promo queda debajo del costo**.
- Mi Tienda Online: catálogo para compartir por WhatsApp, tienda online con carrito, pedidos web, envíos, colores propios.
- **Vendi App:** app para consumidores donde aparecen los comercios cercanos con su "vidriera" y ofertas (para liquidar lo que vence). Es su apuesta de red: "El comercio gestiona. El cliente vuelve."

### Rendimiento
Hub: Inteligencia, Estadísticas (comparativas), **Rendimiento del negocio con puntaje** (58/100 "Regular" **en una cuenta sin una sola venta**), Recomendaciones ("Qué hacer hoy"), Demanda. Compara con el rubro (rangos de CAME 2025 + datos de la red), **metas** sugeridas por IA, **"Ranking Vendi"** contra 66 negocios del rubro (se desbloquea en PRO MAX).

### Sucursales
Hub: transferencias, todas juntas, ventas de todas, caja por sucursal, gestionar, sumar/quitar, buscar stock en otra, comparar (varias PRO MAX o próximamente).

### Auditoría Total
Registro de actividad legible, con filtros (ventas, productos, precios, caja), "Revisar" lo sensible, exportar a Excel.

### Panel Admin
Equipo, sucursales, permisos (PRO MAX, abre un cartel de venta), métodos de pago (comisión, recargo, atajos Alt), **Módulos** (prender y apagar secciones del menú), **Política de ventas** (editar precio, cobro rápido, exigir cliente, saldo a favor, recargo de tarjeta automático, margen asumido de ventas a mano, qué código mostrar en la caja, límite de deuda, exigir proveedor en compras, no remarcar al recibir, PLU).

### Configuración
Una sola página larga: logo, color del tema, datos del negocio, datos que salen en los comprobantes con vista previa, mail de Mercado Pago, redes, info pública (slogan, horarios), rubro (16 opciones), contraseña, notificaciones.

### Ayuda y onboarding
- **Cartel "¡Bienvenido a…!" de 3 o 4 pasos con "¡Entendido!" la primera vez en cada sección** (POS, Caja, Analíticas, Inteligencia).
- **Guía de usuario:** página HTML aparte, 46.000 caracteres, 45 capturas, índice. **Atrasada**: no menciona el modo rápido (F8) que lanzaron en septiembre.
- **Asistente de ayuda:** panel lateral con sugerencias **según la pantalla** (en Auditoría: "Qué registra", "Quién hizo qué"…), chat, "¿La app no abre? Repararla" y la franja "¿No pudiste resolverlo acá? Escribinos por WhatsApp".
- Ícono "?" al lado de cada título.

---

## 5. Lo que hace mal (lo vimos)

1. **Carga lenta y rara:** cada carga completa tarda varios segundos y muestra por un momento "Sin conexión" y el menú de un "Vendedor" con solo Inicio y Remitos.
2. **Búsqueda del POS con demora** (1–2 s): en el mostrador se nota.
3. **Catálogo sucio:** marcas triplicadas, productos repetidos, precios metidos en el nombre.
4. **Textos de programador** a la vista ("cuando el backend incluya…").
5. **Puntaje de 58/100 sin datos** y "octubre cierra en $0": desconfianza.
6. **Precios y planes inconsistentes** (ARCA en PRO afuera, en PRO MAX adentro) y **muchas cosas "próximamente"**.
7. **Upsells en el camino** (tocar Permisos abre "Mejorar mi plan").
8. **Detalles de foco:** al cerrar el cartel del POS, lo que se escribe no entra al buscador; al poner el costo en el catálogo, el precio sugerido se pega a lo que escribís.
9. **Guía atrasada** respecto del producto.
10. **Mucho y desparramado:** 20 secciones + hubs de tarjetas + 25 herramientas: la misma función aparece en dos lugares (Edición masiva está dos veces en Herramientas; Promociones en Inventario y en Marketing).

---

## 6. Comparativa con Genez

| Tema | Vendi | Genez | Quién gana |
|---|---|---|---|
| Rubros | Solo retail | Comercio, gastronomía (salón, comandas, cocina, QR de mesa) y servicios (agenda, abonos) | **Genez** |
| Arrancar con productos | 4 caminos: a mano, Excel con IA, escaneando, catálogo de la red con precios promedio | A mano, planilla con vista previa, foto de remito en Compras | **Vendi** |
| Precio efectivo / tarjeta | Dos precios por producto, se ven los dos en la caja | Un precio + recargo/comisión por medio | **Vendi** (más claro para el mostrador) |
| Caja | No bloquea: se abre y cierra sola | Hay que abrirla antes de cobrar | **Vendi** (menos fricción) |
| Velocidad del POS | Búsqueda en el servidor, 1–2 s | Búsqueda local instantánea, escáner global | **Genez** |
| Teclado | Modo teclado con leyenda, F8/F4/F9/F3, Alt 1–9 configurables, modo rápido | F1–F10, 1–6 medios, I/T/W/E, Enter vacío cobra | Empate; Vendi **muestra los atajos en los botones** |
| Cobro en una pantalla | Modo rápido: medios con casillas de monto | Ventana de medios, paso a paso | **Vendi** para pagos combinados |
| Vuelto | Montos rápidos con y sin sueltos | Montos rápidos | Parecido |
| Sin internet | "Sigue operativa y sincroniza" | Cola en la computadora | Parecido |
| Factura ARCA | Sí (plan dudoso) | Sí, en Pro | Empate |
| Mercado Pago | Mail de MP para la suscripción, QR como medio | Avisos de cobro en vivo con voz, conexión por comercio | **Genez** |
| Fiado / cuenta corriente | Límite, saldo a favor (billetera), mercadería a favor, ajuste de fiado por suba de precio | Cuenta corriente con cobros parciales | **Vendi** |
| Proveedores | Carrito de reposición, deudas, pedido por WhatsApp | Compras, órdenes, recepción parcial, facturas a pagar, pagos por proveedor | Parecido; Vendi más simple |
| Listas de precios | Listas, grupos de precio, mayorista por %, tienda web, ajuste USD, actualizar con lista del proveedor | Listas por cliente, planilla | **Vendi** (inflación y dólar) |
| Variantes / fraccionado | Talle y color; presentaciones; venta suelta | Bulto de compra, precio abierto, balanza | **Vendi** |
| Promociones | Promos, combos, cupones, aviso si pierde plata | Promociones (2x1…) | **Vendi** |
| Informes | Hubs, puntaje, ranking, metas IA (con datos de relleno) | Resumen con comparación, puente de rentabilidad, matriz, quiebres, "Mi reporte" con drill-down, reportes por mail, objetivos, RFM | **Genez** (más hondo y honesto) |
| IA | Mucha promesa (IA en todo), parte "próximamente" | Asistente con tus datos, foto de remito, diagnósticos sin IA | Vendi en amplitud; Genez en lo que anda |
| Canales | Tienda online, catálogo compartible, app de consumidores, bot | App del cliente para turnos (servicios), pedidos por canal (gastronomía) | **Vendi** en retail |
| Multi-sucursal | Mucho en PRO MAX | Sucursales, transferencias, comparativo | Parecido |
| Permisos | Roles en PRO MAX | Roles, personas, excepciones, banderas, todo en Pro | **Genez** |
| Auditoría | Legible, filtros, "revisar" lo sensible | Bitácora | **Vendi** en presentación |
| Onboarding | Cartel por pantalla, guía HTML, asistente contextual con WhatsApp | Bienvenida, recorrido guiado de corrido con Enter, venta en modo muestra, primeros pasos que se tildan solos, ayuda por pantalla, centro de ayuda | **Genez** |
| Menú y administración | 5 grupos con rótulo; "Administración" aparte (Panel Admin, Suscripción, Configuración) | Una lista sin grupos; Ajustes, Permisos y Equipo mezclados con lo de todos los días | **Vendi** |
| Configuración | Panel Admin + Política de ventas + Configuración | Ajustes en pestañas técnicas | **Vendi** |
| Instalar en el escritorio | Sí | No (solo la app del cliente) | **Vendi** |
| Asistente con IA | Contesta con los datos del negocio, escribe textos de promoción, sugiere ayuda; no responde preguntas generales | Asistente con los datos del negocio | **Vendi** (más pulido y siempre a mano) |
| Página y marketing | Muy completa: embajadores, changelog, app de consumidores, guía | Landing nueva | **Vendi** |
| Precio | PRO $29.900 / PRO MAX $59.900 (de "lanzamiento") | Simple $29.900 / Pro $59.900 | Igual |
| Prueba | 30 días | 10 días | **Vendi** |
| Confianza | Textos de programador, puntaje falso, "próximamente" | Sin relleno, datos reales | **Genez** |

---

## 7. Qué copiaría (ordenado por impacto y esfuerzo)

**Rápido y de alto impacto**
1. **Precio efectivo y precio tarjeta por producto**, a la vista en la caja, con el recargo automático configurable (precio tarjeta = efectivo × (1 + %)) y el total desglosado. Es como piensa el mostrador argentino.
2. **Mostrar el atajo en cada botón de la caja** (la teclita al lado: F2, F8…), no solo en la ayuda de F1.
3. **No bloquear la venta con la caja cerrada:** abrirla sola con la primera venta (con el fondo de caja de Ajustes) y avisar. Hoy es el primer obstáculo del que arranca.
4. **Montos rápidos con "los sueltos"** ($7.350 → $8.350 además de $8.000 y $10.000).
5. **"Cobro rápido"**: una tecla que cobra en efectivo justo, sin cliente ni vuelto.
6. **Comprobante por WhatsApp y QR** al terminar la venta (ya tenemos WhatsApp/mail: sumar el QR).
7. **"¿Qué vas a cargar?" con 4 caminos** en Productos vacío: a mano, planilla, escaneando, catálogo.
8. **Changelog visible** ("Lo nuevo en Genez"): muestra que el producto se mueve.

**Medio**
9. **Catálogo precargado**, pero **limpio**: el de SEPA/Open Food Facts que ya relevamos, con precios de referencia. Ellos lo tienen sucio; nosotros podemos tenerlo bien. Diferencial.
10. **Actualizar precios con la lista del proveedor** (Excel/PDF), columnas a elegir y vista previa: para la inflación.
11. **Saldo a favor (billetera) y límite de deuda** en cuenta corriente.
12. **Ajuste por dólar** para productos dolarizados.
13. **Promos que avisan si quedan por debajo del costo.**
14. **Calendario comercial** en Inicio (feriados, Día de la Madre, cobro de sueldos) con una sugerencia concreta.
15. **Pedido al proveedor como imagen para WhatsApp.**
16. **Mantenimiento del catálogo**: duplicados y recuperar eliminados.

**De estructura (lo que marcó Nehuen)**
- **Menú en grupos con rótulo** y un **área de Administración aparte** (Ajustes, Permisos, Equipo, Suscripción).
- **Instalar en el escritorio.**
- **Asistente siempre a mano** (botón fijo) que conteste con los datos, escriba textos de promoción y lleve a la ayuda; un chat abierto, con topes por plan, sería ir más allá que Vendi.
- **Más configuración**, ordenada por lo que hace el comercio.
- **Marketing**: changelog, embajadores, guía pública.

**Grande (decidir si va)**
17. Presentaciones de compra y venta suelta (bolsa de 20 kg por kilo).
18. Variantes (talle y color).
19. Catálogo público para compartir y tienda online.

## 8. Qué mejoraría de lo nuestro

- **Atajos a la vista** (punto 2) y **la venta en una sola pantalla** con casillas por medio cuando se combinan pagos: hoy el pago combinado es un paso aparte.
- **La caja** (punto 3): es lo más "enroscado" de Genez para el que empieza.
- **Prueba de 30 días** en vez de 10: Vendi da 30 sin tarjeta y es lo que compara el que elige.
- **Upsells sin cortar el camino:** Genez no lo hace; mantenerlo así.

## 9. Dónde Genez es más enroscado que Vendi

1. **Abrir la caja antes de vender** (Vendi no lo pide).
2. **Un solo precio + recargos por medio** en vez de efectivo/tarjeta a la vista.
3. **Pago combinado** como paso aparte (Vendi: casillas en la misma pantalla).
4. **Arrancar con productos:** sin catálogo, el comercio nuevo carga todo.
5. **El menú:** una lista sin grupos con lo de administración mezclado; Vendi separa Administración.
6. **Ajustes repartido en pestañas** técnicas (Cobros y facturas, Equipos…). Vendi también es largo, pero separa "Política de ventas" (cómo se vende) de "Configuración" (datos).

## 10. Dónde Genez ya es mejor (y hay que decirlo al vender)

1. **Sirve para más rubros**: un bar o un estudio no tienen nada en Vendi.
2. **La caja es más rápida**: búsqueda local instantánea, escáner global.
3. **Informes honestos y hondos**: puente de rentabilidad, quiebres de stock con venta perdida, "Mi reporte" hasta el ticket, por mail.
4. **Mercado Pago en vivo** con aviso de voz.
5. **Permisos completos en Pro** (en Vendi, PRO MAX).
6. **El onboarding**: recorrido guiado de corrido, venta en modo muestra, primeros pasos que se tildan solos.
7. **Sin relleno**: no mostramos puntajes inventados ni "próximamente" por todos lados.

---

## 11. Prueba a fondo (segunda vuelta, 07/10)

Se cargaron:
- 3 ventas: una en efectivo en la vista clásica, una con pago combinado en el modo rápido solo con teclado y un fiado a un cliente creado desde la caja;
- 1 egreso y 1 cierre manual con faltante;
- 2 consultas al asistente.

**Pendiente para Nehuen:** la caja de Vendi quedó en cierre **manual**. Para volverla a automático: Caja → (con una caja abierta) Configurar → Programado. La configuración solo aparece con una caja abierta.

### Lo que anda muy bien

1. **El modo rápido con teclado es lo mejor que vimos para el mostrador**:
   - Alt Q / Alt W agregan los más vendidos;
   - Alt 1 ya trae el total en efectivo;
   - con Alt 2 y "+", la transferencia se lleva lo que falta;
   - F8 registra.

   Una venta con pago combinado sin tocar el mouse, en segundos.
2. **"Productos más vendidos" con atajo propio** debajo del carrito.
3. **El cliente nuevo se crea en el mismo buscador de la caja** ("+ Crear cliente …"), sin ventanas nuevas.
4. **La caja se abre sola con la primera venta** y los números cierran: efectivo y transferencia por separado, y el fiado no entra a la caja.
5. **Configuración de la caja muy completa**:
   - cierre **programado** (a la hora que elijas) o **manual**;
   - una caja **compartida** o **una por cajero** (para controlar faltantes por persona);
   - **cuándo se reinicia el saldo de cada medio** (por turno, por día o nunca).
6. **El cierre muestra los fiados del turno aparte** ("crédito entregado, no ingresó a la caja") y la utilidad. Deja **reabrir la última caja**.
7. **Control de caja** con vendido, ticket promedio, egresos, cuadre, ganancia y "**resultado del día: ganancia menos egresos**". El turno se nombra solo ("Noche").
8. **El asistente con IA contesta con los datos reales**: "Hoy vendiste $17.000, margen $4.668… el que más deja es la yerba, 35 %… te debe Cliente Prueba Vendi $3.150". Escribe textos de promoción y debajo sugiere los artículos de ayuda que corresponden.
9. **Promociones por plantilla con un ejemplo concreto en cada una** (10 en total), cada una con una etiqueta que dice si aparece online:
   - 2x1 / 3x2, % off, happy hour, precio especial;
   - combo automático en caja o combo como producto;
   - pack por categoría, elegí N de una lista, descuento por cantidad;
   - una opción avanzada guiada en 3 pasos.
10. **El comprobante** se elige al cobrar (sin ticket, ticket, WhatsApp o QR) y se configura en el momento (ticket o A4, 80 o 58 mm, impresión ESC/POS).

### Lo que anda mal (lo vimos)

1. **El cierre de caja suma lo que escribís al valor que ya tenía el campo.** El campo "real" muestra 0,00 pero tiene cargado el teórico. Al hacer clic y escribir 9960, el total real pasó a **$109.963.350** y la diferencia a casi $110 millones. Es el mismo error del precio sugerido en el catálogo.
2. **"Cobrar sin vuelto" aparece donde estaba "Cobrar".** Al elegir un monto rápido, los botones se reacomodan, y el lugar del botón principal pasa a "Cobrar $10.000 sin vuelto", que registra la venta por $10.000 en vez de $8.500. Un cajero apurado lo toca.
3. **El cierre no pide motivo de la diferencia** (Ventario sí) y, si no contás, toma lo teórico como real: la diferencia da $0 sin haber contado nada.
4. **La caja abierta aparece en "Últimas cajas cerradas"**, y el efectivo inicial se puede editar después con un lápiz.
5. **"Ventas de hoy · Total cobrado hoy: $17.000" incluye el fiado**, que no se cobró (lo cobrado fue $13.850).
6. **Un pago combinado aparece como dos ventas** en los movimientos de la caja.
7. **Al elegir cuenta corriente, la casilla de efectivo sigue mostrando el total**: no se entiende qué se va a registrar hasta ver el ticket.
8. **El cobro clásico pide dos confirmaciones** (cobrar el efectivo y después "Registrar venta").
9. **El asistente no es un chat abierto**: escribe la promo, pero a "qué es la inflación" responde "no tengo información" y deriva a soporte. También se equivocó al llamar "efectivo" a lo que incluía transferencias, y usa formato inglés ($17,000).
10. **Asistente IA de promociones solo en Pro Max.**
11. **El cartel de bienvenida de Caja reaparece** después de "¡Entendido!".
12. **El ticket lleva la firma de Vendi** ("VendiApp – Tu negocio, simplificado") y pide subir el logo cada vez.
13. **La pantalla se traba**: varias veces el navegador no pudo ni sacar una captura con una ventana abierta.

### Qué cambia en las conclusiones

- **Lo que más hay que copiar de Vendi es el modo rápido con teclado** (Alt para medios, "+" para completar, atajos para los más vendidos) y la **configuración de la caja** (programada o manual, compartida o por cajero).
- **El asistente vale por estar siempre a mano y contestar con los datos**, no por ser abierto. Genez ya tiene la base (asistente con los datos): falta el botón fijo, que proponga textos y que lleve a la ayuda.
- **Sus errores están en los números del cierre**: justo donde un comercio no perdona. La caja de Genez tiene que ser a prueba de esto (campos que se reemplazan al escribir, botones que no cambian de lugar, motivo obligatorio para la diferencia).
