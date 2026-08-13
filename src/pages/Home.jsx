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
import { ShoppingCart, Search, Utensils } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice } from '@/lib/codeGen';
import { cn } from '@/lib/utils';
import { Image } from '@/components/ui/image';

function HomeContent() {
  const { t, tn, lang } = useLang();
  const { categories, products, allergens, productOptions, fixedMenus, settings, loading } = useCatalog();
  const { items, total, addItem } = useCart();
  const [activeCat, setActiveCat] = useState(null);
  const [search, setSearch] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [wizardMenu, setWizardMenu] = useState(null);
  const [lactoseProduct, setLactoseProduct] = useState(null);

  useEffect(() => {
    if (!loading && categories.length > 0 && !activeCat) {
      setActiveCat(categories[0].id);
    }
  }, [loading, categories, activeCat]);

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

  const handleAddToCart = (product, type = 'ala_carte') => {
    if (product.lactose_free_option) {
      setLactoseProduct(product);
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
    });
  };

  const handleLactoseChoice = (lactoseFree) => {
    if (!lactoseProduct) return;
    addItem({
      product_id: lactoseProduct.id,
      name_it: lactoseProduct.name_it,
      name_en: lactoseProduct.name_en,
      price: lactoseProduct.price,
      category_id: lactoseProduct.category_id,
      type: 'ala_carte',
      quantity: 1,
      lactose_free: lactoseFree,
    });
    setLactoseProduct(null);
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
            <PrivacyDialog />
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
                      <AllergenDialog product={product} allergens={allergens} />
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
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} />

      {/* Checkout dialog */}
      <CheckoutDialog open={checkoutOpen} onClose={() => setCheckoutOpen(false)} onClear={() => { setCartOpen(false); }} settings={settings} />

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

      {/* Fixed menu wizard */}
      {wizardMenu && (
        <FixedMenuWizard menu={wizardMenu} products={products} onClose={() => setWizardMenu(null)} />
      )}

      {/* Lactose choice dialog */}
      {lactoseProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setLactoseProduct(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">{t('lactoseFreeChoice')}</h3>
            <p className="text-sm text-muted-foreground">{tn(lactoseProduct.name_it, lactoseProduct.name_en)}</p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => handleLactoseChoice(false)}>{t('withLactose')}</Button>
              <Button variant="outline" className="flex-1 border-green-500 text-green-600 hover:bg-green-50" onClick={() => handleLactoseChoice(true)}>{t('withoutLactose')}</Button>
            </div>
            <Button variant="ghost" className="w-full" onClick={() => setLactoseProduct(null)}>{t('cancel')}</Button>
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