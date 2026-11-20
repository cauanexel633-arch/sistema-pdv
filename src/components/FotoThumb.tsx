import { useEffect, useState } from 'react';
import { BUCKET_FOTOS, supabase } from '../lib/supabase';

/** Mostra uma foto do bucket privado usando URL assinada (válida por 1 hora). */
export default function FotoThumb({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    supabase.storage
      .from(BUCKET_FOTOS)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (ativo) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      ativo = false;
    };
  }, [path]);

  return url ? (
    <img src={url} alt="" className={`${className ?? ''} object-cover`} loading="lazy" />
  ) : (
    <div className={`${className ?? ''} bg-slate-200`} />
  );
}
