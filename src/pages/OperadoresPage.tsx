import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import type { Perfil } from '../lib/types';
import Toast from '../components/Toast';

export default function OperadoresPage() {
  const { perfil } = useAuth();
  const [pessoas, setPessoas] = useState<Perfil[]>([]);
  const [codigo, setCodigo] = useState('');
  const [toast, setToast] = useState<{ mensagem: string; tipo: 'ok' | 'erro' } | null>(null);

  useEffect(() => {
    supabase
      .from('perfis')
      .select('id, nome, papel, central_id')
      .order('papel')
      .order('nome')
      .then(({ data }) => setPessoas((data ?? []) as Perfil[]));

    supabase
      .from('centrais')
      .select('codigo')
      .maybeSingle()
      .then(({ data }) => setCodigo(data?.codigo ?? ''));
  }, []);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setToast({ mensagem: 'Código copiado.', tipo: 'ok' });
    } catch {
      setToast({ mensagem: 'Não foi possível copiar. Anote o código manualmente.', tipo: 'erro' });
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Operadores</h1>

      <section className="cartao space-y-3 text-center">
        <p className="text-sm text-slate-600">Código desta central</p>
        <p className="select-all font-mono text-3xl font-bold tracking-[0.3em] text-indigo-700">
          {codigo || '—'}
        </p>
        <button className="btn-secundario w-full" onClick={copiar} disabled={!codigo}>
          Copiar código
        </button>
        <p className="text-sm text-slate-500">
          Para adicionar um operador, compartilhe este código. Na tela de criar conta, a pessoa escolhe
          “Operador” e informa o código.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Pessoas nesta central ({pessoas.length})</h2>
        <ul className="space-y-2">
          {pessoas.map((p) => (
            <li key={p.id} className="cartao flex items-center justify-between">
              <span className="font-medium">
                {p.nome}
                {p.id === perfil?.id && <span className="ml-2 text-xs text-slate-500">(você)</span>}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  p.papel === 'central' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {p.papel === 'central' ? 'Central' : 'Operador'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {toast && <Toast mensagem={toast.mensagem} tipo={toast.tipo} onFechar={() => setToast(null)} />}
    </div>
  );
}
