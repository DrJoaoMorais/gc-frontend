-- As tabelas mantêm a proibição de escrita direta. Só esta operação transacional,
-- com validação explícita do titular na função, pode gravar uma nova versão.
alter function public.gc_save_protocol_version(uuid,uuid,jsonb,jsonb) security definer;
revoke all on function public.gc_save_protocol_version(uuid,uuid,jsonb,jsonb) from public, anon;
grant execute on function public.gc_save_protocol_version(uuid,uuid,jsonb,jsonb) to authenticated;
