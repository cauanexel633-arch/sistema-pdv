import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FORMA_LABEL, TIPO_LABEL, type Perfil, type Venda } from '../lib/types';
import { dataHora, fimDoDia, formatarReais, inicioDoDia, mensagemErro } from '../lib/format';
import Modal from '../components/Modal';

export default function HistoricoPage() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [operadores, setOperadores] = useState<Perfil[]>([]);
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [operadorId, setOperadorId] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [detalhe, setDetalhe] = useState<Venda | null>(null);

  useEffect(() => {
    supabase
      .from('perfis')
      .select('id, nome, papel, central_id')
      .order('nome')
      .then(({ data }) => setOperadores((data ?? []) as Perfil[]));
  }, []);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);

    let consulta = supabase.from('vendas').select('*').order('criado_em', { ascending: false }).limit(500);
    if (de) consulta = consulta.gte('criado_em', inicioDoDia(de));
    if (ate) consulta = consulta.lte('criado_em', fimDoDia(ate));
    if (operadorId) consulta = consulta.eq('operador_id', operadorId);

    consulta.then(({ data, error }) => {
      if (!ativo) return;
      setErro(error ? mensagemErro(error) : '');
      setVendas((data ?? []) as Venda[]);
      setCarregando(false);
    });

    return () => {
      ativo = false;
    };
  }, [de, ate, operadorId]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Histórico</h1>

      <section className="cartao grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="rotulo" htmlFor="de">De</label>
          <input id="de" type="date" className="campo" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div>
          <label className="rotulo" htmlFor="ate">Até</label>
          <input id="ate" type="date" className="campo" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
        <div>
          <label className="rotulo" htmlFor="operador">Operador</label>
          <select id="operador" className="campo" value={operadorId} onChange={(e) => setOperadorId(e.target.value)}>
            <option value="">Todos</option>
            {operadores.map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
        </div>
      </section>

      {erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      <ul className="space-y-3">
        {carregando && <li className="p-6 text-center text-slate-500">Carregando…</li>}
        {!carregando && vendas.length === 0 && (
          <li className="p-6 text-center text-slate-500">Nenhuma venda encontrada.</li>
        )}
        {!carregando &&
          vendas.map((v) => (
            <li key={v.id}>
              <button
                onClick={() => setDetalhe(v)}
                className="cartao flex w-full items-center justify-between gap-3 text-left active:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">{dataHora(v.criado_em)} · {v.operador_nome}</p>
                  <p className="truncate font-medium">
                    {v.itens.length} item(ns) · {FORMA_LABEL[v.forma_pagamento]}
                    {v.parcelas ? ` ${v.parcelas}x` : ''}
                  </p>
                </div>
                <span className="flex-none text-lg font-bold text-indigo-700">
                  {formatarReais(v.total_centavos)}
                </span>
              </button>
            </li>
          ))}
      </ul>

      {!carregando && vendas.length >= 500 && (
        <p className="text-center text-sm text-slate-500">Mostrando as 500 vendas mais recentes. Refine o período para ver mais.</p>
      )}

      {detalhe && (
        <Modal titulo="Detalhes da venda" onFechar={() => setDetalhe(null)}>
          <div className="space-y-4 text-sm">
            <p className="text-slate-600">
              {dataHora(detalhe.criado_em)} · Operador: <strong>{detalhe.operador_nome}</strong>
            </p>
            <ul className="space-y-2">
              {detalhe.itens.map((i) => (
                <li key={i.id} className="rounded-xl bg-slate-50 p-3">
                  <p className="font-medium">{i.nome}</p>
                  <p className="text-slate-500">
                    {TIPO_LABEL[i.tipo]}
                    {i.numero_serie ? ` · Série: ${i.numero_serie}` : ''}
                  </p>
                  <p className="text-right font-semibold">{formatarReais(i.valor_centavos)}</p>
                </li>
              ))}
            </ul>
            <div className="space-y-1 border-t border-slate-200 pt-3">
              <p className="flex justify-between"><span>Subtotal</span><span>{formatarReais(detalhe.subtotal_centavos)}</span></p>
              <p className="flex justify-between"><span>Desconto</span><span>- {formatarReais(detalhe.desconto_centavos)}</span></p>
              <p className="flex justify-between text-base font-bold"><span>Total</span><span>{formatarReais(detalhe.total_centavos)}</span></p>
              <p className="flex justify-between pt-2 text-slate-600">
                <span>Pagamento</span>
                <span>
                  {FORMA_LABEL[detalhe.forma_pagamento]}
                  {detalhe.parcelas ? ` · ${detalhe.parcelas}x de ${formatarReais(Math.floor(detalhe.total_centavos / detalhe.parcelas))}` : ''}
                </span>
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
