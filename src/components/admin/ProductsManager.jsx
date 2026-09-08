import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { formatPrice } from '@/lib/codeGen';
import ProductImageUpload from '@/components/admin/ProductImageUpload';
import { Image } from '@/components/ui/image';

export default function ProductsManager({ products, categories, allergens, productOptions = [], reload }) {
  const { t, tn } = useLang();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);
  const emptyForm = {
    name_it: '', name_en: '', description_it: '', description_en: '', price: 0, category_id: '',
    allergens: [], available: true, lactose_free_option: false, sort_order: 0, image_url: '',
    option_ids: [], is_new: false, stock_enabled: false, stock_quantity: '',
  };
  const [form, setForm] = useState(emptyForm);

  const handleSave = async () => {
    if (!form.name_it || !form.name_en || !form.category_id) return;
    try {
      const payload = {
        ...form,
        stock_quantity: form.stock_enabled ? Math.max(0, parseInt(form.stock_quantity, 10) || 0) : null,
      };
      if (editing) {
        await base44.entities.Product.update(editing, payload);
      } else {
        await base44.entities.Product.create(payload);
      }
      toast({ title: t('save') + ' ✓' });
      setEditing(null);
      setForm(emptyForm);
      reload();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminare?')) return;
    try {
      await base44.entities.Product.delete(id);
      reload();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  const handleEdit = (p) => {
    setEditing(p.id);
    setForm({
      name_it: p.name_it, name_en: p.name_en,
      description_it: p.description_it || '', description_en: p.description_en || '',
      price: p.price, category_id: p.category_id,
      allergens: p.allergens || [], available: p.available !== false, lactose_free_option: p.lactose_free_option || false, sort_order: p.sort_order || 0,
      image_url: p.image_url || '',
      option_ids: p.option_ids || [], is_new: p.is_new || false,
      stock_enabled: p.stock_enabled || false, stock_quantity: p.stock_quantity ?? '',
    });
  };

  const toggleAllergen = (aid) => {
    setForm(prev => ({
      ...prev,
      allergens: prev.allergens.includes(aid)
        ? prev.allergens.filter(a => a !== aid)
        : [...prev.allergens, aid]
    }));
  };

  const toggleOption = (oid) => {
    setForm(prev => ({
      ...prev,
      option_ids: prev.option_ids.includes(oid)
        ? prev.option_ids.filter(o => o !== oid)
        : [...prev.option_ids, oid]
    }));
  };

  const moveOrder = async (p, delta) => {
    await base44.entities.Product.update(p.id, { sort_order: (p.sort_order || 0) + delta });
    reload();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="font-semibold">{editing ? t('edit') : t('newProduct')}</h3>
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Descrizione (IT)</Label>
              <Input value={form.description_it} onChange={e => setForm({ ...form, description_it: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Descrizione (EN)</Label>
              <Input value={form.description_en} onChange={e => setForm({ ...form, description_en: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">{t('price')} (€)</Label>
              <Input type="number" step="0.50" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">{t('categories')}</Label>
              <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name_it}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('sortOrder')}</Label>
              <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </div>
          </div>
          {allergens.length > 0 && (
            <div>
              <Label className="text-xs">{t('allergens')}</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {allergens.map(a => (
                  <button
                    key={a.id}
                    onClick={() => toggleAllergen(a.id)}
                    className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 border ${form.allergens.includes(a.id) ? 'bg-amber-100 border-amber-400' : 'bg-white border-border'}`}
                  >
                    {a.icon} {tn(a.name_it, a.name_en)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {productOptions.length > 0 && (
            <div>
              <Label className="text-xs">{t('productOptions')}</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {productOptions.map(o => (
                  <button
                    key={o.id}
                    onClick={() => toggleOption(o.id)}
                    className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 border ${form.option_ids.includes(o.id) ? 'bg-violet-100 border-violet-400' : 'bg-white border-border'}`}
                  >
                    {o.icon} {tn(o.name_it, o.name_en)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <ProductImageUpload value={form.image_url || ''} onChange={url => setForm({ ...form, image_url: url })} />
          <div className="flex items-center gap-2">
            <Switch checked={form.available} onCheckedChange={v => setForm({ ...form, available: v })} />
            <Label className="text-sm">{form.available ? t('available') : t('soldOut')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.lactose_free_option} onCheckedChange={v => setForm({ ...form, lactose_free_option: v })} />
            <Label className="text-sm">{t('lactoseFreeOption')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_new} onCheckedChange={v => setForm({ ...form, is_new: v })} />
            <Label className="text-sm">✨ {t('isNewLabel')}</Label>
          </div>
          <div className="border rounded-lg p-3 space-y-2 bg-slate-50">
            <div className="flex items-center gap-2">
              <Switch checked={form.stock_enabled} onCheckedChange={v => setForm({ ...form, stock_enabled: v })} />
              <Label className="text-sm">{t('stockTrackingLabel')}</Label>
            </div>
            {form.stock_enabled && (
              <div>
                <Label className="text-xs">{t('stockQuantityLabel')}</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.stock_quantity}
                  onChange={e => setForm({ ...form, stock_quantity: e.target.value })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">{t('stockQuantityHint')}</p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">{t('save')}</Button>
            {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm(emptyForm); }}>{t('cancel')}</Button>}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {products.map(p => {
          const cat = categories.find(c => c.id === p.category_id);
          return (
            <Card key={p.id}>
              <CardContent className="py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {p.image_url ? (
                    <Image src={p.image_url} fittingType="fill" className="w-10 h-10 rounded-lg flex-shrink-0" alt="" />
                  ) : (
                    <span className="text-lg flex-shrink-0">{cat?.icon}</span>
                  )}
                  <div className="min-w-0">
                    <p className={`font-medium text-sm truncate flex items-center gap-1.5 ${p.available === false ? 'line-through text-muted-foreground' : ''}`}>
                      {p.name_it}
                      {p.is_new && <span className="text-[10px] font-bold bg-violet-600 text-white rounded px-1.5 py-0.5 flex-shrink-0">✨ {t('isNewLabel')}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cat?.name_it} · {formatPrice(p.price)}
                      {p.stock_enabled && (
                        <span className={p.stock_quantity > 0 ? 'text-blue-600 font-medium' : 'text-red-600 font-medium'}> · {t('stockRemainingLabel')}: {p.stock_quantity ?? 0}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveOrder(p, -1)}><ArrowUp className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveOrder(p, 1)}><ArrowDown className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(p)}>{t('edit')}</Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}