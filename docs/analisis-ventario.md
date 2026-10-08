# Ventario: análisis completo y comparativa con Vendi y Genez

Relevado el 07/10/2026 en una cuenta de prueba de Ventario (7 días de prueba), en dos vueltas. La primera recorrió cada sección, la configuración, el centro de ayuda y los planes sin guardar nada. La segunda, con permiso de Nehuen para usarlo de punta a punta, **cargó datos y operó**. Hizo productos, ventas, un fiado, un gasto, el cierre de caja, una compra a proveedor, tesorería, un pedido por la tienda online y reportes. Lo que salió de esa prueba está en la sección 11, y corrige algunas cosas de las primeras secciones.

**Lo que no probé:** crear un vendedor (pide definirle una contraseña, es crear una cuenta), configurar el PIN de administrador (es una credencial) y la integración con MercadoLibre.

---

## 1. Qué es Ventario

- **Producto:** POS + stock + **tienda online** para comercio minorista. Igual que Vendi, solo retail: ni gastronomía ni servicios.
- **Promesa:** "Potenciá tu Tienda Online". Lo venden como "POS, stock y tienda online para tu negocio": **la tienda online es el centro del discurso**, no un agregado.
- **Prueba:** 7 días.
- **Planes:**

| Plan | Mensual | Qué trae |
|---|---|---|
| Pro | $29.560 | 700 productos, 3 vendedores, MercadoLibre, tesorería, funciona sin internet, fiados, mayoristas, 2 "cruces"/mes, soporte por WhatsApp |
| Full | $66.500 | 10.000 productos, 5 vendedores, IA para facturas de compra, AFIP/ARCA, más de 60 permisos, onboarding 1 a 1, soporte 24/7 |

  Trimestral −15 %, anual −30 %. **Limita por cantidad de productos y de vendedores** (Genez y Vendi no).

---

## 2. Estructura: dos mundos separados

Ventario separa **la caja** del **panel de administración**, y es lo más interesante que tiene:

- **El Punto de Venta (`/overlay`) es una pantalla completa aparte**, sin menú lateral. Arriba, una fila de botones de color **solo con ícono** (el nombre aparece al pasar el mouse) y algunos con su atajo:
  - Gasto (F7), Pago a proveedor, Ingreso/retiro;
  - Ver deudores (F8), Informe y cierre de caja (F4), Historial (F6);
  - Dashboard (vuelve al panel).
- **El panel de administración** tiene menú lateral **agrupado por tema y con rótulos**:
  - arriba: selector de negocio, botón grande **"Punto de Venta"**, "Primeros pasos (0 de 2 esenciales)";
  - **Productos:** Inventario, Promociones y Combos, Compras, Control de Stock, Auditoría de Stock;
  - **Caja & Tesorería:** Control de Caja, Cuentas Corrientes, Tesorería;
  - **Tienda Online:** Configuración, Catálogo, Pedidos, Cupones;
  - **sueltos:** Clientes, Mi Equipo, Proveedores, Gastos, Historial, Reportes, Resumen Fiscal (Full), Presupuestos, MercadoLibre;
  - abajo: tarjeta de la prueba; en el encabezado, **"Configuración 0 %"**, una barra de qué tan completo está el negocio.
- **Configuración ("Centro de ajustes") va aparte**, no en el menú: Datos del negocio, Referidos, Punto de venta, Facturación ARCA, Contraseña, API y conexiones.

El cajero vive en la pantalla de venta y no ve el panel; el dueño vive en el panel y entra a la caja con un botón. **Es la separación que Genez no tiene.**

## 3. Visual

- **Claro**, fondo gris muy suave, tarjetas blancas, esquinas bien redondeadas, tipografía geométrica.
- **Mucho color en el POS**: cada botón de arriba es de un color distinto (gris, violeta, verde, azul, morado, negro). Se distinguen de un vistazo, pero es más ruidoso que Genez.
- Ilustraciones 3D en "Primeros pasos" y en los estados vacíos ("Todavía no tenés productos → Cargar producto").
- Avisos tipo *toast* arriba a la derecha ("Prueba agregado al carrito", "Abrir caja primero").

