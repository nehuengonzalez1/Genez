/* ============================================================
   SEMILLA · cuatro meses de historia en Almha
   ============================================================

   Almha tenía el catálogo cargado —nueve prestaciones, diez espacios,
   cinco personas con sus horarios— y ni un solo día de operación: cero
   clientes, cero turnos dictados, cero ventas, cero caja. Un informe es
   una lectura del pasado, así que sin pasado no hay nada que leer ni,
   sobre todo, nada que mirar para saber si la pantalla está bien hecha.

   Esto llena ese hueco: cuatro meses enteros hacia atrás y dos semanas
   hacia adelante, armados sobre el catálogo que YA está cargado. No
   inventa servicios ni salas ni gente: usa los que están, así el día que
   lleguen los datos de verdad lo único que cambia son los nombres.

   TODO ES DE EJEMPLO y va marcado igual que el resto de Almha:

     delete from reservas    where empresa_id = (select id from empresas where nombre = 'Almha')
                               and campos_extra ->> 'demo' = 'true';
     delete from operaciones where empresa_id = (select id from empresas where nombre = 'Almha')
                               and campos_extra ->> 'demo' = 'true';
     delete from clientes    where empresa_id = (select id from empresas where nombre = 'Almha')
                               and campos_extra ->> 'demo' = 'true';

   Los abonos, las notas de ficha y la lista de espera cuelgan del cliente
   y se van con él por la cascada.

   POR QUÉ SE NIEGA A CORRER EN UN COMERCIO DE VERDAD
   --------------------------------------------------
   La regla del proyecto es que los datos de ejemplo solo existen en
   comercios marcados `demo` en su configuración. Esa regla estaba escrita
   en un comentario de `tablero.js` y en la cabeza de quien la escribió;
   acá está puesta como guarda, que es donde sirve. Si `config->>'demo'`
   no es `true`, el archivo aborta y no escribe una línea.

   El azar va sembrado con `setseed`, así que dos corridas dan lo mismo:
   un informe que cambia de números cada vez que se vuelve a sembrar no
   se puede comparar contra una captura.

   Se puede correr las veces que haga falta: barre lo suyo antes.

     node scripts/aplicar-sql.mjs supabase/seed/almha_historia.sql
   ============================================================ */

/* Una venta con su línea, su pago y su movimiento de caja. Va como
   función temporal —vive lo que dura la conexión— porque el bloque de
   abajo la llama desde cuatro lugares y repetir los cuatro inserts era
   la forma más segura de que uno de ellos quedara distinto.

   No usa `registrar_venta` a propósito: esa función estampa la fecha del
   momento, y acá toda la gracia es que las ventas tengan la fecha del día
   en que pasaron. */
create function pg_temp.venta_demo(
  p_emp     uuid,
  p_suc     uuid,
  p_user    uuid,
  p_cliente uuid,
  p_item    uuid,
  p_detalle text,
  p_precio  numeric,
  p_fecha   timestamptz,
  p_ses     uuid,
  p_medio   text,
  p_numero  text,
  p_cobrada boolean
) returns uuid
language plpgsql
as $fn$
declare
  v_op uuid := gen_random_uuid();
begin
  insert into operaciones (
    id, empresa_id, sucursal_id, tipo, estado, numero, fecha, cliente_id,
    usuario_id, subtotal, total, campos_extra, creada_en
  ) values (
    v_op, p_emp, p_suc, 'venta', 'confirmada', p_numero, p_fecha, p_cliente,
    p_user, p_precio, p_precio, '{"demo": true}'::jsonb, p_fecha
  );

  insert into operacion_lineas (
    operacion_id, empresa_id, item_id, descripcion, cantidad,
    precio_unitario, total, estado, usuario_id
  ) values (
    v_op, p_emp, p_item, p_detalle, 1, p_precio, p_precio, 'entregado', p_user
  );

  /* Lo que no se cobró queda como operación confirmada sin pagos: así es
     como el sistema representa una cuenta corriente, y es lo que lee
     "Pendientes" en Finanzas. Un saldo guardado se desincroniza. */
  if p_cobrada then
    insert into pagos (operacion_id, empresa_id, medio, monto, fecha)
    values (v_op, p_emp, p_medio, p_precio, p_fecha);

    insert into movimientos_caja (
      empresa_id, sucursal_id, sesion_id, tipo, medio, monto,
      detalle, categoria, operacion_id, usuario_id, fecha
    ) values (
      p_emp, p_suc, p_ses, 'ingreso', p_medio, p_precio,
      'Venta ' || coalesce(p_numero, ''),
      case when p_detalle like 'Pack%' or p_detalle like 'Plan%' then 'abonos' else 'turnos' end,
      v_op, p_user, p_fecha
    );
  end if;

  return v_op;
