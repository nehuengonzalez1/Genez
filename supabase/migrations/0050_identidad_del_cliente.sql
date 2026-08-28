/* ============================================================
   0050 · LA IDENTIDAD DEL CLIENTE
   ============================================================

   Los cimientos para que el cliente de un comercio entre a una aplicación
   propia y vea lo suyo. Acá no hay pantalla todavía: hay identidad,
   aislamiento y las funciones por las que va a leer.

   Ver `docs/modelo-identidad-del-cliente.md` para el diseño completo y
   para lo que quedó abierto.

   EL PUNTO DE PARTIDA ERA BUENO
   -----------------------------
   Se verificó antes de escribir nada: un usuario de Auth sin perfil no ve
   ninguna fila de ninguna tabla ni puede escribir. Todas las políticas
   cuelgan de `empresa_actual()` —que le da null— o de `es_plataforma()`
   —que le da false—.

   Así que esto no debilita nada de lo que existe: se arranca de cero y se
   abre a mano. Es al revés de como estaba `perfiles` antes de 0048, que
   partía de "todos ven todo" y había que ir cerrando.

   UN CLIENTE NO ES UN PERFIL, Y NO ES UN MATIZ
   --------------------------------------------
   `perfiles` significa "trabaja acá". `puede_ver(empresa_id)` da verdadero
   para cualquiera que tenga una fila ahí, y de eso cuelga el sistema
   entero: la agenda completa, la facturación, la caja.

   Un cliente con perfil vería los turnos de todas las demás personas. No
   es un permiso mal dado: es la categoría equivocada. Por eso las dos
   cosas se excluyen en la base y no en un comentario.

   EL CLIENTE NO LEE TABLAS, LEE FUNCIONES
   ---------------------------------------
   Esto corrige lo que decía el documento de diseño, y el motivo apareció
   al mirar las columnas.

   `items` tiene `costo`, `stock_min` y `proveedor_id`. `reservas` y
   `abonos` tienen `notas`, que es donde recepción escribe cosas internas.
   Una política de RLS decide sobre la **fila**, no sobre la columna: darle
   lectura de `items` para que vea el catálogo es darle el costo.

   Y hay algo peor que el costo de hoy: con una política de fila, **cada
   columna que se agregue mañana queda expuesta sola**. El día que alguien
   sume `margen` a `items`, pasa a ser pública sin que nadie lo decida.

   Con funciones que proyectan, las columnas nuevas nacen privadas. Es el
   default correcto para lo único de este sistema que va a mirar gente de
   afuera.

   No se usan vistas por dos razones que se suman: una vista con
   `security_invoker` —que este proyecto exige en todas, y con razón—
   heredaría las políticas del que pregunta, que para un cliente no
   existen, y devolvería vacío. Y sin `security_invoker` sería una vista
   que saltea RLS, que es justo lo que la prueba de vistas impide.
   ============================================================ */


/* ------------------------------------------------------------
   1 · El enlace

   Una persona, varias fichas. La misma que va a la barbería y al gimnasio
   son dos filas de `clientes` —cada comercio es dueño de su relación, con
   su ficha y sus datos fiscales— apuntando a una sola cuenta.

   `on delete set null` y no cascade: si la persona borra su cuenta, la
   ficha y su historia quedan. El comercio le facturó y le atendió, y eso
   no desaparece porque alguien desinstale una aplicación.
   ------------------------------------------------------------ */

alter table clientes
  add column if not exists usuario_id uuid references auth.users(id) on delete set null,
  add column if not exists enlazado_en timestamptz;

create index if not exists clientes_usuario_id_idx on clientes (usuario_id);

comment on column clientes.usuario_id is
  'La cuenta con la que esta persona entra a la app de cliente. Null mientras no tenga.';


/* ------------------------------------------------------------
   2 · Un cliente no puede ser personal, ni al revés

   Las dos direcciones, porque con una sola la otra es el camino de al
   lado. Y en la base, porque una validación de pantalla la saltea
   cualquier otra pantalla: es la regla 1 del proyecto.
   ------------------------------------------------------------ */

create or replace function public.cliente_no_es_personal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.usuario_id is null then
    return new;
  end if;

  if exists (select 1 from perfiles where id = new.usuario_id) then
    raise exception 'Esa cuenta ya es de alguien que trabaja en un comercio. Un cliente no puede tener acceso al sistema de gestión.'
      using errcode = 'P0080';
  end if;

  /* Una cuenta, una ficha por comercio. Sin esto, dos fichas enlazadas a
     la misma persona en el mismo comercio hacen que `mis_fichas` devuelva
     las dos y el historial se vea duplicado. */
  if exists (
    select 1 from clientes
     where usuario_id = new.usuario_id
       and empresa_id = new.empresa_id
       and id <> new.id
  ) then
    raise exception 'Esa cuenta ya está enlazada a otra ficha de este comercio.'
      using errcode = 'P0081';
  end if;

  return new;
