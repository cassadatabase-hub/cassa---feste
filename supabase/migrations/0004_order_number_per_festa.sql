-- ======================================================================
--  NUMERAZIONE ORDINI PER FESTA
--  Ogni festa ha il suo contatore (feste.next_order_number): settembre
--  riparte da 1 indipendentemente da giugno.
--  Un trigger assegna il numero a ogni nuovo ordine in cassa, qualunque
--  sia la funzione (create_paid_order) che lo inserisce. Se l'ordine non ha
--  una festa, resta il numero calcolato dalla funzione come prima.
--  Si può rilanciare senza problemi.
-- ======================================================================

alter table public.feste
  add column if not exists next_order_number numeric not null default 1;

-- Allinea i contatori agli ordini già registrati (e, per la festa attiva,
-- al "prossimo numero" che avevi impostato finora nelle impostazioni).
update public.feste f
   set next_order_number = coalesce(
     (select max(o.order_number) from public.cashier_orders o where o.festa_id = f.id::text), 0
   ) + 1;

update public.feste f
   set next_order_number = greatest(f.next_order_number, s.next_order_number)
  from public.app_settings s
 where f.id::text = s.active_festa_id;

create or replace function public.assign_festa_order_number()
returns trigger as $$
declare
  n numeric;
begin
  if coalesce(new.festa_id, '') = '' then
    return new;
  end if;
  -- l'UPDATE blocca la riga della festa: due casse insieme non possono
  -- ottenere lo stesso numero
  update public.feste
     set next_order_number = next_order_number + 1
   where id::text = new.festa_id
  returning next_order_number - 1 into n;
  if n is not null then
    new.order_number := n;
  end if;
  return new;
end;
$$ language plpgsql volatile;

drop trigger if exists cashier_orders_assign_number on public.cashier_orders;
create trigger cashier_orders_assign_number
  before insert on public.cashier_orders
  for each row execute function public.assign_festa_order_number();
