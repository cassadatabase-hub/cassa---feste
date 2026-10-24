import React from 'react';
import { Banknote, CreditCard } from 'lucide-react';
import { useLang } from '@/lib/i18n';

// Scelta del metodo di pagamento in cassa: contanti o POS (nessun calcolo del resto).
export default function PaymentMethodPicker({ value, onChange }) {
  const { t } = useLang();
  const options = [
    { id: 'cash', label: t('paymentCash'), Icon: Banknote },
    { id: 'pos', label: t('paymentPos'), Icon: CreditCard },
  ];
  return (
    <div>
      <p className="text-xs font-medium mb-1">{t('paymentMethod')}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`flex items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-semibold transition ${
              value === id ? 'border-orange-600 bg-orange-50 text-orange-700' : 'border-border bg-white text-muted-foreground hover:border-slate-400'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
