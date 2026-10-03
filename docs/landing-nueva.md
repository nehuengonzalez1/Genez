# Landing nueva y autoservicio

Especificación para aprobar antes de construir (03/10/2026). Reemplaza al alta en
pasos (`src/landing/Stepper.jsx`) por una sola pantalla: qué hace el sistema, los
precios y un registro con el que el comercio entra a probar solo.

Las maquetas son las 11 secciones que pasó Nehuen el 03/10, en claro y en oscuro.
Las imágenes se recortan de ellas, como en la landing actual.

---

## 1. Lo que no se cambia

- Los links con `?rubro=…&negocio=…` siguen preseleccionando rubro y negocio
  (ahora en el registro, no en el alta).
- Los rubros y los negocios salen de la base (`rubros_publicos`); los precios, de
  `tarifas` (`tarifas_publicas`) con `planes()` y `presupuestar()`.
- Modo claro y oscuro con el mismo botón.
- "Entrar" lleva a `/login`.
- El panel de Precios sigue siendo el único lugar donde se cambian los precios.

## 2. Las 11 secciones

Cada una cuenta algo distinto; nada se repite entre secciones.

| # | Sección (maqueta) | Contenido | Botones |
|---|---|---|---|
| 1 | Inicio | "Un sistema que se adapta a vos." La pantalla del sistema con un nombre genérico (no "Nehuen") y productos sin marcas | "Armar mi sistema" baja al registro; "Conocer Genez" baja a la sección 2 |
| 2 | Vender es una parte | Operar · Controlar · Ganar · Decidir | — |
| 3 | Tu forma de trabajar | Filtros Todos / Comercio / Gastronomía / Servicios y los negocios con lo que les resolvemos (tabla de abajo). Indumentaria y Ecommerce con sello "Próximamente", sin botón | Cada negocio baja al registro con ese negocio elegido |
| 4 | Costos + rentabilidad | Recetas, costo por insumo, margen por producto, precio sugerido | — |
| 5 | **Genez IA** (en la maqueta, "Intelligence") | El asistente y las alertas | "Preguntarle a Genez" baja al registro |
| 6 | No termina en el mostrador | Lo que conecta hacia afuera: app del cliente, carta QR en la mesa, avisos por WhatsApp, Mercado Pago, factura electrónica, vende sin internet | Sin botón a otra pantalla |
| 7 | Solo los módulos que necesitás | Grilla con los módulos reales | "Conocé todos los módulos" despliega el resto ahí mismo |
| 8 | Cómo funciona | Creá tu cuenta → Elegí tu rubro y plan → Empezá a vender. "10 días gratis, sin tarjeta". Se mantiene "Después te acompañamos" | — |
| 9 | Precios | Ver punto 4 | "Empezar con Start/Pro" baja al registro con el plan elegido; "Hablar con un asesor" abre WhatsApp |
| 10 | **Hacemos más** (nueva, sin maqueta) | Automatizaciones, app para tus clientes, página web; opciones para tildar | La consulta queda en el panel y abre WhatsApp |
| 11 | Preguntas | Las de la maqueta, con respuestas reales; "¿Cuánto cuesta?" sale de las tarifas | — |
| 12 | Registro | Ver punto 5 | — |

"Hacemos más" se diseña con el estilo de las demás. En el menú superior,
"Intelligence" pasa a "Genez IA".

### Lo que le resolvemos a cada negocio (sección 3)

| Negocio | Soluciones |
|---|---|
| Kiosco | Venta rápida · caja y cierres · stock · fiado |
| Almacén | Fiado · stock · caja · compras |
| Minimercado | Cobro con lector · stock y vencimientos · remitos por foto · varias cajas |
| Dietética | Vencimientos · lista del proveedor · margen |
| Verdulería | Precios del día · caja · compras |
| Panadería | Recetas y producción · costo por receta · pedidos |
| Ferretería | Catálogo grande · lista del proveedor con precio sugerido · presupuestos · cuenta corriente |
| Casa de sanitarios | Presupuestos · cuenta corriente · factura A y B |
| Bar / Cervecería | Mesas · comandas a la barra · promociones · cierre de caja |
| Café | Mostrador rápido · carta QR · comandas |
| Restaurante | Plano de mesas · comandas a cocina · reservas · costo por receta |
| Rotisería / Take away | Centro de pedidos y delivery · recetas · cobro rápido |
| Estética / Peluquería / Barbería | Turnos · recordatorios por WhatsApp · comisiones · app del cliente |
| Pilates / Gimnasio | Clases con cupo · abonos y packs · asistencia · reservas desde el celular |
| Consultorio / Spa | Turnos por profesional o sala · recordatorios · factura |

"Venta por peso" queda afuera hasta verificar que el sistema la resuelva.

## 3. Lo que no se promete

- Indumentaria (variantes, talles), Ecommerce (tienda online, envíos) y
  multisucursal: "Próximamente". Son los pendientes prioritarios.