---

## 4. Sección por sección

### Punto de venta
- **Carrito a la izquierda**, catálogo con buscador a la derecha ("Buscar por nombre o código · Enter para agregar"), filtro por categoría y botón de refrescar.
- Arriba del carrito:
  - **"SCANNER ON"**: indicador de que el lector está escuchando;
  - **Limpiar**;
  - **Rápida (F1)**: venta de un ítem que no está cargado ("¿Qué vendiste?", precio, cantidad, con el total a agregar);
  - **Poner en espera**: estaciona la venta para atender a otro cliente.
- Abajo: ítems/cantidad, subtotal, **Total** grande en azul, **Descuento** y **Recargo**, "Confirmar venta (F8)".
- **Deja armar el carrito con la caja cerrada** (con el aviso "Sin caja activa · Abrir caja"), pero **no deja cobrar** sin abrirla. La apertura pide "¿Cuánto efectivo tenés para empezar?" y, opcional, una **transferencia inicial** ("se guarda para auditoría de la caja digital del turno").
- **Conflicto de atajos:** F8 es "Confirmar venta" en el carrito y "Ver deudores" en la barra de arriba.
- Tour de 9 pasos (driver.js) la primera vez.

### Dashboard
Indicadores del día, **análisis financiero** (ganancia bruta y neta, egresos), cuentas corrientes, caja del turno, **deuda con proveedores**, stock bajo y últimos movimientos. Es una foto del negocio en una pantalla.

### Inventario (Productos | Organización)
- Alta en un **panel lateral** (no una página):
  - nombre, código, **categoría obligatoria**, subcategoría, marca (Full), proveedor;
  - dónde se vende: tienda online / en el local;
  - **costo, margen y precio de venta** (calcula uno con los otros dos), unidad (unidad, kg o litro; Full), IVA, precio mayorista;
  - 3 imágenes, **variantes** (talle, color), cantidad, stock mínimo;
  - **hasta 10 códigos alternativos** por producto.
- "Organización" maneja categorías y subcategorías.
- Catálogo con **destacados** y **catálogo en PDF** para mandar.

### Promociones y Combos, Compras
Combos y promos aparte; compras a proveedores.

### Control de Stock
Ingresos y egresos manuales **con motivo**.

### Auditoría de Stock
**Conteo físico en 4 pasos con Excel**: bajás la planilla, contás, la subís, revisás las diferencias y aplicás.

### Control de Caja
**Cajas abiertas en tiempo real, por vendedor**, y cierres consolidados. Pensado para el dueño que no está en el local.

### Cuentas Corrientes
Saldos por cliente, **cuotas vencidas**.

### Tesorería (lo más original)
- **Fondo operativo** (la plata del negocio) y **fondo virtual** (bancos y billeteras).
- **Cheques en cartera.**
- **"Mi plata personal":** registra lo que el dueño saca para él, separado de los gastos del negocio.
- Protegida con **PIN**.

Es la respuesta a la pregunta que todo dueño de comercio chico se hace: "¿cuánta plata tengo, dónde está y cuánta me llevé yo?".

### Tienda Online
- URL propia con *slug*.
- Horarios: un turno, dos turnos o 24 h.
- Compra mínima, medios de pago, **a qué cuenta va el cobro**.
- Catálogo (hasta 500 productos), destacados.
- **Pedidos en tablero kanban:** por confirmar → en cola → en preparación → para entregar.
- Cupones.

### Clientes
Categorías **mayorista, distribuidor, franquicia**; no deja duplicar por teléfono o mail.

### Mi Equipo
Vendedores, hasta 3 en Pro.

### Proveedores y Gastos
- **Proveedores:** con saldo deudor o a favor.
- **Gastos:** fijos y variables.

