import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { Image } from '@/components/ui/image';

export default function ProductImageUpload({ value, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      onChange(res.file_url);
    } catch (err) {
      console.error('Upload error', err);
      alert('Errore caricamento immagine');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Foto prodotto</Label>
      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative w-20 h-20 rounded-lg overflow-hidden border flex-shrink-0">
            <Image src={value} fittingType="fill" className="w-20 h-20" alt="Anteprima" />
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 flex-shrink-0">
            <ImagePlus className="w-6 h-6" />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Caricamento...</> : 'Carica foto'}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
              Rimuovi
            </Button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
      </div>
    </div>
  );
}