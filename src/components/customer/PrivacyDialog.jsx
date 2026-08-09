import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Shield } from 'lucide-react';
import { useLang } from '@/lib/i18n';

export default function PrivacyDialog({ trigger }) {
  const { t } = useLang();
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <button className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            {t('privacy')}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {t('privacy')}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('privacyText')}</p>
      </DialogContent>
    </Dialog>
  );
}