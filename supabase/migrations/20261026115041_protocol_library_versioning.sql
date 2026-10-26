-- Nova versão completa; as consultas e prescrições antigas mantêm os seus IDs.
create or replace function public.gc_save_protocol_version(p_protocol_id uuid, p_phase_id uuid, p_phase jsonb, p_exercises jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  source public.protocols_catalog%rowtype;
  phase public.protocol_phases%rowtype;
  new_protocol uuid;
  new_phase uuid;
begin
  if auth.uid() is distinct from '32a24abe-cd69-42d9-bf3a-3355f4f6e28c'::uuid then
    raise exception 'Acesso reservado ao titular.';
  end if;
  select * into source from public.protocols_catalog where id = p_protocol_id for update;
  if not found or not source.is_active then
    raise exception 'Este protocolo já tem uma versão mais recente. Reabra a biblioteca.';
  end if;
  if not exists (select 1 from public.protocol_phases where id = p_phase_id and protocol_id = p_protocol_id) then
    raise exception 'A fase não pertence ao protocolo.';
  end if;
  if jsonb_typeof(p_phase) is distinct from 'object'
    or jsonb_typeof(p_phase->'data') is distinct from 'object'
    or jsonb_typeof(p_exercises) is distinct from 'array'
    or nullif(trim(p_phase->>'name'), '') is null then
    raise exception 'Conteúdo da fase inválido.';
  end if;
  if (p_phase->>'anchor_from')::integer < 0 or (p_phase->>'anchor_to')::integer < 0
    or (p_phase->>'anchor_to')::integer <= (p_phase->>'anchor_from')::integer then
    raise exception 'O fim do período deve ser posterior ao início.';
  end if;
  insert into public.protocols_catalog(region,name,kind,is_active,sort_order,data)
    values(source.region,source.name,source.kind,true,source.sort_order,
      source.data || jsonb_build_object('previous_version_id',source.id,'version',coalesce((source.data->>'version')::integer,1)+1))
    returning id into new_protocol;
  for phase in select * from public.protocol_phases where protocol_id = source.id order by phase_order loop
    insert into public.protocol_phases(protocol_id,phase_order,name,anchor_kind,anchor_from,anchor_to,data)
      values(new_protocol,phase.phase_order,
        case when phase.id = p_phase_id then p_phase->>'name' else phase.name end,
        case when phase.id = p_phase_id then p_phase->>'anchor_kind' else phase.anchor_kind end,
        case when phase.id = p_phase_id then (p_phase->>'anchor_from')::integer else phase.anchor_from end,
        case when phase.id = p_phase_id then (p_phase->>'anchor_to')::integer else phase.anchor_to end,
        case when phase.id = p_phase_id then p_phase->'data' else phase.data end)
      returning id into new_phase;
    if phase.id = p_phase_id then
      insert into public.protocol_phase_exercises(phase_id,exercise_id,sort_order,context,is_optional,prescription_defaults,clinical_note)
        select new_phase,x.exercise_id,x.sort_order,x.context,x.is_optional,x.prescription_defaults,x.clinical_note
        from jsonb_to_recordset(p_exercises) as x(exercise_id uuid,sort_order integer,context text,is_optional boolean,prescription_defaults jsonb,clinical_note text);
    else
      insert into public.protocol_phase_exercises(phase_id,exercise_id,sort_order,context,is_optional,prescription_defaults,clinical_note)
        select new_phase,exercise_id,sort_order,context,is_optional,prescription_defaults,clinical_note
        from public.protocol_phase_exercises where phase_id = phase.id;
    end if;
  end loop;
  update public.protocols_catalog set is_active = false where id = source.id;
  return new_protocol;
end;
$$;
revoke all on function public.gc_save_protocol_version(uuid,uuid,jsonb,jsonb) from public, anon;
grant execute on function public.gc_save_protocol_version(uuid,uuid,jsonb,jsonb) to authenticated;
