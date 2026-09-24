import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useLang } from '@/lib/i18n';
import { formatPrice } from '@/lib/codeGen';
import { isSoldOut } from '@/lib/stock';
import { cn } from '@/lib/utils';

// Selezione prodotti per la cassa (usata da "Cassa manuale" e dalla modifica
// di un ordine da codice). I prodotti esauriti restano al loro posto ma sono
// spenti e non cliccabili: le posizioni dei pulsanti non cambiano mai.
export default function ProductPicker({
  categories,
  products,
  productOptions = [],
  viewMode = 'tabs',
  cartItems = [],
  onAdd,
  listMaxHeight = 'max-h-[70vh]',
}) {
  const { t, tn } = useLang();
  const [activeCat, setActiveCat] = useState(null);
  const [optionsProduct, setOptionsProduct] = useState(null);
  const [tempSelections, setTempSelections] = useState(/** @type {Record<string, boolean>} */ ({}));

  useEffect(() => {
    if (categories.length > 0 && !activeCat) setActiveCat(categories[0].id);
  }, [categories, activeCat]);

  const getOption = (id) => productOptions.find(o => o.id === id);

  const handleClick = (product) => {
    if (isSoldOut(product)) return;
    const activeOptions = (product.option_ids || []).map(getOption).filter(Boolean);
    const needsChoices = product.lactose_free_option || activeOptions.length > 0;
    if (!needsChoices) {
      onAdd(product, {});
      return;
    }
    const defaults = { lactose_free: false };
    activeOptions.forEach(o => { defaults[`opt_${o.id}`] = false; });
    setTempSelections(defaults);
    setOptionsProduct(product);
  };

  const confirmOptions = () => {
    if (!optionsProduct) return;
    const lactose_free = !!tempSelections.lactose_free;
    const selected_options = {};
    Object.keys(tempSelections).forEach(k => {
      if (k.startsWith('opt_')) selected_options[k.replace('opt_', '')] = !!tempSelections[k];
    });
    onAdd(optionsProduct, { lactose_free, selected_options });
    setOptionsProduct(null);
    setTempSelections({});
  };

  const toggleTemp = (key, value) => setTempSelections(prev => ({ ...prev, [key]: value }));

  const qtyOf = (product) =>
    cartItems.filter(i => i.product_id === product.id).reduce((s, i) => s + (i.quantity || 1), 0);

  // Tutti i prodotti del reparto, esauriti compresi (restano visibili e spenti)
  const filteredProducts = products.filter(p => p.category_id === activeCat);
  const productsByCategory = categories
    .map(cat => ({ cat, items: products.filter(p => p.category_id === cat.id) }))
    .filter(g => g.items.length > 0);

  const soldOutBadge = (
    <span className="text-[10px] font-bold uppercase tracking-wide text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
      {t('soldOut')}
    </span>
  );

  return (
    <>
      <div className="space-y-3">
        {viewMode === 'tabs' && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={cn(
                  "flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition",
                  activeCat === cat.id ? "bg-slate-800 text-white" : "bg-white border hover:border-slate-400"
                )}
              >
                {cat.icon} {tn(cat.name_it, cat.name_en)}
              </button>
            ))}
          </div>
        )}

        {viewMode === 'tabs' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filteredProducts.map(product => {
              const soldOut = isSoldOut(product);
              const totalQty = qtyOf(product);
              return (
                <button
                  key={product.id}
                  onClick={() => handleClick(product)}
                  disabled={soldOut}
                  aria-disabled={soldOut}
                  className={cn(
                    "text-left p-3 rounded-lg border-2 transition relative",
                    soldOut
                      ? "border-dashed border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                      : totalQty > 0 ? "border-orange-500 bg-orange-50" : "border-border bg-white hover:border-slate-400"
                  )}
                >
                  <p className={cn("text-sm font-medium leading-tight", soldOut && "line-through")}>{tn(product.name_it, product.name_en)}</p>
                  <p className={cn("text-sm font-bold mt-1", soldOut ? "text-slate-400" : "text-orange-600")}>{formatPrice(product.price)}</p>
                  {soldOut && <div className="mt-1">{soldOutBadge}</div>}
                  {!soldOut && totalQty > 0 && (
                    <span className="absolute top-1.5 right-1.5 bg-orange-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {totalQty}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className={cn(listMaxHeight, "overflow-y-auto space-y-4 pr-1")}>
            {productsByCategory.map(({ cat, items }) => (
              <div key={cat.id}>
                <h3 className="text-sm font-extrabold text-white bg-slate-700 uppercase tracking-wide px-3 py-2 rounded-lg mb-2 sticky top-0 z-10 shadow">
                  {cat.icon} {tn(cat.name_it, cat.name_en)}
                </h3>
                <div className="space-y-1.5">
                  {items.map(product => {
                    const soldOut = isSoldOut(product);
                    const totalQty = qtyOf(product);
                    return (
                      <button
                        key={product.id}
                        onClick={() => handleClick(product)}
                        disabled={soldOut}
                        aria-disabled={soldOut}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-lg border-2 transition flex items-center justify-between gap-3",
                          soldOut
                            ? "border-dashed border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                            : totalQty > 0 ? "border-orange-500 bg-orange-50" : "border-border bg-white hover:border-slate-400"
                        )}
                      >
                        <span className={cn("text-sm font-medium truncate", soldOut && "line-through")}>{tn(product.name_it, product.name_en)}</span>
                        <span className="flex items-center gap-2 flex-shrink-0">
                          {soldOut && soldOutBadge}
                          <span className={cn("text-sm font-bold", soldOut ? "text-slate-400" : "text-orange-600")}>{formatPrice(product.price)}</span>
                          {!soldOut && totalQty > 0 && (
                            <span className="bg-orange-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                              {totalQty}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {optionsProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOptionsProduct(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">{t('optionsChoice')}</h3>
            <p className="text-sm text-muted-foreground font-medium">{tn(optionsProduct.name_it, optionsProduct.name_en)}</p>
            <div className="space-y-3">
              {optionsProduct.lactose_free_option && (
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
              {(optionsProduct.option_ids || [])
                .map(getOption)
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
                ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setOptionsProduct(null)}>{t('cancel')}</Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={confirmOptions}>{t('confirm')}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
