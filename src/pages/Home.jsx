import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLang } from '@/lib/i18n';
import { CartProvider, useCart } from '@/lib/cart';
import { useCatalog } from '@/lib/useCatalog';
import LanguageToggle from '@/components/shared/LanguageToggle';
import PrivacyDialog from '@/components/customer/PrivacyDialog';
import Onboarding from '@/components/customer/Onboarding';
import CartDrawer from '@/components/customer/CartDrawer';
import CheckoutDialog from '@/components/customer/CheckoutDialog';
import AllergenDialog from '@/components/customer/AllergenDialog';
import FixedMenuWizard from '@/components/customer/FixedMenuWizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Search, Utensils, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice } from '@/lib/codeGen';
import { getPendingOrderCode, clearPendingOrderCode, savePendingOrderCode, getEditingOrder, saveEditingOrder, clearEditingOrder } from '@/lib/pendingOrderCode';
import { reconcileItems, describeRemoved } from '@/lib/stock';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { Image } from '@/components/ui/image';

function HomeContent() {
  const { t, tn, lang } = useLang();
  const { categories, products, allergens, productOptions, fixedMenus, settings, loading } = useCatalog();
  const { items, total, addItem, clearCart, replaceItems, setTableNumber, setCustomerName } = useCart();
  const { toast } = useToast();
  const [activeCat, setActiveCat] = useState(null);
  const [search, setSearch] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [wizardMenu, setWizardMenu] = useState(null);
  const [optionsProduct, setOptionsProduct] = useState(null);
  const [tempSelections, setTempSelections] = useState(/** @type {Record<string, boolean>} */ ({}));
  const [pendingCode, setPendingCode] = useState(null);
  const [pendingCodeDetailOpen, setPendingCodeDetailOpen] = useState(false);
  // Ordine già inviato che il cliente sta modificando (finché non è pagato)
  const [editingOrder, setEditingOrder] = useState(() => getEditingOrder());
  const [editBusy, setEditBusy] = useState(false);

  useEffect(() => {
    if (!loading && categories.length > 0 && !activeCat) {
      setActiveCat(categories[0].id);
    }
  }, [loading, categories, activeCat]);

  useEffect(() => {
    const saved = getPendingOrderCode();
    if (saved) setPendingCode(saved);
  }, []);

  // Finché c'è un codice in sospeso, controlliamo periodicamente su Supabase
  // se la cassa lo ha confermato — così il banner sparisce da solo, senza che
  // il cliente debba ricaricare la pagina.
  useEffect(() => {
    if (!pendingCode) return;
    const checkStatus = () => {
      base44.entities.OrderCode.filter({ code: pendingCode.code, purpose: 'cassa' })
        .then(results => {
          const oc = results && results[0];
          if (oc && oc.status === 'consumed') {
            clearPendingOrderCode();
            setPendingCode(null);
            // se stava modificando un ordine ormai pagato, chiudiamo la modifica
            if (getEditingOrder()?.code === oc.code) {
              clearEditingOrder();
              setEditingOrder(null);
              clearCart();
              toast({ title: t('orderAlreadyPaidCantEdit'), variant: 'destructive' });
            }
          } else if (oc && oc.status === 'pending' && typeof oc.total === 'number' && oc.total !== pendingCode.total) {
            // la cassa ha modificato l'ordine (es. prodotti esauriti tolti):
            // aggiorniamo il totale mostrato al cliente
            const updated = { ...pendingCode, total: oc.total };
            savePendingOrderCode(updated);
            setPendingCode(updated);
          }
        })
        .catch(() => { /* offline o errore di rete: riproviamo al prossimo giro */ });
    };
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, [pendingCode?.code, pendingCode?.total]);

  useEffect(() => {
    const seen = localStorage.getItem('sagra_onboarded');
    if (!seen) {
      setOnboardingOpen(true);
      localStorage.setItem('sagra_onboarded', '1');
    }
  }, []);

  useEffect(() => {
    if (items.length > 0 && !sessionStorage.getItem('sagra_pending_seen')) {
      setPendingOpen(true);
      sessionStorage.setItem('sagra_pending_seen', '1');
    }
  }, [items.length]);

  // Riporta nel carrello l'ordine già inviato (finché la cassa non lo ha
  // pagato) per poterlo modificare; il codice resta lo stesso.
  const startEditOrder = async () => {
    if (!pendingCode || editBusy) return;
    if (items.length > 0 && !editingOrder && !confirm(t('replaceCartConfirm'))) return;
    setEditBusy(true);
    try {
      const results = await base44.entities.OrderCode.filter({ code: pendingCode.code, purpose: 'cassa' });
      const oc = results && results[0];
      if (!oc || oc.status !== 'pending') {
        toast({ title: t('orderAlreadyPaidCantEdit'), variant: 'destructive' });
        clearPendingOrderCode();
        setPendingCode(null);
        setPendingCodeDetailOpen(false);
        return;
      }
      if (new Date(oc.expires_at) < new Date()) {
        toast({ title: t('codeExpired'), variant: 'destructive' });
        return;
      }
      // togliamo subito i prodotti nel frattempo esauriti
      const fresh = await base44.entities.Product.list('sort_order', 500);
      const { items: kept, removed } = reconcileItems(oc.cart_data?.items || [], fresh);
      replaceItems(kept);
      setTableNumber(oc.table_number || '');
      setCustomerName(oc.customer_name || '');
      const edit = { id: oc.id, code: oc.code };
      saveEditingOrder(edit);
      setEditingOrder(edit);
      setPendingCodeDetailOpen(false);
      if (removed.length > 0) {
        toast({ title: t('soldOutRemovedTitle'), description: describeRemoved(removed, { t, tn }), variant: 'destructive' });
      }
      setCartOpen(true);
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    } finally {
      setEditBusy(false);
    }
  };

  const cancelEditOrder = () => {
    clearEditingOrder();
    setEditingOrder(null);
    clearCart();
    setCartOpen(false);
  };

  const handleOrderUpdated = ({ alreadyPaid } = {}) => {
    clearEditingOrder();
    setEditingOrder(null);
    if (alreadyPaid) {
      clearPendingOrderCode();
      setPendingCode(null);
      clearCart();
    }
  };

  const handleAddToCart = (product, type = 'ala_carte') => {
    const activeOptions = (product.option_ids || [])
      .map(oid => productOptions.find(o => o.id === oid))
      .filter(Boolean);
    const needsChoices = product.lactose_free_option || activeOptions.length > 0;
    if (needsChoices) {
      const defaults = { lactose_free: false };
      activeOptions.forEach(o => { defaults[`opt_${o.id}`] = false; });
      setTempSelections(defaults);
      setOptionsProduct({ product, type });
      return;
    }
    addItem({
      product_id: product.id,
      name_it: product.name_it,
      name_en: product.name_en,
      price: product.price,
      category_id: product.category_id,
      type,
      quantity: 1,
      separate_print: product.separate_print || false,
    });
  };

  const confirmOptions = () => {
    if (!optionsProduct) return;
    const { product, type } = optionsProduct;
    const lactose_free = !!tempSelections.lactose_free;
    const selected_options = {};
    Object.keys(tempSelections).forEach(k => {
      if (k.startsWith('opt_')) {
        selected_options[k.replace('opt_', '')] = !!tempSelections[k];
      }
    });
    addItem({
      product_id: product.id,
      name_it: product.name_it,
      name_en: product.name_en,
      price: product.price,
      category_id: product.category_id,
      type,
      quantity: 1,
      lactose_free,
      selected_options,
      separate_print: product.separate_print || false,
    });
    setOptionsProduct(null);
    setTempSelections({});
  };

  const toggleTemp = (key, value) => {
    setTempSelections(prev => ({ ...prev, [key]: value }));
  };

  const filteredProducts = search
    ? products.filter(p => p.name_it?.toLowerCase().includes(search.toLowerCase()) || p.name_en?.toLowerCase().includes(search.toLowerCase()))
    : products.filter(p => p.category_id === activeCat);

  const isOutOfStock = (p) => p.stock_enabled && (p.stock_quantity ?? 0) <= 0;
  const availableProducts = filteredProducts.filter(p => p.available !== false && !isOutOfStock(p));
  const soldOutProducts = filteredProducts.filter(p => p.available === false || isOutOfStock(p));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Utensils className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">{settings?.festa_name || t('appName')}</h1>
              <p className="text-xs text-muted-foreground leading-tight">{t('tagline')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PrivacyDialog trigger={undefined} />
            <LanguageToggle />
            <div className="flex gap-1">
              <Link to="/cassa" className="px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground border rounded-lg">
                {t('cassa')}
              </Link>
              <Link to="/admin" className="px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground border rounded-lg">
                {t('admin')}
              </Link>
            </div>
          </div>
        </div>
        {/* Search */}
        <div className="max-w-3xl mx-auto px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('search')}
              className="pl-9 h-10"
            />
          </div>
        </div>
      </header>

      {editingOrder && (
        <div className="bg-orange-100 border-b border-orange-300">
          <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5 text-orange-900 min-w-0">
              <Pencil className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{t('editingOrderBanner')} <strong className="font-mono tracking-widest">{editingOrder.code}</strong></span>
            </span>
            <button className="flex-shrink-0 text-orange-900 underline font-medium" onClick={cancelEditOrder}>{t('cancelEdit')}</button>
          </div>
        </div>
      )}

      {/* Category tabs */}
      {!search && (
        <div className="sticky top-[121px] z-20 bg-gray-50/95 backdrop-blur border-b">
          <div className="max-w-3xl mx-auto px-4 py-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={cn(
                  "flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition flex items-center gap-1",
                  activeCat === cat.id
                    ? "bg-orange-600 text-white"
                    : "bg-white border text-foreground hover:border-orange-300"
                )}
              >
                {cat.icon && <span>{cat.icon}</span>}
                {tn(cat.name_it, cat.name_en)}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-4">
        {/* Fixed menus */}
        {!search && fixedMenus.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-2">{t('fixedMenu')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fixedMenus.map(menu => (
                <button
                  key={menu.id}
                  onClick={() => setWizardMenu(menu)}
                  className="text-left p-4 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-md hover:shadow-lg transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg">{tn(menu.name_it, menu.name_en)}</span>
                    <span className="text-xl font-bold">€{menu.price.toFixed(2)}</span>
                  </div>
                  <p className="text-sm opacity-90 mt-1">{t('chooseFirst')} · {t('chooseSecond')} · {t('included')}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Products */}
        <section>
          {search && <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-2">{t('search')}</h2>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {availableProducts.map(product => {
              const hasImage = !!product.image_url;
              const activeOptions = (product.option_ids || [])
                .map(oid => productOptions.find(o => o.id === oid))
                .filter(Boolean);
              const lowStock = product.stock_enabled && product.stock_quantity != null && product.stock_quantity > 0 && product.stock_quantity <= 5;
              return (
                <div key={product.id} className={cn(
                  "bg-white rounded-xl border overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-0.5 transition group relative",
                  product.is_new && "ring-2 ring-violet-400"
                )}>
                  {product.is_new && (
                    <span className="absolute top-1.5 left-1.5 z-10 bg-violet-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow flex items-center gap-0.5 animate-pulse">
                      ✨ {t('isNewLabel')}
                    </span>
                  )}
                  {hasImage && (
                    <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                      <Image
                        src={product.image_url}
                        fittingType="fill"
                        className="w-full h-full group-hover:scale-105 transition duration-300"
                        alt={tn(product.name_it, product.name_en)}
                      />
                    </div>
                  )}
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="font-semibold text-sm leading-tight">{tn(product.name_it, product.name_en)}</h3>
                    </div>
                    {(product.description_it || product.description_en) && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 flex-1">{tn(product.description_it, product.description_en)}</p>
                    )}
                    {activeOptions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {activeOptions.map(o => (
                          <span key={o.id} className="text-[10px] bg-violet-50 border border-violet-200 text-violet-700 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                            {o.icon} {tn(o.name_it, o.name_en)}
                          </span>
                        ))}
                      </div>
                    )}
                    {lowStock && (
                      <p className="text-[11px] font-semibold text-orange-600 mt-1">{t('lastPortionsLabel')}: {product.stock_quantity}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-base font-bold text-orange-600">{formatPrice(product.price)}</span>
                      <AllergenDialog product={product} allergens={allergens} children={undefined} />
                    </div>
                    <Button size="sm" className="w-full mt-2 h-8 bg-orange-600 hover:bg-orange-700" onClick={() => handleAddToCart(product)}>
                      {t('addToCart')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          {soldOutProducts.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">{t('soldOut')}</p>
              {soldOutProducts.map(product => (
                <div key={product.id} className="bg-gray-100 rounded-xl border p-3 flex items-center justify-between opacity-60">
                  <span className="font-medium text-sm line-through">{tn(product.name_it, product.name_en)}</span>
                  <span className="text-xs text-red-500 font-medium">{t('soldOut')}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Recovered order code banner: reappears even after a refresh or an
          accidental close, so the customer never really "loses" their code. */}
      {pendingCode && (
        <div className={cn(
          "fixed left-0 right-0 z-40 px-4 max-w-3xl mx-auto",
          items.length > 0 ? "bottom-20" : "bottom-4"
        )}>
          <div className="w-full bg-white border-2 border-orange-500 rounded-2xl shadow-lg px-4 py-2.5 flex items-center justify-between gap-2">
            <button className="flex items-center gap-2 min-w-0 flex-1 text-left" onClick={() => setPendingCodeDetailOpen(true)}>
              <span className="text-xl">🎫</span>
              <span className="min-w-0">
                <span className="block text-[11px] text-muted-foreground leading-tight">{t('yourLastCode')}</span>
                <span className="block font-bold tracking-widest text-orange-600 leading-tight">{pendingCode.code}</span>
              </span>
            </button>
            <button
              className="flex-shrink-0 text-xs font-semibold text-orange-700 border border-orange-300 rounded-lg px-2 py-1 hover:bg-orange-50 disabled:opacity-50"
              onClick={startEditOrder}
              disabled={editBusy}
            >
              {t('editOrder')}
            </button>
            <button
              className="text-muted-foreground hover:text-foreground text-sm px-1 flex-shrink-0"
              onClick={() => { clearPendingOrderCode(); setPendingCode(null); }}
              aria-label={t('close')}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Floating cart button */}
      {items.length > 0 && (
        <div className="fixed bottom-4 left-0 right-0 z-40 px-4 max-w-3xl mx-auto">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-2xl shadow-lg px-5 py-3.5 flex items-center justify-between transition active:scale-[0.98]"
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-2 -right-2 bg-white text-orange-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {items.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </div>
              <span className="font-semibold">{t('cart')}</span>
            </div>
            <span className="font-bold text-lg">{formatPrice(total)}</span>
          </button>
        </div>
      )}

      {/* Cart drawer */}
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} productOptions={productOptions} editing={!!editingOrder} />

      {/* Checkout dialog */}
      <CheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onClear={() => { setCartOpen(false); }}
        onCodeGenerated={(data) => setPendingCode(data)}
        settings={settings}
        editingOrder={editingOrder}
        onOrderUpdated={handleOrderUpdated}
      />

      {/* Onboarding */}
      <Onboarding open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />

      {/* Pending order dialog */}
      {pendingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-lg">{t('pendingOrderTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('pendingOrderText')}</p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setPendingOpen(false)}>{t('continueOrder')}</Button>
              <Button variant="outline" className="flex-1" onClick={() => { localStorage.removeItem('sagra_cart'); localStorage.removeItem('sagra_pending_order'); window.location.reload(); }}>{t('cancelOrder')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Pending order code detail (reopened from the banner) */}
      {pendingCodeDetailOpen && pendingCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPendingCodeDetailOpen(false)}>
          <div className="text-center space-y-6 bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div>
              <p className="text-sm text-muted-foreground mb-2">{t('yourLastCode')}</p>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl p-8">
                <p className="text-xs uppercase tracking-widest opacity-80 mb-2">{t('yourCode')}</p>
                <p className="text-5xl font-bold tracking-[0.3em] font-mono">{pendingCode.code}</p>
                {pendingCode.table_number && (
                  <p className="text-sm mt-3 opacity-90">{t('tableNumber')}: <span className="font-bold">{pendingCode.table_number}</span></p>
                )}
                {typeof pendingCode.total === 'number' && (
                  <p className="text-sm opacity-90">{formatPrice(pendingCode.total)}</p>
                )}
              </div>
            </div>
            <Button variant="outline" className="w-full border-orange-300 text-orange-700 hover:bg-orange-50" onClick={startEditOrder} disabled={editBusy}>
              <Pencil className="w-4 h-4 mr-1.5" />
              {t('editOrder')}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { clearPendingOrderCode(); setPendingCode(null); setPendingCodeDetailOpen(false); }}>
                {t('dismissCode')}
              </Button>
              <Button className="flex-1" onClick={() => setPendingCodeDetailOpen(false)}>{t('close')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed menu wizard */}
      {wizardMenu && (
        <FixedMenuWizard menu={wizardMenu} products={products} onClose={() => setWizardMenu(null)} />
      )}

      {/* Options choice dialog */}
      {optionsProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOptionsProduct(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">{t('optionsChoice')}</h3>
            <p className="text-sm text-muted-foreground font-medium">{tn(optionsProduct.product.name_it, optionsProduct.product.name_en)}</p>
            <div className="space-y-3">
              {optionsProduct.product.lactose_free_option && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-700">🥛 {t('lactoseFreeChoice')}</p>
                  <div className="flex gap-2">
                    <Button
                      variant={tempSelections.lactose_free ? 'outline' : 'default'}
                      className={cn('flex-1', !tempSelections.lactose_free && 'bg-slate-700 hover:bg-slate-800')}
                      onClick={() => toggleTemp('lactose_free', false)}
                    >
                      {t('withLactose')}
                    </Button>
                    <Button
                      variant={tempSelections.lactose_free ? 'default' : 'outline'}
                      className={cn('flex-1', tempSelections.lactose_free ? 'bg-green-600 hover:bg-green-700 border-green-600' : 'border-green-500 text-green-600 hover:bg-green-50')}
                      onClick={() => toggleTemp('lactose_free', true)}
                    >
                      {t('withoutLactose')}
                    </Button>
                  </div>
                </div>
              )}
              {(optionsProduct.product.option_ids || [])
                .map(oid => productOptions.find(o => o.id === oid))
                .filter(Boolean)
                .map(o => (
                  <div key={o.id} className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-700">{o.icon} {tn(o.name_it, o.name_en)}</p>
                    <div className="flex gap-2">
                      <Button
                        variant={tempSelections[`opt_${o.id}`] ? 'outline' : 'default'}
                        className={cn('flex-1', !tempSelections[`opt_${o.id}`] && 'bg-slate-700 hover:bg-slate-800')}
                        onClick={() => toggleTemp(`opt_${o.id}`, false)}
                      >
                        {t('noOption')}
                      </Button>
                      <Button
                        variant={tempSelections[`opt_${o.id}`] ? 'default' : 'outline'}
                        className={cn('flex-1', tempSelections[`opt_${o.id}`] ? 'bg-violet-600 hover:bg-violet-700 border-violet-600' : 'border-violet-500 text-violet-600 hover:bg-violet-50')}
                        onClick={() => toggleTemp(`opt_${o.id}`, true)}
                      >
                        {t('yesOption')}
                      </Button>
                    </div>
                  </div>
                ))
              }
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setOptionsProduct(null)}>{t('cancel')}</Button>
              <Button className="flex-1 bg-orange-600 hover:bg-orange-700" onClick={confirmOptions}>{t('confirm')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <LanguageProvider>
      <CartProvider>
        <HomeContent />
      </CartProvider>
    </LanguageProvider>
  );
}