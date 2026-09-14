-- Guarda o conteúdo revisto sem modificar honorários, pagamentos ou atos clínicos.
create table public.agenda_envios_faturacao (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  snapshot jsonb not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.agenda_envios_faturacao enable row level security;
create policy agenda_envios_read on public.agenda_envios_faturacao for select to authenticated
using (exists(select 1 from public.clinic_members cm where cm.user_id=auth.uid() and cm.is_active=true and (cm.role='super_admin' or (cm.role='medico' and cm.clinic_id=agenda_envios_faturacao.clinic_id))));
create policy agenda_envios_insert on public.agenda_envios_faturacao for insert to authenticated
with check (created_by=auth.uid() and exists(select 1 from public.clinic_members cm where cm.user_id=auth.uid() and cm.is_active=true and (cm.role='super_admin' or (cm.role='medico' and cm.clinic_id=agenda_envios_faturacao.clinic_id))));
revoke all on public.agenda_envios_faturacao from public, anon, authenticated;
grant select, insert on public.agenda_envios_faturacao to authenticated;
create index agenda_envios_clinic_date on public.agenda_envios_faturacao(clinic_id,created_at desc);
alter table public.controlo_faturacao add column envio_id uuid references public.agenda_envios_faturacao(id);

create or replace function public.agenda_confirmar_envio(p_items jsonb, p_snapshot jsonb)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  ent public.entidades_financeiras%rowtype;
  reg public.registos_financeiros%rowtype;
  old public.controlo_faturacao%rowtype;
  snapshot jsonb;
  batch uuid := gen_random_uuid();
  changed integer;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if jsonb_typeof(p_items) <> 'array' or coalesce(jsonb_array_length(p_items),0) = 0 then
    raise exception 'Não há atos para registar.';
  end if;
  if p_snapshot->>'recipient' is distinct from 'mariasantosp.pt@gmail.com'
     or coalesce(length(trim(p_snapshot->>'body')),0)=0
     or coalesce(length(trim(p_snapshot->>'subject')),0)=0 then
    raise exception 'Confirme o destinatário e o conteúdo do email.';
  end if;
  snapshot := p_snapshot || jsonb_build_object('batch_id',batch,'confirmed_by',auth.uid(),'confirmed_at',now());
  insert into public.agenda_envios_faturacao(id,clinic_id,snapshot) values(batch,(p_snapshot->>'clinic_id')::uuid,snapshot);
  -- Ordem consistente para evitar bloqueios cruzados em fechos concorrentes.
  for item in select value from jsonb_array_elements(p_items) order by value->>'entidade_id',value->>'chave' loop
    select * into strict ent from public.entidades_financeiras where id=(item->>'entidade_id')::uuid;
    if not exists (
      select 1 from public.clinic_members cm
      where cm.user_id=auth.uid() and cm.is_active=true
        and (cm.role='super_admin' or (cm.role='medico' and cm.clinic_id=ent.clinic_id))
    ) then raise exception 'Sem permissão para esta clínica.'; end if;
    if ent.clinic_id::text is distinct from p_snapshot->>'clinic_id' then
      raise exception 'O pedido contém outra clínica.';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(ent.id::text || ':' || (item->>'chave'),0));
    if item->>'granularidade'='registo' then
      select * into strict reg from public.registos_financeiros where id=(item->>'registo_financeiro_id')::uuid for share;
      if reg.updated_at is distinct from (p_snapshot->'record_versions'->>reg.id::text)::timestamptz then
        raise exception 'Um valor ou ato mudou desde a preparação do email. Reabra o fecho.';
      end if;
      if reg.entidade_id<>ent.id or reg.id::text is distinct from item->>'chave'
        or reg.data::text is distinct from item->>'data_referencia'
        or reg.appt_status is distinct from 'done'
        or reg.financial_status='honorarios_dispensados'
        or reg.data>(now() at time zone 'Europe/Lisbon')::date then
        raise exception 'O ato foi alterado. Reabra o fecho antes de registar o envio.';
      end if;
      if reg.appointment_id is not null and not exists(select 1 from public.appointments a where a.id=reg.appointment_id and a.status='done') then
        raise exception 'Confirme o estado do ato na agenda.';
      end if;
      if exists (
        select 1 from public.controlo_faturacao c where c.entidade_id=ent.id
        and (c.enviado_contabilista_at is not null or c.estado='enviado_contabilista')
        and ((c.granularidade='dia' and c.chave=reg.data::text) or (c.granularidade='mensal' and c.chave=to_char(reg.data,'YYYY-MM')))
        and (reg.created_at is null or c.enviado_contabilista_at is null or reg.created_at<=c.enviado_contabilista_at)
      ) then raise exception 'Este ato já pertence a um envio anterior. Reabra o fecho.'; end if;
    elsif item->>'granularidade'='mensal' then
      if ent.tipo<>'avenca' or item->>'chave' is distinct from to_char((item->>'data_referencia')::date,'YYYY-MM') then
        raise exception 'Avença ou mês inválido.';
      end if;
    else raise exception 'Tipo de fecho inválido.';
    end if;
    select * into old from public.controlo_faturacao
      where entidade_id=ent.id and granularidade=item->>'granularidade' and chave=item->>'chave' for update;
    if found and (old.enviado_contabilista_at is not null or old.estado='enviado_contabilista') then
      raise exception 'Um dos pedidos já foi enviado. Reabra o fecho para atualizar a lista.';
    end if;
    insert into public.controlo_faturacao(entidade_id,granularidade,chave,data_referencia,registo_financeiro_id,estado,enviado_contabilista_at,envio_id)
    values(ent.id,item->>'granularidade',item->>'chave',(item->>'data_referencia')::date,(item->>'registo_financeiro_id')::uuid,'enviado_contabilista',now(),batch)
    on conflict(entidade_id,granularidade,chave) do update
      set estado=case when controlo_faturacao.estado in ('pago','recibo_emitido') then controlo_faturacao.estado else 'enviado_contabilista' end,
          enviado_contabilista_at=excluded.enviado_contabilista_at,envio_id=excluded.envio_id
      where controlo_faturacao.enviado_contabilista_at is null and controlo_faturacao.estado<>'enviado_contabilista';
    get diagnostics changed = row_count;
    if changed<>1 then raise exception 'Envio já registado ou sem permissão. Atualize o fecho.'; end if;
  end loop;
end;
$$;
revoke all on function public.agenda_confirmar_envio(jsonb,jsonb) from public, anon;
grant execute on function public.agenda_confirmar_envio(jsonb,jsonb) to authenticated;