end;
$fn$;


do $semilla$
declare
  v_emp    uuid;
  v_suc    uuid;
  v_user   uuid;
  v_pv     text;
  v_num    int := 0;

  v_hoy    date := current_date;
  /* La historia arranca el 1 de un mes y no "hace 120 días" a secas. Un
     informe mensual con un primer mes cortado por la mitad muestra una
     caída que nunca pasó, y el ojo la lee antes que cualquier aclaración
     al pie. */
  v_inicio date := (date_trunc('month', current_date::timestamp) - interval '4 months')::date;
  v_dia    date;
  v_off    int;
  v_dow    int;

  v_ses    uuid;
  v_cli    uuid;
  v_clase  uuid;
  v_abono  uuid;
  v_op     uuid;

  v_cuantos  int;
  v_cupo     int;
  v_estado   text;
  v_medio    text;
  v_cobrada  boolean;
  v_hora     int;
  v_cuando   timestamptz;
  v_efectivo numeric;

  v_horas   numeric;
  v_clases  int;
  v_total   numeric;
  v_desde   date;
  v_hasta   date;
  v_liq     uuid;
  v_mov     uuid;
  v_semana  int;

  /* Ojo con estos cuatro: plpgsql resuelve los nombres antes que el SQL,
     así que un `join personal p` adentro de este bloque se lee como la
     variable `p` y revienta con "record is not assigned yet". Por eso los
     alias de las consultas de acá abajo son `per`, `cl`, `sc` y no las
     iniciales de siempre. */
  c   record;
  s   record;
  p   record;
  pl  record;

  v_nombres text[] := array[
    'Florencia Silva',   'Martina López',     'Agustín Pérez',     'Belén Acosta',
    'Julieta Román',     'Camila Torres',     'Antonella Vera',    'Lucía Fernández',
    'Micaela Duarte',    'Sofía Benítez',     'Rocío Medina',      'Paula Cabrera',
    'Carolina Ferreyra', 'Daniela Quiroga',   'Mariana Sosa',      'Aldana Bruno',
    'Guadalupe Ibarra',  'Malena Ríos',       'Victoria Peralta',  'Abril Maldonado',
    'Josefina Aguirre',  'Delfina Ocampo',    'Renata Vidal',      'Emilia Cardozo',
    'Milagros Ponce',    'Ana Clara Vega',    'Bautista Correa',   'Tomás Herrera',
    'Ignacio Bustos',    'Federico Ledesma',  'Nicolás Arias',     'Joaquín Escobar',
    'Matías Villalba',   'Franco Miranda',    'Santiago Alvarado', 'Gonzalo Paz',
    'Verónica Ramallo',  'Silvina Barrios',   'Patricia Godoy',    'Alejandra Núñez',
    'Marcela Fuentes',   'Gabriela Molina',   'Natalia Cáceres',   'Andrea Sarmiento',
    'Laura Bianchi',     'Cecilia Domínguez', 'Romina Ávalos',     'Vanesa Olmedo',
    'Elena Zabala',      'Graciela Ferrari',  'Nadia Segovia',     'Ayelén Cortés',
    'Brenda Salazar',    'Ximena Lucero',     'Priscila Ojeda'
  ];

  v_notas text[] := array[
    'Prefiere turnos a la mañana temprano.',
    'Viene derivada por su kinesióloga.',
    'Trabaja cerca, puede venir en el horario del mediodía.',
    'Le molesta el frío en la sala, dejar la estufa prendida.',
    'Pidió que la avisemos si se libera un lugar los martes.',
    'Paga siempre por transferencia el primer día del mes.'
  ];
begin

/* ------------------------------------------------------------
   1 · La guarda

   No es una formalidad: esta semilla escribe ventas y movimientos de
   caja, que es lo último que se quiere ver aparecer en un negocio real.
   ------------------------------------------------------------ */
