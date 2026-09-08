import React, { useState } from 'react';
import { base44, supabase } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, AlertCircle, CheckCircle, Printer } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { formatPrice } from '@/lib/codeGen';
import { useToast } from '@/components/ui/use-toast';
import ComandaPrint from '@/components/cassa/ComandaPrint';
import ReceiptPrint from '@/components/cassa/ReceiptPrint';

export default function CodeLookup({ categories, comandaTemplates, productOptions = [], onOrderCompleted }) {
  const { t, tn } = useLang();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [orderCode, setOrderCode] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [paidOrder, setPaidOrder] = useState(null);
  const [festaName, setFestaName] = useState('');

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

  React.useEffect(() => {
    base44.entities.AppSettings.list('-created_date', 1).then(s => {
      if (s && s[0]) setFestaName(s[0].festa_name || '');
    });
  }, []);

  const handleLookup = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setOrderCode(null);
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
      setOrderCode(oc);
    } catch (e) {
      setError('notfound');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!orderCode) return;
    setLoading(true);
    try {
      const settings = await base44.entities.AppSettings.list('-created_date', 1);
      const items = (orderCode.cart_data?.items || []).map(item => ({
        ...item,
        name: item.name_it || item.name,
        quantity: item.quantity || 1,
        price: item.price,
      }));

      const { data: cashierOrder, error } = await supabase.rpc('create_paid_order', {
        p_code: orderCode.code,
        p_items: items,
        p_total: orderCode.total,
        p_table_number: orderCode.table_number,
        p_customer_name: orderCode.customer_name || null,
        p_note: null,
        p_mode: 'code',
        p_festa_id: settings?.[0]?.active_festa_id || '',
      });
      if (error) throw error;

      await base44.entities.OrderCode.update(orderCode.id, {
        status: 'consumed',
        consumed_at: new Date().toISOString(),
      });

      setPaidOrder(cashierOrder);
      setShowPrint(true);
      setOrderCode(null);
      setCode('');
      onOrderCompleted?.();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const cartItems = orderCode?.cart_data?.items || [];

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
              <span className="text-2xl text-orange-600">{formatPrice(orderCode.total)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-4 text-sm">
              <span><strong>{t('tableNumber2')}:</strong> {orderCode.table_number}</span>
              {orderCode.customer_name && <span><strong>{t('customerName')}:</strong> {orderCode.customer_name}</span>}
              <span><strong>{t('mode')}:</strong> {t('modeCode')}</span>
            </div>
            <div className="border rounded-lg divide-y">
              {cartItems.map((item, i) => (
                <div key={i} className="flex justify-between items-start px-3 py-2 text-sm">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="font-bold w-8 flex-shrink-0">{item.quantity}x</span>
                    <div className="min-w-0">
                      <p>{item.name_it || item.name}</p>
                      {item.lactose_free && <p className="text-xs text-green-600 font-medium">🥛 {t('withoutLactoseLabel')}</p>}
                      {renderOptionsInline(item)}
                    </div>
                  </div>
                  <span className="font-medium flex-shrink-0 ml-2">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-3">
              <span>{t('total')}</span>
              <span>{formatPrice(orderCode.total)}</span>
            </div>
            <Button size="lg" className="w-full bg-green-600 hover:bg-green-700" onClick={handleMarkPaid} disabled={loading}>
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
            <ReceiptPrint order={paidOrder} festaName={festaName} productOptions={productOptions} />
            <ComandaPrint order={paidOrder} categories={categories} templates={comandaTemplates} singleMode={false} productOptions={productOptions} />
            <Button variant="outline" className="w-full" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              {t('print')}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => { setShowPrint(false); setPaidOrder(null); }}>{t('close')}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}