### Historial
Resumen, ventas, pedidos, presupuestos y devoluciones, con **desglose por medio de pago**.

### Reportes (12, cada uno una tarjeta)
1. Ventas por vendedor.
2. Rentabilidad.
3. Por categoría.
4. **Rotación ABC.**
5. Turnos.
6. **Reposición.**
7. Stock actual.
8. Stock bajo.
9. Movimientos.
10. **Valorización.**
11. **Pérdidas.**
12. Devoluciones.

### Resumen Fiscal (Full)
Libro IVA ventas y compras.

### MercadoLibre
Integración para sincronizar publicaciones y stock.

### Configuración → Punto de venta
**La configuración más completa de los tres**, ordenada en categorías con buscador:

- **Operación diaria:**
  - fiados, devoluciones, gastos y movimientos desde la caja;
  - apertura con transferencia, pago a proveedor desde la caja;
  - presupuestos en PDF, venta rápida, pedir el cliente en la venta.
- **Precios y reglas:**
  - **stock negativo sí/no**, ocultar el stock en la caja, mostrar el código;
  - precio mayorista (Full) y **mayorista automático por cantidad**;
  - **validar el efectivo**, **redondeo** (hacia arriba o abajo, a $100);
  - **costo promedio ponderado o último costo**, descuento sugerido;
  - recargo obligatorio por medio.
- **Equipos y tickets:**
  - escáner, **formato de balanza**;
  - impresión: modo, **APK para Android**, impresión aislada; tamaño de la térmica;
  - **qué medios aparecen en la caja** (efectivo, transferencia, Mercado Pago, QR, débito, crédito).
- **Seguridad y avisos:**
  - **cierre ciego con PIN** (el cajero cuenta sin ver lo esperado);
  - alertas de stock bajo, ventas altas, plan por vencer, sin stock y ventas bajas.
- **"Instalar App"** en el escritorio.

### Configuración → Datos del negocio
Con un **indicador de completitud** ("50 %") que te dice qué falta.

### Configuración → API y conexiones
- **Conector MCP** (`ventario.com.ar/mcp`) para usar el negocio desde **ChatGPT o Claude**.
- Claves de API y especificación OpenAPI para GPT Actions; 5.000 consultas por día.
- En esta cuenta, desactivado. **Ninguno de los otros dos lo tiene.**

### Referidos
Programa de referidos (como el Embajador de Vendi).

### Ayuda
- Botón de **Centro de Ayuda**, que abre un panel con:
  - **"Tour de esta sección"**;
  - **7 tours** (Dashboard, POS, Inventario, Configuración, Mi Equipo, Tienda Online, Tesorería);
  - preguntas frecuentes;
  - soporte por WhatsApp.
- **"Primeros pasos"** en el menú con lo esencial ("0 de 2").

---

## 5. Lo que hace mal (lo vimos)

1. **La categoría del primer producto es una trampa.** Es obligatoria y el comercio nuevo no tiene ninguna. Escribirla en el campo sí la crea, pero solo si apretás Enter, y no hay ningún "+ Crear" que lo indique. Si no apretás Enter, "Crear producto" no hace nada y no avisa por qué. Así quedó una categoría "Beb" al lado de "Bebidas". (En la primera vuelta concluí que no se podía crear; con la prueba a fondo se ve que sí, pero sin ninguna pista.)
2. **F8 hace dos cosas** (confirmar venta y ver deudores).
3. **Un tour aparece donde no corresponde:** el de Tesorería se abrió estando en Configuración.
4. **El modal de planes no se cierra con Esc.**
5. **Límites que duelen:** 700 productos en Pro alcanzan para un kiosco, no para un minimercado (Super 25 tiene muchos más). 3 vendedores.
6. **Prueba corta:** 7 días.
7. **Lo fiscal (ARCA, libro IVA) y la marca del producto, solo en Full** ($66.500).
8. **POS muy colorido:** se distinguen los botones, pero es más ruido que información.
9. **Cerrar el panel de un producto a medio cargar no avisa** que se pierde lo escrito.

