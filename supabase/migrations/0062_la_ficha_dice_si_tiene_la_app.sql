/* ============================================================
   0062 · LA FICHA DICE SI TIENE LA APP
   ============================================================

   Para que la pantalla del comercio pueda ofrecer "darle la app" tiene que
   saber si ya la tiene. Ese dato es `clientes.usuario_id`, que existe
   desde 0050 — y no llega a la ficha.

   EL ASTERISCO DE UNA VISTA SE CONGELA
   ------------------------------------
   `clientes_vista` (0040) empieza con `select c.*`. Uno lee eso y entiende
   "todas las columnas de clientes, las de hoy y las de mañana". No es así:
   Postgres expande el asterisco **cuando se crea la vista** y guarda la
   lista resultante. Las columnas que se agreguen después no aparecen
   nunca.

   0050 le agregó a `clientes` el `usuario_id` y el `enlazado_en` diez
   migraciones más tarde, así que la vista quedó sin las dos y nadie se
   entera: no falla, no avisa, simplemente no están. La ficha del cliente
   viene leyendo desde entonces un cliente sin su cuenta.

   Por eso acá el asterisco se reemplaza por la lista escrita. No es
   prolijidad: es que la próxima columna que alguien agregue a `clientes`
   tampoco va a aparecer sola, y con la lista a la vista eso se nota al
   leer en vez de descubrirse un año después.

   POR QUÉ NO SE BORRA Y SE VUELVE A CREAR
   ---------------------------------------
   `create or replace view` deja agregar columnas **al final** y nada más:
   ni renombrar ni reordenar. De ahí que las dos nuevas vayan últimas,
   después de los recuentos, aunque por sentido irían al lado del correo.

   La alternativa era `drop ... cascade`, que se lleva puesto todo lo que
   dependa de la vista. Dos columnas al final no valen ese riesgo.
   ============================================================ */

create or replace view clientes_vista
with (security_invoker = true) as
select
  /* La lista de `clientes` escrita, en el orden en que el asterisco la
     había dejado. Cambiar el orden acá haría fallar el `replace`. */
  c.id,
  c.empresa_id,
  c.razon_social,
  c.tipo_doc,
  c.doc,
  c.condicion,
  c.domicilio,
  c.email,
  c.tel,
  c.campos_extra,
  c.activo,
  c.creado_en,

  coalesce(t.turnos, 0)     as turnos,
  coalesce(t.asistio, 0)    as asistio,
  coalesce(t.ausencias, 0)  as ausencias,
  coalesce(t.cancelados, 0) as cancelados,
  t.ultima,
  t.proxima,
  /* Sobre los turnos que ya pasaron: contra los futuros no hay asistencia
     que medir todavía, y meterlos hunde el porcentaje sin motivo. */
  case when coalesce(t.asistio, 0) + coalesce(t.ausencias, 0) = 0 then null
       else t.asistio::numeric / (t.asistio + t.ausencias)
  end as asistencia,

  coalesce(v.gastado, 0)  as gastado,
  coalesce(v.compras, 0)  as compras,
  coalesce(a.abonos, 0)   as abonos_activos,
  coalesce(n.notas, 0)    as notas,
  coalesce(n.alertas, 0)  as alertas,

  /* Las dos de 0050, al final porque es donde `replace` las acepta.

     No sale el correo de la cuenta ni nada de `auth.users`: para la ficha
     alcanza con si tiene acceso y desde cuándo. El correo con el que se la
     invitó es el de la ficha. */
  c.usuario_id,
  c.enlazado_en
from clientes c
left join lateral (
  select
    count(*)                                            as turnos,
    count(*) filter (where r.estado = 'cumplida')       as asistio,
    count(*) filter (where r.estado = 'ausente')        as ausencias,
    count(*) filter (where r.estado = 'cancelada')      as cancelados,
    max(r.desde) filter (where r.desde < now() and r.estado <> 'cancelada') as ultima,
    min(r.desde) filter (where r.desde >= now() and r.estado not in ('cancelada', 'ausente')) as proxima
  from reservas r
  where r.cliente_id = c.id and r.cupo is null
) t on true
left join lateral (
  select sum(o.total) as gastado, count(*) as compras
  from operaciones o
  where o.cliente_id = c.id and o.estado = 'confirmada'
) v on true
left join lateral (
  select count(*) as abonos
  from abonos_vista av
  where av.cliente_id = c.id and av.estado = 'activo'
) a on true
left join lateral (
  select count(*) as notas, count(*) filter (where destacada) as alertas
  from cliente_notas cn
  where cn.cliente_id = c.id
) n on true;

comment on view clientes_vista is
  'El cliente con sus cuentas hechas: cuántas veces vino, cuántas faltó, cuándo fue la última, cuánto gastó y si tiene la app. Se calculan acá y no en la pantalla para que la lista y la ficha no puedan discrepar.';
