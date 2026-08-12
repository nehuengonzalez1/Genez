/* ============================================================
   0002 · SEGURIDAD A NIVEL DE FILA
   ============================================================

   El aislamiento entre negocios lo garantiza la base, no la aplicación.
   Un bug en el front no puede filtrar datos de un comercio a otro:
   Postgres directamente no devuelve esas filas.

   Alcance de esta capa: qué EMPRESA puede ver cada quien.
   Lo que un rol puede hacer dentro de su empresa (ver costos, anular,
   cerrar caja) sigue resolviéndose en la aplicación por ahora.
   ============================================================ */

/* Las dos funciones corren como definer a propósito: si consultaran
   perfiles con RLS activo, la política de perfiles se llamaría a sí
   misma y Postgres cortaría por recursión infinita. */

create or replace function public.empresa_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id from perfiles where id = auth.uid()
$$;

create or replace function public.es_plataforma()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select es_plataforma from perfiles where id = auth.uid()), false)
$$;

/* Atajo para no repetir la misma condición en veinte políticas. */
create or replace function public.puede_ver(fila_empresa uuid)
returns boolean
language sql
stable
as $$
  select fila_empresa = public.empresa_actual() or public.es_plataforma()
$$;

/* ============================================================
   ACTIVACIÓN
   ============================================================ */

alter table empresas          enable row level security;
alter table sucursales        enable row level security;
alter table perfiles          enable row level security;
alter table items             enable row level security;
alter table historial_costos  enable row level security;
alter table clientes          enable row level security;
alter table proveedores       enable row level security;
alter table operaciones       enable row level security;
alter table operacion_lineas  enable row level security;
alter table pagos             enable row level security;
alter table movimientos_stock enable row level security;
alter table sesiones_caja     enable row level security;
alter table movimientos_caja  enable row level security;

/* ============================================================
   EMPRESAS Y SUCURSALES
   ============================================================ */

create policy empresas_ver on empresas
  for select using (id = public.empresa_actual() or public.es_plataforma());

/* Crear y dar de baja comercios es tarea de la plataforma. */
create policy empresas_administrar on empresas
  for all using (public.es_plataforma()) with check (public.es_plataforma());

create policy sucursales_ver on sucursales
  for select using (public.puede_ver(empresa_id));

create policy sucursales_escribir on sucursales
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

/* ============================================================
   PERFILES

   Todos leen a sus compañeros de empresa (el ticket muestra quién
   cobró). Alta y baja de accesos las hace la plataforma o el dueño,
   y eso se valida en la aplicación.
   ============================================================ */

create policy perfiles_ver_propio on perfiles
  for select using (id = auth.uid());

create policy perfiles_ver_equipo on perfiles
  for select using (public.puede_ver(empresa_id));

create policy perfiles_administrar on perfiles
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

/* ============================================================
   CATÁLOGO, CLIENTES Y PROVEEDORES
   ============================================================ */

create policy items_todo on items
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

create policy historial_costos_todo on historial_costos
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

create policy clientes_todo on clientes
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

create policy proveedores_todo on proveedores
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

/* ============================================================
   OPERACIONES

   Una venta confirmada no se edita ni se borra: se anula con una
   operación de devolución que la referencia. Eso mantiene el libro
   consistente y es lo que hace que el POS offline no genere conflictos.
   ============================================================ */

create policy operaciones_ver on operaciones
  for select using (public.puede_ver(empresa_id));

create policy operaciones_crear on operaciones
  for insert with check (public.puede_ver(empresa_id));

/* Solo lo que todavía no se cerró admite cambios: un presupuesto se
   edita, un pedido cambia de estado, una venta confirmada no. */
create policy operaciones_editar_abiertas on operaciones
  for update
  using (public.puede_ver(empresa_id) and estado in ('borrador', 'pendiente', 'preparando'))
  with check (public.puede_ver(empresa_id));

create policy operacion_lineas_ver on operacion_lineas
  for select using (public.puede_ver(empresa_id));

create policy operacion_lineas_crear on operacion_lineas
  for insert with check (public.puede_ver(empresa_id));

create policy operacion_lineas_editar_abiertas on operacion_lineas
  for update using (
    public.puede_ver(empresa_id)
    and exists (
      select 1 from operaciones o
      where o.id = operacion_id and o.estado in ('borrador', 'pendiente', 'preparando')
    )
  ) with check (public.puede_ver(empresa_id));

create policy operacion_lineas_borrar_abiertas on operacion_lineas
  for delete using (
    public.puede_ver(empresa_id)
    and exists (
      select 1 from operaciones o
      where o.id = operacion_id and o.estado in ('borrador', 'pendiente', 'preparando')
    )
  );

create policy pagos_ver on pagos
  for select using (public.puede_ver(empresa_id));

create policy pagos_crear on pagos
  for insert with check (public.puede_ver(empresa_id));

/* ============================================================
   LIBROS DE STOCK Y CAJA

   Son asientos: se agregan, no se corrigen. Un error se arregla con
   un movimiento de ajuste que lo compensa, igual que en contabilidad.
   ============================================================ */

create policy movimientos_stock_ver on movimientos_stock
  for select using (public.puede_ver(empresa_id));

create policy movimientos_stock_crear on movimientos_stock
  for insert with check (public.puede_ver(empresa_id));

create policy movimientos_caja_ver on movimientos_caja
  for select using (public.puede_ver(empresa_id));

create policy movimientos_caja_crear on movimientos_caja
  for insert with check (public.puede_ver(empresa_id));

/* La sesión de caja sí se actualiza: se abre y después se cierra. */
create policy sesiones_caja_ver on sesiones_caja
  for select using (public.puede_ver(empresa_id));

create policy sesiones_caja_crear on sesiones_caja
  for insert with check (public.puede_ver(empresa_id));

create policy sesiones_caja_cerrar on sesiones_caja
  for update using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));
