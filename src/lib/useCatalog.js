import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useCatalog() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [allergens, setAllergens] = useState([]);
  const [fixedMenus, setFixedMenus] = useState([]);
  const [comandaTemplates, setComandaTemplates] = useState([]);
  const [feste, setFeste] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cats, prods, algs, menus, templates, sets, fests] = await Promise.all([
        base44.entities.Category.list('sort_order', 100),
        base44.entities.Product.list('sort_order', 500),
        base44.entities.Allergen.list('sort_order', 50),
        base44.entities.FixedMenu.list('-created_date', 50),
        base44.entities.ComandaTemplate.list('sort_order', 50),
        base44.entities.AppSettings.list('-created_date', 5),
        base44.entities.Festa.list('-created_date', 100),
      ]);
      setCategories(cats || []);
      setProducts(prods || []);
      setAllergens(algs || []);
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

  return {
    categories, products, allergens, fixedMenus, comandaTemplates, settings, feste,
    loading, reload: loadAll
  };
}