---

## 6. Comparativa de los tres

| Tema | Vendi | Ventario | Genez |
|---|---|---|---|
| Rubros | Retail | Retail | **Retail, gastronomía y servicios** |
| Separación caja / administración | Grupo "Administración" (Panel Admin, Suscripción, Configuración) | **POS en pantalla completa aparte + panel + centro de ajustes** | **Todo en un menú**: Ajustes, Permisos y Equipo mezclados con Productos |
| Menú lateral | 20 secciones en 5 grupos con rótulo | **Grupos por tema con rótulo** (Productos, Caja & Tesorería, Tienda Online) | **14 módulos en una lista sin grupos** (minimercado) |
| Configuración | Panel Admin + Política de ventas + Configuración | **Centro de ajustes por categorías con buscador, decenas de opciones** | Ajustes en pestañas técnicas |
| Instalar en el escritorio | Sí | Sí | **No** (solo la app del cliente) |
| Chat con IA | Asistente con datos del negocio y textos de marketing; **no** responde preguntas generales (ver la prueba en `analisis-vendi.md`) | **Conector MCP para ChatGPT/Claude** | Asistente con los datos del negocio, acotado |
| Página web / marketing | **Muy completa**, embajadores, changelog | Landing centrada en la tienda online, referidos | Landing nueva (04/10) |
| Tienda online | Sí, PRO MAX | **El centro del producto**, pedidos en kanban | No (gastronomía tiene pedidos por canal) |
| MercadoLibre | No | **Sí** | No |
| App para consumidores | **Vendi App** (red de comercios) | No | App del cliente (turnos, servicios) |
| Caja cerrada | Se abre sola | Deja armar, no cobrar | Hay que abrirla (salvo el modo muestra del recorrido) |
| Venta en espera | — | **Sí** | No |
| Venta de algo no cargado | F3 | **F1 "Rápida"** | Precio abierto |
| Atajos | Modo teclado con leyenda, Alt 1–9 configurables | Tecla al lado de cada botón | F1–F10 y 1–6, sin mostrarlos en los botones |
| Tesorería / plata del dueño | — | **Fondos, cheques, "mi plata personal"** | Caja grande con "Retiro del dueño" como tipo de movimiento; sin cheques |
| Cierre ciego | — | **Sí, con PIN** | Arqueo con lo esperado a la vista |
| Conteo físico | Auditar stock | **4 pasos con Excel** | Conteo en Stock |
| Costo promedio ponderado | — | **Elegible** | **Elegible** (también "ppp" en Compras) |
| Redondeo del total | — | **Sí** | No |
| Varios códigos por producto | — | **Hasta 10** | Uno (más el PLU de balanza) |
| Variantes | Talle y color | Talle y color | No |
| Reportes | Hubs, puntaje, ranking con relleno | **12 tarjetas claras**, ABC, valorización, pérdidas | **Más hondo**: puente de rentabilidad, quiebres, "Mi reporte", por mail |
| Mercado Pago en vivo | No | Medio en la caja | **Aviso del cobro con voz** |
| Permisos | Roles en PRO MAX | 60+ permisos en Full | **Roles, personas y excepciones en Pro** |
| Onboarding | Cartel por pantalla, guía HTML | Tour por sección, 7 tours, primeros pasos | **Recorrido general de corrido con Enter, venta en modo muestra, tour por pantalla** |
| Límite de productos | Sin límite | **700 en Pro** | Sin límite |
| Prueba | **30 días** | 7 días | 10 días |
| Precio de entrada | $29.900 | $29.560 | $29.900 |

---

## 7. Lo que hacen mejor que Genez (sin vueltas)