end;
$$;

drop trigger if exists clientes_no_es_personal on clientes;

create trigger clientes_no_es_personal
  before insert or update of usuario_id on clientes
  for each row execute function public.cliente_no_es_personal();


/* La otra dirección: darle acceso al sistema a alguien que ya es cliente.
   Se suma a `cuidar_el_acceso` de 0048 en vez de reemplazarlo. */
create or replace function public.perfil_no_es_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from clientes where usuario_id = new.id) then
    raise exception 'Esa cuenta es la de un cliente. Para que trabaje acá necesita una cuenta aparte.'
      using errcode = 'P0080';
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_no_es_cliente on perfiles;

create trigger perfiles_no_es_cliente
  before insert on perfiles
  for each row execute function public.perfil_no_es_cliente();


/* ------------------------------------------------------------
   2 bis · La bitácora daba por sentado que todos son personal

   `anotar_acceso` (0048) escribe `bitacora.usuario_id = auth.uid()`, y esa
   columna tiene clave foránea a `perfiles`. Hasta hoy era cierto sin
   pensarlo: quien estaba autenticado, o era null, o era alguien de
   `perfiles`.

   Desde esta migración eso dejó de valer: hay cuentas autenticadas que no
   son personal. Hoy no se alcanza —el cliente no escribe nada— pero se va
   a alcanzar apenas exista `reservar_como_cliente`, y va a fallar con un
   error de clave foránea que no le va a decir nada a nadie.

   Se anota null cuando el que actúa no es personal. El acto queda
   registrado igual, que es lo que la bitácora tiene que garantizar; quién
   fue, cuando sea un cliente, va a ir en el detalle y no en esta columna,
   que significa "qué persona del comercio hizo esto".
   ------------------------------------------------------------ */

create or replace function public.actor_del_comercio()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from perfiles where id = auth.uid()
$$;

comment on function public.actor_del_comercio is
  'auth.uid() solo si es alguien del comercio. Null para un cliente, que no va en bitacora.usuario_id.';

create or replace function public.anotar_acceso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid := coalesce(new.empresa_id, old.empresa_id);
  v_accion  text;
begin
  if v_empresa is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    v_accion := 'acceso.crear';
  elsif tg_op = 'DELETE' then
    v_accion := 'acceso.borrar';
  elsif new.activo is distinct from old.activo then
    v_accion := case when new.activo then 'acceso.alta' else 'acceso.baja' end;
  elsif new.rol is distinct from old.rol or new.permisos is distinct from old.permisos then
    v_accion := 'acceso.permisos';
  else
    return new;
  end if;

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (
    v_empresa,
    public.actor_del_comercio(),
    v_accion,
    'acceso',
    coalesce(new.id, old.id),
    jsonb_build_object(
      'nombre', coalesce(new.nombre, old.nombre),
      'rol_antes', case when tg_op = 'INSERT' then null else old.rol end,
      'rol', coalesce(new.rol, old.rol),
      'permisos_antes', case when tg_op = 'INSERT' then null else old.permisos end,
      'permisos', coalesce(new.permisos, old.permisos)
    )
  );

  return coalesce(new, old);
end;
$$;


/* ------------------------------------------------------------
   3 · Quién soy

   `mis_fichas` es de lo que cuelga todo lo demás. Es `security definer`
   porque tiene que leer `clientes`, que para un cliente está cerrado: si
   corriera como el que pregunta, se llamaría a sí misma sin poder ver
   nada.
   ------------------------------------------------------------ */

create or replace function public.mis_fichas()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from clientes
   where usuario_id = auth.uid()
     and activo = true
$$;

comment on function public.mis_fichas is
  'Las fichas de cliente de quien está preguntando, en todos los comercios.';

/* Los comercios donde es cliente. Es la pantalla de inicio de la app:
   la misma persona puede ir a la estética y al bar. */
