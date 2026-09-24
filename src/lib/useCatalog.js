import { useState, useEffect, useCallback } from 'react';
import { base44, supabase } from '@/api/base44Client';

// liveProducts: se true, l'elenco prodotti si aggiorna da solo (in tempo
// reale via Supabase + controllo periodico di sicurezza) senza ricaricare la
// pagina e senza mostrare lo spinner. Usato dalla cassa.
export function useCatalog({ liveProducts = false } = {}) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [allergens, setAllergens] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [fixedMenus, setFixedMenus] = useState([]);
  const [comandaTemplates, setComandaTemplates] = useState([]);
  const [feste, setFeste] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cats, prods, algs, opts, menus, templates, sets, fests] = await Promise.all([
        base44.entities.Category.list('sort_order', 100),
        base44.entities.Product.list('sort_order', 500),
        base44.entities.Allergen.list('sort_order', 50),
        base44.entities.ProductOption.list('sort_order', 50),
        base44.entities.FixedMenu.list('-created_date', 50),
        base44.entities.ComandaTemplate.list('sort_order', 50),
        base44.entities.AppSettings.list('-created_date', 5),
        base44.entities.Festa.list('-created_date', 100),
      ]);
      setCategories(cats || []);
      setProducts(prods || []);
      setAllergens(algs || []);
      setProductOptions(opts || []);
      setFixedMenus((menus || []).filter(m => m.active));
      setComandaTemplates(templates || []);
      setFeste(fests || []);
      setSettings((sets && sets[0]) || { cassa_pin: '1234', admin_pin: '9999', code_expiry_hours: 4, next_order_number: 1 });
    } catch (e) {
      console.error('Catalog load error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Aggiornamento "silenzioso" dei soli prodotti: non tocca `loading`, quindi
  // la schermata di cassa non si smonta e non si perde l'ordine in corso.
  const refreshProducts = useCallback(async () => {
    try {
      const prods = await base44.entities.Product.list('sort_order', 500);
      setProducts(prev => (JSON.stringify(prev) === JSON.stringify(prods) ? prev : (prods || [])));
    } catch (e) {
      // offline o errore di rete: riproviamo al prossimo giro
    }
  }, []);

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
    loading, reload: loadAll
  };
}