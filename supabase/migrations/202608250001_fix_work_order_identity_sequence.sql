begin;

create or replace function public.reserve_work_order_identity(p_new_client boolean)
returns table(id uuid,sequence_number integer,work_order_number text,business_client_id integer)
language plpgsql security definer set search_path=public as $$
declare v_sequence integer; v_id uuid; v_client_id integer;
begin
  if not public.work_order_is_authorized() then raise exception 'Forbidden' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext('kairo-work-order-number'));
  select greatest(
    coalesce((select state.last_sequence from public.work_order_number_state as state where state.singleton_key=true),95),
    coalesce((select max(reservation.sequence_number) from public.work_order_number_reservations as reservation),0),
    coalesce((select max(work_order.sequence_number) from public.work_orders as work_order),0),
    coalesce((select max(client.business_client_id)-1000 from public.clients as client where client.business_client_id between 1001 and 9999),0),
    coalesce((select max((regexp_match(project.project_code,'([0-9]{4})'))[1]::integer)-1000 from public.projects as project where project.project_code ~ '[0-9]{4}'),0)
  ) + 1 into v_sequence;
  v_client_id:=case when p_new_client then 1000+v_sequence else null end;
  insert into public.work_order_number_reservations(sequence_number,work_order_number,business_client_id,new_client,reserved_by)
  values(v_sequence,lpad(v_sequence::text,4,'0'),v_client_id,p_new_client,auth.uid()) returning work_order_number_reservations.id into v_id;
  update public.work_order_number_state set last_sequence=v_sequence,updated_at=now() where singleton_key=true;
  return query select v_id,v_sequence,lpad(v_sequence::text,4,'0'),v_client_id;
end $$;

revoke all on function public.reserve_work_order_identity(boolean) from public,anon;
grant execute on function public.reserve_work_order_identity(boolean) to authenticated;

commit;
