-- ======================================================================
--  MULTI-FESTA: ogni festa ha i suoi reparti, prodotti, menu fissi e
--  modelli di comanda, e un proprio colore tema.
--  Da eseguire in Supabase: SQL Editor > New query (si può rilanciare
--  senza problemi).
--
--  Allergeni e opzioni prodotto restano condivisi tra tutte le feste.
-- ======================================================================

-- 01. Colore tema per festa (default: arancione attuale)
alter table public.feste
  add column if not exists theme_color text not null default '#ea580c';

-- 02. Collegamento alla festa
alter table public.categories        add column if not exists festa_id text;
alter table public.products          add column if not exists festa_id text;
alter table public.fixed_menus       add column if not exists festa_id text;
alter table public.comanda_templates add column if not exists festa_id text;

create index if not exists categories_festa_idx        on public.categories(festa_id);
create index if not exists products_festa_idx          on public.products(festa_id);
create index if not exists fixed_menus_festa_idx       on public.fixed_menus(festa_id);
create index if not exists comanda_templates_festa_idx on public.comanda_templates(festa_id);

-- 03. I dati già presenti vengono assegnati alla festa attiva (o, se non
--     c'è, all'ultima creata; se non esiste nessuna festa ma ci sono dati,
--     ne viene creata una con il nome impostato in app_settings).
do $$
declare
  fid text;
  fname text;
begin
  select nullif(active_festa_id, '') into fid
  from public.app_settings
  where coalesce(active_festa_id, '') <> ''
  limit 1;

  if fid is null then
    select id::text into fid from public.feste order by created_date desc limit 1;
  end if;

  if fid is null and (
       exists (select 1 from public.categories)
    or exists (select 1 from public.products)
    or exists (select 1 from public.fixed_menus)
    or exists (select 1 from public.comanda_templates)
  ) then
    select coalesce(nullif(festa_name, ''), 'Festa') into fname from public.app_settings limit 1;
    insert into public.feste (name, status)
    values (coalesce(fname, 'Festa'), 'active')
    returning id::text into fid;

    update public.app_settings
       set active_festa_id = fid,
           festa_name = coalesce(fname, 'Festa');
  end if;

  if fid is not null then
    update public.categories        set festa_id = fid where festa_id is null;
    update public.products          set festa_id = fid where festa_id is null;
    update public.fixed_menus       set festa_id = fid where festa_id is null;
    update public.comanda_templates set festa_id = fid where festa_id is null;
  end if;
end $$;
