import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLang } from '@/lib/i18n';
import { useCatalog } from '@/lib/useCatalog';
import LanguageToggle from '@/components/shared/LanguageToggle';
import ProductsManager from '@/components/admin/ProductsManager';
import AllergensManager from '@/components/admin/AllergensManager';
import ProductOptionsManager from '@/components/admin/ProductOptionsManager';
import ComandaTemplatesManager from '@/components/admin/ComandaTemplatesManager';
import FixedMenusManager from '@/components/admin/FixedMenusManager';
import SettingsManager from '@/components/admin/SettingsManager';
import FestasManager from '@/components/admin/FestasManager';
import DailyReport from '@/components/admin/DailyReport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Lock, LogOut, TriangleAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { isValidHex, DEFAULT_THEME_COLOR } from '@/lib/theme';
import { Link } from 'react-router-dom';

function AdminContent() {
  const { t } = useLang();
  const { toast } = useToast();
  // Festa che l'admin sta gestendo (può essere diversa da quella in vendita)
  const [managedFestaId, setManagedFestaId] = useState(() => {
    try { return sessionStorage.getItem('admin_festa_id') || null; } catch { return null; }
  });
  const {
    categories, products, allergens, productOptions, fixedMenus, comandaTemplates,
    settings, feste, currentFesta, activeFesta, loading, reload,
  } = useCatalog({ festaId: managedFestaId || 'auto' });
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('admin_authed') === '1') setAuthed(true);
  }, []);

  const handleLogin = () => {
    if (pin === (settings?.admin_pin || '9999')) {
      setAuthed(true);
      sessionStorage.setItem('admin_authed', '1');
      setError(false);
    } else {
      setError(true);
    }
  };

  const manageFesta = (id) => {
    setManagedFestaId(id);
    try { sessionStorage.setItem('admin_festa_id', id); } catch { /* ignora */ }
  };

  const putCurrentOnSale = async () => {
    if (!currentFesta) return;
    try {
      await base44.entities.Festa.update(currentFesta.id, { status: 'active' });
      if (settings?.id) {
        await base44.entities.AppSettings.update(settings.id, { active_festa_id: currentFesta.id, festa_name: currentFesta.name });
      } else {
        await base44.entities.AppSettings.create({ active_festa_id: currentFesta.id, festa_name: currentFesta.name, cassa_pin: '1234' });
      }
      toast({ title: t('festaLiveToast').replace('{name}', currentFesta.name) });
      reload();
    } catch (e) {
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  const handleLogout = () => {
    setAuthed(false);
    sessionStorage.removeItem('admin_authed');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-sm w-full">
          <CardHeader className="text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-slate-900 flex items-center justify-center mb-2">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <CardTitle>{t('admin')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="password"
              value={pin}
              onChange={e => { setPin(e.target.value); setError(false); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder={t('enterPin')}
              className="text-center text-2xl tracking-widest h-14"
              autoFocus
            />
            {error && <p className="text-sm text-destructive text-center">{t('wrongPin')}</p>}
            <Button className="w-full h-11" onClick={handleLogin}>{t('login')}</Button>
            <Link to="/" className="block text-center text-xs text-muted-foreground hover:underline">{t('back')} → {t('menu')}</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">{t('admin')}</h1>
          <div className="flex items-center gap-3">
            {feste.length > 0 && currentFesta && (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-xs text-muted-foreground">{t('managingFesta')}</span>
                <Select value={currentFesta.id} onValueChange={manageFesta}>
                  <SelectTrigger className="h-9 w-[170px] sm:w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {feste.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full inline-block"
                            style={{ backgroundColor: isValidHex(f.theme_color) ? f.theme_color : DEFAULT_THEME_COLOR }}
                          />
                          {f.name}
                          {f.id === settings?.active_festa_id && <Badge className="bg-green-600 ml-1 px-1.5 py-0 text-[10px]">{t('liveFesta')}</Badge>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <LanguageToggle />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1" />
              {t('logout')}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4">
        {currentFesta && currentFesta.id !== activeFesta?.id && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span className="flex items-center gap-2">
              <TriangleAlert className="w-4 h-4 flex-shrink-0" />
              {activeFesta
                ? t('managingNotLive').replace('{managed}', currentFesta.name).replace('{live}', activeFesta.name)
                : t('managingNoLive').replace('{managed}', currentFesta.name)}
            </span>
            <Button size="sm" variant="outline" className="bg-white" onClick={putCurrentOnSale}>{t('setLive')}</Button>
          </div>
        )}
        <Tabs defaultValue="products">
          <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
            <TabsTrigger value="products">{t('products')}</TabsTrigger>
            <TabsTrigger value="allergens">{t('allergens')}</TabsTrigger>
            <TabsTrigger value="productoptions">{t('productOptions')}</TabsTrigger>
            <TabsTrigger value="fixedmenus">{t('fixedMenu')}</TabsTrigger>
            <TabsTrigger value="templates">{t('comandaTemplates')}</TabsTrigger>
            <TabsTrigger value="feste">{t('festeManagement')}</TabsTrigger>
            <TabsTrigger value="settings">{t('settings')}</TabsTrigger>
            <TabsTrigger value="report">{t('reportTab')}</TabsTrigger>
          </TabsList>
          <TabsContent value="products">
            <ProductsManager festa={currentFesta} products={products} categories={categories} allergens={allergens} productOptions={productOptions} fixedMenus={fixedMenus} reload={reload} />
          </TabsContent>
          <TabsContent value="allergens">
            <AllergensManager allergens={allergens} reload={reload} />
          </TabsContent>
          <TabsContent value="productoptions">
            <ProductOptionsManager productOptions={productOptions} reload={reload} />
          </TabsContent>
          <TabsContent value="fixedmenus">
            <FixedMenusManager festaId={currentFesta?.id || null} fixedMenus={fixedMenus} products={products} categories={categories} reload={reload} />
          </TabsContent>
          <TabsContent value="templates">
            <ComandaTemplatesManager festaId={currentFesta?.id || null} templates={comandaTemplates} categories={categories} reload={reload} />
          </TabsContent>
          <TabsContent value="feste">
            <FestasManager settings={settings} feste={feste} managedFestaId={currentFesta?.id || null} onManage={manageFesta} reload={reload} />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsManager settings={settings} reload={reload} />
          </TabsContent>
          <TabsContent value="report">
            <DailyReport categories={categories} settings={settings} reload={reload} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default function Admin() {
  return (
    <LanguageProvider>
      <AdminContent />
    </LanguageProvider>
  );
}