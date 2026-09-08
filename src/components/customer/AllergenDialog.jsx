import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertCircle } from 'lucide-react';
import { useLang } from '@/lib/i18n';

export default function AllergenDialog({ product, allergens, children }) {
  const { t, tn } = useLang();
  const [open, setOpen] = useState(false);

  if (!product || !product.allergens || product.allergens.length === 0) return children;

  const productAllergens = allergens.filter(a => product.allergens.includes(a.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <button className="inline-flex items-center gap-1 text-xs text-amber-600 hover:underline">
            <AlertCircle className="w-3.5 h-3.5" />
            {t('allergens')}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            {t('allergenInfo')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm font-medium">{tn(product.name_it, product.name_en)}</p>
          {productAllergens.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t('contains')}:</p>
              <div className="flex flex-wrap gap-2">
                {productAllergens.map(a => (
                  <div key={a.id} className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    <span className="text-lg">{a.icon}</span>
                    <span className="text-sm font-medium">{tn(a.name_it, a.name_en)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nessun allergene segnalato / No allergens reported</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}