1. **Separan el trabajo del mostrador del de administración.** En Ventario el cajero vive en el POS a pantalla completa; el dueño, en el panel; la configuración, en un centro aparte. En Vendi, "Administración" es un grupo propio con Panel Admin, Suscripción y Configuración. En Genez, Ajustes, Permisos, Equipo y la suscripción están en la misma lista que Productos y Caja.
2. **Menú con grupos rotulados.** Los dos agrupan por tema; Genez tiene la capacidad (el menú es dato y acepta grupos) pero el rubro minimercado está cargado como un solo grupo sin rótulo.
3. **Más configuración, mejor ordenada.** Ventario: categorías ("Operación diaria", "Precios y reglas", "Equipos y tickets", "Seguridad y avisos") con buscador, y en cada opción una línea que explica qué hace.
4. **Instalación en el escritorio.** Los dos la ofrecen; Genez no (el sistema de gestión no tiene manifest ni service worker).
5. **IA.** El asistente de Vendi contesta con los datos reales del negocio (cuánto vendí, qué deja más margen, quién debe), escribe textos de promoción y sugiere los artículos de ayuda que corresponden. No es un chat abierto: ante una pregunta general deriva a soporte. Ventario se conecta a ChatGPT y Claude por MCP.
6. **Marketing y canales.** Vendi: página muy completa, embajadores, changelog público, app de consumidores. Ventario: tienda online con kanban de pedidos y MercadoLibre.
7. **Tesorería y "mi plata personal"** (Ventario).
8. **Cierre ciego con PIN** (Ventario).
9. **Indicadores de completitud** (Ventario: "Configuración 0 %", "Datos del negocio 50 %").
10. **El atajo al lado de cada botón** (los dos).

---

## 8. Qué copiaría (ordenado por impacto y esfuerzo)

**Rápido**
1. **Menú agrupado y con rótulo** en los tres rubros. Para minimercado, por ejemplo:
   - *Vender:* Cobrar, Caja, Pedidos, Presupuestos;
   - *Mercadería:* Productos, Stock, Compras;
   - *Clientes:* Clientes, Cuenta corriente;
   - *Números:* Inicio, Informes, Asistente.

   Es un cambio de datos en la base, no de código.
2. **Un área de "Administración" aparte**: Ajustes, Permisos, Equipo y la suscripción salen del menú de trabajo y van a un lugar propio (un grupo al pie o un ícono de engranaje), como Vendi y Ventario.
3. **El atajo a la vista en cada botón de la caja** (F8, F2…).
4. **Instalar en el escritorio** (manifest + service worker mínimo para el sistema de gestión, como ya tiene la app del cliente).
5. **"Poner en espera"** en la caja: estacionar una venta para atender al de atrás (hoy no existe).

**Medio**
6. **Ajustes reordenados por lo que hace el comercio** (operación diaria, precios y reglas, equipos y tickets, seguridad), con un buscador y una línea de explicación por opción.
7. **Cierre ciego** como opción de la caja.
8. **Redondeo del total** (a $10 o $100). (El costo promedio ponderado Genez ya lo tiene.)
9. **Varios códigos por producto.**
10. **Indicador de completitud** del negocio en Inicio, atado a los Primeros pasos que ya tenemos.
11. **"Mi plata personal" más a la vista:** Genez ya registra el retiro del dueño en la caja grande; falta mostrarlo como un saldo propio.

**Grande (decidir)**
12. **Chat abierto** en el asistente, con topes de uso por plan (ya está en "Salir a vender": asistente mixto con topes).
13. **Conector MCP** para que el dueño consulte su negocio desde Claude o ChatGPT.
14. **Tienda online / catálogo compartible** y **MercadoLibre**.
15. **Variantes** (talle y color), si entra un comercio de ropa.

---

## 9. Dónde Genez es más enroscado