select id into v_emp from empresas where nombre = 'Almha';
if v_emp is null then
  raise exception 'No existe Almha. Corré antes supabase/seed/almha.sql.';
end if;

if coalesce((select config ->> 'demo' from empresas where id = v_emp), 'false') <> 'true' then
  raise exception 'Almha no está marcada como comercio de demostración. Esta semilla no corre sobre datos reales.';
end if;

select id into v_suc  from sucursales where empresa_id = v_emp limit 1;
select id into v_user from perfiles    where es_plataforma limit 1;
select coalesce(config -> 'fiscal' ->> 'puntoVenta', '0001') into v_pv from empresas where id = v_emp;

perform setseed(0.20260822);

/* ------------------------------------------------------------
   2 · Barrer la corrida anterior

   El orden lo manda la clave foránea: los movimientos primero, porque la
   operación los deja huérfanos en vez de borrarlos y un arqueo con
   ingresos de ventas que ya no existen no cierra nunca.

   Se barre todo lo transaccional del comercio y no solo lo marcado: la
   guarda de arriba ya garantizó que estamos en un comercio de
   demostración, donde no hay nada que preservar. Los turnos de prueba
   que quedaron de armar la agenda también se van acá, que es lo que se
   quiere.
   ------------------------------------------------------------ */
delete from movimientos_caja where empresa_id = v_emp;
delete from liquidaciones    where empresa_id = v_emp;
delete from espera           where empresa_id = v_emp;
delete from reservas         where empresa_id = v_emp;
delete from abonos           where empresa_id = v_emp;
delete from operaciones      where empresa_id = v_emp;
delete from sesiones_caja    where empresa_id = v_emp;
delete from clientes         where empresa_id = v_emp;
delete from items            where empresa_id = v_emp and tipo = 'plan';

raise notice 'Almha: barrido lo anterior.';

/* ------------------------------------------------------------
   3 · Los planes del catálogo

   Un plan es un item con `tipo = 'plan'` y sus condiciones en
   `campos_extra`. No es una tabla aparte a propósito: así se cobra, se
   asienta en caja y aparece en los informes por el mismo camino que una
   limpieza facial. Ver la migración 0035.
   ------------------------------------------------------------ */
for pl in
  select * from (values
    ('Pack 4 clases',      56000,  4,          null::int, 45),
    ('Pack 8 clases',      100000, 8,          null::int, 60),
    ('Plan 2 por semana',  95000,  null::int,  2,         30),
    ('Plan libre mensual', 130000, null::int,  null::int, 30)
  ) as x(nombre, precio, clases, tope, dias)
loop
  insert into items (
    empresa_id, tipo, nombre, categoria, precio, costo,
    controla_stock, activo, campos_extra
  ) values (
    v_emp, 'plan', pl.nombre, 'Pilates', pl.precio, 0,
    false, true,
    jsonb_build_object('demo', true, 'clases', pl.clases,
                       'topeSemanal', pl.tope, 'vigenciaDias', pl.dias)
  );
end loop;

raise notice 'Almha: 4 planes.';

/* ------------------------------------------------------------
   4 · La gente

   `perfil` no es una columna de la base: es una tabla temporal para que
   los bucles de abajo sepan a quién mandar a pilates y a quién a una
   camilla. Una clienta de masajes que aparece anotada en reformer todas
   las semanas hace que la ocupación mienta.
   ------------------------------------------------------------ */
create temp table semilla_clientes (id uuid, perfil text, alta date) on commit drop;

