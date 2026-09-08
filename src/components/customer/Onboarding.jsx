import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, Smartphone } from 'lucide-react';
import { useLang } from '@/lib/i18n';

export default function Onboarding({ open, onClose }) {
  const { t } = useLang();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">{t('welcome')}</DialogTitle>
          <DialogDescription className="text-center">{t('tagline')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-sm text-muted-foreground pt-2">{t('onboardingText')}</p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t('onboardingTableTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('onboardingTableText')}</p>
            </div>
          </div>
        </div>
        <Button onClick={onClose} className="w-full h-12 text-base">{t('gotIt')}</Button>
      </DialogContent>
    </Dialog>
  );
}