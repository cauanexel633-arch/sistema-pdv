import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Perfil } from '../lib/types';

interface AuthValue {
  session: Session | null;
  perfil: Perfil | null;
  carregando: boolean;
  sair: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

async function buscarPerfil(userId: string): Promise<Perfil | null> {
  const { data } = await supabase
    .from('perfis')
    .select('id, papel, nome, central_id')
    .eq('id', userId)
    .maybeSingle();
  return (data as Perfil | null) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    const aplicar = async (s: Session | null) => {
      if (!ativo) return;
      setSession(s);
      setPerfil(s ? await buscarPerfil(s.user.id) : null);
    };

    supabase.auth.getSession().then(async ({ data }) => {
      await aplicar(data.session);
      if (ativo) setCarregando(false);
    });

    // setTimeout evita chamar o Supabase dentro do callback de auth (pode travar a sessão).
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setTimeout(() => void aplicar(s), 0);
    });

    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthValue = {
    session,
    perfil,
    carregando,
    sair: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
