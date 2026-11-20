import { useCallback, useEffect, useState } from 'react';
import { BUCKET_FOTOS, supabase } from '../lib/supabase';
import { TIPO_LABEL, type Item, type TipoItem } from '../lib/types';
import { formatarReais, mensagemErro } from '../lib/format';
import ItemForm from '../components/ItemForm';
import Confirmar from '../components/Confirmar';
import FotoThumb from '../components/FotoThumb';
import Toast from '../components/Toast';

const TIPOS: TipoItem[] = ['kit', 'residencial', 'viagem'];

export default function CadastroPage() {
  const [tipo, setTipo] = useState<TipoItem>('kit');
  const [itens, setItens] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editor, setEditor] = useState<{ item: Item | null } | null>(null);
  const [paraExcluir, setParaExcluir] = useState<Item | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [toast, setToast] = useState<{ mensagem: string; tipo: 'ok' | 'erro' } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from('itens')
      .select('*')
      .eq('tipo', tipo)
      .eq('vendido', false)
      .order('criado_em', { ascending: false });
    if (error) setToast({ mensagem: mensagemErro(error), tipo: 'erro' });
    setItens((data ?? []) as Item[]);
    setCarregando(false);
  }, [tipo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function confirmarExclusao() {
    if (!paraExcluir) return;
    setExcluindo(true);
    // RLS impede excluir itens vendidos: nesse caso nenhuma linha volta.
    const { data, error } = await supabase.from('itens').delete().eq('id', paraExcluir.id).select('id');
    setExcluindo(false);
    const alvo = paraExcluir;
    setParaExcluir(null);

    if (error) return setToast({ mensagem: mensagemErro(error), tipo: 'erro' });
    if (!data?.length) return setToast({ mensagem: 'Este item já foi vendido e não pode ser excluído.', tipo: 'erro' });

    if (alvo.fotos.length) await supabase.storage.from(BUCKET_FOTOS).remove(alvo.fotos);
    setToast({ mensagem: 'Item excluído.', tipo: 'ok' });
    carregar();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cadastro</h1>

      <div role="tablist" className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-1 shadow-sm">
        {TIPOS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tipo === t}
            onClick={() => setTipo(t)}
            className={`rounded-xl px-2 py-3 text-sm font-semibold ${
              tipo === t ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            {TIPO_LABEL[t]}
          </button>
        ))}
      </div>

      <button className="btn-primario w-full" onClick={() => setEditor({ item: null })}>
        + Novo
      </button>

      <ul className="space-y-3">
        {carregando && <li className="p-6 text-center text-slate-500">Carregando…</li>}
        {!carregando && itens.length === 0 && (
          <li className="p-6 text-center text-slate-500">Nenhum item cadastrado nesta seção.</li>
        )}
        {!carregando &&
          itens.map((item) => (
            <li key={item.id} className="cartao flex items-center gap-3">
              {item.fotos[0] ? (
                <FotoThumb path={item.fotos[0]} className="h-16 w-16 flex-none rounded-lg" />
              ) : (
                <div className="h-16 w-16 flex-none rounded-lg bg-slate-100" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{item.nome}</p>
                {item.numero_serie && (
                  <p className="truncate text-sm text-slate-500">Série: {item.numero_serie}</p>
                )}
                <p className="text-sm font-medium text-indigo-700">{formatarReais(item.valor_centavos)}</p>
              </div>
              <div className="flex flex-none flex-col gap-2">
                <button className="btn-secundario px-3 py-2 text-sm" onClick={() => setEditor({ item })}>
                  Editar
                </button>
                <button className="btn-perigo px-3 py-2 text-sm" onClick={() => setParaExcluir(item)}>
                  Excluir
                </button>
              </div>
            </li>
          ))}
      </ul>

      {editor && (
        <ItemForm
          tipo={tipo}
          item={editor.item}
          onFechar={() => setEditor(null)}
          onSalvo={() => {
            setEditor(null);
            setToast({ mensagem: 'Item salvo com sucesso.', tipo: 'ok' });
            carregar();
          }}
        />
      )}

      {paraExcluir && (
        <Confirmar
          mensagem={`Excluir "${paraExcluir.nome}"? Esta ação não pode ser desfeita.`}
          carregando={excluindo}
          onCancelar={() => setParaExcluir(null)}
          onConfirmar={confirmarExclusao}
        />
      )}

      {toast && <Toast mensagem={toast.mensagem} tipo={toast.tipo} onFechar={() => setToast(null)} />}
    </div>
  );
}
