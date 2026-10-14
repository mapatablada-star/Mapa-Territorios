-- Extensión aditiva: no altera territorios ni historial_territorios.
create table if not exists public.territorio_partes (
 id bigint generated always as identity primary key,
 territorio_id bigint not null references public.territorios(id) on delete cascade,
 orden integer not null check (orden between 1 and 30),
 manzanas text not null check (char_length(manzanas) between 1 and 90),
 estado text not null check (estado in ('available','assigned','done')),
 fecha_asignacion date,
 fecha_ultima_visita date,
 asignado_a text not null default '',
 persona text not null default '',
 observaciones text not null default '',
 version integer not null default 1 check (version >= 1),
 updated_by uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists territorio_partes_territorio_idx on public.territorio_partes(territorio_id, orden);
create table if not exists public.historial_partes (
 id bigint generated always as identity primary key,
 territorio_id bigint not null references public.territorios(id) on delete cascade,
 parte_id bigint,
 accion text not null check (accion in ('crear','modificar','quitar')),
 datos jsonb not null,
 usuario_id uuid,
 created_at timestamptz not null default now()
);
create index if not exists historial_partes_territorio_idx on public.historial_partes(territorio_id, created_at desc);
alter table public.territorio_partes enable row level security;
alter table public.historial_partes enable row level security;
revoke all on public.territorio_partes from anon, authenticated;
revoke all on public.historial_partes from anon, authenticated;
grant select,insert,update,delete on public.territorio_partes to authenticated;
grant select,insert on public.historial_partes to authenticated;
grant usage,select on sequence public.territorio_partes_id_seq to authenticated;
grant usage,select on sequence public.historial_partes_id_seq to authenticated;
create policy partes_lectura_autorizados on public.territorio_partes
 for select to authenticated
 using (exists(select 1 from public.usuarios_autorizados u where u.id=(select auth.uid()) and u.activo));
create policy partes_alta_editores on public.territorio_partes
 for insert to authenticated
 with check (exists(select 1 from public.usuarios_autorizados u where u.id=(select auth.uid()) and u.activo and u.rol in ('admin','usuario')));
create policy partes_modificar_editores on public.territorio_partes
 for update to authenticated
 using (exists(select 1 from public.usuarios_autorizados u where u.id=(select auth.uid()) and u.activo and u.rol in ('admin','usuario')))
 with check (exists(select 1 from public.usuarios_autorizados u where u.id=(select auth.uid()) and u.activo and u.rol in ('admin','usuario')));
create policy partes_eliminar_editores on public.territorio_partes
 for delete to authenticated
 using (exists(select 1 from public.usuarios_autorizados u where u.id=(select auth.uid()) and u.activo and u.rol in ('admin','usuario')));
create policy partes_historial_lectura on public.historial_partes
 for select to authenticated
 using (exists(select 1 from public.usuarios_autorizados u where u.id=(select auth.uid()) and u.activo));
create policy partes_historial_insertar on public.historial_partes
 for insert to authenticated
 with check (usuario_id=(select auth.uid()) and exists(select 1 from public.usuarios_autorizados u where u.id=(select auth.uid()) and u.activo and u.rol in ('admin','usuario')));

-- Guarda todas las partes en una transacción. Rechaza ediciones concurrentes
-- y manzanas repetidas, incluso cuando A-B se solapa con B-D.
create or replace function public.guardar_territorio_partes(
  p_territorio_id bigint,
  p_partes jsonb,
  p_expected jsonb default '[]'::jsonb
) returns setof public.territorio_partes
language plpgsql
security invoker
set search_path = ''
as $$
declare
 v_actual jsonb;
 v_parte jsonb;
 v_db public.territorio_partes%rowtype;
 v_anterior public.territorio_partes%rowtype;
 v_id bigint;
 v_ids bigint[]:=array[]::bigint[];
 v_manzanas text;
 v_est text;
 v_asignacion date;
 v_visita date;
 v_asignado text;
 v_persona text;
 v_obs text;
 v_orden integer:=0;
 v_abc text:='ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
 v_trozo text;
 v_inicio integer;
 v_fin integer;
 v_letra text;
 v_ocupadas text[]:=array[]::text[];
 v_tokens text[];
 v_i integer;
 v_j integer;
begin
 if not exists(select 1 from public.usuarios_autorizados u
               where u.id=(select auth.uid()) and u.activo and u.rol in ('admin','usuario')) then
   raise exception 'No autorizado para editar partes' using errcode='42501';
 end if;
 if not exists(select 1 from public.territorios t where t.id=p_territorio_id) then
   raise exception 'Territorio inexistente';
 end if;
 if jsonb_typeof(p_partes) is distinct from 'array' or jsonb_array_length(p_partes)>27 or
       (jsonb_array_length(p_partes)>0 and jsonb_array_length(p_partes)<2) then
   raise exception 'Se requieren 2 a 27 partes, o 0 para volver al estado único';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(60422, (p_territorio_id % 2147483647)::integer);
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version) order by id),'[]'::jsonb)
 into v_actual from public.territorio_partes where territorio_id=p_territorio_id;
 if p_expected is distinct from v_actual then
   raise exception 'Las partes cambiaron en otra sesión. Volvé a abrir el territorio antes de guardar.';
 end if;

 for v_parte in select value from jsonb_array_elements(p_partes) loop
   v_orden:=v_orden+1;
   v_manzanas:=upper(regexp_replace(coalesce(v_parte->>'manzanas',''),'\s+','','g'));
   if v_manzanas !~ '^[A-ZÑ](-[A-ZÑ])?(,[A-ZÑ](-[A-ZÑ])?)*$' then
     raise exception 'Usá letras de manzanas, por ejemplo A-B o C,D';
   end if;
   foreach v_trozo in array string_to_array(v_manzanas,',') loop
     v_tokens:=string_to_array(v_trozo,'-');
     v_inicio:=position(v_tokens[1] in v_abc);
     v_fin:=position(v_tokens[coalesce(array_length(v_tokens,1),1)] in v_abc);
     if v_inicio=0 or v_fin=0 or v_inicio>v_fin then
       raise exception 'Rango de manzanas inválido: %', v_trozo;
     end if;
     for v_j in v_inicio..v_fin loop
       v_letra:=substring(v_abc from v_j for 1);
       if v_letra=any(v_ocupadas) then
         raise exception 'La manzana % aparece en más de una parte',v_letra;
       end if;
       v_ocupadas:=array_append(v_ocupadas,v_letra);
     end loop;
   end loop;
   v_est:=coalesce(v_parte->>'estado','available');
   if v_est not in ('available','assigned','done') then
     raise exception 'Estado inválido';
   end if;
   v_asignacion:=nullif(v_parte->>'fecha_asignacion','')::date;
   v_visita:=nullif(v_parte->>'fecha_ultima_visita','')::date;
   if v_est='done' and v_visita is null then v_visita:=current_date; end if;
   if v_est='assigned' then v_visita:=null; end if;
   if v_asignacion is not null and v_visita is not null and v_visita<v_asignacion then
     raise exception 'La visita no puede ser anterior a la asignación';
   end if;
   v_asignado:=left(coalesce(v_parte->>'asignado_a',''),200);
   v_persona:=left(coalesce(v_parte->>'persona',''),200);
   v_obs:=left(coalesce(v_parte->>'observaciones',''),3000);
   v_id:=nullif(v_parte->>'id','')::bigint;
   if v_id is null then
     insert into public.territorio_partes(territorio_id,orden,manzanas,estado,fecha_asignacion,
       fecha_ultima_visita,asignado_a,persona,observaciones,updated_by)
     values(p_territorio_id,v_orden,v_manzanas,v_est,v_asignacion,v_visita,v_asignado,v_persona,v_obs,(select auth.uid()))
     returning * into v_db;
     v_id:=v_db.id;
     insert into public.historial_partes(territorio_id,parte_id,accion,datos,usuario_id)
     values(p_territorio_id,v_id,'crear',to_jsonb(v_db),(select auth.uid()));
   else
     select * into v_anterior from public.territorio_partes where id=v_id and territorio_id=p_territorio_id;
     if not found then raise exception 'Parte ajena o inexistente'; end if;
     update public.territorio_partes set
       orden=v_orden,manzanas=v_manzanas,estado=v_est,fecha_asignacion=v_asignacion,
       fecha_ultima_visita=v_visita,asignado_a=v_asignado,persona=v_persona,observaciones=v_obs,
       updated_at=now(),updated_by=(select auth.uid()),version=version+1
     where id=v_id and (orden,manzanas,estado,fecha_asignacion,fecha_ultima_visita,asignado_a,persona,observaciones)
       is distinct from (v_orden,v_manzanas,v_est,v_asignacion,v_visita,v_asignado,v_persona,v_obs)
     returning * into v_db;
     if found then
       insert into public.historial_partes(territorio_id,parte_id,accion,datos,usuario_id)
       values(p_territorio_id,v_id,'modificar',to_jsonb(v_db),(select auth.uid()));
     end if;
   end if;
   v_ids:=array_append(v_ids,v_id);
 end loop;
 for v_anterior in select * from public.territorio_partes
                   where territorio_id=p_territorio_id and not (id=any(v_ids)) loop
   insert into public.historial_partes(territorio_id,parte_id,accion,datos,usuario_id)
   values(p_territorio_id,v_anterior.id,'quitar',to_jsonb(v_anterior),(select auth.uid()));
   delete from public.territorio_partes where id=v_anterior.id;
 end loop;
 return query select * from public.territorio_partes
     where territorio_id=p_territorio_id order by orden,id;
end;
$$;
revoke all on function public.guardar_territorio_partes(bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.guardar_territorio_partes(bigint,jsonb,jsonb) to authenticated;
