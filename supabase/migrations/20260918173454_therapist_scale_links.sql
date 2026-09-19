-- Links de avaliação para profissionais. Preparação local; não aplicada em produção.
-- Um pedido imutável contém uma ou várias definições versionadas.
-- O acesso público depende exclusivamente de um token aleatório de 256 bits.
create schema if not exists gc_scale_private;
revoke all on schema gc_scale_private from public, anon, authenticated;
create table gc_scale_private.catalog (
 id text primary key, definition jsonb not null
);
revoke all on gc_scale_private.catalog from public, anon, authenticated;
create table public.therapist_scale_requests (
 id uuid primary key,
 assessment_id uuid not null references public.consultation_assessments(id) on delete restrict,
 consultation_id uuid not null references public.consultations(id) on delete restrict,
 clinic_id uuid not null, patient_id uuid not null,
 created_by uuid not null references auth.users(id),
 token_hash text not null unique,
 reference text not null, instructions text not null default '',
 definitions jsonb not null check(jsonb_typeof(definitions)='array'),
 answers jsonb not null default '{}', respondent jsonb not null default '{}', results jsonb not null default '{}',
 revision integer not null default 0,
 status text not null default 'pending' check(status in ('pending','completed','revoked')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '7 days', completed_at timestamptz,
 check(jsonb_typeof(answers)='object' and jsonb_typeof(respondent)='object'),
 check(length(instructions)<=3000)
);
create index therapist_scale_requests_assessment_idx on public.therapist_scale_requests(assessment_id);
create index therapist_scale_requests_consultation_idx on public.therapist_scale_requests(consultation_id);
create index therapist_scale_requests_author_idx on public.therapist_scale_requests(created_by);
alter table public.therapist_scale_requests enable row level security;
revoke all on public.therapist_scale_requests from public,anon,authenticated;
-- Sem acesso directo: todas as operações passam pelas funções restritas abaixo.

create function gc_scale_private.allowed(p_clinic uuid,p_author uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and auth.uid()=p_author and exists(
 select 1 from public.clinic_members cm where cm.user_id=auth.uid() and cm.clinic_id=p_clinic
 and cm.is_active and cm.role in ('super_admin','admin','medico'))
$$;

create function gc_scale_private.validate_fields(p_fields jsonb,p_values jsonb,p_complete boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare f jsonb;v jsonb;k text;rowvalue jsonb; n numeric;
begin
 if p_values is null or jsonb_typeof(p_values)<>'object' then raise exception 'invalid_values';end if;
 for k in select jsonb_object_keys(p_values) loop
   if not exists(select 1 from jsonb_array_elements(p_fields) x where x->>'id'=k) then raise exception 'unknown_field';end if;
 end loop;
 for f in select value from jsonb_array_elements(p_fields) loop
   v=p_values->(f->>'id');
   if v is null or v='null'::jsonb or v='""'::jsonb then
     if p_complete and (f->>'required')::boolean then raise exception 'missing_field: %',f->>'label';end if;
     continue;
   end if;
   case f->>'type'
   when 'text' then
     if jsonb_typeof(v)<>'string' or length(v#>>'{}')>(f->>'maxLength')::int or (p_complete and (f->>'required')::boolean and btrim(v#>>'{}')='') then raise exception 'invalid_text';end if;
   when 'choice' then
     if not exists(select 1 from jsonb_array_elements(f->'values') x where x=v) then raise exception 'invalid_choice';end if;
   when 'number' then
     if jsonb_typeof(v)<>'number' then raise exception 'invalid_number';end if;
     n=(v#>>'{}')::numeric;
     if n<(f->>'min')::numeric or n>(f->>'max')::numeric or ((f->>'step')::numeric=1 and n<>trunc(n)) then raise exception 'invalid_range';end if;
   when 'repeat' then
     if jsonb_typeof(v)<>'array' then raise exception 'invalid_rows';end if;
     if jsonb_array_length(v)>(f->>'maxItems')::int or (p_complete and jsonb_array_length(v)=0) then raise exception 'invalid_rows';end if;
     for rowvalue in select value from jsonb_array_elements(v) loop
       perform gc_scale_private.validate_fields(f->'fields',rowvalue,p_complete);
     end loop;
   else raise exception 'unknown_field_type';
   end case;
 end loop;
end $$;

create function public.therapist_scale_create(p_assessment uuid,p_ids text[],p_instructions text,p_reference text,p_token text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.consultation_assessments%rowtype;r public.therapist_scale_requests%rowtype;defs jsonb;hashed text;
begin
 select * into a from public.consultation_assessments where id=p_assessment;
 if not found or not gc_scale_private.allowed(a.clinic_id,a.author_user_id) then raise exception 'not_authorized';end if;
 if a.assessment_type<>'teleconsulta' or not exists(select 1 from public.consultations c where c.id=a.consultation_id and c.patient_id=a.patient_id and c.clinic_id=a.clinic_id) then raise exception 'invalid_context';end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' or p_request_id is null then raise exception 'invalid_token';end if;
 if coalesce(cardinality(p_ids),0)<1 or cardinality(p_ids)>8 or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x) then raise exception 'invalid_scales';end if;
 if coalesce(length(p_instructions),0)>3000 or coalesce(length(btrim(p_reference)),0) not between 1 and 120 then raise exception 'invalid_request';end if;
 select jsonb_agg(c.definition order by t.ord) into defs from unnest(p_ids) with ordinality t(id,ord) join gc_scale_private.catalog c on c.id=t.id;
 if coalesce(jsonb_array_length(defs),0)<>cardinality(p_ids) then raise exception 'unknown_scale';end if;
 hashed=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 -- Serializa repetições do mesmo pedido após falha de rede.
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into r from public.therapist_scale_requests where id=p_request_id;
 if found then
   if r.created_by<>auth.uid() or r.assessment_id<>p_assessment or r.token_hash<>hashed or r.definitions<>defs or r.instructions<>coalesce(p_instructions,'') or r.reference<>btrim(p_reference) then raise exception 'request_conflict';end if;
   return jsonb_build_object('id',r.id,'expires_at',r.expires_at);
 end if;
 insert into public.therapist_scale_requests(id,assessment_id,consultation_id,clinic_id,patient_id,created_by,token_hash,reference,instructions,definitions)
 values(p_request_id,a.id,a.consultation_id,a.clinic_id,a.patient_id,auth.uid(),hashed,btrim(p_reference),coalesce(p_instructions,''),defs) returning * into r;
 return jsonb_build_object('id',r.id,'expires_at',r.expires_at);
end $$;

create function public.therapist_scale_context(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.therapist_scale_requests%rowtype;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return jsonb_build_object('status','invalid');end if;
 select * into r from public.therapist_scale_requests where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 if not found or r.status='revoked' or r.expires_at<=now() then return jsonb_build_object('status','invalid');end if;
 if r.status='completed' then return jsonb_build_object('status','completed');end if;
 return jsonb_build_object('status','pending','reference',r.reference,'instructions',r.instructions,'definitions',r.definitions,'answers',r.answers,'respondent',r.respondent,'revision',r.revision,'expires_at',r.expires_at);
end $$;

create function public.therapist_scale_save(p_token text,p_revision integer,p_answers jsonb,p_respondent jsonb,p_complete boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.therapist_scale_requests%rowtype;d jsonb;a jsonb;f jsonb;k text;s numeric;groupscores jsonb;computed jsonb='{}';state text;dt date;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'invalid_link';end if;
 select * into r from public.therapist_scale_requests where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if not found or r.status='revoked' or r.expires_at<=now() then raise exception 'invalid_link';end if;
 if p_complete is null or p_revision is null then raise exception 'invalid_payload';end if;
 -- Uma repetição idêntica da conclusão é segura; não altera o resultado submetido.
 if r.status='completed' then
   if p_complete and r.answers=p_answers and r.respondent=p_respondent then return jsonb_build_object('revision',r.revision,'status','completed');end if;
   raise exception 'already_completed';
 end if;
 if p_revision<>r.revision then raise exception 'revision_conflict';end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>80000 or p_respondent is null or jsonb_typeof(p_respondent)<>'object' or octet_length(p_respondent::text)>2000 then raise exception 'invalid_payload';end if;
 for k in select jsonb_object_keys(p_respondent) loop
   if k not in ('name','profession','registration','date','attested') then raise exception 'unknown_metadata';end if;
   if k='attested' then if jsonb_typeof(p_respondent->k)<>'boolean' then raise exception 'invalid_attestation';end if;
   elsif jsonb_typeof(p_respondent->k)<>'string' or length(p_respondent->>k)>160 then raise exception 'invalid_metadata';end if;
 end loop;
 if coalesce(p_respondent->>'date','')<>'' then
   dt=(p_respondent->>'date')::date;
   if dt>current_date or dt<current_date-36525 then raise exception 'invalid_date';end if;
 end if;
 if p_complete and (coalesce(btrim(p_respondent->>'name'),'')='' or coalesce(btrim(p_respondent->>'profession'),'')='' or dt is null or p_respondent->'attested' is distinct from 'true'::jsonb) then raise exception 'missing_professional';end if;
 for k in select jsonb_object_keys(p_answers) loop
   if not exists(select 1 from jsonb_array_elements(r.definitions) x where x->>'id'=k) then raise exception 'unrequested_scale';end if;
 end loop;
 for d in select value from jsonb_array_elements(r.definitions) loop
   a=p_answers->(d->>'id');
   if a is null then if p_complete then raise exception 'missing_scale';end if;continue;end if;
   if jsonb_typeof(a)<>'object' then raise exception 'invalid_answer';end if;
   for k in select jsonb_object_keys(a) loop
     if k not in ('status','values','reason','notes') then raise exception 'unknown_answer_field';end if;
   end loop;
   state=a->>'status';
   if state is not null and state not in ('done','not_done') then raise exception 'invalid_status';end if;
   if p_complete and state is null then raise exception 'missing_status';end if;
   if (a ? 'notes' and (jsonb_typeof(a->'notes')<>'string' or length(a->>'notes')>1000)) or (a ? 'reason' and (jsonb_typeof(a->'reason')<>'string' or length(a->>'reason')>500)) then raise exception 'invalid_notes';end if;
   if state='not_done' then
     if p_complete and coalesce(btrim(a->>'reason'),'')='' then raise exception 'missing_reason';end if;
     if coalesce(a->'values','{}')<>'{}'::jsonb then raise exception 'unexpected_values';end if;
     computed=computed||jsonb_build_object(d->>'id',jsonb_build_object('status','not_done'));
   else
     perform gc_scale_private.validate_fields(d->'fields',coalesce(a->'values','{}'),p_complete);
     if p_complete and d->>'maxScore' is not null then
       s=0;groupscores='{}'::jsonb;
       for f in select value from jsonb_array_elements(d->'fields') loop
         if coalesce((f->>'score')::boolean,false) then
           s=s+(a->'values'->>(f->>'id'))::numeric;
           if f->>'group' is not null then groupscores=groupscores||jsonb_build_object(f->>'group',coalesce((groupscores->>(f->>'group'))::numeric,0)+(a->'values'->>(f->>'id'))::numeric);end if;
         end if;
       end loop;
       computed=computed||jsonb_build_object(d->>'id',jsonb_build_object('status','done','total',s,'groups',groupscores));
     else computed=computed||jsonb_build_object(d->>'id',jsonb_build_object('status',state));end if;
   end if;
 end loop;
 update public.therapist_scale_requests set answers=p_answers,respondent=p_respondent,revision=revision+1,
 status=case when p_complete then 'completed' else 'pending' end,
 completed_at=case when p_complete then now() else null end,
 results=case when p_complete then computed else '{}'::jsonb end
 where id=r.id returning revision into p_revision;
 return jsonb_build_object('revision',p_revision,'status',case when p_complete then 'completed' else 'pending' end);
end $$;

create function public.therapist_scale_list(p_consultation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'not_authorized';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'assessment_id',r.assessment_id,'reference',r.reference,'instructions',r.instructions,'status',case when r.status='pending' and r.expires_at<=now() then 'expired' else r.status end,'created_at',r.created_at,'expires_at',r.expires_at,'completed_at',r.completed_at,'definitions',r.definitions,'answers',case when r.status='completed' then r.answers else '{}'::jsonb end,'respondent',case when r.status='completed' then r.respondent else '{}'::jsonb end,'results',r.results) order by r.created_at desc)
 from public.therapist_scale_requests r where r.consultation_id=p_consultation and gc_scale_private.allowed(r.clinic_id,r.created_by)),'[]'::jsonb);
end $$;

create function public.therapist_scale_revoke(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.therapist_scale_requests%rowtype;
begin
 select * into r from public.therapist_scale_requests where id=p_id for update;
 if not found or not gc_scale_private.allowed(r.clinic_id,r.created_by) then raise exception 'not_authorized';end if;
 if r.status='completed' then raise exception 'already_completed';end if;
 update public.therapist_scale_requests set status='revoked' where id=p_id;
end $$;
revoke all on all functions in schema gc_scale_private from public,anon,authenticated;
revoke all on function public.therapist_scale_create(uuid,text[],text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.therapist_scale_context(text) from public,anon,authenticated;
revoke all on function public.therapist_scale_save(text,integer,jsonb,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.therapist_scale_list(uuid) from public,anon,authenticated;
revoke all on function public.therapist_scale_revoke(uuid) from public,anon,authenticated;
grant execute on function public.therapist_scale_create(uuid,text[],text,text,text,uuid) to authenticated;
grant execute on function public.therapist_scale_list(uuid),public.therapist_scale_revoke(uuid) to authenticated;
grant execute on function public.therapist_scale_context(text),public.therapist_scale_save(text,integer,jsonb,jsonb,boolean) to anon,authenticated;

insert into gc_scale_private.catalog(id,definition) values ('barthel', $catalog${"id": "barthel", "title": "Índice de Barthel — 0–100", "version": "2026-09-19.1", "source": "https://www.sralab.org/rehabilitation-measures/barthel-index", "description": "Avalia o desempenho habitual e a ajuda efetivamente necessária.", "fields": [{"id": "alimentacao", "label": "Alimentação", "type": "choice", "values": [0, 5, 10], "required": true, "score": true, "labels": {"0": "Incapaz", "5": "Necessita ajuda", "10": "Independente"}}, {"id": "banho", "label": "Banho", "type": "choice", "values": [0, 5], "required": true, "score": true, "labels": {"0": "Dependente", "5": "Independente"}}, {"id": "higiene", "label": "Higiene pessoal", "type": "choice", "values": [0, 5], "required": true, "score": true, "labels": {"0": "Necessita ajuda", "5": "Independente"}}, {"id": "vestir", "label": "Vestir", "type": "choice", "values": [0, 5, 10], "required": true, "score": true, "labels": {"0": "Dependente", "5": "Ajuda parcial", "10": "Independente"}}, {"id": "intestinal", "label": "Controlo intestinal", "type": "choice", "values": [0, 5, 10], "required": true, "score": true, "labels": {"0": "Incontinente", "5": "Acidente ocasional", "10": "Continente"}}, {"id": "vesical", "label": "Controlo vesical", "type": "choice", "values": [0, 5, 10], "required": true, "score": true, "labels": {"0": "Incontinente / algália sem autonomia", "5": "Acidente ocasional", "10": "Continente / autónomo com algália"}}, {"id": "sanita", "label": "Utilização da sanita", "type": "choice", "values": [0, 5, 10], "required": true, "score": true, "labels": {"0": "Dependente", "5": "Alguma ajuda", "10": "Independente"}}, {"id": "transferencia", "label": "Transferência cama/cadeira", "type": "choice", "values": [0, 5, 10, 15], "required": true, "score": true, "labels": {"0": "Incapaz / sem equilíbrio sentado", "5": "Ajuda importante; senta-se", "10": "Ajuda mínima / supervisão", "15": "Independente"}}, {"id": "mobilidade", "label": "Marcha / cadeira de rodas", "type": "choice", "values": [0, 5, 10, 15], "required": true, "score": true, "labels": {"0": "Imóvel", "5": "Cadeira de rodas autónoma >50 m", "10": "Marcha com ajuda >50 m", "15": "Marcha independente >50 m"}}, {"id": "escadas", "label": "Escadas", "type": "choice", "values": [0, 5, 10], "required": true, "score": true, "labels": {"0": "Incapaz", "5": "Necessita ajuda", "10": "Independente"}}], "maxScore": 100, "domain": "Autonomia nas atividades básicas da vida diária", "direction": "0 = dependência máxima nos itens avaliados · 100 = independência nesses itens. Cada item tem máximo próprio.", "interpretationVersion": "descriptive-2026-09-19"}$catalog$::jsonb);

insert into gc_scale_private.catalog(id,definition) values ('tug', $catalog${"id": "tug", "title": "TUG — Timed Up and Go", "version": "2026-09-19.1", "source": "https://www.cdc.gov/steadi/media/pdfs/steadi-assessment-tug-508.pdf", "description": "Cadeira com braços, calçado habitual e percurso de 3 m. Cronometrar do comando de início até voltar a sentar. Pode usar o auxiliar habitual.", "fields": [{"id": "tempo", "label": "Tempo (segundos)", "type": "number", "min": 0.01, "max": 3600, "step": 0.01, "score": false, "required": true}, {"id": "auxiliar", "label": "Auxiliar", "type": "choice", "values": ["Sem auxiliar", "Bengala", "Canadiana(s)", "Andarilho", "Outro"], "required": true}, {"id": "ajuda", "label": "Ajuda durante o teste", "type": "choice", "values": ["Sem ajuda", "Supervisão", "Ajuda física ligeira", "Ajuda física moderada / importante"], "required": true}, {"id": "contexto", "label": "Contexto para interpretação", "type": "choice", "values": ["Idoso (≥65 anos)", "Adulto <65 anos", "Não indicado"], "required": true}, {"id": "protocolo", "label": "Execução", "type": "choice", "values": ["Protocolo habitual — 3 m", "Execução adaptada"], "required": true}, {"id": "condicoes", "label": "Condições ou adaptações", "type": "text", "maxLength": 500, "required": false}, {"id": "passos_curtos", "label": "Passos curtos", "type": "choice", "values": ["Sim", "Não", "Não observado"], "required": false, "optionalGroup": "Observações da marcha"}, {"id": "hesitacao", "label": "Hesitação", "type": "choice", "values": ["Sim", "Não", "Não observado"], "required": false, "optionalGroup": "Observações da marcha"}, {"id": "desequilibrio", "label": "Desequilíbrio", "type": "choice", "values": ["Sim", "Não", "Não observado"], "required": false, "optionalGroup": "Observações da marcha"}, {"id": "arrastamento", "label": "Marcha arrastada", "type": "choice", "values": ["Sim", "Não", "Não observado"], "required": false, "optionalGroup": "Observações da marcha"}, {"id": "balanco", "label": "Balanço dos MS reduzido", "type": "choice", "values": ["Sim", "Não", "Não observado"], "required": false, "optionalGroup": "Observações da marcha"}, {"id": "paredes", "label": "Apoio em paredes / mobiliário", "type": "choice", "values": ["Sim", "Não", "Não observado"], "required": false, "optionalGroup": "Observações da marcha"}, {"id": "viragem", "label": "Viragem em bloco", "type": "choice", "values": ["Sim", "Não", "Não observado"], "required": false, "optionalGroup": "Observações da marcha"}], "maxScore": null, "domain": "Mobilidade funcional e rastreio de risco de queda", "direction": "Resultado em segundos: menos tempo = execução mais rápida. Não é uma pontuação de independência.", "interpretationVersion": "descriptive-2026-09-19"}$catalog$::jsonb);

insert into gc_scale_private.catalog(id,definition) values ('sppb', $catalog${"id": "sppb", "title": "SPPB — 0–12", "version": "2026-09-19.1", "source": "https://www.sralab.org/sites/default/files/2018-03/SPPB-Score-Tool.pdf", "description": "Aplicar o protocolo correspondente ao percurso escolhido (3 ou 4 m). Registar as três componentes e os tempos medidos. Marcha: usar a tentativa mais rápida, em centésimos de segundo. Cadeira: cinco levantamentos sem usar os membros superiores (MS). As pontuações são selecionadas pelo profissional; os tempos não as substituem automaticamente.", "fields": [{"id": "equilibrio", "label": "Pontuação do equilíbrio", "type": "number", "min": 0, "max": 4, "step": 1, "score": true, "required": true, "labels": {"0": "Não mantém pés juntos 10 s", "1": "Pés juntos 10 s; semi-tandem <10 s", "2": "Semi-tandem 10 s; tandem <3 s", "3": "Semi-tandem 10 s; tandem ≥3 e <10 s", "4": "Tandem 10 s"}, "compactLabels": true}, {"id": "marcha", "label": "Pontuação da marcha", "type": "number", "min": 0, "max": 4, "step": 1, "score": true, "required": true, "labels": {"0": "Não realiza, segundo protocolo", "1": "4 m: >8,70 s · 3 m: >6,52 s", "2": "4 m: 6,21–8,70 s · 3 m: 4,66–6,52 s", "3": "4 m: 4,82–6,20 s · 3 m: 3,62–4,65 s", "4": "4 m: <4,82 s · 3 m: <3,62 s"}, "compactLabels": true}, {"id": "cadeira", "label": "Pontuação de levantar da cadeira", "type": "number", "min": 0, "max": 4, "step": 1, "score": true, "required": true, "labels": {"0": "Não completa 5 vezes sem MS em 60 s", "1": "≥16,70 e ≤60 s", "2": "13,70–16,69 s", "3": "11,20–13,69 s", "4": "≤11,19 s"}, "compactLabels": true}, {"id": "percurso", "label": "Percurso da marcha (metros)", "type": "choice", "values": [3, 4], "required": true}, {"id": "medicoes", "label": "Tempos medidos e condições de realização", "type": "text", "maxLength": 500, "required": false}, {"id": "tempo_marcha_1", "label": "Marcha — tentativa 1 (s)", "type": "number", "min": 0.01, "max": 3600, "step": 0.01, "score": false, "required": false, "optionalGroup": "Tempos medidos"}, {"id": "tempo_marcha_2", "label": "Marcha — tentativa 2 (s)", "type": "number", "min": 0.01, "max": 3600, "step": 0.01, "score": false, "required": false, "optionalGroup": "Tempos medidos"}, {"id": "tempo_cadeira", "label": "Cinco levantamentos — tempo (s)", "type": "number", "min": 0.01, "max": 3600, "step": 0.01, "score": false, "required": false, "optionalGroup": "Tempos medidos"}], "maxScore": 12, "domain": "Desempenho físico dos membros inferiores", "direction": "0–12: maior pontuação = melhor desempenho. Equilíbrio, marcha e cadeira: 0–4 cada.", "interpretationVersion": "descriptive-2026-09-19"}$catalog$::jsonb);

insert into gc_scale_private.catalog(id,definition) values ('tinetti', $catalog${"id": "tinetti", "title": "Tinetti / POMA — 0–28", "version": "2026-09-19.1", "source": "https://www.tendertouch.com/wp-content/uploads/user_uploads/Training%20admin/1629903865_Tinettti-Test-Score-Sheet.pdf", "description": "Versão POMA de 28 pontos. A rotação e o passo têm subitens próprios; não são tarefas adicionais.", "fields": [{"id": "sentado", "label": "Equilíbrio sentado", "type": "number", "min": 0, "max": 1, "step": 1, "score": true, "required": true, "group": "Equilíbrio", "labels": {"0": "Instável / desliza", "1": "Estável"}}, {"id": "levantar", "label": "Levantar da cadeira", "type": "number", "min": 0, "max": 2, "step": 1, "score": true, "required": true, "group": "Equilíbrio", "labels": {"0": "Precisa de ajuda", "1": "Usa MS", "2": "Sem usar MS"}}, {"id": "tentativas", "label": "Tentativas de levantar", "type": "number", "min": 0, "max": 2, "step": 1, "score": true, "required": true, "group": "Equilíbrio", "labels": {"0": "Não consegue sem ajuda", "1": "Mais de uma tentativa", "2": "Uma tentativa"}}, {"id": "imediato", "label": "Equilíbrio inicial de pé", "type": "number", "min": 0, "max": 2, "step": 1, "score": true, "required": true, "group": "Equilíbrio", "labels": {"0": "Instável", "1": "Estável com apoio", "2": "Estável sem apoio"}}, {"id": "pe", "label": "Equilíbrio de pé", "type": "number", "min": 0, "max": 2, "step": 1, "score": true, "required": true, "group": "Equilíbrio", "labels": {"0": "Instável", "1": "Base alargada / apoio", "2": "Base estreita sem apoio"}}, {"id": "perturbacao", "label": "Resposta à perturbação", "type": "number", "min": 0, "max": 2, "step": 1, "score": true, "required": true, "group": "Equilíbrio", "labels": {"0": "Começa a cair", "1": "Oscila; recupera equilíbrio", "2": "Estável"}}, {"id": "olhos", "label": "Olhos fechados", "type": "number", "min": 0, "max": 1, "step": 1, "score": true, "required": true, "group": "Equilíbrio", "labels": {"0": "Instável", "1": "Estável"}}, {"id": "rot_passos", "label": "Rotação 360° — continuidade", "type": "number", "min": 0, "max": 1, "step": 1, "score": true, "required": true, "group": "Equilíbrio", "labels": {"0": "Passos descontínuos", "1": "Passos contínuos"}}, {"id": "rot_estabilidade", "label": "Rotação 360° — estabilidade", "type": "number", "min": 0, "max": 1, "step": 1, "score": true, "required": true, "group": "Equilíbrio", "labels": {"0": "Instável", "1": "Estável"}}, {"id": "sentar", "label": "Sentar", "type": "number", "min": 0, "max": 2, "step": 1, "score": true, "required": true, "group": "Equilíbrio", "labels": {"0": "Inseguro", "1": "Usa MS / movimento irregular", "2": "Seguro e suave"}}, {"id": "inicio", "label": "Início da marcha", "type": "number", "min": 0, "max": 1, "step": 1, "score": true, "required": true, "group": "Marcha", "labels": {"0": "Hesitação", "1": "Sem hesitação"}}, {"id": "passo_d", "label": "Comprimento do passo direito", "type": "number", "min": 0, "max": 1, "step": 1, "score": true, "required": true, "group": "Marcha", "labels": {"0": "Não ultrapassa pé de apoio", "1": "Ultrapassa pé de apoio"}}, {"id": "passo_e", "label": "Comprimento do passo esquerdo", "type": "number", "min": 0, "max": 1, "step": 1, "score": true, "required": true, "group": "Marcha", "labels": {"0": "Não ultrapassa pé de apoio", "1": "Ultrapassa pé de apoio"}}, {"id": "altura_d", "label": "Elevação do pé direito", "type": "number", "min": 0, "max": 1, "step": 1, "score": true, "required": true, "group": "Marcha", "labels": {"0": "Não eleva do chão", "1": "Eleva do chão"}}, {"id": "altura_e", "label": "Elevação do pé esquerdo", "type": "number", "min": 0, "max": 1, "step": 1, "score": true, "required": true, "group": "Marcha", "labels": {"0": "Não eleva do chão", "1": "Eleva do chão"}}, {"id": "simetria", "label": "Simetria dos passos", "type": "number", "min": 0, "max": 1, "step": 1, "score": true, "required": true, "group": "Marcha", "labels": {"0": "Passos desiguais", "1": "Passos iguais"}}, {"id": "continuidade", "label": "Continuidade dos passos", "type": "number", "min": 0, "max": 1, "step": 1, "score": true, "required": true, "group": "Marcha", "labels": {"0": "Descontínuos", "1": "Contínuos"}}, {"id": "trajeto", "label": "Trajeto", "type": "number", "min": 0, "max": 2, "step": 1, "score": true, "required": true, "group": "Marcha", "labels": {"0": "Desvio marcado", "1": "Desvio ligeiro / usa auxiliar", "2": "Reto sem auxiliar"}}, {"id": "tronco", "label": "Tronco", "type": "number", "min": 0, "max": 2, "step": 1, "score": true, "required": true, "group": "Marcha", "labels": {"0": "Oscilação marcada / auxiliar", "1": "Compensações posturais", "2": "Sem compensações"}}, {"id": "base", "label": "Base de marcha", "type": "number", "min": 0, "max": 1, "step": 1, "score": true, "required": true, "group": "Marcha", "labels": {"0": "Calcanhares afastados", "1": "Calcanhares próximos"}}], "maxScore": 28, "domain": "Equilíbrio e marcha", "direction": "0–28: maior pontuação = melhor desempenho. Equilíbrio /16 + marcha /12.", "interpretationVersion": "descriptive-2026-09-19"}$catalog$::jsonb);

insert into gc_scale_private.catalog(id,definition) values ('berg', $catalog${"id": "berg", "title": "Equilíbrio de Berg — 0–56", "version": "2026-09-19.1", "source": "https://www.sralab.org/sites/default/files/2024-03/core-measure-berg-balance-scale-(bbs)_final-2019.pdf", "description": "Selecionar o critério mais baixo aplicável. Considerar ajuda, supervisão, tempo e distância próprios de cada tarefa.", "fields": [{"id": "item_1", "label": "Levantar-se", "type": "number", "min": 0, "max": 4, "step": 1, "score": true, "required": true, "labels": {"0": "Ajuda moderada/máxima", "1": "Ajuda mínima", "2": "Várias tentativas com MS", "3": "Usa MS", "4": "Sem MS; estável"}, "compactLabels": true}, {"id": "item_2", "label": "Manter-se de pé sem apoio", "type": "number", "min": 0, "max": 4, "step": 1, "score": true, "required": true, "labels": {"0": "<30 s", "1": "Várias tentativas: 30 s", "2": "30 s", "3": "2 min supervisionados", "4": "2 min seguros"}, "compactLabels": true}, {"id": "item_3", "label": "Sentar-se sem apoio do tronco", "type": "number", "min": 0, "max": 4, "step": 1, "score": true, "required": true, "labels": {"0": "Não mantém 10 s", "1": "10 s", "2": "30 s", "3": "2 min supervisionados", "4": "2 min seguros"}, "compactLabels": true}, {"id": "item_4", "label": "Sentar a partir de pé", "type": "number", "min": 0, "max": 4, "step": 1, "score": true, "required": true, "labels": {"0": "Ajuda para sentar", "1": "Descida descontrolada", "2": "Apoia pernas na cadeira", "3": "Controla com MS", "4": "Seguro; mínimo uso MS"}, "compactLabels": true}, {"id": "item_5", "label": "Transferências", "type": "number", "min": 0, "max": 4, "step": 1, "score": true, "required": true, "labels": {"0": "Duas pessoas", "1": "Uma pessoa", "2": "Orientação/supervisão", "3": "Uso marcado MS", "4": "Uso mínimo MS"}, "compactLabels": true}, {"id": "item_6", "label": "De pé com olhos fechados", "type": "number", "min": 0, "max": 4, "step": 1, "score": true, "required": true, "labels": {"0": "Ajuda para não cair", "1": "<3 s; mantém-se estável", "2": "3 s", "3": "10 s supervisionados", "4": "10 s seguros"}, "compactLabels": true}, {"id": "item_7", "label": "De pé com pés juntos", "type": "number", "min": 0, "max": 4, "step": 1, "score": true, "required": true, "labels": {"0": "Ajuda; <15 s", "1": "Ajuda: mantém 15 s", "2": "Coloca sozinho; <30 s", "3": "1 min supervisionado", "4": "1 min seguro"}, "compactLabels": true}, {"id": "item_8", "label": "Alcance anterior", "type": "number", "min": 0, "max": 4, "step": 1, "score": true, "required": true, "labels": {"0": "Perde equilíbrio", "1": "Supervisão", "2": "Alcança 5 cm", "3": "Alcança 12 cm", "4": "Alcança 25 cm"}, "compactLabels": true}, {"id": "item_9", "label": "Apanhar objeto do chão", "type": "number", "min": 0, "max": 4, "step": 1, "score": true, "required": true, "labels": {"0": "Não tenta / ajuda", "1": "Não apanha; supervisão", "2": "Fica a 2–5 cm", "3": "Apanha supervisionado", "4": "Apanha facilmente"}, "compactLabels": true}, {"id": "item_10", "label": "Olhar para trás", "type": "number", "min": 0, "max": 4, "step": 1, "score": true, "required": true, "labels": {"0": "Ajuda", "1": "Supervisão", "2": "Roda apenas de lado", "3": "Um lado completo", "4": "Ambos os lados"}, "compactLabels": true}, {"id": "item_11", "label": "Rodar 360°", "type": "number", "min": 0, "max": 4, "step": 1, "score": true, "required": true, "labels": {"0": "Ajuda", "1": "Supervisão/orientação", "2": "Seguro, lento", "3": "≤4 s num sentido", "4": "≤4 s nos dois sentidos"}, "compactLabels": true}, {"id": "item_12", "label": "Alternar pés no degrau", "type": "number", "min": 0, "max": 4, "step": 1, "score": true, "required": true, "labels": {"0": "Ajuda / incapaz", "1": ">2 passos; ajuda mínima", "2": "4 passos supervisionados", "3": "8 passos; >20 s", "4": "8 passos; ≤20 s"}, "compactLabels": true}, {"id": "item_13", "label": "Um pé à frente do outro", "type": "number", "min": 0, "max": 4, "step": 1, "score": true, "required": true, "labels": {"0": "Perde equilíbrio", "1": "Ajuda a posicionar: 15 s", "2": "Pequeno passo: 30 s", "3": "Pé à frente: 30 s", "4": "Tandem: 30 s"}, "compactLabels": true}, {"id": "item_14", "label": "Apoio num só pé", "type": "number", "min": 0, "max": 4, "step": 1, "score": true, "required": true, "labels": {"0": "Não tenta / ajuda", "1": "<3 s", "2": "≥3 e <5 s", "3": "5–10 s", "4": ">10 s"}, "compactLabels": true}], "maxScore": 56, "domain": "Equilíbrio funcional", "direction": "0–56: maior pontuação = melhor desempenho. Cada tarefa tem critérios próprios de 0 a 4.", "interpretationVersion": "descriptive-2026-09-19"}$catalog$::jsonb);

insert into gc_scale_private.catalog(id,definition) values ('dor', $catalog${"id": "dor", "title": "Dor — escala numérica", "version": "2026-09-19.1", "source": "https://www.sralab.org/rehabilitation-measures/numeric-pain-rating-scale", "description": "Manter separados repouso, atividade e pico. Identificar a tarefa e o período de referência.", "fields": [{"id": "repouso", "label": "Dor em repouso (0–10)", "type": "number", "min": 0, "max": 10, "step": 1, "score": false, "required": true, "buttons": true}, {"id": "atividade", "label": "Dor em atividade (0–10)", "type": "number", "min": 0, "max": 10, "step": 1, "score": false, "required": true, "buttons": true}, {"id": "tarefa", "label": "Atividade avaliada", "type": "text", "maxLength": 500, "required": true}, {"id": "pico", "label": "Pico de dor (0–10)", "type": "number", "min": 0, "max": 10, "step": 1, "score": false, "required": true, "buttons": true}, {"id": "periodo", "label": "Período de referência do pico", "type": "text", "maxLength": 500, "required": true}], "maxScore": null, "domain": "Intensidade da dor", "direction": "0 = sem dor · 10 = pior dor imaginável. Maior valor = mais dor.", "interpretationVersion": "descriptive-2026-09-19"}$catalog$::jsonb);

insert into gc_scale_private.catalog(id,definition) values ('mrc', $catalog${"id": "mrc", "title": "Força muscular — MRC", "version": "2026-09-19.1", "source": "https://www.ukri.org/councils/mrc/facilities-and-resources/find-an-mrc-facility-or-resource/mrc-muscle-scale/", "description": "Teste presencial. Used with the permission of the Medical Research Council. Descrições de apoio em português, adaptadas.", "fields": [{"id": "grupos", "label": "Grupos musculares avaliados", "type": "repeat", "required": true, "maxItems": 20, "fields": [{"id": "musculo", "label": "Movimento / grupo muscular", "type": "text", "maxLength": 500, "required": true, "suggestions": ["Abdução do ombro", "Flexão do ombro", "Flexão do cotovelo", "Extensão do cotovelo", "Extensão do punho", "Flexão do punho", "Preensão da mão", "Pinça", "Flexão da anca", "Extensão do joelho", "Dorsiflexão da tibiotársica", "Flexão plantar da tibiotársica"]}, {"id": "lado", "label": "Lado", "type": "choice", "values": ["Direito", "Esquerdo"], "required": true}, {"id": "grau", "label": "Grau", "type": "choice", "values": [0, 1, 2, 3, 4, 5], "required": true, "labels": {"0": "Sem contração", "1": "Contração sem movimento", "2": "Movimento sem gravidade", "3": "Contra a gravidade", "4": "Contra resistência", "5": "Força normal"}, "compactLabels": true}]}], "maxScore": null, "domain": "Força muscular por movimento e lado", "direction": "0 = sem contração · 5 = força normal esperada. Não somar grupos musculares.", "interpretationVersion": "descriptive-2026-09-19"}$catalog$::jsonb);

insert into gc_scale_private.catalog(id,definition) values ('ashworth', $catalog${"id": "ashworth", "title": "Ashworth modificada", "version": "2026-09-19.1", "source": "https://www.sralab.org/rehabilitation-measures/ashworth-scale-modified-ashworth-scale", "description": "Avaliar com o doente relaxado. Não distingue, isoladamente, espasticidade de outras causas de resistência passiva.", "fields": [{"id": "grupos", "label": "Grupos musculares avaliados", "type": "repeat", "required": true, "maxItems": 20, "fields": [{"id": "musculo", "label": "Movimento / grupo muscular", "type": "text", "maxLength": 500, "required": true, "suggestions": ["Flexores do cotovelo", "Extensores do cotovelo", "Flexores do punho", "Extensores do punho", "Flexores do joelho", "Extensores do joelho", "Dorsiflexores da tibiotársica", "Flexores plantares da tibiotársica"]}, {"id": "lado", "label": "Lado", "type": "choice", "values": ["Direito", "Esquerdo"], "required": true}, {"id": "grau", "label": "Grau", "type": "choice", "values": ["0", "1", "1+", "2", "3", "4"], "required": true, "labels": {"0": "Sem aumento", "1": "Ressalto/libertação ou resistência final", "1+": "Ressalto + resistência em <½ amplitude", "2": "Resistência em grande parte; mobiliza facilmente", "3": "Movimento passivo difícil", "4": "Rigidez"}, "compactLabels": true}]}], "maxScore": null, "domain": "Resistência ao movimento passivo / tónus", "direction": "0 = sem aumento do tónus · 4 = rigidez. 1+ é um grau próprio; não equivale a 1,5.", "interpretationVersion": "descriptive-2026-09-19"}$catalog$::jsonb);
