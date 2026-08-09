import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Printer, Clock, Euro } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { formatPrice, formatTime, formatDate } from '@/lib/codeGen';
import ComandaPrint from '@/components/cassa/ComandaPrint';

export default function OrderHistory({ categories, comandaTemplates, refreshKey, activeFestaId }) {
  const { t, tn } = useLang();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [reprintOrder, setReprintOrder] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.CashierOrder.list('-created_date', 500);
      const filtered = (all || []).filter(o => {
        const d = new Date(o.created_date);
        const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (dayKey !== selectedDate) return false;
        if (activeFestaId && o.festa_id !== activeFestaId) return false;
        return true;
      });
      setOrders(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [refreshKey, selectedDate, activeFestaId]);

  const filteredOrders = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);
  const totalRevenue = orders.filter(o => o.status === 'paid').reduce((s, o) => s + (o.total || 0), 0);
  const paidCount = orders.filter(o => o.status === 'paid').length;

  const exportCsv = () => {
    const rows = [['N.', 'Ora', 'Tavolo', 'Modalità', 'Stato', 'Totale', 'Articoli']];
    orders.forEach(o => {
      const itemsStr = (o.items || []).map(i => `${i.quantity}x ${i.name_it || i.name}`).join('; ');
      rows.push([
        o.order_number || '',
        formatTime(o.created_date),
        o.table_number || '',
        o.mode === 'code' ? t('modeCode') : t('modeManual'),
        o.status === 'paid' ? t('paid') : t('pending'),
        (o.total || 0).toFixed(2),
        itemsStr,
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cassa_${formatDate(new Date()).replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Euro className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('totalRevenue')}</p>
              <p className="text-xl font-bold">{formatPrice(totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('orderCount')}</p>
              <p className="text-xl font-bold">{paidCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-40" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all')}</SelectItem>
              <SelectItem value="paid">{t('paid')}</SelectItem>
              <SelectItem value="pending">{t('pending')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="w-4 h-4 mr-2" />
          {t('exportCsv')}
        </Button>
      </div>

      {filteredOrders.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">{t('noOrdersToday')}</p>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map(order => (
            <Card key={order.id}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">{t('orderNumber')}</p>
                      <p className="font-bold">{order.order_number}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{t('tableNumber2')}: {order.table_number}</span>
                        <span className="text-xs text-muted-foreground">{formatTime(order.created_date)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {order.mode === 'code' ? `📎 ${t('modeCode')}` : `✍️ ${t('modeManual')}`}
                        {order.code && ` · ${order.code}`}
                        {order.note && ` · ${order.note}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(order.items || []).map(i => `${i.quantity}x ${i.name_it || i.name}`).join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className="font-bold text-lg">{formatPrice(order.total)}</span>
                    <Button size="sm" variant="ghost" onClick={() => setReprintOrder(order)}>
                      <Printer className="w-3.5 h-3.5 mr-1" />
                      {t('reprint')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {reprintOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setReprintOrder(null)}>
          <div className="bg-white rounded-2xl p-4 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-3">{t('reprint')} — {t('orderNumber')} {reprintOrder.order_number}</h3>
            <ComandaPrint order={reprintOrder} categories={categories} templates={comandaTemplates} />
            <div className="flex gap-2 mt-3">
              <Button className="flex-1" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" />
                {t('print')}
              </Button>
              <Button variant="ghost" onClick={() => setReprintOrder(null)}>{t('close')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}