create or replace function public.mis_comercios()
returns table (
  empresa_id  uuid,
  nombre      text,
  rubro       text,
  ficha_id    uuid,
  desde       timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.nombre, e.rubro, c.id, c.creado_en
    from clientes c
    join empresas e on e.id = c.empresa_id
   where c.usuario_id = auth.uid()
     and c.activo = true
     and e.activa = true
   order by e.nombre
$$;


/* ------------------------------------------------------------
   4 · Lo que puede ver, columna por columna

   Cada función elige qué devuelve. Lo que no está acá, el cliente no lo
   ve, y lo que se agregue mañana a las tablas tampoco: hay que venir a
   escribirlo, que es exactamente lo que se quiere.

   `notas` no está en ninguna: es donde recepción escribe para adentro.
   ------------------------------------------------------------ */

/* `create or replace` no puede cambiarle el tipo de retorno a una función
   que ya existe, así que se borra primero. Es idempotente igual, y hace
   falta porque esta función ya salió una vez con menos columnas. */
drop function if exists public.mis_turnos(date);

/* `personal_id` e `item_id` son columnas de `reservas` desde 0032, no
   viven en `campos_extra`.

   Y una inscripción a una clase grupal (0034) no lleva el servicio en su
   propia fila: lo lleva la fila de la clase, que es su `clase_id`. Sin el
   coalesce, todo lo que sea pilates aparecería sin nombre, que en Almha es
   la mitad de la agenda. */
create or replace function public.mis_turnos(p_desde date default null)
returns table (
  id           uuid,
  empresa      text,
  servicio     text,
  profesional  text,
  desde        timestamptz,
  duracion_min integer,
  estado       text,
  es_clase     boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    e.nombre,
    coalesce(i.nombre, ic.nombre),
    coalesce(per.nombre, perc.nombre),
    r.desde,
    r.duracion_min,
    r.estado,
    r.clase_id is not null
  from reservas r
  join empresas e on e.id = r.empresa_id
  left join items    i    on i.id    = r.item_id
  left join personal per  on per.id  = r.personal_id
  /* La clase de la que esta reserva es una inscripción. */
  left join reservas cl   on cl.id   = r.clase_id
  left join items    ic   on ic.id   = cl.item_id
  left join personal perc on perc.id = cl.personal_id
 where r.cliente_id in (select public.mis_fichas())
   and r.desde >= coalesce(p_desde, current_date - 90)
 order by r.desde desc
$$;

comment on function public.mis_turnos is
  'Los turnos de quien pregunta. Sin `notas`: eso es lo que escribe recepción para adentro.';


create or replace function public.mis_abonos()
returns table (
  id        uuid,
  empresa   text,
  nombre    text,
  clases    integer,
  usadas    bigint,
  desde     date,
  vence     date,
  vigente   boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    e.nombre,
    a.nombre,
    a.clases,
    (select count(*) from reservas r
      where r.cliente_id = a.cliente_id
        and r.estado <> 'cancelada'
        and r.desde >= a.desde
        and (a.vence is null or r.desde::date <= a.vence)),
    a.desde,
    a.vence,
    (not a.anulado and (a.vence is null or a.vence >= current_date))
  from abonos a
  join empresas e on e.id = a.empresa_id
 where a.cliente_id in (select public.mis_fichas())
   and a.anulado = false
 order by a.desde desc
$$;


/* El catálogo, sin costo ni stock ni proveedor. Solo de los comercios
   donde ya es cliente: mientras el alta la haga el comercio invitando
   —que es el camino de la v1— no hay caso de alguien mirando el catálogo
   de un comercio con el que no tiene relación. */
create or replace function public.catalogo_de(p_empresa uuid)
returns table (
  id           uuid,
  nombre       text,
  categoria    text,
  precio       numeric,
  duracion_min integer
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.nombre, i.categoria, i.precio, i.duracion_min
    from items i
   where i.empresa_id = p_empresa
     and i.activo = true
     and i.tipo = 'servicio'
     and exists (
       select 1 from clientes c
        where c.empresa_id = p_empresa
          and c.usuario_id = auth.uid()
          and c.activo = true
     )
   order by i.categoria nulls last, i.nombre
$$;

comment on function public.catalogo_de is
  'Los servicios de un comercio, sin costo ni stock. Solo para quien ya es cliente de ese comercio.';


grant execute on function public.mis_fichas()        to authenticated;
grant execute on function public.mis_comercios()     to authenticated;
grant execute on function public.mis_turnos(date)    to authenticated;
grant execute on function public.mis_abonos()        to authenticated;
grant execute on function public.catalogo_de(uuid)   to authenticated;


/* ------------------------------------------------------------
   5 · Lo que NO se hace acá, dicho para que no se busque

   No hay ninguna política nueva de RLS. El cliente sigue sin poder leer
   una sola tabla directamente, y eso es el diseño y no una etapa
   pendiente.

   Tampoco hay forma de que el cliente escriba. Reservar va a ser una
   función con las reglas del negocio adentro —anticipación, cancelación,
   abono vencido, choque— igual que `registrar_venta`. Un insert directo
   obligaría a repetir esas reglas en cada pantalla que reserve, y la que
   se olvide es la que alguien va a encontrar.

   Y falta enlazar: `usuario_id` existe y hoy lo llena a mano quien tenga
   acceso a la base. El alta por invitación es el paso siguiente.
   ------------------------------------------------------------ */
