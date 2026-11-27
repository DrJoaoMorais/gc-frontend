-- A data de início em clinics.extra_fields.faturacao_web_desde é opt-in.
-- A migração não aplica preços nem altera dados históricos.
alter table public.registos_financeiros
  add column web_preco_pendente boolean not null default false,
  add column web_preco_confirmado_at timestamptz,
  add column web_pedido_id uuid references public.agenda_envios_faturacao(id),
  add column web_recebido_doente_at timestamptz,
  add column web_transferido_at timestamptz,
  add column web_honorarios_recebidos_at timestamptz;

alter table public.registos_financeiros add constraint registos_financeiros_web_consistente check (
  (not web_preco_pendente or
    (valor is not distinct from 0::numeric and valor_manual is null and valor_faturado is null
      and web_preco_confirmado_at is null))
  and (web_preco_confirmado_at is null or
    (valor is not null and valor > 0 and valor is not distinct from valor_manual
      and valor is not distinct from valor_faturado))
  and (web_recebido_doente_at is null or web_preco_confirmado_at is not null)
  and (web_pedido_id is null or valor_faturado > 0 and valor_faturado is not null)
  and (web_transferido_at is null or web_recebido_doente_at is not null)
  and (web_honorarios_recebidos_at is null or web_transferido_at is not null)
);

alter table public.controlo_faturacao add column web_pedido boolean not null default false,
  add column web_historico_estados jsonb;
create policy controlo_faturacao_web_clinica on public.controlo_faturacao
as restrictive for all to authenticated
using (not web_pedido or exists (
  select 1 from public.entidades_financeiras e join public.clinic_members m on m.clinic_id=e.clinic_id
  where e.id=controlo_faturacao.entidade_id and m.user_id=auth.uid()
    and m.is_active and m.role in ('medico','super_admin')
));

create function public.proteger_registo_faturacao_web()
returns trigger language plpgsql set search_path = '' as $$
declare
  dia date;