for v_off in 1..array_length(v_nombres, 1) loop
  /* Las altas se reparten en los cuatro meses, con más al principio: un
     negocio que arranca su sistema carga la cartera que ya tenía y
     después suma de a poco. Eso es lo que después se lee como "clientes
     nuevos por mes", y con altas parejas ese informe no dice nada. */
  v_dia := v_hoy - (case when v_off <= 30 then (v_hoy - v_inicio) - v_off
                         else floor(random() * (v_hoy - v_inicio - 10))::int end);

  insert into clientes (empresa_id, razon_social, tel, email, condicion, activo, campos_extra, creado_en)
  values (
    v_emp,
    v_nombres[v_off],
    '11' || lpad((floor(random() * 90000000) + 10000000)::text, 8, '0'),
    lower(translate(split_part(v_nombres[v_off], ' ', 1), 'áéíóúñÁÉÍÓÚÑ', 'aeiounAEIOUN'))
      || v_off || '@ejemplo.com',
    'CF', true, '{"demo": true}'::jsonb,
    v_dia + time '10:00'
  )
  returning id into v_cli;

  insert into semilla_clientes (id, perfil, alta)
  values (v_cli, case when random() < 0.58 then 'pilates'
                      when random() < 0.62 then 'estetica'
                      else 'masajes' end, v_dia);

  /* Una nota cada tanto: la ficha con todas las fichas vacías no deja ver
     si el cuaderno se lee bien. */
  if random() < 0.35 then
    insert into cliente_notas (empresa_id, cliente_id, texto, destacada, usuario_id, creada_en)
    values (v_emp, v_cli, v_notas[1 + floor(random() * array_length(v_notas, 1))::int],
            false, v_user, v_dia + time '10:05');
  end if;
end loop;

/* Las dos contraindicaciones destacadas: son las que la ficha saca a la
   superficie y las que aparecen al agendar un turno. */
insert into cliente_notas (empresa_id, cliente_id, texto, destacada, usuario_id)
select v_emp, id, 'Alérgica al ácido glicólico. No usar en limpieza facial.', true, v_user
  from semilla_clientes where perfil = 'estetica' order by random() limit 1;

insert into cliente_notas (empresa_id, cliente_id, texto, destacada, usuario_id)
select v_emp, id, 'Hernia lumbar. No hacer flexión de columna cargada.', true, v_user
  from semilla_clientes where perfil = 'pilates' order by random() limit 1;

raise notice 'Almha: % clientes.', array_length(v_nombres, 1);

/* ------------------------------------------------------------
   5 · Qué se dicta y dónde

   Se lee del catálogo real del comercio en vez de escribirlo acá: si
   mañana se agrega una prestación de masajes, entra sola.
   ------------------------------------------------------------ */
create temp table semilla_agenda (
  clase       boolean,
  item_id     uuid,
  nombre      text,
  precio      numeric,
  duracion    int,
  personal_id uuid,
  recurso_id  uuid,
  cupo        int,
  hora        int,
  perfil      text
) on commit drop;

/* Las clases con cupo: tres por día de semana, en las salas grandes. El
   horario fijo es lo que hace que la ocupación se pueda comparar de una
   semana a la otra. */
insert into semilla_agenda (clase, item_id, nombre, precio, duracion, personal_id, recurso_id, cupo, hora, perfil)
select true, i.id, i.nombre, i.precio, i.duracion_min, per.id, r.id, r.capacidad, h.hora, 'pilates'
  from (values ('Pilates Mat',      'Sala Mat 1',      'Sofía González',  9),
               ('Pilates Reformer', 'Sala Reformer 1', 'Valentina Rojas', 18),
               ('Pilates Reformer', 'Sala Reformer 2', 'Sofía González',  19)
       ) as h(servicio, sala, profe, hora)
  join items    i on i.empresa_id = v_emp and i.nombre = h.servicio
  join recursos r on r.empresa_id = v_emp and r.nombre = h.sala
  join personal per on per.empresa_id = v_emp and per.nombre = h.profe;

/* Los turnos de a uno. La sala sale al azar entre las de su área, así los
   boxes se llenan parejo y la ocupación no queda toda en uno. */
insert into semilla_agenda (clase, item_id, nombre, precio, duracion, personal_id, recurso_id, cupo, hora, perfil)
select false, i.id, i.nombre, i.precio, i.duracion_min, per.id, r.id, null, null,
       case when i.categoria = 'Estética' then 'estetica' else 'masajes' end
  from items i
  join personal per on per.empresa_id = v_emp and per.especialidad = i.categoria
  join recursos r on r.empresa_id = v_emp
                 and r.nombre = any (case when i.categoria = 'Estética'
                                          then array['Sala Estética', 'Gabinete 1', 'Gabinete 2']
                                          else array['Box Masajes 1', 'Box Masajes 2', 'Consultorio 1'] end)
 where i.empresa_id = v_emp and i.tipo = 'servicio'
   and i.categoria in ('Estética', 'Masajes');

/* Corporales lo da la de masajes: en el equipo de ejemplo nadie tiene esa
   especialidad exacta, y sin esto el drenaje linfático no lo daría nadie
   y no se vendería nunca. */