1. **El menú:** una lista larga sin grupos, con lo de administración mezclado con lo de todos los días.
2. **Abrir la caja antes de vender** (Vendi no lo pide; Ventario al menos deja armar el carrito).
3. **Ajustes** en pestañas pensadas desde el sistema (Cobros y facturas, Equipos…) y no desde lo que el comercio quiere hacer.
4. **Pago combinado** como paso aparte.
5. **Un solo precio + recargos** en vez de efectivo/tarjeta a la vista (Vendi).

## 10. Dónde Genez es mejor

1. **Tres rubros**: un bar o un estudio no tienen nada en los otros dos.
2. **Arrancar sin trabas:** nada obligatorio para crear un producto (en Ventario, la categoría obligatoria sin pista de cómo crearla).
3. **Sin límite de productos** (Ventario: 700) y **permisos completos en Pro** (en los otros, en el plan caro).
4. **Informes más hondos y honestos.**
5. **Mercado Pago en vivo con voz.**
6. **El onboarding más guiado de los tres.**
7. **La caja más rápida:** búsqueda local, escáner global.

---

## 11. Prueba a fondo (segunda vuelta, 07/10)

Datos cargados para la prueba:
- 2 productos (Coca Cola 2,25 L y Lavandina Ayudin 1 L) y 3 categorías (una duplicada sin querer);
- 2 ventas, una de ellas anulada;
- 1 cliente con límite de fiado;
- 1 gasto y 1 cierre de caja con faltante;
- 1 proveedor y 1 compra a deber;
- 1 pedido por la tienda online, de punta a punta.

La tienda quedó **pausada** otra vez.

### Lo que anda muy bien (copiable)

1. **Apertura de caja con transferencia inicial** además del efectivo ("se guarda para auditoría de la caja digital del turno").
2. **Pagos múltiples con botones "Restante" y "Mitad"**. En la transferencia pide titular o alias, opcional, "para conciliar con el banco".
3. **Ventas en espera**: una lista desplegable arriba del carrito; se recupera con un clic.
4. **El límite de fiado se respeta**: el cliente que lo superaría aparece en rojo, "Sin cupo", y no se puede elegir. Al crear el cliente se carga un **"saldo anterior"** (lo que ya debía antes del sistema).
5. **Cierre de caja muy completo**:
   - separa "efectivo a retirar" de "dinero para el siguiente turno";
   - tiene contador de billetes (incluye el de $20.000);
   - pide declarar tarjetas, Mercado Pago y transferencias;
   - muestra la diferencia **por medio**;
   - si hay diferencia, **el motivo es obligatorio** y se elige con botones (error de medio de pago, retiro no registrado, comprobante pendiente, error de conteo);
   - lo retirado pasa solo a Tesorería (efectivo al fondo operativo, transferencias al virtual).
6. **Compras**:
   - una sola pantalla en 3 pasos, con el método de costeo a la vista ("promedio ponderado", y lo calculó bien: 3 a $900 + 12 a $950 = $940);
   - el proveedor nuevo se crea desde el campo, con un "+ Crear" explícito;
   - al subir el costo avisa en el mismo renglón "**Real: 53,2 %**" y ofrece "**Mantener 60 %**", que recalcula el precio;
   - el pago puede ser pagada, parcial o a deber, y elegís de qué fondo sale; a deber muestra cómo queda la cuenta ("Debe $11.400").
7. **Modo edición avanzada en Compras**: la compra se vuelve una planilla donde también se cambian precios y márgenes y se crean productos nuevos.
8. **Pago a proveedor que explica antes de elegir**: pagar deuda (de la compra más vieja a la más nueva), registrar una factura de insumos o un pago informativo.
9. **Tienda online de punta a punta**:
   - catálogo con selección múltiple y "Publicar";
   - el cliente pide con nombre y celular;
   - el pedido llega al tablero con la etiqueta "Cliente nuevo" y una notificación;
   - pasa por confirmar → en cola → preparación → para entregar → historial;
   - descuenta stock al confirmar;
   - QR de la tienda para imprimir;
   - al pie, "Creá tu tienda gratis": cada tienda les trae comercios nuevos.
