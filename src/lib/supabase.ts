import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** false quando o arquivo .env não foi preenchido — o App mostra um aviso. */
export const configuracaoOk = Boolean(url && chave);

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  chave || 'placeholder',
);

export const BUCKET_FOTOS = 'fotos';
