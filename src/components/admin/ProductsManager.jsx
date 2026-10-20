import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Trash2, ArrowUp, ArrowDown, Folder, FolderOpen, ChevronRight, Plus, Pencil, Search } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { formatPrice } from '@/lib/codeGen';
import ProductImageUpload from '@/components/admin/ProductImageUpload';
import CatalogBackup from '@/components/admin/CatalogBackup';
import { Image } from '@/components/ui/image';

const emptyProductForm = (category_id = '') => ({
  name_it: '', name_en: '', description_it: '', description_en: '', price: 0, category_id,
  allergens: [], available: true, lactose_free_option: false, image_url: '',
  option_ids: [], is_new: false, stock_enabled: false, stock_quantity: '', separate_print: false,
});

const emptyCategoryForm = () => ({ name_it: '', name_en: '', icon: '🍽️', is_drink: false });

const bySort = (a, b) => (a.sort_order || 0) - (b.sort_order || 0);
const maxSort = (list) => list.reduce((m, x) => Math.max(m, x.sort_order || 0), 0);

// Admin prodotti: i reparti sono "cartelle" da aprire per vedere i prodotti.
export default function ProductsManager({
  festa, products, categories, allergens, productOptions = [], fixedMenus = [], reload,
}) {
  const { t, tn } = useLang();
  const { toast } = useToast();
  const [openIds, setOpenIds] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [productDialog, setProductDialog] = useState(null); // { id, form }
  const [categoryDialog, setCategoryDialog] = useState(null); // { id, form }
  const [saving, setSaving] = useState(false);

  const festaId = festa?.id || null;
  const sortedCategories = useMemo(() => [...categories].sort(bySort), [categories]);
  const productsByCategory = useMemo(() => {
    const map = new Map();
    for (const p of [...products].sort(bySort)) {
      const key = p.category_id || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return map;
  }, [products]);

  const q = query.trim().toLowerCase();
  const matches = (p) => !q || (p.name_it || '').toLowerCase().includes(q) || (p.name_en || '').toLowerCase().includes(q);

  const orphanProducts = useMemo(
    () => products.filter(p => !categories.some(c => c.id === p.category_id)).sort(bySort),
    [products, categories]
  );

  const toggleFolder = (id) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const run = async (fn) => {
    try {
      await fn();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  // ---- ordine (scambia con il vicino e rinumera la lista) ----
  const reorder = (list, index, delta, entity) => run(async () => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    await Promise.all(
      next.map((item, i) => (item.sort_order !== i * 10 ? entity.update(item.id, { sort_order: i * 10 }) : null)).filter(Boolean)
    );
    reload();
  });

  // ---- reparti ----
  const openCategoryDialog = (cat) => {
    setCategoryDialog(cat
      ? { id: cat.id, form: { name_it: cat.name_it, name_en: cat.name_en, icon: cat.icon || '🍽️', is_drink: !!cat.is_drink } }
      : { id: null, form: emptyCategoryForm() });
  };

  const saveCategory = () => run(async () => {
    const { id, form } = categoryDialog;
    if (!form.name_it.trim() || !form.name_en.trim()) {
      toast({ title: 'Compila il nome in italiano e in inglese', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (id) {
        await base44.entities.Category.update(id, form);
      } else {
        const created = await base44.entities.Category.create({ ...form, sort_order: maxSort(categories) + 10, festa_id: festaId });
        if (created?.id) setOpenIds(prev => new Set(prev).add(created.id));
      }
      toast({ title: t('save') + ' ✓' });
      setCategoryDialog(null);
      reload();
    } finally {
      setSaving(false);
    }
  });

  const deleteCategory = (cat) => run(async () => {
    const count = (productsByCategory.get(cat.id) || []).length;
    if (!confirm(t('deleteDepartmentConfirm').replace('{name}', cat.name_it).replace('{n}', count))) return;
    if (count > 0) await base44.entities.Product.deleteMany({ category_id: cat.id });
    await base44.entities.Category.delete(cat.id);
    reload();
  });

  // ---- prodotti ----
  const openProductDialog = (categoryId, product) => {
    if (product) {
      setProductDialog({
        id: product.id,
        sort_order: product.sort_order || 0,
        form: {
          name_it: product.name_it, name_en: product.name_en,
          description_it: product.description_it || '', description_en: product.description_en || '',
          price: product.price, category_id: product.category_id || '',
          allergens: product.allergens || [], available: product.available !== false,
          lactose_free_option: product.lactose_free_option || false,
          image_url: product.image_url || '',
          option_ids: product.option_ids || [], is_new: product.is_new || false,
          separate_print: product.separate_print || false,
          stock_enabled: product.stock_enabled || false, stock_quantity: product.stock_quantity ?? '',
        },
      });
    } else {
      setProductDialog({ id: null, form: emptyProductForm(categoryId) });
    }
  };

  const setForm = (patch) => setProductDialog(prev => ({ ...prev, form: { ...prev.form, ...patch } }));

  const toggleIn = (key, value) => {
    const list = productDialog.form[key];
    setForm({ [key]: list.includes(value) ? list.filter(v => v !== value) : [...list, value] });
  };

  const saveProduct = () => run(async () => {
    const { id, form } = productDialog;
    if (!form.name_it.trim() || !form.name_en.trim() || !form.category_id) {
      toast({ title: 'Compila nome (IT e EN) e reparto', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        stock_quantity: form.stock_enabled ? Math.max(0, parseInt(form.stock_quantity, 10) || 0) : null,
      };
      if (id) {
        await base44.entities.Product.update(id, payload);
      } else {
        const inFolder = productsByCategory.get(form.category_id) || [];
        await base44.entities.Product.create({ ...payload, sort_order: maxSort(inFolder) + 10, festa_id: festaId });
      }
      toast({ title: t('save') + ' ✓' });
      setOpenIds(prev => new Set(prev).add(form.category_id));
      setProductDialog(null);
      reload();
    } finally {
      setSaving(false);
    }
  });

  const deleteProduct = (id) => run(async () => {
    if (!confirm('Eliminare?')) return;
    await base44.entities.Product.delete(id);
    reload();
  });

  if (!festa) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">{t('createFestaFirst')}</CardContent>
      </Card>
    );
  }

  const renderProductRow = (p, list, index) => {
    const cat = categories.find(c => c.id === p.category_id);
    return (
      <div key={p.id} className="flex items-center justify-between gap-2 py-2 px-3 border-t first:border-t-0">
        <div className="flex items-center gap-2 min-w-0">
          {p.image_url ? (
            <Image src={p.image_url} fittingType="fill" className="w-10 h-10 rounded-lg flex-shrink-0" alt="" />
          ) : (
            <span className="text-lg flex-shrink-0 w-10 text-center">{cat?.icon}</span>
          )}
          <div className="min-w-0">
            <p className={`font-medium text-sm truncate flex items-center gap-1.5 ${p.available === false ? 'line-through text-muted-foreground' : ''}`}>
              {p.name_it}
              {p.is_new && <span className="text-[10px] font-bold bg-violet-600 text-white rounded px-1.5 py-0.5 flex-shrink-0">✨ {t('isNewLabel')}</span>}
              {p.separate_print && <span className="text-[10px] font-bold bg-slate-600 text-white rounded px-1.5 py-0.5 flex-shrink-0">🖨️ {t('separatePrintShort')}</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatPrice(p.price)}
              {p.stock_enabled && (
                <span className={p.stock_quantity > 0 ? 'text-blue-600 font-medium' : 'text-red-600 font-medium'}> · {t('stockRemainingLabel')}: {p.stock_quantity ?? 0}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {!q && list.length > 1 && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => reorder(list, index, -1, base44.entities.Product)}><ArrowUp className="w-3.5 h-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === list.length - 1} onClick={() => reorder(list, index, 1, base44.entities.Product)}><ArrowDown className="w-3.5 h-3.5" /></Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => openProductDialog(p.category_id, p)}>{t('edit')}</Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteProduct(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>
    );
  };

  const renderFolder = (cat, catIndex) => {
    const all = productsByCategory.get(cat.id) || [];
    const visible = all.filter(matches);
    if (q && visible.length === 0) return null;
    const isOpen = q ? true : openIds.has(cat.id);
    return (
      <Card key={cat.id} className="overflow-hidden">
        <Collapsible open={isOpen}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => toggleFolder(cat.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFolder(cat.id); } }}
            className={`flex items-center justify-between gap-2 px-3 py-3 cursor-pointer select-none hover:bg-orange-50 ${isOpen ? 'bg-orange-50' : ''}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
              {isOpen
                ? <FolderOpen className="w-5 h-5 text-orange-600 flex-shrink-0" />
                : <Folder className="w-5 h-5 text-orange-600 flex-shrink-0" />}
              <span className="text-xl flex-shrink-0">{cat.icon}</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{cat.name_it} <span className="font-normal text-muted-foreground">/ {cat.name_en}</span></p>
                {cat.is_drink && <span className="text-xs text-blue-600">🍻 {t('isDrink')}</span>}
              </div>
              <Badge variant="secondary" className="flex-shrink-0">{t('productsCount').replace('{n}', all.length)}</Badge>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {!q && sortedCategories.length > 1 && (
                <>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={catIndex === 0} onClick={() => reorder(sortedCategories, catIndex, -1, base44.entities.Category)}><ArrowUp className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={catIndex === sortedCategories.length - 1} onClick={() => reorder(sortedCategories, catIndex, 1, base44.entities.Category)}><ArrowDown className="w-3.5 h-3.5" /></Button>
                </>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCategoryDialog(cat)}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCategory(cat)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
          <CollapsibleContent>
            <div className="border-t bg-white">
              {visible.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-4">{t('emptyFolder')}</p>
              ) : (
                visible.map((p, i) => renderProductRow(p, visible, i))
              )}
              {!q && (
                <div className="border-t p-2">
                  <Button variant="ghost" size="sm" className="w-full text-orange-700 hover:text-orange-800" onClick={() => openProductDialog(cat.id)}>
                    <Plus className="w-4 h-4 mr-1" />
                    {t('addProductHere')} · {cat.name_it}
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  const orphansVisible = orphanProducts.filter(matches);
  const f = productDialog?.form;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{t('productsAndDepartments')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <CatalogBackup
            festa={festa}
            products={products}
            categories={categories}
            allergens={allergens}
            productOptions={productOptions}
            fixedMenus={fixedMenus}
            reload={reload}
          />
          <Button size="sm" onClick={() => openCategoryDialog(null)}>
            <Plus className="w-4 h-4 mr-1" />
            {t('newCategory')}
          </Button>
        </div>
      </div>

      {products.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('searchProduct')} className="pl-9" />
        </div>
      )}

      {sortedCategories.length === 0 && orphanProducts.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">{t('noDepartmentsYet')}</p>
      ) : (
        <div className="space-y-2">
          {sortedCategories.map((cat, i) => renderFolder(cat, i))}
          {orphansVisible.length > 0 && (
            <Card className="overflow-hidden border-dashed">
              <div className="px-3 py-2 text-sm font-semibold flex items-center gap-2 bg-slate-50">
                <Folder className="w-5 h-5 text-slate-400" />
                {t('noDepartment')}
                <Badge variant="secondary">{orphansVisible.length}</Badge>
              </div>
              <div className="bg-white">{orphansVisible.map((p, i) => renderProductRow(p, orphansVisible, i))}</div>
            </Card>
          )}
          {q && sortedCategories.every(c => !(productsByCategory.get(c.id) || []).some(matches)) && orphansVisible.length === 0 && (
            <p className="text-center text-muted-foreground py-6">{t('noProductFound')}</p>
          )}
        </div>
      )}

      {/* ---- Dialog reparto ---- */}
      <Dialog open={!!categoryDialog} onOpenChange={(v) => { if (!v && !saving) setCategoryDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{categoryDialog?.id ? t('edit') : t('newCategory')}</DialogTitle>
          </DialogHeader>
          {categoryDialog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Nome (IT)</Label>
                  <Input value={categoryDialog.form.name_it} onChange={e => setCategoryDialog({ ...categoryDialog, form: { ...categoryDialog.form, name_it: e.target.value } })} />
                </div>
                <div>
                  <Label className="text-xs">Nome (EN)</Label>
                  <Input value={categoryDialog.form.name_en} onChange={e => setCategoryDialog({ ...categoryDialog, form: { ...categoryDialog.form, name_en: e.target.value } })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 items-end">
                <div>
                  <Label className="text-xs">{t('icon')}</Label>
                  <Input value={categoryDialog.form.icon} onChange={e => setCategoryDialog({ ...categoryDialog, form: { ...categoryDialog.form, icon: e.target.value } })} className="text-center text-xl" />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Switch checked={categoryDialog.form.is_drink} onCheckedChange={v => setCategoryDialog({ ...categoryDialog, form: { ...categoryDialog.form, is_drink: v } })} />
                  <Label className="text-xs">{t('isDrink')}</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCategoryDialog(null)} disabled={saving}>{t('cancel')}</Button>
            <Button onClick={saveCategory} disabled={saving}>{t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Dialog prodotto ---- */}
      <Dialog open={!!productDialog} onOpenChange={(v) => { if (!v && !saving) setProductDialog(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{productDialog?.id ? t('edit') : t('newProduct')}</DialogTitle>
          </DialogHeader>
          {f && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Nome (IT)</Label>
                  <Input value={f.name_it} onChange={e => setForm({ name_it: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Nome (EN)</Label>
                  <Input value={f.name_en} onChange={e => setForm({ name_en: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Descrizione (IT)</Label>
                  <Input value={f.description_it} onChange={e => setForm({ description_it: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Descrizione (EN)</Label>
                  <Input value={f.description_en} onChange={e => setForm({ description_en: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{t('price')} (€)</Label>
                  <Input type="number" step="0.50" value={f.price} onChange={e => setForm({ price: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">{t('categories')}</Label>
                  <Select value={f.category_id} onValueChange={v => setForm({ category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {sortedCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name_it}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {allergens.length > 0 && (
                <div>
                  <Label className="text-xs">{t('allergens')}</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {allergens.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleIn('allergens', a.id)}
                        className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 border ${f.allergens.includes(a.id) ? 'bg-amber-100 border-amber-400' : 'bg-white border-border'}`}
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
                        type="button"
                        onClick={() => toggleIn('option_ids', o.id)}
                        className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 border ${f.option_ids.includes(o.id) ? 'bg-violet-100 border-violet-400' : 'bg-white border-border'}`}
                      >
                        {o.icon} {tn(o.name_it, o.name_en)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <ProductImageUpload value={f.image_url || ''} onChange={url => setForm({ image_url: url })} />
              <div className="flex items-center gap-2">
                <Switch checked={f.available} onCheckedChange={v => setForm({ available: v })} />
                <Label className="text-sm">{f.available ? t('available') : t('soldOut')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={f.lactose_free_option} onCheckedChange={v => setForm({ lactose_free_option: v })} />
                <Label className="text-sm">{t('lactoseFreeOption')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={f.is_new} onCheckedChange={v => setForm({ is_new: v })} />
                <Label className="text-sm">✨ {t('isNewLabel')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={f.separate_print} onCheckedChange={v => setForm({ separate_print: v })} />
                <Label className="text-sm">🖨️ {t('separatePrintLabel')}</Label>
              </div>
              {f.separate_print && (
                <p className="text-xs text-muted-foreground -mt-2">{t('separatePrintHint')}</p>
              )}
              <div className="border rounded-lg p-3 space-y-2 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Switch checked={f.stock_enabled} onCheckedChange={v => setForm({ stock_enabled: v })} />
                  <Label className="text-sm">{t('stockTrackingLabel')}</Label>
                </div>
                {f.stock_enabled && (
                  <div>
                    <Label className="text-xs">{t('stockQuantityLabel')}</Label>
                    <Input type="number" min="0" value={f.stock_quantity} onChange={e => setForm({ stock_quantity: e.target.value })} placeholder="0" />
                    <p className="text-xs text-muted-foreground mt-1">{t('stockQuantityHint')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setProductDialog(null)} disabled={saving}>{t('cancel')}</Button>
            <Button onClick={saveProduct} disabled={saving}>{t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
