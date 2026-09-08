import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';

export default function CategoriesManager({ categories, reload }) {
  const { t, tn } = useLang();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name_it: '', name_en: '', icon: '🍽️', sort_order: 0, is_drink: false });

  const handleSave = async () => {
    if (!form.name_it || !form.name_en) return;
    try {
      if (editing) {
        await base44.entities.Category.update(editing, form);
      } else {
        await base44.entities.Category.create(form);
      }
      toast({ title: t('save') + ' ✓' });
      setEditing(null);
      setForm({ name_it: '', name_en: '', icon: '🍽️', sort_order: 0, is_drink: false });
      reload();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminare?')) return;
    try {
      await base44.entities.Category.delete(id);
      reload();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  const handleEdit = (cat) => {
    setEditing(cat.id);
    setForm({ name_it: cat.name_it, name_en: cat.name_en, icon: cat.icon || '🍽️', sort_order: cat.sort_order || 0, is_drink: cat.is_drink || false });
  };

  const moveOrder = async (cat, delta) => {
    await base44.entities.Category.update(cat.id, { sort_order: (cat.sort_order || 0) + delta });
    reload();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="font-semibold">{editing ? t('edit') : t('newCategory')}</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nome (IT)</Label>
              <Input value={form.name_it} onChange={e => setForm({ ...form, name_it: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Nome (EN)</Label>
              <Input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">{t('icon')}</Label>
              <Input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} className="text-center text-xl" />
            </div>
            <div>
              <Label className="text-xs">{t('sortOrder')}</Label>
              <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Switch checked={form.is_drink} onCheckedChange={v => setForm({ ...form, is_drink: v })} />
              <Label className="text-xs">{t('isDrink')}</Label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">{t('save')}</Button>
            {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm({ name_it: '', name_en: '', icon: '🍽️', sort_order: 0, is_drink: false }); }}>{t('cancel')}</Button>}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {categories.map(cat => (
          <Card key={cat.id}>
            <CardContent className="py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{cat.icon}</span>
                <div>
                  <p className="font-medium text-sm">{cat.name_it} / {cat.name_en}</p>
                  {cat.is_drink && <span className="text-xs text-blue-600">🍻 {t('isDrink')}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveOrder(cat, -1)}><ArrowUp className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveOrder(cat, 1)}><ArrowDown className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" onClick={() => handleEdit(cat)}>{t('edit')}</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(cat.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}