insert into semilla_agenda (clase, item_id, nombre, precio, duracion, personal_id, recurso_id, cupo, hora, perfil)
select false, i.id, i.nombre, i.precio, i.duracion_min, per.id, r.id, null, null, 'masajes'
  from items i
  cross join (select id from personal where empresa_id = v_emp and nombre = 'Agustina Pérez') per
  join recursos r on r.empresa_id = v_emp and r.nombre = 'Box Masajes 2'
 where i.empresa_id = v_emp and i.tipo = 'servicio' and i.categoria = 'Corporales';

/* Pilates Personalizado es de a uno aunque sea pilates: va con la profe
   de pilates y en un reformer. */
insert into semilla_agenda (clase, item_id, nombre, precio, duracion, personal_id, recurso_id, cupo, hora, perfil)
select false, i.id, i.nombre, i.precio, i.duracion_min, per.id, r.id, null, null, 'pilates'
  from items i
  cross join (select id from personal where empresa_id = v_emp and nombre = 'Valentina Rojas') per
  join recursos r on r.empresa_id = v_emp and r.nombre = 'Sala Reformer 1'
 where i.empresa_id = v_emp and i.tipo = 'servicio' and i.nombre = 'Pilates Personalizado';

/* ------------------------------------------------------------
   6 · Los días

   De atrás para adelante: cuatro meses enteros de historia y dos semanas
   de agenda por venir, que es lo que hace que la pantalla tenga algo que
   mostrar arriba y algo que mostrar abajo.

   Domingo cerrado, sábado a media máquina.
   ------------------------------------------------------------ */
