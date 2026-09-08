import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, HardDriveUpload, ChevronDown, ChevronRight, Euro, Receipt, CalendarDays, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLang } from '@/lib/i18n';
import { formatPrice, formatDate } from '@/lib/codeGen';
import { useToast } from '@/components/ui/use-toast';
import { computeReport, buildWorkbook, arrayBufferToBase64 } from '@/lib/reportUtils';

export default function DailyReport({ categories, settings, reload }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingDrive, setExportingDrive] = useState(false);
  const [expandedDay, setExpandedDay] = useState(null);
  const [driveResult, setDriveResult] = useState(null);
  const [feste, setFeste] = useState([]);
  const [selectedFestaId, setSelectedFestaId] = useState(settings?.active_festa_id || 'all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    base44.entities.Festa.list('-created_date', 100).then(f => setFeste(f || []));
  }, []);

  useEffect(() => {
    if (settings?.active_festa_id && selectedFestaId === 'all') {
      setSelectedFestaId(settings.active_festa_id);
    }
  }, [settings]);

  useEffect(() => {
    loadOrders();
  }, [selectedFestaId]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.CashierOrder.list('-created_date', 500);
      let filtered = (all || []).filter(o => o.status === 'paid');
      if (selectedFestaId && selectedFestaId !== 'all') {
        filtered = filtered.filter(o => o.festa_id === selectedFestaId);
      }
      setOrders(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const report = useMemo(() => computeReport(orders, categories), [orders, categories]);

  const getFileName = () => {
    const date = formatDate(new Date()).replace(/\//g, '-');
    const selectedFesta = feste.find(f => f.id === selectedFestaId);
    const festa = (selectedFesta?.name || settings?.festa_name || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `Report_${festa}_${date}.xlsx`;
  };

  const deleteAllOrders = async () => {
    setDeleting(true);
    try {
      if (selectedFestaId && selectedFestaId !== 'all') {
        await base44.entities.CashierOrder.deleteMany({ status: 'paid', festa_id: selectedFestaId });
      } else {
        await base44.entities.CashierOrder.deleteMany({ status: 'paid' });
      }
      if (settings?.id) {
        await base44.entities.AppSettings.update(settings.id, { next_order_number: 1 });
      }
      setShowDeleteConfirm(false);
      await loadOrders();
      reload?.();
      toast({ title: t('ordersDeleted') });
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const exportExcel = () => {
    const wb = buildWorkbook(report, t);
    XLSX.writeFile(wb, getFileName());
  };

  const exportToDrive = async () => {
    setExportingDrive(true);
    setDriveResult(null);
    try {
      const wb = buildWorkbook(report, t);
      const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const fileBase64 = arrayBufferToBase64(arrayBuffer);
      const res = await base44.functions.invoke('uploadToGoogleDrive', {
        fileBase64,
        fileName: getFileName(),
        folderName: feste.find(f => f.id === selectedFestaId)?.name || settings?.festa_name || '',
      });
      setDriveResult(res.data);
      toast({ title: t('savedToDrive') });
    } catch (e) {
      toast({ title: t('driveError'), description: e.message, variant: 'destructive' });
    } finally {
      setExportingDrive(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  if (orders.length === 0) {
    return <p className="text-center text-muted-foreground py-8">{t('noPaidOrders')}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <Euro className="w-5 h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t('grandTotal')}</p>
              <p className="text-lg font-bold">{formatPrice(report.grandTotal)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t('totalOrders')}</p>
              <p className="text-lg font-bold">{report.totalOrders}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t('days')}</p>
              <p className="text-lg font-bold">{report.days.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">{t('selectFesta')}</p>
          <Select value={selectedFestaId} onValueChange={setSelectedFestaId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allFeste')}</SelectItem>
              {feste.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportExcel}>
          <Download className="w-4 h-4 mr-2" />
          {t('exportExcel')}
        </Button>
        <Button onClick={exportToDrive} disabled={exportingDrive}>
          <HardDriveUpload className="w-4 h-4 mr-2" />
          {exportingDrive ? t('savingToDrive') : t('exportToDrive')}
        </Button>
      </div>

      <div className="pt-2 border-t">
        <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)} disabled={deleting}>
          <Trash2 className="w-4 h-4 mr-2" />
          {t('deleteAllOrders')}
        </Button>
        <p className="text-xs text-muted-foreground mt-1">{t('deleteAllOrdersHint')}</p>
      </div>

      {driveResult?.success && (
        <Card className="bg-green-50 border-green-300">
          <CardContent className="py-3 text-sm">
            <p className="font-medium text-green-700">✓ {t('savedToDrive')}</p>
            <a href={driveResult.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs break-all">
              {driveResult.fileUrl}
            </a>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {report.days.map(day => {
          const dayData = report.byDay[day];
          const isExpanded = expandedDay === day;
          return (
            <Card key={day}>
              <CardContent className="py-3">
                <button
                  className="flex items-center justify-between w-full text-left"
                  onClick={() => setExpandedDay(isExpanded ? null : day)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <span className="font-bold">{day}</span>
                    <span className="text-sm text-muted-foreground">· {dayData.orders.length} {t('orders')}</span>
                  </div>
                  <span className="font-bold text-green-600">{formatPrice(dayData.total)}</span>
                </button>

                {isExpanded && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{t('perCategory')}</p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-muted-foreground">
                            <th className="py-1">{t('category')}</th>
                            <th className="py-1 text-right">{t('quantity')}</th>
                            <th className="py-1 text-right">{t('revenue')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(dayData.categories).sort((a, b) => b[1].revenue - a[1].revenue).map(([name, c]) => (
                            <tr key={name} className="border-b">
                              <td className="py-1">{name}</td>
                              <td className="py-1 text-right">{c.quantity}</td>
                              <td className="py-1 text-right font-medium">{formatPrice(c.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{t('perProduct')}</p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-muted-foreground">
                            <th className="py-1">{t('product')}</th>
                            <th className="py-1 text-right">{t('quantity')}</th>
                            <th className="py-1 text-right">{t('revenue')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(dayData.products).sort((a, b) => b[1].revenue - a[1].revenue).map(([name, p]) => (
                            <tr key={name} className="border-b">
                              <td className="py-1">{name}</td>
                              <td className="py-1 text-right">{p.quantity}</td>
                              <td className="py-1 text-right font-medium">{formatPrice(p.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-destructive mb-2">{t('deleteAllOrders')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('deleteAllOrdersConfirm')}</p>
            <div className="flex gap-2">
              <Button variant="destructive" className="flex-1" onClick={deleteAllOrders} disabled={deleting}>
                {deleting ? '...' : t('confirmDelete')}
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>{t('cancel')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}