- Pedidos por WhatsApp: lo que existe son avisos y recordatorios.
- "Filtros por sucursal", "sucursal sin conexión", "reportes avanzados",
  "configuración avanzada": no van.
- Sin "+ IVA", sin trimestral, sin "Valores de referencia para este prototipo".
- Sin "Super 25" ni marcas reales en los ejemplos.

## 4. Precios

- Pestañas por rubro (Comercio / Gastronomía / Servicios).
- Durante el lanzamiento, **solo mensual**: lista tachada y 50% los primeros 6
  meses. Semestral (−20%) y anual (2 meses gratis) se habilitan sobre la lista
  cuando termine el lanzamiento; quedan cargables en `tarifas` desde el panel.
- Start muestra sus módulos; Pro dice "Todo Start, más:" y Empresa "Todo Pro,
  más:". Salen de `planes()`, así que cambian solos con los módulos del rubro.
- "A medida" sigue: tildás módulos y el precio se actualiza ahí mismo.

Cambios en los rubros, en la base (migración nueva):

| Rubro | Start | Pro agrega | Empresa agrega |
|---|---|---|---|
| Comercio | Cobro, Caja, Ajustes, Productos, Informes | Stock, Compras, Pedidos, Clientes, Cuenta corriente | Equipo, **Permisos**, Asistente IA, soporte prioritario |
| Gastronomía | Cobro, Caja, Ajustes, Productos, Informes | Salón, Stock, Compras, Clientes, Cuenta corriente | Equipo, Asistente IA, soporte prioritario |
| Servicios | Cobro, Caja, Ajustes, Servicios, Agenda, Informes | Clientes, **Abonos, Avisos** | Equipo, Finanzas, Seguimiento, Permisos, soporte prioritario |

Permisos no está en el menú de Comercio: hay que sumarlo al `menu` del rubro,
no solo a `modulos`. Con la lista actual, Comercio Empresa pasa a $172.000
($86.000 en el lanzamiento) y Servicios Pro a $132.000 ($66.000).

## 5. Registro (sección 12)

Dos pasos en la misma tarjeta, más la confirmación:

1. **Tu comercio**: nombre (ejemplo genérico), rubro y negocio, cantidad de
   sucursales, provincia, principal problema (obligatorio, hasta 500).
2. **Tus datos**: nombre, email, WhatsApp, contraseña, plan (viene elegido si
   tocó un plan), aceptación de términos y privacidad.
3. **Confirmación**: "Te mandamos un mail. Confirmalo y entrás".

## 6. Autoservicio

**Alta.** `supabase.auth.signUp` con confirmación por mail. Al confirmar y
entrar por primera vez sin comercio, una función de la base
(`crear_comercio_de_prueba`, security definer) crea el comercio con el rubro,
los módulos del plan elegido, el usuario dueño, una sucursal y una caja, los
datos del formulario y `prueba_hasta` = hoy + 10. Un comercio por cuenta.

**Ejemplos.** Productos y ventas de ejemplo del rubro, marcados como ejemplo, con
un botón "Borrar ejemplos y empezar".

**Vencimiento.** Estado del comercio: prueba, activo, suspendido. Vencida la
prueba sin pago, el comercio queda suspendido: la base no le devuelve datos (RLS,
no solo la pantalla; a verificar contra `permisos_de()` y las políticas) y la
app muestra "Tu prueba terminó" con el botón Contratar.

**Mails** (Resend, desde @genez.com.ar): confirmación de cuenta, 3 días antes de
vencer y al vencer, invitando a contratar. Un cron diario de Vercel
(`api/`) manda los de vencimiento. La clave de Resend vive solo en Vercel.

**Contratar.** Pantalla con plan y precio, link de pago y datos de
transferencia, y "Ya pagué", que avisa en el panel y por WhatsApp. Nehuen activa
el comercio a mano desde su panel.

**Panel de plataforma.** Lista de pruebas con vencimiento y estado; activar,
extender, suspender. Las consultas de "Hacemos más" también llegan ahí.

Todo se prueba con "Super 25 Pruebas", nunca con Super 25.

## 7. Orden de trabajo

1. Landing: las 11 secciones y "Hacemos más", en claro y en oscuro, en esta
   rama, mostrando cada sección en local.
2. Autoservicio: migración, función de alta, ejemplos, suspensión, mails, panel.
3. Publicar las dos cosas juntas. Hasta entonces sigue el alta actual.

**Condiciones para publicar**: Supabase en plan Pro (hoy está en Free, sin
backups, en la misma base donde vende Super 25), Resend con el dominio
verificado, y términos y política de privacidad.

## 8. Pendientes prioritarios (después)

- Indumentaria: variantes y talles.
- Ecommerce: tienda online y envíos.
- Terminar multisucursal: agenda, abonos y presupuestos todavía guardan la
  sucursal vacía.
- Pago automático por suscripción de Mercado Pago.
