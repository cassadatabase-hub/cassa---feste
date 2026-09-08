import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLang } from '@/lib/i18n';
import { useCatalog } from '@/lib/useCatalog';
import LanguageToggle from '@/components/shared/LanguageToggle';
import CategoriesManager from '@/components/admin/CategoriesManager';
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
import { Lock, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';

function AdminContent() {
  const { t } = useLang();
  const { categories, products, allergens, productOptions, fixedMenus, comandaTemplates, settings, loading, reload } = useCatalog();
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
            <LanguageToggle />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1" />
              {t('logout')}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4">
        <Tabs defaultValue="categories">
          <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
            <TabsTrigger value="categories">{t('categories')}</TabsTrigger>
            <TabsTrigger value="products">{t('products')}</TabsTrigger>
            <TabsTrigger value="allergens">{t('allergens')}</TabsTrigger>
            <TabsTrigger value="productoptions">{t('productOptions')}</TabsTrigger>
            <TabsTrigger value="fixedmenus">{t('fixedMenu')}</TabsTrigger>
            <TabsTrigger value="templates">{t('comandaTemplates')}</TabsTrigger>
            <TabsTrigger value="feste">{t('festeManagement')}</TabsTrigger>
            <TabsTrigger value="settings">{t('settings')}</TabsTrigger>
            <TabsTrigger value="report">{t('reportTab')}</TabsTrigger>
          </TabsList>
          <TabsContent value="categories">
            <CategoriesManager categories={categories} reload={reload} />
          </TabsContent>
          <TabsContent value="products">
            <ProductsManager products={products} categories={categories} allergens={allergens} productOptions={productOptions} reload={reload} />
          </TabsContent>
          <TabsContent value="allergens">
            <AllergensManager allergens={allergens} reload={reload} />
          </TabsContent>
          <TabsContent value="productoptions">
            <ProductOptionsManager productOptions={productOptions} reload={reload} />
          </TabsContent>
          <TabsContent value="fixedmenus">
            <FixedMenusManager fixedMenus={fixedMenus} products={products} categories={categories} reload={reload} />
          </TabsContent>
          <TabsContent value="templates">
            <ComandaTemplatesManager templates={comandaTemplates} categories={categories} reload={reload} />
          </TabsContent>
          <TabsContent value="feste">
            <FestasManager settings={settings} reload={reload} />
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