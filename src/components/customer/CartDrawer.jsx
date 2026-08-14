import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { useLang } from '@/lib/i18n';
import { formatPrice } from '@/lib/codeGen';

export default function CartDrawer({ open, onOpenChange, onCheckout, productOptions = [] }) {
  const { items, updateQuantity, removeItem, total, alaCarteItems, fixedMenuItems, drinkItems, tableNumber, setTableNumber } = useCart();
  const { t, tn, lang } = useLang();

  const getOption = (id) => productOptions.find(o => o.id === id);

  const renderOptions = (item) => {
    if (!item.selected_options) return null;
    const entries = Object.entries(item.selected_options).filter(([, v]) => !!v);
    if (entries.length === 0) return null;
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {entries.map(([oid]) => {
          const o = getOption(oid);
          if (!o) return null;
          return (
            <span key={oid} className="text-[10px] bg-violet-50 border border-violet-200 text-violet-700 rounded px-1.5 py-0.5 flex items-center gap-0.5">
              ✓ {o.icon} {tn(o.name_it, o.name_en)}
            </span>
          );
        })}
      </div>
    );
  };

  const renderSection = (sectionItems, title) => {
    if (sectionItems.length === 0) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide pt-2">{title}</h4>
        {sectionItems.map(item => (
          <div key={item.uid} className="flex items-start gap-2 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">{tn(item.name_it, item.name_en)}</p>
              {item.lactose_free && (
                <p className="text-xs text-green-600 font-medium">🥛 {t('withoutLactoseLabel')}</p>
              )}
              {renderOptions(item)}
              {item.menu_items && item.menu_items.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {item.menu_items.map((mi, i) => (
                    <p key={i} className="text-xs text-muted-foreground pl-2">• {tn(mi.name_it, mi.name_en)}{mi.quantity > 1 ? ` ×${mi.quantity}` : ''}</p>
                  ))}
                </div>
              )}
              {item.included_items && item.included_items.length > 0 && (
                <p className="text-xs text-green-600 pl-2 mt-0.5">✓ {item.included_items.join(', ')}</p>
              )}
              <p className="text-sm font-semibold mt-0.5">{formatPrice(item.price)}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.uid, -1)}>
                <Minus className="w-3 h-3" />
              </Button>
              <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.uid, 1)}>
                <Plus className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.uid)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader className="">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            {t('cart')}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground text-center px-4">{t('cartEmpty')}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-1">
            {renderSection(alaCarteItems, t('foodAlaCarte'))}
            {renderSection(fixedMenuItems, t('fixedMenus'))}
            {renderSection(drinkItems, t('drinks'))}
          </div>
        )}

        {items.length > 0 && (
          <SheetFooter className="gap-3">
            <div className="flex items-center justify-between text-lg font-bold">
              <span>{t('total')}</span>
              <span>{formatPrice(total)}</span>
            </div>
            <Separator />
            <div className="space-y-2 rounded-lg bg-orange-50 border border-orange-200 p-3">
              <Label htmlFor="table-cart" className="text-orange-900 font-semibold">{t('tableNumber')} *</Label>
              <Input
                id="table-cart"
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
                placeholder={t('tableNumberPlaceholder')}
                className="h-12 text-base border-orange-300 focus-visible:ring-orange-500"
              />
            </div>
            <Button
              size="lg"
              className="w-full bg-orange-600 hover:bg-orange-700"
              disabled={!tableNumber.trim()}
              onClick={onCheckout}
            >
              {t('generateCode')}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}