begin
  if tg_op='INSERT' then
    new.web_preco_pendente := false;
    new.web_preco_confirmado_at := null;
    new.web_pedido_id := null;
    new.web_recebido_doente_at := null;
    new.web_transferido_at := null;
    new.web_honorarios_recebidos_at := null;
    -- Trata apenas novos registos. Num upsert sobre um registo anterior,
    -- o preço legado e a entidade original continuam a ser decididos pelo sync existente.
    select (a.start_at at time zone 'Europe/Lisbon')::date into dia
    from public.appointments a join public.clinics c on c.id=a.clinic_id
    join public.entidades_financeiras e on e.clinic_id=c.id
    where a.id=new.appointment_id and a.patient_id=new.patient_id
      and c.slug='joao-morais-web' and c.is_active and e.id=new.entidade_id and e.tipo='acto'
      and a.mode::text<>'bloqueio' and a.procedure_type is not null
      and (a.start_at at time zone 'Europe/Lisbon')::date >= nullif(c.extra_fields->>'faturacao_web_desde','')::date
      and not exists (select 1 from public.registos_financeiros r where r.appointment_id=a.id);
    if dia is not null then
      new.web_preco_pendente := true;
      new.valor := 0;
      new.valor_manual := null;
      new.valor_faturado := null;
      new.data := dia;
      new.periodo := to_char(dia,'YYYY-MM');
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.web_pedido_id is not null or old.web_recebido_doente_at is not null then
      raise exception 'Este ato já tem um pedido de faturação registado.';
    end if;
    return old;
  end if;

  if row(new.web_preco_confirmado_at,new.web_pedido_id,new.web_recebido_doente_at,
        new.web_transferido_at,new.web_honorarios_recebidos_at)
    is distinct from row(old.web_preco_confirmado_at,old.web_pedido_id,old.web_recebido_doente_at,
        old.web_transferido_at,old.web_honorarios_recebidos_at)
    and not exists (
      select 1 from public.entidades_financeiras e join public.clinics c on c.id=e.clinic_id
      join public.clinic_members m on m.clinic_id=c.id
      where e.id=old.entidade_id and (c.slug='joao-morais-web' or (c.slug='athletix' and new.web_pedido_id is not null and new.web_preco_confirmado_at is null and new.web_recebido_doente_at is null))
        and m.user_id=auth.uid() and m.is_active and m.role in ('medico','super_admin')
    ) then raise exception 'Sem permissão para faturar nesta clínica.'; end if;

  if old.web_preco_confirmado_at is not null and old.web_pedido_id is null
    and old.web_recebido_doente_at is null and new.financial_status='honorarios_dispensados' then
    new.web_preco_pendente := true;
    new.web_preco_confirmado_at := null;
    new.valor := 0;
    new.valor_manual := null;
    new.valor_faturado := null;
  end if;

  if old.web_preco_pendente or old.web_preco_confirmado_at is not null then
    select (a.start_at at time zone 'Europe/Lisbon')::date into dia
    from public.appointments a join public.entidades_financeiras e on e.clinic_id=a.clinic_id
    where a.id=old.appointment_id and e.id=old.entidade_id;
    if dia is not null then
      new.data := dia;
      new.periodo := to_char(dia,'YYYY-MM');
    end if;
  end if;
  if old.web_preco_pendente and new.web_preco_confirmado_at is null then
    new.web_preco_pendente := true;
    new.valor := 0;
    new.valor_manual := null;
    new.valor_faturado := null;
  end if;

  if old.web_recebido_doente_at is not null and (
      new.web_recebido_doente_at is distinct from old.web_recebido_doente_at
      or (old.web_transferido_at is not null and new.web_transferido_at is distinct from old.web_transferido_at)
      or (old.web_honorarios_recebidos_at is not null and new.web_honorarios_recebidos_at is distinct from old.web_honorarios_recebidos_at)
      or row(new.valor,new.valor_manual,new.valor_faturado,new.entidade_id,new.patient_id,new.appointment_id,
             new.appt_status,new.financial_status,new.data,new.tipo_acto) is distinct from
         row(old.valor,old.valor_manual,old.valor_faturado,old.entidade_id,old.patient_id,old.appointment_id,
             old.appt_status,old.financial_status,old.data,old.tipo_acto)
    ) then raise exception 'Este ato já tem um recebimento confirmado.'; end if;
  if old.web_pedido_id is not null and
    row(new.web_pedido_id,new.web_preco_confirmado_at,new.entidade_id,new.appointment_id,
        new.patient_id,new.data,new.periodo,new.tipo_acto,new.appt_status,new.financial_status,
        new.valor,new.valor_manual,new.valor_faturado)
    is distinct from
    row(old.web_pedido_id,old.web_preco_confirmado_at,old.entidade_id,old.appointment_id,
        old.patient_id,old.data,old.periodo,old.tipo_acto,old.appt_status,old.financial_status,
        old.valor,old.valor_manual,old.valor_faturado) then
    raise exception 'Este ato já tem um pedido de faturação registado.';
  end if;

  if old.web_preco_confirmado_at is not null and new.web_pedido_id is null
    and new.web_preco_confirmado_at is not distinct from old.web_preco_confirmado_at
    and row(new.valor,new.valor_manual,new.valor_faturado)
        is distinct from row(old.valor,old.valor_manual,old.valor_faturado) then
    raise exception 'Acerte o preço em Financeiro > Faturação.';
  end if;
  return new;
end;
$$;

create trigger proteger_registo_faturacao_web
before insert or update or delete on public.registos_financeiros
for each row execute function public.proteger_registo_faturacao_web();

create function public.proteger_marcacao_faturacao_web()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.registos_financeiros where appointment_id=old.id
             and (web_pedido_id is not null or web_recebido_doente_at is not null)) then
    if tg_op='DELETE' then
      raise exception 'Esta consulta já tem faturação ou recebimento registado.';
    elsif row(new.clinic_id,new.patient_id,new.start_at,new.procedure_type,new.mode,new.status,new.financial_status)
       is distinct from row(old.clinic_id,old.patient_id,old.start_at,old.procedure_type,old.mode,old.status,old.financial_status) then
      raise exception 'Esta consulta já tem faturação ou recebimento registado.';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

create trigger proteger_marcacao_faturacao_web
before update of clinic_id,patient_id,start_at,procedure_type,mode,status,financial_status or delete
on public.appointments for each row execute function public.proteger_marcacao_faturacao_web();

