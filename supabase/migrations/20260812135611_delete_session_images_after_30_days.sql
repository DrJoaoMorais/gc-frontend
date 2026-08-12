-- Conservação clínica: elimina imagens 30 dias depois da data de fim do plano.
-- A função apenas enumera os ficheiros vencidos. A Edge Function apaga primeiro
-- o objecto privado e só depois o respectivo registo.
create or replace function public.wo_expired_session_images()
returns table(image_id uuid, storage_path text)
language sql
security definer
set search_path = ''
as $$
  select i.id, i.storage_path
  from public.wo_session_images i
  join public.wo_prescriptions p on p.id = i.prescription_id
  where i.status = 'ready'
    and coalesce(
      case when p.data->>'endDate' ~ '^\d{4}-\d{2}-\d{2}$'
        then (p.data->>'endDate')::date
      end,
      p.expires_at::date
    ) < current_date - 30
  order by i.created_at
  limit 500;
$$;

revoke all on function public.wo_expired_session_images() from public, anon, authenticated;
grant execute on function public.wo_expired_session_images() to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'delete-session-images-after-30-days';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'delete-session-images-after-30-days',
    '17 3 * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/wo-session-image',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
          'x-cleanup-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'session_image_cleanup_secret')
        ),
        body := jsonb_build_object('action', 'cleanup')
      );
    $job$
  );
end $$;
