import React from 'react';
import { useLang } from '@/lib/i18n';

export default function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center bg-muted rounded-full p-0.5">
      <button
        onClick={() => setLang('it')}
        className={`px-2.5 py-1 text-xs font-bold rounded-full transition ${lang === 'it' ? 'bg-white shadow text-foreground' : 'text-muted-foreground'}`}
      >
        IT
      </button>
      <button
        onClick={() => setLang('en')}
        className={`px-2.5 py-1 text-xs font-bold rounded-full transition ${lang === 'en' ? 'bg-white shadow text-foreground' : 'text-muted-foreground'}`}
      >
        EN
      </button>
    </div>
  );
}