-- O fecho antigo continua disponível para as outras clínicas e períodos.
-- A regra é aplicada mesmo quando a RLS de clínicas oculta a origem ao autor.
create schema gc_faturacao_private;
revoke all on schema gc_faturacao_private from public,anon,authenticated;

create function gc_faturacao_private.proteger_envio_faturacao_web()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  inicio text;
  origem_id uuid;
  pedido uuid;
begin
  if tg_op='UPDATE' and old.web_pedido and (row(new.envio_id,new.registo_financeiro_id,new.entidade_id,new.granularidade,new.chave,new.data_referencia,new.web_pedido)
    is distinct from row(old.envio_id,old.registo_financeiro_id,old.entidade_id,old.granularidade,old.chave,old.data_referencia,old.web_pedido)
    or (old.enviado_contabilista_at is not null and new.enviado_contabilista_at is not null and new.enviado_contabilista_at is distinct from old.enviado_contabilista_at)) then
    raise exception 'O histórico deste pedido está bloqueado.';
  end if;
  select c.id,(select nullif(w.extra_fields->>'faturacao_web_desde','') from public.clinics w where w.slug='joao-morais-web' and w.is_active) into origem_id,inicio
  from public.entidades_financeiras e join public.clinics c on c.id=e.clinic_id
  where e.id=new.entidade_id and c.slug in ('joao-morais-web','athletix');

  if new.web_pedido or (inicio is not null and
    (case when new.granularidade='mensal' then to_char(new.data_referencia,'YYYY-MM') >= left(inicio,7)
      else new.data_referencia >= inicio::date end)) then
    if not exists (
      select 1 from public.clinic_members m where m.clinic_id=origem_id and m.user_id=auth.uid()
        and m.is_active and m.role in ('medico','super_admin')
    ) then raise exception 'Sem permissão para faturar nesta clínica.'; end if;
    select r.web_pedido_id into pedido from public.registos_financeiros r
    where r.id=new.registo_financeiro_id and r.entidade_id=new.entidade_id;
    if pedido is not null and (new.estado='pago' or new.pago_at is not null) then
      raise exception 'Confirme os movimentos em Financeiro > Faturação.';
    end if;
    if pedido is null and new.estado='por_enviar' and new.envio_id is null and new.enviado_contabilista_at is null then
      return new;
    end if;
    if pedido is null or not new.web_pedido or new.envio_id is distinct from pedido
      or new.granularidade <> 'registo' or new.chave <> new.registo_financeiro_id::text then
      raise exception 'Use Financeiro > Faturação para este ato João Morais Web.';
    end if;
  end if;
  if new.web_pedido and tg_op='UPDATE' then
    if new.estado is distinct from (case when new.recibo_emitido_at is not null then 'recibo_emitido'
      when new.enviado_contabilista_at is not null then 'enviado_contabilista' else 'por_enviar' end)
      or (new.recibo_emitido_at is not null and new.enviado_contabilista_at is null) then
      raise exception 'Estado de emissão incompatível com o envio.';
    end if;
    new.web_historico_estados := old.web_historico_estados;
    if new.estado is distinct from old.estado then
      new.web_historico_estados := coalesce(old.web_historico_estados,'[]'::jsonb) ||
        jsonb_build_array(jsonb_build_object('de',old.estado,'para',new.estado,'autor',auth.uid(),'data',clock_timestamp()));
    end if;
  end if;
  return new;
end;
$$;

create trigger proteger_envio_faturacao_web
before insert or update of entidade_id,granularidade,chave,data_referencia,registo_financeiro_id,envio_id,enviado_contabilista_at,recibo_emitido_at,estado,pago_at,web_pedido,web_historico_estados
on public.controlo_faturacao for each row execute function gc_faturacao_private.proteger_envio_faturacao_web();
revoke all on function gc_faturacao_private.proteger_envio_faturacao_web() from public,anon,authenticated;