for v_off in (v_inicio - v_hoy)..14 loop
  v_dia := v_hoy + v_off;
  v_dow := extract(dow from v_dia);
  continue when v_dow = 0;

  /* La caja del día. La de hoy queda abierta —es lo que espera encontrar
     quien entra a cobrar— y las anteriores cerradas con su declarado. */
  if v_off <= 0 then
    insert into sesiones_caja (empresa_id, sucursal_id, abierta_en, cerrada_en, monto_inicial, abierta_por, cerrada_por)
    values (v_emp, v_suc, v_dia + time '08:30',
            case when v_off = 0 then null else v_dia + time '21:00' end,
            30000, v_user, case when v_off = 0 then null else v_user end)
    returning id into v_ses;
  else
    v_ses := null;
  end if;

  /* --- las clases con cupo --- */
  for s in
    select * from semilla_agenda
     where clase and (v_dow between 1 and 5 or (v_dow = 6 and hora = 9))
     order by hora
  loop
    insert into reservas (
      empresa_id, sucursal_id, recurso_id, personal_id, item_id,
      nombre, personas, desde, duracion_min, estado, cupo, usuario_id, campos_extra, creada_en
    ) values (
      v_emp, v_suc, s.recurso_id, s.personal_id, s.item_id,
      s.nombre, 0, v_dia + make_time(s.hora, 0, 0), s.duracion,
      case when v_off < 0 then 'cumplida' else 'confirmada' end,
      s.cupo, v_user, '{"demo": true}'::jsonb, v_dia - 3 + time '12:00'
    )
    returning id into v_clase;

    /* Cuánta gente se anota. Reformer llena más que mat y el turno de las
       19 más que el de las 18: son las diferencias que después hacen que
       el informe de ocupación sirva para decidir qué clase abrir. */
    v_cupo := s.cupo;
    v_cuantos := greatest(1, least(v_cupo,
      round(v_cupo * (case when s.hora >= 18 then 0.80 else 0.55 end)
                   * (0.7 + random() * 0.6))::int));

    for c in
      select sc.id from semilla_clientes sc
       where sc.perfil = 'pilates' and sc.alta <= v_dia
       order by random() limit v_cuantos
    loop
      /* ¿Tiene crédito que cubra este día? Se pregunta por la ventana del
         abono y por lo consumido, no por su estado de hoy: un abono de
         mayo hoy figura vencido, y en mayo servía. */
      select a.id into v_abono
        from abonos a
       where a.cliente_id = c.id and not a.anulado
         and a.desde <= v_dia and (a.vence is null or a.vence >= v_dia)
         and (a.clases is null
              or (select count(*) from reservas r
                   where r.abono_id = a.id and r.estado <> 'cancelada') < a.clases)
       order by a.desde desc limit 1;

      /* Sin crédito casi siempre compra uno nuevo: así funciona un estudio
         de pilates. El resto paga la clase suelta. */
      if v_abono is null and v_off <= 0 and random() < 0.78 then
        select * into pl from items
         where empresa_id = v_emp and tipo = 'plan' order by random() limit 1;

        v_num := v_num + 1;
        v_medio := (array['efectivo','debito','credito','mp','transferencia'])[1 + floor(random() * 5)::int];
        v_op := pg_temp.venta_demo(v_emp, v_suc, v_user, c.id, pl.id, pl.nombre, pl.precio,
                                   v_dia + time '09:00', v_ses, v_medio,
                                   v_pv || '-' || lpad(v_num::text, 8, '0'), true);

        insert into abonos (
          empresa_id, cliente_id, item_id, operacion_id, nombre, clases,
          tope_semanal, desde, vence, usuario_id, creado_en
        ) values (
          v_emp, c.id, pl.id, v_op, pl.nombre,
          nullif(pl.campos_extra ->> 'clases', '')::int,
          nullif(pl.campos_extra ->> 'topeSemanal', '')::int,
          v_dia,
          v_dia + coalesce(nullif(pl.campos_extra ->> 'vigenciaDias', '')::int, 30),
          v_user, v_dia + time '09:00'
        )
        returning id into v_abono;
      end if;

      if v_off < 0 then
        v_estado := case when random() < 0.84 then 'cumplida'
                         when random() < 0.55 then 'ausente'
                         else 'cancelada' end;
      else
        v_estado := case when random() < 0.75 then 'confirmada' else 'pendiente' end;
      end if;

      insert into reservas (
        empresa_id, sucursal_id, recurso_id, personal_id, item_id, clase_id,
        cliente_id, nombre, personas, desde, duracion_min, estado, abono_id,
        usuario_id, campos_extra, creada_en
      )
      select v_emp, v_suc, s.recurso_id, s.personal_id, s.item_id, v_clase,
             c.id, cl.razon_social, 1, v_dia + make_time(s.hora, 0, 0), s.duracion,
             v_estado, v_abono, v_user, '{"demo": true}'::jsonb, v_dia - 2 + time '18:00'
        from clientes cl where cl.id = c.id;

      /* Sin abono la clase se paga suelta. Cancelada no se cobra. */
      if v_abono is null and v_estado <> 'cancelada' and v_off <= 0 then
        v_num := v_num + 1;
        v_medio := (array['efectivo','debito','mp','mp','transferencia'])[1 + floor(random() * 5)::int];
        perform pg_temp.venta_demo(v_emp, v_suc, v_user, c.id, s.item_id, s.nombre, s.precio,
                                   v_dia + make_time(s.hora, 30, 0), v_ses, v_medio,
                                   v_pv || '-' || lpad(v_num::text, 8, '0'), true);
      end if;
    end loop;
  end loop;

  /* --- los turnos de a uno --- */
  v_cuantos := case when v_dow = 6 then 2 + floor(random() * 2)::int
                    else 4 + floor(random() * 4)::int end;

  for v_hora in 1..v_cuantos loop
    select * into s from semilla_agenda where not clase order by random() limit 1;

    select sc.id into v_cli from semilla_clientes sc
     where sc.perfil = s.perfil and sc.alta <= v_dia
     order by random() limit 1;
    continue when v_cli is null;

    v_cuando := v_dia + make_time(10 + ((v_hora * 2 + floor(random() * 2)::int) % 9),
                                  (array[0, 30])[1 + floor(random() * 2)::int], 0);

    if v_off < 0 then
      v_estado := case when random() < 0.86 then 'cumplida'
                       when random() < 0.5  then 'ausente'
                       else 'cancelada' end;
    else
      v_estado := case when random() < 0.7 then 'confirmada' else 'pendiente' end;
    end if;

    insert into reservas (
      empresa_id, sucursal_id, recurso_id, personal_id, item_id,
      cliente_id, nombre, personas, desde, duracion_min, estado,
      usuario_id, campos_extra, creada_en
    )
    select v_emp, v_suc, s.recurso_id, s.personal_id, s.item_id,
           v_cli, cl.razon_social, 1, v_cuando, s.duracion, v_estado,
           v_user, '{"demo": true}'::jsonb, v_dia - 4 + time '11:00'
      from clientes cl where cl.id = v_cli;

    /* Un turno cumplido se cobra. Uno de cada ocho queda sin cobrar: es la
       cuenta corriente que después hay que ir a buscar, y si la semilla no
       la produce, "Pendientes" no se puede mirar. */
    if v_estado = 'cumplida' then
      v_num := v_num + 1;
      v_cobrada := random() >= 0.12;
      v_medio := (array['efectivo','efectivo','debito','credito','mp','transferencia'])[1 + floor(random() * 6)::int];
      perform pg_temp.venta_demo(v_emp, v_suc, v_user, v_cli, s.item_id, s.nombre, s.precio,
                                 v_cuando + interval '50 minutes', v_ses, v_medio,
                                 v_pv || '-' || lpad(v_num::text, 8, '0'), v_cobrada);
    end if;
  end loop;

  /* El declarado del arqueo: lo que entró en efectivo más el inicial.
     Cierra clavado a propósito; las diferencias de arqueo son otra
     historia y no las cuenta un informe. */
  if v_off < 0 then
    select coalesce(sum(monto), 0) into v_efectivo
      from movimientos_caja
     where sesion_id = v_ses and tipo = 'ingreso' and medio = 'efectivo';
    update sesiones_caja set monto_declarado = 30000 + v_efectivo where id = v_ses;
  end if;
