import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';

export default function AllergensManager({ allergens, reload }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [form, setForm] = useState({ name_it: '', name_en: '', icon: '⚠️' });

  const handleSave = async () => {
    if (!form.name_it || !form.name_en) return;
    try {
      await base44.entities.Allergen.create({ ...form, sort_order: allergens.length });
      setForm({ name_it: '', name_en: '', icon: '⚠️' });
      reload();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminare?')) return;
    await base44.entities.Allergen.delete(id);
    reload();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="font-semibold">{t('newAllergen')}</h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">{t('icon')}</Label>
              <Input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} className="text-center text-xl" />
            </div>
            <div>
              <Label className="text-xs">Nome (IT)</Label>
              <Input value={form.name_it} onChange={e => setForm({ ...form, name_it: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Nome (EN)</Label>
              <Input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} />
            </div>
          </div>
          <Button onClick={handleSave} className="w-full">{t('add')}</Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {allergens.map(a => (
          <div key={a.id} className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <span className="text-lg">{a.icon}</span>
            <span className="text-sm font-medium">{a.name_it}</span>
            <button onClick={() => handleDelete(a.id)} className="text-destructive hover:text-red-700">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}