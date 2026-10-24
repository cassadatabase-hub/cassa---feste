-- ======================================================================
--  METODO DI PAGAMENTO sugli ordini in cassa (contanti / POS).
--  Gli omaggi non richiedono modifiche al database: sono righe
--  dell'ordine (campo items) con prezzo 0 e gifted = true, quindi le
--  scorte scalano come per ogni altro prodotto.
--  Si può rilanciare senza problemi.
-- ======================================================================
alter table public.cashier_orders
  add column if not exists payment_method text;

alter table public.cashier_orders
  drop constraint if exists cashier_orders_payment_method_check;
alter table public.cashier_orders
  add constraint cashier_orders_payment_method_check
  check (payment_method is null or payment_method in ('cash', 'pos'));