end loop;

raise notice 'Almha: agenda y ventas de 120 días.';

/* ------------------------------------------------------------
   7 · La lista de espera

   Solo sobre clases futuras que quedaron llenas: anotarse en una que ya
   pasó no existe.
   ------------------------------------------------------------ */
for s in
  select r.id, r.cupo, r.desde
    from reservas r
   where r.empresa_id = v_emp and r.cupo is not null and r.desde > now()
     and (select count(*) from reservas i
           where i.clase_id = r.id and i.estado not in ('cancelada', 'ausente')) >= r.cupo
   order by r.desde limit 6
loop
  for c in
    select sc.id from semilla_clientes sc
     where sc.perfil = 'pilates'
       and not exists (select 1 from reservas i where i.clase_id = s.id and i.cliente_id = sc.id)
     order by random() limit 1 + floor(random() * 2)::int
  loop
    insert into espera (empresa_id, clase_id, cliente_id, nombre, telefono, estado, orden, usuario_id)
    select v_emp, s.id, c.id, cl.razon_social, cl.tel, 'esperando',
           (select count(*) from espera e where e.clase_id = s.id), v_user
      from clientes cl where cl.id = c.id;
  end loop;
end loop;

/* ------------------------------------------------------------
   8 · Las liquidaciones

   Semana de lunes a domingo. Las horas salen de la agenda —una clase
   cuenta una vez y no una por alumno, por eso el filtro `clase_id is
   null`— y recepción se liquida por horario, que no dicta nada.

   La semana en curso queda en borrador: es la que se está mirando. Las
   anteriores, pagadas y con su egreso escrito. Sin eso los egresos del
   mes mienten por el gasto más grande y más regular del negocio.
   ------------------------------------------------------------ */
/* Todas las semanas de la historia, no las últimas doce: un mes con
   ingresos y sin sueldos da un resultado que duplica al real, y eso
   después se lee como una caída de rentabilidad que nunca existió. */
