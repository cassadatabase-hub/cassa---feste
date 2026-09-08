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

export default function ComandaTemplatesManager({ templates, categories, reload }) {
  const { t, tn } = useLang();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);
  const emptyForm = { name: '', title: '', header_text: '', header_font_size: 20, header_bold: true, header_align: 'center', category_ids: [], paper_size: '80mm', font_family: 'monospace', font_size: 12, title_font_size: 16, sort_order: 0, active: true };
  const [form, setForm] = useState(emptyForm);

  const handleSave = async () => {
    if (!form.name || !form.title) return;
    try {
      if (editing) {
        await base44.entities.ComandaTemplate.update(editing, form);
      } else {
        await base44.entities.ComandaTemplate.create(form);
      }
      setEditing(null);
      setForm(emptyForm);
      reload();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  const handleEdit = (tpl) => {
    setEditing(tpl.id);
    setForm({ name: tpl.name, title: tpl.title, header_text: tpl.header_text || '', header_font_size: tpl.header_font_size || 20, header_bold: tpl.header_bold !== false, header_align: tpl.header_align || 'center', category_ids: tpl.category_ids || [], paper_size: tpl.paper_size || '80mm', font_family: tpl.font_family || 'monospace', font_size: tpl.font_size || 12, title_font_size: tpl.title_font_size || 16, sort_order: tpl.sort_order || 0, active: tpl.active !== false });
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminare?')) return;
    await base44.entities.ComandaTemplate.delete(id);
    reload();
  };

  const toggleCategory = (cid) => {
    setForm(prev => ({
      ...prev,
      category_ids: prev.category_ids.includes(cid)
        ? prev.category_ids.filter(c => c !== cid)
        : [...prev.category_ids, cid]
    }));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="font-semibold">{editing ? t('edit') : t('newTemplate')}</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t('name')}</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="es. Comanda cucina" />
            </div>
            <div>
              <Label className="text-xs">Intestazione</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="es. CUCINA" />
            </div>
          </div>
          <div>
            <Label className="text-xs">{t('headerText')}</Label>
            <Input value={form.header_text} onChange={e => setForm({ ...form, header_text: e.target.value })} placeholder="es. Festa Del Binengo" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">{t('headerFontSize')}</Label>
              <Input type="number" value={form.header_font_size} onChange={e => setForm({ ...form, header_font_size: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">{t('headerAlign')}</Label>
              <Select value={form.header_align} onValueChange={v => setForm({ ...form, header_align: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">{t('alignLeft')}</SelectItem>
                  <SelectItem value="center">{t('alignCenter')}</SelectItem>
                  <SelectItem value="right">{t('alignRight')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col">
              <Label className="text-xs">{t('headerBold')}</Label>
              <div className="flex items-center h-9">
                <Switch checked={form.header_bold} onCheckedChange={v => setForm({ ...form, header_bold: v })} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t('paperSize')}</Label>
              <Select value={form.paper_size} onValueChange={v => setForm({ ...form, paper_size: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="58mm">58mm (termica)</SelectItem>
                  <SelectItem value="80mm">80mm (termica)</SelectItem>
                  <SelectItem value="A4">A4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('fontFamily')}</Label>
              <Select value={form.font_family} onValueChange={v => setForm({ ...form, font_family: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monospace">Monospace</SelectItem>
                  <SelectItem value="sans-serif">Sans-serif</SelectItem>
                  <SelectItem value="serif">Serif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">{t('fontSizeText')}</Label>
              <Input type="number" value={form.font_size} onChange={e => setForm({ ...form, font_size: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">{t('fontSizeTitle')}</Label>
              <Input type="number" value={form.title_font_size} onChange={e => setForm({ ...form, title_font_size: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">{t('sortOrder')}</Label>
              <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">{t('selectCategories')}</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleCategory(c.id)}
                  className={`px-2 py-1 rounded-lg text-xs border ${form.category_ids.includes(c.id) ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-border'}`}
                >
                  {c.icon} {c.name_it}
                </button>
              ))}
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
        {templates.map(tpl => (
          <Card key={tpl.id}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{tpl.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {tpl.header_text ? `"${tpl.header_text}" · ` : ''}{tpl.title} · {tpl.paper_size} · {tpl.font_family || 'monospace'} {(tpl.font_size || 12)}/{(tpl.title_font_size || 16)}pt · {(tpl.category_ids || []).length} {t('categories')}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(tpl.category_ids || []).map(cid => {
                      const c = categories.find(x => x.id === cid);
                      return c ? <span key={cid} className="text-xs bg-muted rounded px-1.5 py-0.5">{c.icon} {c.name_it}</span> : null;
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => { await base44.entities.ComandaTemplate.update(tpl.id, { sort_order: (tpl.sort_order || 0) - 1 }); reload(); }}><ArrowUp className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => { await base44.entities.ComandaTemplate.update(tpl.id, { sort_order: (tpl.sort_order || 0) + 1 }); reload(); }}><ArrowDown className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(tpl)}>{t('edit')}</Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(tpl.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}