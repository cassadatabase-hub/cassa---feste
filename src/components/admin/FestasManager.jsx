import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Plus, CheckCircle, Calendar, Trash2, HardDriveUpload } from 'lucide-react';
import { formatDate } from '@/lib/codeGen';
import { generateAndUploadFestaReport } from '@/lib/reportUtils';

export default function FestasManager({ settings, reload }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [feste, setFeste] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', notes: '' });
  const [archivingId, setArchivingId] = useState(null);

  const loadFeste = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.Festa.list('-created_date', 100);
      setFeste(all || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFeste(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      // Archive all currently active feste
      const activeFeste = feste.filter(f => f.status === 'active');
      await Promise.all(activeFeste.map(f =>
        base44.entities.Festa.update(f.id, { status: 'archived' })
      ));
      // Create the new festa as active
      const newFesta = await base44.entities.Festa.create({
        ...form,
        status: 'active',
      });
      // Set as active in settings
      if (settings?.id) {
        await base44.entities.AppSettings.update(settings.id, {
          active_festa_id: newFesta.id,
          festa_name: newFesta.name,
        });
      } else {
        await base44.entities.AppSettings.create({
          active_festa_id: newFesta.id,
          festa_name: newFesta.name,
          cassa_pin: '1234',
        });
      }
      toast({ title: t('festaCreated') });
      setForm({ name: '', start_date: '', end_date: '', notes: '' });
      setShowForm(false);
      loadFeste();
      reload?.();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  const handleActivate = async (festa) => {
    try {
      // Archive all currently active feste
      const activeFeste = feste.filter(f => f.status === 'active' && f.id !== festa.id);
      await Promise.all(activeFeste.map(f =>
        base44.entities.Festa.update(f.id, { status: 'archived' })
      ));
      // Set this one as active
      await base44.entities.Festa.update(festa.id, { status: 'active' });
      // Update settings
      if (settings?.id) {
        await base44.entities.AppSettings.update(settings.id, {
          active_festa_id: festa.id,
          festa_name: festa.name,
        });
      }
      toast({ title: t('festaActivated') });
      loadFeste();
      reload?.();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  const handleArchive = async (festa) => {
    setArchivingId(festa.id);
    try {
      // Auto-upload report to Google Drive before archiving
      let driveResult = null;
      try {
        const cats = await base44.entities.Category.list('sort_order', 100);
        driveResult = await generateAndUploadFestaReport(festa.id, festa.name, cats || [], t);
      } catch (e) {
        console.error('Drive upload error', e);
      }

      await base44.entities.Festa.update(festa.id, { status: 'archived' });
      if (settings?.active_festa_id === festa.id && settings?.id) {
        await base44.entities.AppSettings.update(settings.id, {
          active_festa_id: '',
          festa_name: '',
        });
      }

      if (driveResult?.success) {
        toast({ title: t('festaArchived'), description: t('savedToDrive') });
      } else if (driveResult?.error === 'no_orders') {
        toast({ title: t('festaArchived'), description: t('noPaidOrders') });
      } else {
        toast({ title: t('festaArchived') });
      }
      loadFeste();
      reload?.();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    } finally {
      setArchivingId(null);
    }
  };

  const handleDelete = async (festa) => {
    if (!confirm(`${t('delete')} "${festa.name}"?`)) return;
    try {
      await base44.entities.Festa.delete(festa.id);
      if (settings?.active_festa_id === festa.id && settings?.id) {
        await base44.entities.AppSettings.update(settings.id, { active_festa_id: '', festa_name: '' });
      }
      loadFeste();
      reload?.();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t('festeManagement')}</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" />
          {t('newFesta')}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3 max-w-md">
            <div>
              <Label>{t('festaName')}</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('festaNamePlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t('startDate')}</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <Label>{t('endDate')}</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t('notes')}</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">{t('festaNameHint')}</p>
            <div className="flex gap-2">
              <Button onClick={handleCreate} className="flex-1">{t('create')}</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {feste.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">{t('noFeste')}</p>
      ) : (
        <div className="space-y-2">
          {feste.map(festa => {
            const isActiveSelected = settings?.active_festa_id === festa.id;
            return (
              <Card key={festa.id} className={isActiveSelected ? 'border-green-500' : ''}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold">{festa.name}</span>
                        {isActiveSelected && <Badge className="bg-green-600">{t('activeFesta')}</Badge>}
                        {festa.status === 'archived' && !isActiveSelected && <Badge variant="secondary">{t('archivedFesta')}</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Calendar className="w-3 h-3" />
                        {festa.start_date ? formatDate(festa.start_date) : '—'}
                        {festa.end_date ? ` → ${formatDate(festa.end_date)}` : ''}
                      </div>
                      {festa.notes && <p className="text-xs text-muted-foreground mt-1">{festa.notes}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {!isActiveSelected && (
                        <Button size="sm" variant="outline" onClick={() => handleActivate(festa)}>
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          {t('activate')}
                        </Button>
                      )}
                      {isActiveSelected && (
                        <Button size="sm" variant="outline" onClick={() => handleArchive(festa)} disabled={archivingId === festa.id}>
                          {archivingId === festa.id ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                              {t('savingToDrive')}
                            </>
                          ) : (
                            <>
                              <HardDriveUpload className="w-3.5 h-3.5 mr-1" />
                              {t('archive')}
                            </>
                          )}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(festa)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}