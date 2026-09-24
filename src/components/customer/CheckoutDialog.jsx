import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, Share2, UserPlus } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { useLang } from '@/lib/i18n';
import { generateCode, formatPrice } from '@/lib/codeGen';
import { savePendingOrderCode } from '@/lib/pendingOrderCode';
import { base44, supabase } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function CheckoutDialog({ open, onClose, onClear, onCodeGenerated, settings, editingOrder = null, onOrderUpdated }) {
  const { items, total, tableNumber, customerName, setCustomerName, clearCart } = useCart();
  const { t, tn } = useLang();
  const { toast } = useToast();
  const [generatedCode, setGeneratedCode] = useState(null);
  const [shareCode, setShareCode] = useState(null);
  const [importCode, setImportCode] = useState('');
  const [importedOrders, setImportedOrders] = useState([]);
  const [isTableRef, setIsTableRef] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wasUpdate, setWasUpdate] = useState(false);

  const expiryHours = settings?.code_expiry_hours || 4;

  const handleGenerateCode = async () => {
    setLoading(true);
    try {
      let code = generateCode(6);
      const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000).toISOString();
      const importedItems = importedOrders.flatMap(o => (o.items || []).map(i => ({ ...i, _imported: o.name })));
      const allItems = [...items, ...importedItems];
      const allTotal = total + importedOrders.reduce((s, o) => s + o.total, 0);
      const cartData = { items: allItems, total: allTotal, customer_name: customerName };
      if (editingOrder) {
        // Modifica di un ordine già inviato: aggiorniamo lo stesso codice, ma
        // solo se la cassa non lo ha ancora pagato.
        const { data, error } = await supabase
          .from('order_codes')
          .update({
            cart_data: cartData,
            table_number: tableNumber,
            customer_name: customerName,
            total: allTotal,
            expires_at: expiresAt,
          })
          .eq('id', editingOrder.id)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          toast({ title: t('orderAlreadyPaidCantEdit'), variant: 'destructive' });
          onOrderUpdated?.({ alreadyPaid: true });
          onClose();
          return;
        }
        code = editingOrder.code;
        setWasUpdate(true);
      } else {
        await base44.entities.OrderCode.create({
          code,
          cart_data: cartData,
          table_number: tableNumber,
          customer_name: customerName,
          total: allTotal,
          status: 'pending',
          expires_at: expiresAt,
          purpose: 'cassa',
        });
      }
      setGeneratedCode(code);
      const pending = { code, table_number: tableNumber, total: allTotal, customer_name: customerName };
      savePendingOrderCode(pending);
      onCodeGenerated?.(pending);
      if (editingOrder) onOrderUpdated?.({ alreadyPaid: false });
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = (code) => {
    const text = `${t('yourCode')}: ${code}\n${t('tableNumber')}: ${tableNumber}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleBecomeTableRef = () => {
    setIsTableRef(true);
  };

  const handleGenerateShareCode = async () => {
    setLoading(true);
    try {
      const code = generateCode(6);
      const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000).toISOString();
      await base44.entities.OrderCode.create({
        code,
        cart_data: { items, total, customer_name: customerName },
        table_number: tableNumber,
        customer_name: customerName,
        total,
        status: 'pending',
        expires_at: expiresAt,
        purpose: 'table_share',
      });
      setShareCode(code);
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleImportOrder = async () => {
    if (!importCode.trim()) return;
    setLoading(true);
    try {
      const results = await base44.entities.OrderCode.filter({ code: importCode.trim().toUpperCase(), purpose: 'table_share', status: 'pending' });
      if (!results || results.length === 0) {
        toast({ title: t('codeNotFound'), variant: 'destructive' });
        return;
      }
      const orderCode = results[0];
      if (new Date(orderCode.expires_at) < new Date()) {
        toast({ title: t('codeExpired'), variant: 'destructive' });
        return;
      }
      setImportedOrders(prev => [...prev, {
        code: orderCode.code,
        name: orderCode.customer_name || 'Commensale',
        items: orderCode.cart_data?.items || [],
        total: orderCode.cart_data?.total || 0,
      }]);
      setImportCode('');
      toast({ title: t('importOrder') + ' ✓' });
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const mergedTotal = total + importedOrders.reduce((s, o) => s + o.total, 0);

  const handleClose = () => {
    if (generatedCode) {
      clearCart();
      setGeneratedCode(null);
      setShareCode(null);
      setIsTableRef(false);
      setImportedOrders([]);
      setWasUpdate(false);
      onClear?.();
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('checkout')}</DialogTitle>
        </DialogHeader>

        {!generatedCode ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cust-name">{t('customerName')}</Label>
              <Input id="cust-name" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder={t('customerNamePlaceholder')} />
            </div>

            {/* Table share section */}
            <div className="border rounded-lg p-3 space-y-3 bg-blue-50/50">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{t('tableShareTitle')}</p>
                {!isTableRef && (
                  <Button size="sm" variant="outline" onClick={handleBecomeTableRef}>
                    <UserPlus className="w-4 h-4 mr-1" />
                    {t('becomeTableRef')}
                  </Button>
                )}
              </div>

              {isTableRef && (
                <div className="space-y-3">
                  {/* Generate share code */}
                  {!shareCode ? (
                    <Button size="sm" variant="secondary" className="w-full" onClick={handleGenerateShareCode} disabled={loading || items.length === 0}>
                      <Share2 className="w-4 h-4 mr-1" />
                      {t('generateShareCode')}
                    </Button>
                  ) : (
                    <div className="text-center space-y-2 bg-white rounded-lg p-3 border">
                      <p className="text-xs text-muted-foreground">{t('enterShareCode')}:</p>
                      <p className="text-2xl font-bold tracking-widest text-blue-600">{shareCode}</p>
                      <Button size="sm" variant="ghost" onClick={() => handleCopy(shareCode)}>
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {t('copyCode')}
                      </Button>
                    </div>
                  )}

                  {/* Import code */}
                  <div className="flex gap-2">
                    <Input
                      value={importCode}
                      onChange={e => setImportCode(e.target.value.toUpperCase())}
                      placeholder={t('enterShareCode')}
                      className="uppercase tracking-widest font-mono"
                      maxLength={6}
                    />
                    <Button size="sm" onClick={handleImportOrder} disabled={loading || !importCode.trim()}>
                      {t('importOrder')}
                    </Button>
                  </div>

                  {/* Received orders */}
                  {importedOrders.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-muted-foreground uppercase">{t('receivedOrders')}</p>
                      {importedOrders.map((o, i) => (
                        <div key={i} className="flex items-center justify-between bg-white rounded px-2 py-1.5 text-sm border">
                          <span>{o.name}: {o.items.length} articoli — {formatPrice(o.total)}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setImportedOrders(prev => prev.filter((_, idx) => idx !== i))}>
                            ✕
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Total + generate code */}
            <div className="space-y-3">
              <div className="flex justify-between text-lg font-bold border-t pt-3">
                <span>{t('total')}</span>
                <span>{formatPrice(mergedTotal)}</span>
              </div>
              <Button size="lg" className="w-full bg-orange-600 hover:bg-orange-700" onClick={handleGenerateCode} disabled={loading}>
                {editingOrder ? t('updateOrderCode') : t('generateCode')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-6 py-4">
            <div>
              {wasUpdate && <p className="text-sm font-semibold text-green-700 mb-1">{t('orderUpdated')}</p>}
              <p className="text-sm text-muted-foreground mb-2">{t('codeInstructions')}</p>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl p-8">
                <p className="text-xs uppercase tracking-widest opacity-80 mb-2">{t('yourCode')}</p>
                <p className="text-5xl font-bold tracking-[0.3em] font-mono">{generatedCode}</p>
                <p className="text-sm mt-3 opacity-90">{t('tableNumber')}: <span className="font-bold">{tableNumber}</span></p>
                <p className="text-sm opacity-90">{formatPrice(mergedTotal)}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => handleCopy(generatedCode)}>
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {t('copyCode')}
              </Button>
              <Button variant="outline" onClick={() => handleShareWhatsApp(generatedCode)}>
                <Share2 className="w-4 h-4 mr-1" />
                WhatsApp
              </Button>
            </div>
            <Button className="w-full" onClick={handleClose}>{t('close')}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}