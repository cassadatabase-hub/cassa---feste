-- Aggiornamento in tempo reale dei prodotti sulle casse (opzionale ma consigliato).
-- Senza questa migrazione le casse si aggiornano comunque, con un ritardo massimo
-- di ~10 secondi (controllo periodico). Con questa, l'aggiornamento è immediato.
do $$
begin
  alter publication supabase_realtime add table public.products;
exception
  when duplicate_object then null; -- già presente
end $$;
