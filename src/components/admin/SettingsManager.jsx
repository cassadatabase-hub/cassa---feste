import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useLang } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';

export default function SettingsManager({ settings, reload }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [form, setForm] = useState({
    cassa_pin: settings?.cassa_pin || '1234',
    admin_pin: settings?.admin_pin || '9999',
    code_expiry_hours: settings?.code_expiry_hours || 4,
    next_order_number: settings?.next_order_number || 1,
    festa_name: settings?.festa_name || '',
  });

  const handleSave = async () => {
    try {
      if (settings?.id) {
        await base44.entities.AppSettings.update(settings.id, form);
      } else {
        await base44.entities.AppSettings.create(form);
      }
      toast({ title: t('save') + ' ✓' });
      reload();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-3 max-w-md">
        <div>
          <Label>{t('festaName')}</Label>
          <Input value={form.festa_name} onChange={e => setForm({ ...form, festa_name: e.target.value })} placeholder={t('festaNamePlaceholder')} />
        </div>
        <div>
          <Label>{t('cassaPin')}</Label>
          <Input type="password" value={form.cassa_pin} onChange={e => setForm({ ...form, cassa_pin: e.target.value })} className="font-mono" />
        </div>
        <div>
          <Label>{t('adminPin')}</Label>
          <Input type="password" value={form.admin_pin} onChange={e => setForm({ ...form, admin_pin: e.target.value })} className="font-mono" />
        </div>
        <div>
          <Label>{t('codeExpiry')}</Label>
          <Input type="number" value={form.code_expiry_hours} onChange={e => setForm({ ...form, code_expiry_hours: Number(e.target.value) })} />
        </div>
        <div>
          <Label>{t('orderNumber')} (prossimo)</Label>
          <Input type="number" value={form.next_order_number} onChange={e => setForm({ ...form, next_order_number: Number(e.target.value) })} />
        </div>
        <Button onClick={handleSave} className="w-full">{t('save')}</Button>
      </CardContent>
    </Card>
  );
}