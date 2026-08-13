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
import { cn } from '@/lib/utils';

export default function ManualOrder({ categories, products, comandaTemplates }) {
  const { t, tn } = useLang();
  const { toast } = useToast();
  const [activeCat, setActiveCat] = useState(null);
  const [cart, setCart] = useState([]);
  const [tableNumber, setTableNumber] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [festaName, setFestaName] = useState('');
  const [lactoseProduct, setLactoseProduct] = useState(null);

  React.useEffect(() => {
    base44.entities.AppSettings.list('-created_date', 1).then(s => {
      if (s && s[0]) setFestaName(s[0].festa_name || '');
    });
  }, []);

  React.useEffect(() => {
    if (categories.length > 0 && !activeCat) setActiveCat(categories[0].id);
  }, [categories, activeCat]);

  const addToCart = (product, lactoseFree = false) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id && i.lactose_free === lactoseFree);
      if (existing) {
        return prev.map(i => i.product_id === product.id && i.lactose_free === lactoseFree ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        product_id: product.id,
        name_it: product.name_it,
        name_en: product.name_en,
        price: product.price,
        category_id: product.category_id,
        lactose_free: lactoseFree,
        uid: Date.now() + Math.random(),
        quantity: 1,
      }];
    });
  };

  const handleLactoseChoice = (lactoseFree) => {
    if (!lactoseProduct) return;
    addToCart(lactoseProduct, lactoseFree);
    setLactoseProduct(null);
  };

  const updateQty = (uid, delta) => {
    setCart(prev => prev
      .map(i => i.uid === uid ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
      .filter(i => i.quantity > 0)
    );
  };

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const handleConfirm = async () => {
    if (!tableNumber.trim()) {
      toast({ title: t('tableNumberRequired'), variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
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

  const filteredProducts = products.filter(p =>
    p.category_id === activeCat &&
    p.available !== false &&
    !(p.stock_enabled && (p.stock_quantity ?? 0) <= 0)
  );

  return (
    <>
    <div className="grid lg:grid-cols-[1fr_380px] gap-4">
      {/* Product grid */}
      <div className="space-y-3">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filteredProducts.map(product => {
            const cartItems = cart.filter(i => i.product_id === product.id);
            const totalQty = cartItems.reduce((s, i) => s + i.quantity, 0);
            return (
              <button
                key={product.id}
                onClick={() => product.lactose_free_option ? setLactoseProduct(product) : addToCart(product)}
                className={cn(
                  "text-left p-3 rounded-lg border-2 transition relative",
                  totalQty > 0 ? "border-orange-500 bg-orange-50" : "border-border bg-white hover:border-slate-400"
                )}
              >
                <p className="text-sm font-medium leading-tight">{tn(product.name_it, product.name_en)}</p>
                <p className="text-sm font-bold text-orange-600 mt-1">{formatPrice(product.price)}</p>
                {totalQty > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-orange-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {totalQty}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

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
            <ReceiptPrint order={completedOrder} festaName={festaName} />
            <ComandaPrint order={completedOrder} categories={categories} templates={comandaTemplates} />
            <Button variant="outline" className="w-full" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              {t('print')}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setCompletedOrder(null)}>{t('close')}</Button>
          </CardContent>
        </Card>
      )}

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
    </>
  );
}