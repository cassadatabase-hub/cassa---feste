import React, { useState, useEffect, useRef } from 'react';
import { base44, supabase } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, AlertCircle, CheckCircle, Printer, Plus, Minus, Trash2, PlusCircle, ChevronUp } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { formatPrice } from '@/lib/codeGen';
import { useToast } from '@/components/ui/use-toast';
import ComandaPrint from '@/components/cassa/ComandaPrint';
import ReceiptPrint from '@/components/cassa/ReceiptPrint';
import ProductPicker from '@/components/cassa/ProductPicker';
import { reconcileItems, describeRemoved, itemsTotal, optionsMatch } from '@/lib/stock';

// Le righe salvate potrebbero non avere un uid: glielo diamo per poterle
// modificare in modo affidabile.
const withUids = (items) =>
  (items || []).map((it, idx) => ({ ...it, uid: it.uid ?? `${idx}-${Math.random().toString(36).slice(2)}` }));

export default function CodeLookup({ categories, products = [], comandaTemplates, productOptions = [], onOrderCompleted }) {
  const { t, tn } = useLang();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [orderCode, setOrderCode] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [paidOrder, setPaidOrder] = useState(null);
  const [paidNotice, setPaidNotice] = useState('');
  const [festaName, setFestaName] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  // Avviso "prodotti esauriti tolti automaticamente" mostrato in cassa
  const [notice, setNotice] = useState('');

  // Ultima versione dell'ordine salvata sul database + coda dei salvataggi
  // (serializzati, così l'ordine delle modifiche è sempre rispettato).
  const orderRef = useRef(null);
  const saveChain = useRef(Promise.resolve());
  const pendingSaves = useRef(0);

  const getOption = (id) => productOptions.find(o => o.id === id);

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

  useEffect(() => {
    base44.entities.AppSettings.list('-created_date', 1).then(s => {
      if (s && s[0]) setFestaName(s[0].festa_name || '');
    });
  }, []);

  const loadOrder = (row) => {
    orderRef.current = row;
    setOrderCode(row);
    setItems(withUids(row.cart_data?.items));
  };

  const handleLookup = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setOrderCode(null);
    setItems([]);
    setNotice('');
    setShowPicker(false);
    orderRef.current = null;
    try {
      const results = await base44.entities.OrderCode.filter({ code: code.trim().toUpperCase(), purpose: 'cassa' });
      if (!results || results.length === 0) {
        setError('notfound');
        return;
      }
      const oc = results[0];
      if (oc.status === 'consumed') {
        setError('used');
        setOrderCode(oc);
        return;
      }
      if (new Date(oc.expires_at) < new Date()) {
        setError('expired');
        return;
      }
      loadOrder(oc);
    } catch (e) {
      setError('notfound');
    } finally {
      setLoading(false);
    }
  };

  // ---- Salvataggio delle modifiche (finché l'ordine non è pagato) ----------
  const persistItems = (nextItems) => {
    if (!orderRef.current) return Promise.resolve();
    const orderId = orderRef.current.id;
    const total = itemsTotal(nextItems);
    pendingSaves.current += 1;
    saveChain.current = saveChain.current
      .then(async () => {
        const base = orderRef.current;
        if (!base || base.id !== orderId) return;
        const { data, error: err } = await supabase
          .from('order_codes')
          .update({ cart_data: { ...(base.cart_data || {}), items: nextItems, total }, total })
          .eq('id', orderId)
          .eq('status', 'pending')
          .select('*')
          .maybeSingle();
        if (err) throw err;
        if (!data) {
          // già pagato/annullato da un'altra cassa: non è più modificabile
          setError('used');
          return;
        }
        orderRef.current = data;
        setOrderCode(data);
      })
      .catch(e => toast({ title: 'Errore', description: e.message, variant: 'destructive' }))
      .finally(() => { pendingSaves.current -= 1; });
    return saveChain.current;
  };

  const applyItems = (next) => {
    setItems(next);
    persistItems(next);
  };

  const updateQty = (uid, delta) => {
    applyItems(items
      .map(i => i.uid === uid ? { ...i, quantity: Math.max(0, (i.quantity || 1) + delta) } : i)
      .filter(i => i.quantity > 0));
  };

  const removeItem = (uid) => applyItems(items.filter(i => i.uid !== uid));

  const addProduct = (product, opts = {}) => {
    const { lactose_free = false, selected_options = {} } = opts;
    const existing = items.find(i =>
      i.product_id === product.id &&
      (i.type === 'ala_carte' || !i.type) &&
      !!i.lactose_free === lactose_free &&
      optionsMatch(i.selected_options, selected_options)
    );
    if (existing) {
      applyItems(items.map(i => i.uid === existing.uid ? { ...i, quantity: (i.quantity || 1) + 1 } : i));
      return;
    }
    applyItems([...items, {
      product_id: product.id,
      name_it: product.name_it,
      name_en: product.name_en,
      price: product.price,
      category_id: product.category_id,
      type: 'ala_carte',
      quantity: 1,
      lactose_free,
      selected_options,
      separate_print: product.separate_print || false,
      uid: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }]);
  };

  // ---- Prodotti esauriti: tolti in automatico e segnalati in cassa ---------
  useEffect(() => {
    if (!orderCode || error === 'used' || items.length === 0) return;
    const { items: kept, removed } = reconcileItems(items, products);
    if (removed.length > 0) {
      const text = describeRemoved(removed, { t, tn });
      setNotice(prev => (prev ? `${prev}, ${text}` : text));
      applyItems(kept);
    }
  }, [products, items, orderCode?.id]);

  // ---- Aggiornamento in diretta se il cliente modifica l'ordine ------------
  useEffect(() => {
    if (!orderCode || error === 'used') return;
    const id = orderCode.id;
    const tick = async () => {
      try {
        const { data } = await supabase.from('order_codes').select('*').eq('id', id).maybeSingle();
        if (!data || pendingSaves.current > 0) return;
        if (data.status !== 'pending') { setError('used'); return; }
        if (orderRef.current && data.updated_date !== orderRef.current.updated_date) loadOrder(data);
      } catch (e) { /* riproviamo al prossimo giro */ }
    };
    const interval = setInterval(tick, 5000);
    return () => clearInterval(interval);
  }, [orderCode?.id, error]);

  const handleMarkPaid = async () => {
    if (!orderCode || items.length === 0) return;
    setLoading(true);
    try {
      await saveChain.current; // assicura che tutte le modifiche siano salvate

      // Ultimo controllo sulle disponibilità aggiornate. Se nel frattempo
      // qualcosa è finito lo togliamo, lo segnaliamo e chiediamo di
      // riconfermare (il totale è cambiato): mai un errore.
      const freshProducts = await base44.entities.Product.list('sort_order', 500);
      const check = reconcileItems(items, freshProducts);
      if (check.removed.length > 0) {
        const text = describeRemoved(check.removed, { t, tn });
        setNotice(prev => (prev ? `${prev}, ${text}` : text));
        applyItems(check.items);
        toast({ title: t('soldOutRemovedTitle'), description: `${text} — ${t('soldOutRecheck')}`, variant: 'destructive' });
        return;
      }

      const settings = await base44.entities.AppSettings.list('-created_date', 1);
      const orderItems = items.map(item => ({
        ...item,
        name: item.name_it || item.name,
        quantity: item.quantity || 1,
        price: item.price,
      }));
      const total = itemsTotal(orderItems);

      const { data: cashierOrder, error: rpcError } = await supabase.rpc('create_paid_order', {
        p_code: orderCode.code,
        p_items: orderItems,
        p_total: total,
        p_table_number: orderCode.table_number,
        p_customer_name: orderCode.customer_name || null,
        p_note: null,
        p_mode: 'code',
        p_festa_id: settings?.[0]?.active_festa_id || '',
      });
      if (rpcError) throw rpcError;

      await base44.entities.OrderCode.update(orderCode.id, {
        status: 'consumed',
        consumed_at: new Date().toISOString(),
      });

      setPaidOrder(cashierOrder);
      setPaidNotice(notice);
      setShowPrint(true);
      setOrderCode(null);
      setItems([]);
      setNotice('');
      setShowPicker(false);
      orderRef.current = null;
      setCode('');
      onOrderCompleted?.();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const total = itemsTotal(items);

  const handlePrintAndClose = (onDone) => {
    const cleanup = () => {
      window.removeEventListener('afterprint', cleanup);
      onDone();
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  const closePaid = () => { setShowPrint(false); setPaidOrder(null); setPaidNotice(''); };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            {t('lookupCode')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              placeholder={t('enterCode')}
              className="text-xl font-mono tracking-widest text-center h-12"
              maxLength={6}
            />
            <Button onClick={handleLookup} disabled={loading || !code.trim()} className="h-12 px-6">
              {t('findOrder')}
            </Button>
          </div>

          {error === 'notfound' && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4" />
              {t('codeNotFound')}
            </div>
          )}
          {error === 'expired' && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4" />
              {t('codeExpired')}
            </div>
          )}
          {error === 'used' && orderCode && (
            <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4" />
              {t('codeUsed')}
            </div>
          )}
        </CardContent>
      </Card>

      {orderCode && error !== 'used' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t('orderNumber')} {orderCode.code}</span>
              <span className="text-2xl text-orange-600">{formatPrice(total)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-4 text-sm">
              <span><strong>{t('tableNumber2')}:</strong> {orderCode.table_number}</span>
              {orderCode.customer_name && <span><strong>{t('customerName')}:</strong> {orderCode.customer_name}</span>}
              <span><strong>{t('mode')}:</strong> {t('modeCode')}</span>
            </div>

            {notice && (
              <div className="flex items-start gap-2 text-sm bg-red-50 border border-red-300 text-red-800 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold">{t('soldOutRemovedTitle')}</p>
                  <p>{notice}</p>
                </div>
                <button className="text-red-700 hover:text-red-900 px-1" onClick={() => setNotice('')} aria-label={t('close')}>✕</button>
              </div>
            )}

            <div className="border rounded-lg divide-y">
              {items.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">{t('orderEmpty')}</p>
              )}
              {items.map(item => (
                <div key={item.uid} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{tn(item.name_it, item.name_en) || item.name}</p>
                    {item.lactose_free && <p className="text-xs text-green-600 font-medium">🥛 {t('withoutLactoseLabel')}</p>}
                    {renderOptionsInline(item)}
                    {item.type === 'fixed_menu' && (item.menu_items || []).length > 0 && (
                      <div className="mt-0.5">
                        {item.menu_items.map((mi, i) => (
                          <p key={i} className="text-xs text-muted-foreground pl-2">• {tn(mi.name_it, mi.name_en)}{mi.quantity > 1 ? ` ×${mi.quantity}` : ''}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.type !== 'fixed_menu' ? (
                      <>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.uid, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-7 text-center font-bold">{item.quantity || 1}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.uid, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </>
                    ) : (
                      <span className="font-bold mr-1">{item.quantity || 1}x</span>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.uid)} title={t('removeItem')}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <span className="font-medium flex-shrink-0 w-16 text-right">{formatPrice((item.price || 0) * (item.quantity || 1))}</span>
                </div>
              ))}
            </div>

            <Button variant="outline" className="w-full" onClick={() => setShowPicker(v => !v)}>
              {showPicker ? <ChevronUp className="w-4 h-4 mr-2" /> : <PlusCircle className="w-4 h-4 mr-2" />}
              {showPicker ? t('hideProducts') : t('addProducts')}
            </Button>
            {showPicker && (
              <div className="border rounded-lg p-3 bg-slate-50">
                <ProductPicker
                  categories={categories}
                  products={products}
                  productOptions={productOptions}
                  viewMode="tabs"
                  cartItems={items}
                  onAdd={addProduct}
                />
              </div>
            )}

            <div className="flex justify-between font-bold text-lg border-t pt-3">
              <span>{t('total')}</span>
              <span>{formatPrice(total)}</span>
            </div>
            <Button size="lg" className="w-full bg-green-600 hover:bg-green-700" onClick={handleMarkPaid} disabled={loading || items.length === 0}>
              <CheckCircle className="w-5 h-5 mr-2" />
              {t('markPaid')}
            </Button>
          </CardContent>
        </Card>
      )}

      {showPrint && paidOrder && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              {t('orderCompleted')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{t('orderNumber')} <strong>{paidOrder.order_number}</strong> — {t('tableNumber2')} {paidOrder.table_number}</p>
            {paidNotice && (
              <div className="flex items-start gap-2 text-sm bg-red-50 border border-red-300 text-red-800 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">{t('soldOutRemovedTitle')}</p>
                  <p>{paidNotice}</p>
                </div>
              </div>
            )}
            <Button size="lg" className="w-full bg-slate-800 hover:bg-slate-900" onClick={() => handlePrintAndClose(closePaid)}>
              <Printer className="w-5 h-5 mr-2" />
              {t('print')}
            </Button>
            <ReceiptPrint order={paidOrder} festaName={festaName} productOptions={productOptions} />
            <ComandaPrint order={paidOrder} categories={categories} templates={comandaTemplates} singleMode={false} productOptions={productOptions} />
            <Button variant="ghost" className="w-full" onClick={closePaid}>{t('close')}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