10. **Después de la primera venta**: "Primer resultado alcanzado · Conservar PRO", aclarando que pagar ahora no hace perder los días de prueba. Buena jugada de conversión.
11. **Anular una venta devuelve el stock** y pide motivo.
12. **Avisos contextuales**: al abrir ingresos y retiros aparece "Protegé tu caja con PIN Admin"; al entrar al POS, cómo ajustar el ancho de la térmica.

### Lo que anda mal (lo vimos)

**Números que no cierran**
1. **El descuento se guarda como un producto.** "Descuento 10 %" aparece:
   - entre los más vendidos del Dashboard;
   - y en el reporte de Reposición como **lo más urgente para reponer** ("vendiste 1, te quedan 0").
2. **La transferencia se cuenta como "tarjeta"** en el resumen del historial ("17 % con tarjeta").
3. **El Dashboard sigue diciendo "Turno abierto"** con la caja cerrada.
4. **El resumen del cierre dice "3 ventas"** cuando hubo 2.
5. **El gasto quedó como "Otro"** aunque el formulario mostraba "Mantenimiento" elegido.
6. **El precio recalculado en la compra usa el último costo ($950) y no el promedio ($940)** que el mismo sistema guarda.
7. **El indicador "Configuración" dice 50 % en unas pantallas y 0 % en otras.**
8. **Formato inglés en algunos montos** ("$2,000", "$3,000").
9. **Anular una venta después del cierre no mueve la Tesorería**, y los $2.900 que quedaron para el siguiente turno no figuran en ningún lado hasta que se abre otra caja.

**Fricción**
10. **El buscador del POS no se limpia** después de una búsqueda por nombre: el siguiente escaneo se pega al texto ("lavand7790895000997" → no encontrado). Con un lector físico pasa lo mismo.
11. **Enter con un solo resultado no lo agrega** (avisa "código no encontrado") y las flechas no eligen resultados: hay que usar el mouse.
12. **Cuatro ventanas apiladas para fiar a un cliente nuevo** (cobro → cuenta corriente → agregar → nuevo cliente). Al crearlo se cierran todas y hay que empezar el cobro de nuevo.
13. **Funciones que fallan en silencio o dependen de algo que no se ve**:
    - el retiro de caja exige un PIN de administrador, y lo dice recién después de completar el formulario;
    - "Retirar" en Tesorería queda deshabilitado sin explicar por qué;
    - el pago a proveedor no se registra y no avisa nada (con la caja cerrada y sin la opción "pago a proveedor desde fondo" prendida).
14. **Confirmar un pedido online obliga a decir cómo se cobró**, aunque sea retiro en el local y todavía no pagó.
15. **El cobro no muestra montos rápidos** y la pantalla final no repite el vuelto.
16. **El ticket de un pago mixto dice "MIXTO"** sin el detalle de cada medio.
17. **El mensaje de WhatsApp del pedido lleva un emoji roto** ("�").
18. **Los reportes llevan etiquetas en inglés** (SALES, FINANCIAL, INVENTORY), y tres son del plan Full (valorización, pérdidas, devoluciones).
19. **La tienda nueva no publica nada**: hay que ir al catálogo y publicar a mano (y dice "0 productos0").

### Qué cambia en las conclusiones

- La **caja y la tesorería de Ventario son lo más completo de los tres**: cierre por medio con motivo obligatorio, fondos, lo retirado que pasa solo a tesorería. Pero varias piezas dependen de un PIN o de una opción en Configuración, y si no las prendiste fallan en silencio.
- La **compra con "Real 53 % · Mantener 60 %"** es el mejor detalle de los tres para un comercio con inflación: hay que copiarlo.
- Sus **reportes tienen errores de datos** (el descuento como producto) que en un comercio real dan recomendaciones falsas. Genez no puede permitirse eso: es nuestra ventaja si la cuidamos.
