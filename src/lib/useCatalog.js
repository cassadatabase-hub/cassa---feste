import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { base44, supabase } from '@/api/base44Client';
import { applyTheme, DEFAULT_THEME_COLOR } from '@/lib/theme';

// Ogni festa ha i suoi reparti, prodotti, menu fissi e modelli di comanda
// (colonna festa_id). Allergeni e opzioni prodotto sono condivisi.
//
//  - Clienti e cassa: vedono solo la festa ATTIVA (settings.active_festa_id).
//  - Admin: passa `festaId` per gestire una festa a sua scelta (anche non
//    attiva, ad es. per preparare quella di settembre mentre è attiva giugno).
//
// Le righe senza festa_id (dati vecchi mai assegnati) restano visibili in tutte
// le feste; se non esiste ancora nessuna festa, non si filtra nulla.
//
// liveProducts: se true, l'elenco prodotti si aggiorna da solo (in tempo
// reale via Supabase + controllo periodico di sicurezza) senza ricaricare la
// pagina e senza mostrare lo spinner. Usato dalla cassa. Se nel frattempo
// l'admin cambia la festa attiva, la cassa ricarica tutto il catalogo.
export function useCatalog({ liveProducts = false, festaId = null } = {}) {
  const [rawCategories, setRawCategories] = useState([]);
  const [rawProducts, setRawProducts] = useState([]);
  const [allergens, setAllergens] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [rawFixedMenus, setRawFixedMenus] = useState([]);
  const [rawTemplates, setRawTemplates] = useState([]);
  const [feste, setFeste] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const activeFestaRef = useRef('');

  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [cats, prods, algs, opts, menus, templates, sets, fests] = await Promise.all([
        base44.entities.Category.list('sort_order', 200),
        base44.entities.Product.list('sort_order', 2000),
        base44.entities.Allergen.list('sort_order', 50),
        base44.entities.ProductOption.list('sort_order', 50),
        base44.entities.FixedMenu.list('-created_date', 200),
        base44.entities.ComandaTemplate.list('sort_order', 100),
        base44.entities.AppSettings.list('-created_date', 5),
        base44.entities.Festa.list('-created_date', 100),
      ]);
      setRawCategories(cats || []);
      setRawProducts(prods || []);
      setAllergens(algs || []);
      setProductOptions(opts || []);
      setRawFixedMenus((menus || []).filter(m => m.active));
      setRawTemplates(templates || []);
      setFeste(fests || []);
      const s = (sets && sets[0]) || { cassa_pin: '1234', admin_pin: '9999', code_expiry_hours: 4, next_order_number: 1 };
      activeFestaRef.current = s.active_festa_id || '';
      setSettings(s);
    } catch (e) {
      console.error('Catalog load error', e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Quale festa stiamo mostrando?
  const activeFestaId = settings?.active_festa_id || '';
  const activeFesta = useMemo(() => feste.find(f => f.id === activeFestaId) || null, [feste, activeFestaId]);
  const adminMode = !!festaId;
  const currentFesta = useMemo(() => {
    if (adminMode) {
      return feste.find(f => f.id === festaId) || activeFesta || feste[0] || null;
    }
    return activeFesta;
  }, [adminMode, feste, festaId, activeFesta]);
  const currentFestaId = currentFesta?.id || null;
  // Ci sono feste ma nessuna è attiva: i clienti non devono vedere niente
  const noActiveFesta = !adminMode && feste.length > 0 && !activeFesta;
  // Nessuna festa creata (installazione vecchia/vuota): non filtriamo
  const scoped = feste.length > 0;

  const inScope = useCallback(
    (row) => {
      if (!scoped) return true;
      if (!currentFestaId) return false;
      return !row.festa_id || row.festa_id === currentFestaId;
    },
    [scoped, currentFestaId]
  );

  const categories = useMemo(() => rawCategories.filter(inScope), [rawCategories, inScope]);
  const products = useMemo(() => rawProducts.filter(inScope), [rawProducts, inScope]);
  const fixedMenus = useMemo(() => rawFixedMenus.filter(inScope), [rawFixedMenus, inScope]);
  const comandaTemplates = useMemo(() => rawTemplates.filter(inScope), [rawTemplates, inScope]);

  // Colore dell'app: quello della festa mostrata
  const themeColor = currentFesta?.theme_color || DEFAULT_THEME_COLOR;
  useEffect(() => {
    applyTheme(themeColor);
  }, [themeColor]);

  // Aggiornamento "silenzioso": non tocca `loading`, quindi la schermata di
  // cassa non si smonta e non si perde l'ordine in corso.
  const refreshProducts = useCallback(async () => {
    try {
      const [prods, sets] = await Promise.all([
        base44.entities.Product.list('sort_order', 2000),
        base44.entities.AppSettings.list('-created_date', 5),
      ]);
      const newActive = (sets && sets[0] && sets[0].active_festa_id) || '';
      if (newActive !== activeFestaRef.current) {
        // l'admin ha cambiato festa attiva: ricarichiamo tutto il catalogo
        await loadAll({ silent: true });
        return;
      }
      setRawProducts(prev => (JSON.stringify(prev) === JSON.stringify(prods) ? prev : (prods || [])));
    } catch (e) {
      // offline o errore di rete: riproviamo al prossimo giro
    }
  }, [loadAll]);

  useEffect(() => {
    if (!liveProducts) return;
    let debounce = null;
    const scheduleRefresh = () => {
      clearTimeout(debounce);
      debounce = setTimeout(refreshProducts, 250);
    };
    // 1) tempo reale (richiede che la tabella products sia nella publication
    //    supabase_realtime: vedi supabase/migrations/0002_realtime_products.sql)
    const channel = supabase
      .channel(`catalog-products-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, scheduleRefresh)
      .subscribe();
    // 2) rete di sicurezza: controllo ogni 10 secondi, quando la scheda torna
    //    visibile e quando torna la connessione
    const interval = setInterval(refreshProducts, 10000);
    const onVisible = () => { if (document.visibilityState === 'visible') refreshProducts(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refreshProducts);
    return () => {
      clearTimeout(debounce);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refreshProducts);
      supabase.removeChannel(channel);
    };
  }, [liveProducts, refreshProducts]);

  return {
    categories, products, allergens, productOptions, fixedMenus, comandaTemplates, settings, feste,
    currentFesta, activeFesta, noActiveFesta,
    // ricarica senza spinner: l'admin non perde cartelle aperte e form in corso
    loading, reload: () => loadAll({ silent: true }),
  };
}
