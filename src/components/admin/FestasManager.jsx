import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Plus, CheckCircle, Calendar, Trash2, HardDriveUpload, Pencil, SlidersHorizontal, Check } from 'lucide-react';
import { formatDate } from '@/lib/codeGen';
import { generateAndUploadFestaReport } from '@/lib/reportUtils';
import { THEME_PRESETS, DEFAULT_THEME_COLOR, isValidHex } from '@/lib/theme';

const emptyForm = () => ({ name: '', start_date: '', end_date: '', notes: '', theme_color: DEFAULT_THEME_COLOR, next_order_number: 1 });

function ColorPicker({ value, onChange }) {
  const { t } = useLang();
  const isPreset = THEME_PRESETS.some(p => p.color.toLowerCase() === (value || '').toLowerCase());
  return (
    <div>
      <Label>{t('themeColor')}</Label>
      <div className="flex flex-wrap items-center gap-2 mt-1.5">
        {THEME_PRESETS.map(p => {
          const selected = p.color.toLowerCase() === (value || '').toLowerCase();
          return (
            <button
              key={p.color}
              type="button"
              title={p.name}
              aria-label={p.name}
              onClick={() => onChange(p.color)}
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${selected ? 'border-slate-900' : 'border-white shadow-sm ring-1 ring-slate-200'}`}
              style={{ backgroundColor: p.color }}
            >
              {selected && <Check className="w-4 h-4 text-white" />}
            </button>
          );
        })}
        <label
          className={`flex items-center gap-1.5 text-xs rounded-full border px-2 h-8 cursor-pointer ${!isPreset ? 'border-slate-900' : ''}`}
        >
          <input
            type="color"
            value={isValidHex(value) ? value : DEFAULT_THEME_COLOR}
            onChange={e => onChange(e.target.value)}
            className="w-5 h-5 p-0 border-0 bg-transparent cursor-pointer"
          />
          {t('customColor')}
        </label>
      </div>
    </div>
  );
}

// Tabelle con dati legati alla festa
const FESTA_TABLES = ['categories', 'products', 'fixed_menus', 'comanda_templates'];

export default function FestasManager({ settings, feste, managedFestaId, onManage, reload }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [archivingId, setArchivingId] = useState(null);

  const liveId = settings?.active_festa_id || '';

  const setLive = async (festa) => {
    // Un solo "sipario" alzato: la festa attiva vista da clienti e cassa
    await base44.entities.Festa.update(festa.id, { status: 'active' });
    if (settings?.id) {
      await base44.entities.AppSettings.update(settings.id, { active_festa_id: festa.id, festa_name: festa.name });
    } else {
      await base44.entities.AppSettings.create({ active_festa_id: festa.id, festa_name: festa.name, cassa_pin: '1234' });
    }
  };

  // Prima festa in assoluto: i dati già presenti (senza festa) diventano suoi
  const adoptOrphans = async (festaId) => {
    try {
      for (const table of FESTA_TABLES) {
        await base44.supabase.from(table).update({ festa_id: festaId }).is('festa_id', null);
      }
    } catch (e) {
      console.error('adoptOrphans', e);
    }
  };

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    try {
      const payload = { ...form, name: form.name.trim(), next_order_number: Math.max(1, parseInt(form.next_order_number, 10) || 1) };
      if (editingId) {
        await base44.entities.Festa.update(editingId, payload);
        if (editingId === liveId && settings?.id) {
          await base44.entities.AppSettings.update(settings.id, { festa_name: payload.name });
        }
        toast({ title: t('festaSaved') });
      } else {
        const isFirst = feste.length === 0;
        const created = await base44.entities.Festa.create({ ...payload, status: 'active' });
        if (isFirst) await adoptOrphans(created.id);
        // La prima festa (o se nessuna è in vendita) va subito in vendita;
        // le altre si preparano con calma e si mettono in vendita dopo.
        if (isFirst || !liveId) {
          await setLive(created);
          toast({ title: t('festaCreated') });
        } else {
          toast({ title: t('festaSaved') });
        }
        onManage?.(created.id);
      }
      resetForm();
      reload?.();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  const handleEdit = (festa) => {
    setEditingId(festa.id);
    setForm({
      name: festa.name || '',
      start_date: festa.start_date || '',
      end_date: festa.end_date || '',
      notes: festa.notes || '',
      theme_color: isValidHex(festa.theme_color) ? festa.theme_color : DEFAULT_THEME_COLOR,
      next_order_number: festa.next_order_number || 1,
    });
    setShowForm(true);
  };

  const handleActivate = async (festa) => {
    try {
      await setLive(festa);
      toast({ title: t('festaLiveToast').replace('{name}', festa.name) });
      reload?.();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  const handleArchive = async (festa) => {
    setArchivingId(festa.id);
    try {
      // Report su Google Drive prima di archiviare
      let driveResult = null;
      try {
        const cats = await base44.entities.Category.list('sort_order', 200);
        driveResult = await generateAndUploadFestaReport(festa.id, festa.name, cats || [], t);
      } catch (e) {
        console.error('Drive upload error', e);
      }

      await base44.entities.Festa.update(festa.id, { status: 'archived' });
      if (settings?.active_festa_id === festa.id && settings?.id) {
        await base44.entities.AppSettings.update(settings.id, { active_festa_id: '', festa_name: '' });
      }

      if (driveResult?.success) {
        toast({ title: t('festaArchived'), description: t('savedToDrive') });
      } else if (driveResult?.error === 'no_orders') {
        toast({ title: t('festaArchived'), description: t('noPaidOrders') });
      } else {
        toast({ title: t('festaArchived') });
      }
      reload?.();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    } finally {
      setArchivingId(null);
    }
  };

  const handleDelete = async (festa) => {
    if (!confirm(`${t('delete')} "${festa.name}"?\n\nVerranno eliminati anche i suoi reparti, prodotti e menu. Gli ordini già registrati restano nei report.`)) return;
    try {
      for (const entity of ['FixedMenu', 'Product', 'Category', 'ComandaTemplate']) {
        await base44.entities[entity].deleteMany({ festa_id: festa.id });
      }
      await base44.entities.Festa.delete(festa.id);
      if (settings?.active_festa_id === festa.id && settings?.id) {
        await base44.entities.AppSettings.update(settings.id, { active_festa_id: '', festa_name: '' });
      }
      reload?.();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t('festeManagement')}</h2>
        <Button onClick={() => { if (showForm) resetForm(); else { setForm(emptyForm()); setEditingId(null); setShowForm(true); } }}>
          <Plus className="w-4 h-4 mr-1" />
          {t('newFesta')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t('festaHowItWorks')}</p>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3 max-w-md">
            <h3 className="font-semibold">{editingId ? t('editFesta') : t('newFesta')}</h3>
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
            <div>
              <Label>{t('nextOrderNumber')}</Label>
              <Input type="number" min="1" value={form.next_order_number} onChange={e => setForm({ ...form, next_order_number: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">{t('nextOrderNumberHint')}</p>
            </div>
            <ColorPicker value={form.theme_color} onChange={c => setForm({ ...form, theme_color: c })} />
            <div className="flex gap-2">
              <Button onClick={handleSubmit} className="flex-1">{editingId ? t('save') : t('create')}</Button>
              <Button variant="outline" onClick={resetForm}>{t('cancel')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {feste.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">{t('noFeste')}</p>
      ) : (
        <div className="space-y-2">
          {feste.map(festa => {
            const isLive = liveId === festa.id;
            const isManaged = managedFestaId === festa.id;
            return (
              <Card key={festa.id} className={isLive ? 'border-green-500' : isManaged ? 'border-slate-400' : ''}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="w-4 h-4 rounded-full flex-shrink-0 ring-1 ring-slate-200"
                          style={{ backgroundColor: isValidHex(festa.theme_color) ? festa.theme_color : DEFAULT_THEME_COLOR }}
                        />
                        <span className="font-bold">{festa.name}</span>
                        {isLive && <Badge className="bg-green-600">{t('liveFesta')}</Badge>}
                        {isManaged && <Badge variant="outline">{t('managing')}</Badge>}
                        {festa.status === 'archived' && !isLive && <Badge variant="secondary">{t('archivedFesta')}</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Calendar className="w-3 h-3" />
                        {festa.start_date ? formatDate(festa.start_date) : '—'}
                        {festa.end_date ? ` → ${formatDate(festa.end_date)}` : ''}
                      </div>
                      {festa.notes && <p className="text-xs text-muted-foreground mt-1">{festa.notes}</p>}
                    </div>
                    <div className="flex gap-1 flex-wrap shrink-0">
                      {!isManaged && (
                        <Button size="sm" variant="outline" onClick={() => onManage?.(festa.id)}>
                          <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
                          {t('manage')}
                        </Button>
                      )}
                      {!isLive && (
                        <Button size="sm" variant="outline" onClick={() => handleActivate(festa)}>
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          {t('setLive')}
                        </Button>
                      )}
                      {isLive && (
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
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(festa)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
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