-- Função invocadora: as permissões das tabelas e o isolamento por clínica continuam aplicáveis.
create function public.faturacao_web_registar(p_acao text,p_itens jsonb,p_destinatario text default null,p_previa text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  origem public.clinics%rowtype;
  athletix uuid;
  dia_pedido date;
  reg public.registos_financeiros%rowtype;
  ato public.appointments%rowtype;
  item jsonb;
  doente record;
  assunto text;
  corpo text;
  linhas jsonb := '[]'::jsonb;
  inicio date;
  hoje date := (now() at time zone 'Europe/Lisbon')::date;
  instante timestamptz := clock_timestamp();
  email text;
  destino uuid;
  pedido uuid;
  lote_envio uuid;
  preco numeric;
  ids uuid[] := array[]::uuid[];
begin
  select * into strict origem from public.clinics where slug='joao-morais-web' and is_active;
  if auth.uid() is null or not exists (
    select 1 from public.clinic_members m where m.user_id=auth.uid()
      and m.clinic_id=origem.id and m.is_active and m.role in ('medico','super_admin')
  ) then raise exception 'Sem permissão para faturar nesta clínica.'; end if;

  select id into athletix from public.clinics where slug='athletix' and is_active;
  inicio := nullif(origem.extra_fields->>'faturacao_web_desde','')::date;
  if inicio is null then raise exception 'Configure a data de início do circuito Web.'; end if;
  if p_acao is null or p_acao not in ('preco','prever','pedido','envio','emitida','corrigir_emissao','corrigir_envio','doente','transferencia','honorarios')
    or jsonb_typeof(p_itens) is distinct from 'array'
    or jsonb_array_length(p_itens) not between 1 and 100 then
    raise exception 'Seleção inválida.';
  end if;
  if p_acao in ('prever','pedido') then
    select id,btrim(coalesce(extra_fields->>'faturacao_destinatarios',billing_email)) into destino,email from public.clinics
      where slug='novo-cuidar' and is_active;
    if nullif(email,'') is null or exists (select 1 from unnest(string_to_array(email,',')) as recipients(address) where btrim(address) !~ '^[^[:space:]@,;?&#]+@[^[:space:]@,;?&#]+\.[^[:space:]@,;?&#]+$')
      or email is distinct from p_destinatario then
      raise exception 'Confirme o email de faturação da Novo Cuidar na configuração.';
    end if;
    pedido := gen_random_uuid();
  end if;

  for item in select value from jsonb_array_elements(p_itens) order by value->>'id' loop
    -- Bloqueia pela mesma ordem da sincronização Agenda → Finanças.
    select a.* into strict ato from public.appointments a
      join public.registos_financeiros r on r.appointment_id=a.id
      where r.id=(item->>'id')::uuid and (a.clinic_id=origem.id or (a.clinic_id=athletix and p_acao in ('prever','pedido','envio','emitida','corrigir_emissao','corrigir_envio') and exists (
        select 1 from public.clinic_members m where m.clinic_id=athletix and m.user_id=auth.uid() and m.is_active and m.role in ('medico','super_admin')
      ))) for share of a;
    select r.* into strict reg from public.registos_financeiros r
      join public.entidades_financeiras e on e.id=r.entidade_id
      where r.id=(item->>'id')::uuid and e.clinic_id=ato.clinic_id and e.tipo='acto'
      for update of r;
    if reg.id=any(ids) or reg.updated_at is distinct from (item->>'versao')::timestamptz
      or reg.appointment_id is distinct from ato.id or reg.patient_id is distinct from ato.patient_id
      or reg.patient_id is null or coalesce(reg.tipo_acto,'')=''
      or ato.mode::text='bloqueio' or ato.status is distinct from 'done'
      or reg.appt_status is distinct from 'done' or coalesce(ato.financial_status,'normal') is distinct from reg.financial_status
      or reg.financial_status='honorarios_dispensados'
      or reg.data is distinct from (ato.start_at at time zone 'Europe/Lisbon')::date
      or reg.data not between inicio and hoje then
      raise exception 'O ato mudou ou não é elegível. Atualize a lista e confirme a Agenda.';
    end if;
    ids := array_append(ids,reg.id);

    if p_acao in ('preco','prever','pedido') and (reg.web_pedido_id is not null or exists (
      select 1 from public.controlo_faturacao f where f.entidade_id=reg.entidade_id
        and (f.envio_id is not null or f.enviado_contabilista_at is not null or f.estado<>'por_enviar')
        and ((f.granularidade='registo' and f.chave=reg.id::text)
          or (f.granularidade in ('dia','mensal') and
            f.chave=case when f.granularidade='dia' then reg.data::text else to_char(reg.data,'YYYY-MM') end
            and (f.enviado_contabilista_at is null or reg.created_at is null or reg.created_at<=f.enviado_contabilista_at)))
    )) then raise exception 'Este ato já tem histórico de faturação.'; end if;

    if p_acao='preco' then
      preco := (item->>'preco')::numeric;
      if preco is null or not (preco > 0 and preco <= 999999.99) or preco <> round(preco,2) then
        raise exception 'Introduza um preço positivo com até duas casas decimais.';
      end if;
      if reg.web_recebido_doente_at is not null then
        raise exception 'O pagamento do doente já foi confirmado. O preço está bloqueado.';
      end if;
      update public.registos_financeiros set valor=preco,valor_manual=preco,valor_faturado=preco,
        web_preco_confirmado_at=instante,web_preco_pendente=false where id=reg.id;
      continue;
    end if;

    if p_acao in ('prever','pedido') then
      dia_pedido := coalesce(dia_pedido,reg.data);
      if reg.data <> dia_pedido then raise exception 'Selecione consultas do mesmo dia.'; end if;
    end if;
    if reg.valor_faturado is null or reg.valor_faturado <= 0 or (ato.clinic_id=origem.id and (
      reg.web_preco_confirmado_at is null or reg.valor_faturado is distinct from reg.valor or reg.valor_manual is distinct from reg.valor)) then
      raise exception 'Confirme primeiro o preço e os honorários.';
    end if;
    if p_acao in ('prever','pedido') then
      select full_name,nif,address_line1,postal_code,city
        into strict doente from public.patients where id=reg.patient_id;
      if nullif(btrim(doente.full_name),'') is null or nullif(btrim(doente.nif),'') is null
        or nullif(btrim(doente.address_line1),'') is null or nullif(btrim(doente.postal_code),'') is null
        or nullif(btrim(doente.city),'') is null then
        raise exception 'Complete o nome, NIF e morada fiscal antes de preparar o pedido.';
      end if;
      -- O montante do snapshot vem sempre da linha financeira bloqueada.
      linhas := linhas || jsonb_build_array(jsonb_build_object('id',reg.id,'data',reg.data,
        'clinic_id',ato.clinic_id,'ato',reg.tipo_acto,'valor_faturado',reg.valor_faturado,'patient_id',reg.patient_id,
        'fiscal',to_jsonb(doente)));
    elsif p_acao in ('emitida','corrigir_emissao') then
      update public.controlo_faturacao set
        recibo_emitido_at=case when p_acao='emitida' then instante else null end,
        estado=case when p_acao='emitida' then 'recibo_emitido' else 'enviado_contabilista' end
      where web_pedido and registo_financeiro_id=reg.id and envio_id=reg.web_pedido_id
        and enviado_contabilista_at is not null and (recibo_emitido_at is null)=(p_acao='emitida');
      if not found then raise exception 'Atualize o estado da emissão.'; end if;
    elsif p_acao in ('envio','corrigir_envio') then
      if reg.web_pedido_id is null then raise exception 'Prepare primeiro o pedido.'; end if;
      lote_envio := coalesce(lote_envio,reg.web_pedido_id);
      if lote_envio is distinct from reg.web_pedido_id then
        raise exception 'Confirme um pedido de cada vez.';
      end if;
      update public.controlo_faturacao set enviado_contabilista_at=case when p_acao='envio' then instante else null end,
        estado=case when p_acao='envio' then 'enviado_contabilista' else 'por_enviar' end
        where registo_financeiro_id=reg.id and envio_id=reg.web_pedido_id and recibo_emitido_at is null and (enviado_contabilista_at is null)=(p_acao='envio');
      if not found then raise exception 'O envio já foi registado.'; end if;
    elsif p_acao='doente' and reg.web_recebido_doente_at is null then
      update public.registos_financeiros set web_recebido_doente_at=instante where id=reg.id;
    elsif p_acao='transferencia' and reg.web_recebido_doente_at is not null and reg.web_transferido_at is null then
      update public.registos_financeiros set web_transferido_at=instante where id=reg.id;
    elsif p_acao='honorarios' and reg.web_transferido_at is not null and reg.web_honorarios_recebidos_at is null then
      update public.registos_financeiros set web_honorarios_recebidos_at=instante where id=reg.id;
    else raise exception 'Confirme primeiro o movimento anterior ou atualize a lista.';
    end if;
  end loop;

  if lote_envio is not null and exists (
    select 1 from public.controlo_faturacao where envio_id=lote_envio and (enviado_contabilista_at is null)=(p_acao='envio')
  ) then raise exception 'Confirme todos os atos do pedido em simultâneo.'; end if;

  if pedido is not null then
    assunto := 'Pedido de faturação';
    select 'Bom dia,' || chr(10) || chr(10) || 'Peço a emissão de uma fatura por doente.' ||
      chr(10) || chr(10) || string_agg(bloco,chr(10) || chr(10) order by nome,patient_id) ||
      chr(10) || chr(10) || 'Obrigado,' || chr(10) || 'João Morais'
    into corpo
    from (
      select x->'fiscal'->>'full_name' as nome,x->>'patient_id' as patient_id,
        concat_ws(chr(10), 'Doente: ' || (x->'fiscal'->>'full_name'),
          'NIF: ' || (x->'fiscal'->>'nif'),
          'Morada: ' || (x->'fiscal'->>'address_line1') || ', ' ||
            (x->'fiscal'->>'postal_code') || ' ' || (x->'fiscal'->>'city'),
          string_agg('Valor da consulta: ' ||
            replace(to_char((x->>'valor_faturado')::numeric,'FM999990.00'),'.',',') || ' €',chr(10)
            order by x->>'data',x->>'id')
        ) as bloco
      from jsonb_array_elements(linhas) x group by x->>'patient_id',x->'fiscal'
    ) pedidos;
    if p_acao='prever' then
      return jsonb_build_object('subject',assunto,'body',corpo,'recipient',email);
    end if;
    if corpo is distinct from p_previa then
      raise exception 'Os dados fiscais mudaram. Volte a pré-visualizar o pedido.';
    end if;
    insert into public.agenda_envios_faturacao(id,clinic_id,snapshot)
      values(pedido,origem.id,jsonb_build_object('batch_id',pedido,'circuito','web_novo_cuidar',
        'clinic_id',origem.id,'billing_clinic_id',destino,'recipient',email,'subject',assunto,'body',corpo,
        'items',(select jsonb_agg(x-'fiscal'-'patient_id') from jsonb_array_elements(linhas) x)));
    update public.registos_financeiros set web_pedido_id=pedido where id=any(ids);
    insert into public.controlo_faturacao(entidade_id,granularidade,chave,data_referencia,registo_financeiro_id,envio_id,web_pedido)
      select entidade_id,'registo',id::text,data,id,pedido,true from public.registos_financeiros where id=any(ids)
    on conflict(entidade_id,granularidade,chave) do update
      set envio_id=excluded.envio_id,registo_financeiro_id=excluded.registo_financeiro_id,web_pedido=true
      where controlo_faturacao.estado='por_enviar' and controlo_faturacao.envio_id is null;
    if (select count(*) from public.controlo_faturacao where envio_id=pedido) <> cardinality(ids) then
      raise exception 'O pedido entrou em conflito com outro fecho.';
    end if;
  end if;
  return jsonb_build_object('id',pedido);
end;
$$;

revoke all on function public.faturacao_web_registar(text,jsonb,text,text) from public,anon;
grant execute on function public.faturacao_web_registar(text,jsonb,text,text) to authenticated;

-- O corpo do email reúne dados fiscais das origens incluídas no pedido.
create policy limitar_leitura_pedido_conjunto on public.agenda_envios_faturacao
as restrictive for select to authenticated using (
  snapshot->>'circuito' is distinct from 'web_novo_cuidar' or not exists (
    select 1 from jsonb_array_elements(snapshot->'items') item
    where not exists (select 1 from public.clinic_members m
      where m.clinic_id=coalesce((item->>'clinic_id')::uuid,agenda_envios_faturacao.clinic_id)
        and m.user_id=auth.uid() and m.is_active and m.role in ('medico','super_admin'))
  )
);
