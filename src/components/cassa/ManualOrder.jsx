import React, { useState } from 'react';
import { base44, supabase } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Minus, CheckCircle, Printer } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { formatPrice } from '@/lib/codeGen';
import { useToast } from '@/components/ui/use-toast';
import ComandaPrint from '@/components/cassa/ComandaPrint';
import ReceiptPrint from '@/components/cassa/ReceiptPrint';
import ProductPicker from '@/components/cassa/ProductPicker';
import { reconcileItems, describeRemoved } from '@/lib/stock';

export default function ManualOrder({ categories, products, comandaTemplates, productOptions = [], viewMode = 'tabs' }) {
  const { t, tn } = useLang();
  const { toast } = useToast();
  const [cart, setCart] = useState([]);
  const [tableNumber, setTableNumber] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [festaName, setFestaName] = useState('');

  React.useEffect(() => {
    base44.entities.AppSettings.list('-created_date', 1).then(s => {
      if (s && s[0]) setFestaName(s[0].festa_name || '');
    });
  }, []);

  const getOption = (id) => productOptions.find(o => o.id === id);

  const optionsMatch = (a, b) => {
    const aKeys = Object.keys(a || {});
    const bKeys = Object.keys(b || {});
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(k => a[k] === b[k]);
  };

  const addToCart = (product, opts = {}) => {
    const { lactose_free = false, selected_options = {} } = opts;
    setCart(prev => {
      const existing = prev.find(i =>
      i.product_id === product.id &&
      i.lactose_free === lactose_free &&
      optionsMatch(i.selected_options, selected_options)
    );
      if (existing) {
        return prev.map(i =>
          i.product_id === product.id &&
          i.lactose_free === lactose_free &&
          optionsMatch(i.selected_options, selected_options)
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, {
        product_id: product.id,
        name_it: product.name_it,
        name_en: product.name_en,
        price: product.price,
        category_id: product.category_id,
        lactose_free,
        selected_options,
        separate_print: product.separate_print || false,
        uid: Date.now() + Math.random(),
        quantity: 1,
      }];
    });
  };

  const renderOptionsInline = (item) => {
    if (!item.selected_options) return null;
    const entries = Object.entries(item.selected_options).filter(([, v]) => !!v);
    if (entries.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-0.5">
        {entries.map(([oid]) => {
        const o = getOption(oid);
        if (!o) return null;
        return (
          <span key={oid} className="text-[10px] bg-violet-50 border border-violet-200 text-violet-700 rounded px-1.5 py-0.5">
            ✓ {o.icon} {tn(o.name_it, o.name_en)}
          </span>
        );
      })}
      </div>
    );
  };

  // Se mentre il cassiere compone l'ordine un prodotto viene segnato esaurito
  // (l'elenco prodotti si aggiorna da solo), lo togliamo dall'ordine e lo
  // segnaliamo, così non si arriva al pagamento con prodotti non più disponibili.
  React.useEffect(() => {
    if (cart.length === 0) return;
    const { items: kept, removed } = reconcileItems(cart, products);
    if (removed.length > 0) {
      setCart(kept);
      toast({ title: t('soldOutRemovedTitle'), description: describeRemoved(removed, { t, tn }), variant: 'destructive' });
    }
  }, [products]);

  const updateQty = (uid, delta) => {
    setCart(prev => prev
      .map(i => i.uid === uid ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
      .filter(i => i.quantity > 0)
    );
  };

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  // Chiude da sola la schermata di conferma quando la stampa è davvero
  // terminata (evento "afterprint" del browser) — niente tasto "Chiudi" da
  // premere a mano dopo aver stampato. L'anteprima resta visibile come prima.
  const handlePrintAndClose = (onDone) => {
    const cleanup = () => {
      window.removeEventListener('afterprint', cleanup);
      onDone();
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  const handleConfirm = async () => {
    if (!tableNumber.trim()) {
      toast({ title: t('tableNumberRequired'), variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      // Ultimo controllo sulle disponibilità aggiornate: se qualcosa è finito
      // nel frattempo lo togliamo e chiediamo di riconfermare col nuovo totale.
      const freshProducts = await base44.entities.Product.list('sort_order', 500);
      const check = reconcileItems(cart, freshProducts);
      if (check.removed.length > 0) {
        setCart(check.items);
        toast({
          title: t('soldOutRemovedTitle'),
          description: `${describeRemoved(check.removed, { t, tn })} — ${t('soldOutRecheck')}`,
          variant: 'destructive',
        });
        return;
      }
      const settings = await base44.entities.AppSettings.list('-created_date', 1);
      const items = cart.map(item => ({
        ...item,
        name: item.name_it,
      }));
      const { data: order, error } = await supabase.rpc('create_paid_order', {
        p_code: null,
        p_items: items,
        p_total: total,
        p_table_number: tableNumber,
        p_customer_name: null,
        p_note: note || null,
        p_mode: 'manual',
        p_festa_id: settings?.[0]?.active_festa_id || '',
      });
      if (error) throw error;
      setCompletedOrder(order);
      setCart([]);
      setTableNumber('');
      setNote('');
      toast({ title: t('orderCompleted') });
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="grid lg:grid-cols-[1fr_380px] gap-4">
      {/* Product grid */}
      <ProductPicker
        categories={categories}
        products={products}
        productOptions={productOptions}
        viewMode={viewMode}
        cartItems={cart}
        onAdd={addToCart}
      />

      {/* Cart sidebar */}
      <Card className="h-fit sticky top-4">
        <CardHeader>
          <CardTitle>{t('manualOrder')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t('cartEmpty')}</p>
          ) : (
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {cart.map(item => (
                <div key={item.uid} className="flex items-center justify-between gap-2 py-1.5 border-b">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm block truncate">{tn(item.name_it, item.name_en)}</span>
                    {item.lactose_free && <span className="text-xs text-green-600 font-medium">🥛 {t('withoutLactoseLabel')}</span>}
                    {renderOptionsInline(item)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.uid, -1)}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.uid, 1)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <span className="text-sm font-medium w-16 text-right">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">{t('tableNumber')} *</Label>
                  <Input value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder={t('tableNumberPlaceholder')} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">{t('note')}</Label>
                  <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="..." className="text-sm min-h-[40px]" />
                </div>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>{t('total')}</span>
                <span>{formatPrice(total)}</span>
              </div>
              <Button size="lg" className="w-full bg-green-600 hover:bg-green-700" onClick={handleConfirm} disabled={loading || !tableNumber.trim()}>
                <CheckCircle className="w-5 h-5 mr-2" />
                {t('confirmPayment')}
              </Button>
            </>
          )}

        </CardContent>
      </Card>
      </div>

      {completedOrder && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              {t('orderCompleted')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{t('orderNumber')} <strong>{completedOrder.order_number}</strong> — {t('tableNumber2')} {completedOrder.table_number}</p>
            <Button size="lg" className="w-full bg-slate-800 hover:bg-slate-900" onClick={() => handlePrintAndClose(() => setCompletedOrder(null))}>
              <Printer className="w-5 h-5 mr-2" />
              {t('print')}
            </Button>
            <ReceiptPrint order={completedOrder} festaName={festaName} productOptions={productOptions} />
            <ComandaPrint order={completedOrder} categories={categories} templates={comandaTemplates} singleMode={false} productOptions={productOptions} />
            <Button variant="ghost" className="w-full" onClick={() => setCompletedOrder(null)}>{t('close')}</Button>
          </CardContent>
        </Card>
      )}

    </>
  );
}