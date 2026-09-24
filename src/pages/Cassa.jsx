import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLang } from '@/lib/i18n';
import { useCatalog } from '@/lib/useCatalog';
import LanguageToggle from '@/components/shared/LanguageToggle';
import CodeLookup from '@/components/cassa/CodeLookup';
import ManualOrder from '@/components/cassa/ManualOrder';
import OrderHistory from '@/components/cassa/OrderHistory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Lock, LogOut, Search, ClipboardList, History } from 'lucide-react';
import { Link } from 'react-router-dom';

function CassaContent() {
  const { t } = useLang();
  const { categories, products, productOptions, comandaTemplates, settings, loading } = useCatalog({ liveProducts: true });
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState('lookup');
  // Vista prodotti della Cassa manuale: "tabs" (per reparto) o "list"
  // (scorrimento unico). Salvata solo su QUESTO dispositivo/browser.
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('cassa_products_view') || 'tabs'; } catch (e) { return 'tabs'; }
  });
  const toggleViewMode = () => {
    setViewMode(prev => {
      const next = prev === 'tabs' ? 'list' : 'tabs';
      try { localStorage.setItem('cassa_products_view', next); } catch (e) { /* ignora */ }
      return next;
    });
  };

  useEffect(() => {
    if (sessionStorage.getItem('cassa_authed') === '1') setAuthed(true);
  }, []);

  const handleLogin = () => {
    if (pin === (settings?.cassa_pin || '1234')) {
      setAuthed(true);
      sessionStorage.setItem('cassa_authed', '1');
      setError(false);
    } else {
      setError(true);
    }
  };

  const handleLogout = () => {
    setAuthed(false);
    sessionStorage.removeItem('cassa_authed');
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
            <div className="w-14 h-14 mx-auto rounded-full bg-slate-800 flex items-center justify-center mb-2">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <CardTitle>{t('cassaLogin')}</CardTitle>
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
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">{t('cassa')}</h1>
            <span className="text-xs text-muted-foreground hidden sm:inline">{new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'manual' && (
              <button
                onClick={toggleViewMode}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border bg-white hover:border-slate-400 transition"
                title={t('toggleViewMode')}
              >
                {viewMode === 'tabs' ? `📜 ${t('scrollView')}` : `🗂️ ${t('tabsView')}`}
              </button>
            )}
            <LanguageToggle />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1" />
              {t('logout')}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="lookup"><Search className="w-4 h-4 mr-1.5" />{t('lookupCode')}</TabsTrigger>
            <TabsTrigger value="manual"><ClipboardList className="w-4 h-4 mr-1.5" />{t('manualOrder')}</TabsTrigger>
            <TabsTrigger value="history"><History className="w-4 h-4 mr-1.5" />{t('orderHistory')}</TabsTrigger>
          </TabsList>
          <TabsContent value="lookup">
            <CodeLookup categories={categories} products={products} comandaTemplates={comandaTemplates} productOptions={productOptions} onOrderCompleted={() => setRefreshKey(k => k + 1)} />
          </TabsContent>
          <TabsContent value="manual">
            <ManualOrder categories={categories} products={products} comandaTemplates={comandaTemplates} productOptions={productOptions} viewMode={viewMode} />
          </TabsContent>
          <TabsContent value="history">
            <OrderHistory categories={categories} comandaTemplates={comandaTemplates} productOptions={productOptions} refreshKey={refreshKey} activeFestaId={settings?.active_festa_id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default function Cassa() {
  return (
    <LanguageProvider>
      <CassaContent />
    </LanguageProvider>
  );
}