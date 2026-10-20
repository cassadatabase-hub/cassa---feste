import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Download, Upload } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import {
  buildCatalogExport, downloadJson, catalogFilename,
  parseCatalogFile, summarizeCatalog, importCatalog,
} from '@/lib/catalogExport';

// Pulsanti "Esporta JSON" / "Importa JSON" del catalogo della festa in gestione.
export default function CatalogBackup({ festa, products, categories, allergens, productOptions, fixedMenus, reload }) {
  const { t } = useLang();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('merge');
  const [busy, setBusy] = useState(false);

  const handleExport = () => {
    const out = buildCatalogExport({ festa, categories, products, allergens, productOptions, fixedMenus });
    downloadJson(out, catalogFilename(festa));
    toast({ title: t('exportDone') });
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = parseCatalogFile(await file.text());
      setData(parsed);
      setMode('merge');
      setOpen(true);
    } catch (err) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
  };

  const handleImport = async () => {
    if (!data || !festa) return;
    if (mode === 'replace' && !confirm(t('importReplaceConfirm').replace('{name}', festa.name))) return;
    setBusy(true);
    try {
      const res = await importCatalog(data, {
        festaId: festa.id,
        mode,
        current: { categories, products, fixedMenus, allergens, productOptions },
      });
      toast({
        title: t('importDone'),
        description: t('importDoneDetail').replace('{p}', res.products).replace('{c}', res.categories),
      });
      setOpen(false);
      setData(null);
      reload();
    } catch (err) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const summary = data ? summarizeCatalog(data) : null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleExport} disabled={!festa}>
        <Download className="w-4 h-4 mr-1" />
        {t('exportJson')}
      </Button>
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={!festa}>
        <Upload className="w-4 h-4 mr-1" />
        {t('importJson')}
      </Button>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />

      <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('importTitle')}</DialogTitle>
          </DialogHeader>
          {summary && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-slate-50 border p-3">
                <p className="font-medium">
                  {t('importFound').replace('{c}', summary.categories).replace('{p}', summary.products).replace('{m}', summary.menus)}
                </p>
                {summary.festaName && <p className="text-xs text-muted-foreground mt-0.5">{summary.festaName}</p>}
              </div>
              <p className="text-muted-foreground">{t('importIntoFesta').replace('{name}', festa?.name || '')}</p>
              <div className="space-y-2">
                {[
                  { value: 'merge', label: t('importModeMerge'), hint: t('importModeMergeHint') },
                  { value: 'replace', label: t('importModeReplace'), hint: t('importModeReplaceHint') },
                ].map(opt => (
                  <label
                    key={opt.value}
                    className={`flex gap-2 items-start rounded-lg border p-3 cursor-pointer ${mode === opt.value ? 'border-orange-500 bg-orange-50' : ''}`}
                  >
                    <input
                      type="radio"
                      name="import-mode"
                      className="mt-1"
                      checked={mode === opt.value}
                      onChange={() => setMode(opt.value)}
                    />
                    <span>
                      <span className="block font-medium">{opt.label}</span>
                      <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>{t('cancel')}</Button>
            <Button onClick={handleImport} disabled={busy} variant={mode === 'replace' ? 'destructive' : 'default'}>
              {busy ? '...' : t('importConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