for v_semana in 0..((v_hoy - v_inicio) / 7 + 1) loop
  v_desde := (date_trunc('week', v_hoy::timestamp) - make_interval(weeks => v_semana))::date;
  v_hasta := v_desde + 6;
  /* Recepción cobra aunque no dicte nada, así que sin este corte
     aparecería un sueldo de una semana en la que el negocio todavía no
     existía para el sistema. */
  continue when v_hasta < v_inicio;

  for p in select * from personal where empresa_id = v_emp and activo loop
    if p.tipo = 'recepcion' then
      v_horas  := 40;
      v_clases := 0;
    else
      select coalesce(sum(duracion_min), 0) / 60.0,
             count(*) filter (where cupo is not null)
        into v_horas, v_clases
        from reservas
       where empresa_id = v_emp and personal_id = p.id
         and clase_id is null
         and estado in ('cumplida', 'confirmada')
         and desde::date between v_desde and v_hasta;
    end if;

    continue when coalesce(v_horas, 0) = 0;

    v_total := round(v_horas * p.valor);

    insert into liquidaciones (
      empresa_id, personal_id, desde, hasta, modalidad, valor,
      horas, clases, total, estado, usuario_id, creada_en
    ) values (
      v_emp, p.id, v_desde, v_hasta, p.modalidad, p.valor,
      round(v_horas, 2), v_clases, v_total,
      case when v_semana = 0 then 'borrador' else 'pagada' end,
      v_user, v_hasta + time '20:00'
    )
    returning id into v_liq;

    /* Pagada quiere decir que salió plata: el egreso va en el mismo acto,
       igual que hace `pagar_liquidacion`. */
    if v_semana > 0 then
      insert into movimientos_caja (
        empresa_id, sucursal_id, sesion_id, tipo, medio, monto,
        detalle, categoria, usuario_id, fecha
      ) values (
        v_emp, v_suc,
        (select id from sesiones_caja
          where empresa_id = v_emp and abierta_en::date = v_hasta + 1 limit 1),
        'egreso', 'transferencia', v_total,
        'Sueldo ' || p.nombre || ' · ' || to_char(v_desde, 'DD/MM') || ' al ' || to_char(v_hasta, 'DD/MM'),
        'sueldos', v_user, v_hasta + 1 + time '12:00'
      )
      returning id into v_mov;

      update liquidaciones
         set medio = 'transferencia', movimiento_id = v_mov,
             pagada_en = v_hasta + 1 + time '12:00'
       where id = v_liq;
    end if;
  end loop;
end loop;

/* Dos notas de reemplazo, pegadas al período que explican. */
insert into liquidacion_notas (empresa_id, liquidacion_id, texto, usuario_id)
select v_emp, l.id, 'Cubrió las clases del martes por ausencia de Valentina. Se le pagan a ella, que las dio.', v_user
  from liquidaciones l
  join personal p2 on p2.id = l.personal_id
 where l.empresa_id = v_emp and p2.nombre = 'Sofía González'
 order by l.desde desc limit 1 offset 2;

insert into liquidacion_notas (empresa_id, liquidacion_id, texto, usuario_id)
select v_emp, l.id, 'Semana corta por el feriado del lunes.', v_user
  from liquidaciones l
  join personal p2 on p2.id = l.personal_id
 where l.empresa_id = v_emp and p2.nombre = 'Carla Gómez'
 order by l.desde desc limit 1 offset 1;

/* ------------------------------------------------------------
   9 · Los gastos que no son sueldos

   Un negocio cuyo único egreso son los sueldos da un resultado que no se
   parece al real. Alquiler, servicios, insumos e impuestos, una vez por
   mes.
   ------------------------------------------------------------ */
for v_semana in 0..4 loop
  v_desde := (date_trunc('month', v_hoy::timestamp) - make_interval(months => v_semana))::date;
  /* Ni antes de que el negocio existiera para el sistema, ni con fecha
     futura: el `where` de abajo recorta el mes en curso, del que todavía
     no vencieron todos los gastos. */
  continue when v_desde < v_inicio;

  insert into movimientos_caja (empresa_id, sucursal_id, tipo, medio, monto, detalle, categoria, usuario_id, fecha)
  select v_emp, v_suc, 'egreso', g.medio, g.monto, g.detalle, g.categoria, v_user,
         v_desde + g.dia + time '11:00'
    from (values
      (4,  'transferencia', 850000, 'Alquiler del local',            'alquiler'),
      (9,  'transferencia', 145000, 'Luz, gas e internet',           'servicios'),
      (6,  'efectivo',      98000,  'Insumos de cabina',             'insumos'),
      (18, 'transferencia', 62000,  'Monotributo e Ingresos Brutos', 'impuestos')
    ) as g(dia, medio, monto, detalle, categoria)
   where v_desde + g.dia <= v_hoy;
end loop;

raise notice 'Almha: liquidaciones y gastos.';
raise notice 'Listo. Clientes: %, turnos: %, ventas: %, movimientos: %.',
  (select count(*) from clientes         where empresa_id = v_emp),
  (select count(*) from reservas         where empresa_id = v_emp),
  (select count(*) from operaciones      where empresa_id = v_emp),
  (select count(*) from movimientos_caja where empresa_id = v_emp);

end;
$semilla$;
