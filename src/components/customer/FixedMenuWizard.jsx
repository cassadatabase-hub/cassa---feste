import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Minus, Plus } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { useLang } from '@/lib/i18n';

export default function FixedMenuWizard({ menu, products, onClose }) {
  const { addItem } = useCart();
  const { t, tn } = useLang();
  const [step, setStep] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [firstChoice, setFirstChoice] = useState(null);
  const [secondChoice, setSecondChoice] = useState(null);
  const [extraChoices, setExtraChoices] = useState({});

  const firstCourses = products.filter(p => menu.first_course_ids?.includes(p.id));
  const secondCourses = products.filter(p => menu.second_course_ids?.includes(p.id));
  const extraDrinks = products.filter(p => menu.extra_drink_ids?.includes(p.id));

  const includedItemsIt = menu.included_item_names_it || [];
  const includedItemsEn = menu.included_item_names_en || [];
  const includedItems = tn(includedItemsIt, includedItemsEn);

  const totalExtra = Object.entries(extraChoices).reduce((sum, [pid, qty]) => {
    const p = extraDrinks.find(x => x.id === pid);
    return sum + (p ? p.price * qty : 0);
  }, 0);

  const handleConfirm = () => {
    const items = [];
    if (firstChoice) {
      const p = firstCourses.find(x => x.id === firstChoice);
      if (p) items.push({ product_id: p.id, name_it: p.name_it, name_en: p.name_en, price: 0, type: 'fixed_menu' });
    }
    if (secondChoice) {
      const p = secondCourses.find(x => x.id === secondChoice);
      if (p) items.push({ product_id: p.id, name_it: p.name_it, name_en: p.name_en, price: 0, type: 'fixed_menu' });
    }
    Object.entries(extraChoices).forEach(([pid, qty]) => {
      if (qty > 0) {
        const p = extraDrinks.find(x => x.id === pid);
        if (p) items.push({ product_id: p.id, name_it: p.name_it, name_en: p.name_en, price: p.price, type: 'extra_drink', quantity: qty });
      }
    });

    addItem({
      type: 'fixed_menu',
      name_it: menu.name_it,
      name_en: menu.name_en,
      price: (menu.price * quantity) + totalExtra,
      unit_price: menu.price,
      quantity,
      menu_items: items,
      included_items: includedItems,
    });
    onClose();
  };

  const canProceed = step === 0
    || (step === 1 && (firstChoice || firstCourses.length === 0))
    || (step === 2 && (secondChoice || secondCourses.length === 0))
    || step === 3;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{tn(menu.name_it, menu.name_en)}</span>
            <span className="text-lg text-orange-600">€{menu.price.toFixed(2)}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-orange-500' : 'bg-muted'}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">{t('howManyMenus')}</Label>
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-3xl font-bold w-12 text-center">{quantity}</span>
              <Button variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            <Label className="text-base font-semibold">{t('chooseFirst')}</Label>
            {firstCourses.map(p => (
              <button
                key={p.id}
                onClick={() => setFirstChoice(p.id)}
                className={`w-full text-left p-3 rounded-lg border-2 transition ${firstChoice === p.id ? 'border-orange-500 bg-orange-50' : 'border-border hover:border-orange-300'}`}
              >
                <span className="font-medium">{tn(p.name_it, p.name_en)}</span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <Label className="text-base font-semibold">{t('chooseSecond')}</Label>
            {secondCourses.map(p => (
              <button
                key={p.id}
                onClick={() => setSecondChoice(p.id)}
                className={`w-full text-left p-3 rounded-lg border-2 transition ${secondChoice === p.id ? 'border-orange-500 bg-orange-50' : 'border-border hover:border-orange-300'}`}
              >
                <span className="font-medium">{tn(p.name_it, p.name_en)}</span>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label className="text-base font-semibold">{t('summary')}</Label>
            <div className="space-y-1.5 text-sm">
              {includedItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-green-50 border border-green-200 rounded px-3 py-1.5">
                  <span>✓ {item}</span>
                  <span className="text-xs text-green-600">{t('included')}</span>
                </div>
              ))}
              {firstChoice && (
                <div className="px-3 py-1.5 bg-muted rounded">
                  {tn(firstCourses.find(p => p.id === firstChoice)?.name_it, firstCourses.find(p => p.id === firstChoice)?.name_en)}
                </div>
              )}
              {secondChoice && (
                <div className="px-3 py-1.5 bg-muted rounded">
                  {tn(secondCourses.find(p => p.id === secondChoice)?.name_it, secondCourses.find(p => p.id === secondChoice)?.name_en)}
                </div>
              )}
            </div>
            {extraDrinks.length > 0 && (
              <div className="space-y-2 pt-2">
                <Label className="text-sm font-semibold">{t('extraDrinks')}</Label>
                {extraDrinks.map(p => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div>
                      <span className="text-sm">{tn(p.name_it, p.name_en)}</span>
                      <span className="text-xs text-muted-foreground ml-2">+€{p.price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setExtraChoices(prev => ({ ...prev, [p.id]: Math.max(0, (prev[p.id] || 0) - 1) }))}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{extraChoices[p.id] || 0}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setExtraChoices(prev => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }))}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>{t('total')}</span>
              <span>€{((menu.price * quantity) + totalExtra).toFixed(2)}</span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>{t('back')}</Button>}
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed} className="flex-1">{t('confirm')}</Button>
          ) : (
            <Button onClick={handleConfirm} className="flex-1 bg-orange-600 hover:bg-orange-700">{t('addToCart')}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}