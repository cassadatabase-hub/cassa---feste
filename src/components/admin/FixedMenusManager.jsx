import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { formatPrice } from '@/lib/codeGen';

export default function FixedMenusManager({ fixedMenus, products, categories, reload }) {
  const { t, tn } = useLang();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);
  const emptyForm = { name_it: '', name_en: '', price: 15, first_course_ids: [], second_course_ids: [], included_item_names_it: ['Dolce', 'Acqua', 'Caffè'], included_item_names_en: ['Dessert', 'Water', 'Coffee'], extra_drink_ids: [], active: true };
  const [form, setForm] = useState(emptyForm);

  const handleSave = async () => {
    if (!form.name_it || !form.name_en) return;
    try {
      if (editing) {
        await base44.entities.FixedMenu.update(editing, form);
      } else {
        await base44.entities.FixedMenu.create(form);
      }
      setEditing(null);
      setForm(emptyForm);
      reload();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  const handleEdit = (m) => {
    setEditing(m.id);
    setForm({
      name_it: m.name_it, name_en: m.name_en, price: m.price,
      first_course_ids: m.first_course_ids || [], second_course_ids: m.second_course_ids || [],
      included_item_names_it: m.included_item_names_it || [], included_item_names_en: m.included_item_names_en || [],
      extra_drink_ids: m.extra_drink_ids || [], active: m.active !== false,
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminare?')) return;
    await base44.entities.FixedMenu.delete(id);
    reload();
  };

  const toggleId = (field, pid) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(pid) ? prev[field].filter(x => x !== pid) : [...prev[field], pid]
    }));
  };

  const firstCat = categories.find(c => c.name_it?.toLowerCase().includes('prim'));
  const secondCat = categories.find(c => c.name_it?.toLowerCase().includes('second'));
  const drinkCat = categories.find(c => c.is_drink);

  const firstProducts = firstCat ? products.filter(p => p.category_id === firstCat.id) : products;
  const secondProducts = secondCat ? products.filter(p => p.category_id === secondCat.id) : products;
  const drinkProducts = drinkCat ? products.filter(p => p.category_id === drinkCat.id) : products.filter(p => categories.find(c => c.id === p.category_id)?.is_drink);

  const renderProductSelector = (title, productsList, field) => (
    <div>
      <Label className="text-xs">{title}</Label>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {productsList.map(p => (
          <button
            key={p.id}
            onClick={() => toggleId(field, p.id)}
            className={`px-2 py-1 rounded-lg text-xs border ${form[field].includes(p.id) ? 'bg-orange-100 border-orange-400' : 'bg-white border-border'}`}
          >
            {p.name_it} · {formatPrice(p.price)}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="font-semibold">{editing ? t('edit') : t('newFixedMenu')}</h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Nome (IT)</Label>
              <Input value={form.name_it} onChange={e => setForm({ ...form, name_it: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Nome (EN)</Label>
              <Input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{t('price')} (€)</Label>
              <Input type="number" step="0.50" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} />
            </div>
          </div>
          {renderProductSelector(t('firstCourses'), firstProducts, 'first_course_ids')}
          {renderProductSelector(t('secondCourses'), secondProducts, 'second_course_ids')}
          {renderProductSelector(t('extraDrinks'), drinkProducts, 'extra_drink_ids')}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t('includedItems')} (IT, separati da virgola)</Label>
              <Input value={form.included_item_names_it.join(', ')} onChange={e => setForm({ ...form, included_item_names_it: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
            </div>
            <div>
              <Label className="text-xs">{t('includedItems')} (EN)</Label>
              <Input value={form.included_item_names_en.join(', ')} onChange={e => setForm({ ...form, included_item_names_en: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
            <Label className="text-sm">{form.active ? t('available') : 'Disattivo'}</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">{t('save')}</Button>
            {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm(emptyForm); }}>{t('cancel')}</Button>}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {fixedMenus.map(m => (
          <Card key={m.id}>
            <CardContent className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{m.name_it} / {m.name_en}</p>
                <p className="text-xs text-muted-foreground">{formatPrice(m.price)} · {(m.first_course_ids || []).length} primi · {(m.second_course_ids || []).length} secondi · {m.active === false ? '❌ Disattivo' : '✅ Attivo'}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(m)}>{t('edit')}</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(m.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}