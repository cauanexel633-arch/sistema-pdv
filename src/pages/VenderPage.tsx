import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FORMA_LABEL, TIPO_LABEL, type FormaPagamento, type Item, type TipoItem } from '../lib/types';
import { formatarReais, mensagemErro, normalizar, reaisParaCentavos } from '../lib/format';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

type Filtro = 'todos' | TipoItem;

const FILTROS: { valor: Filtro; label: string }[] = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'kit', label: 'Kit' },
  { valor: 'residencial', label: 'Residencial' },
  { valor: 'viagem', label: 'Viagem' },
];

const FORMAS: FormaPagamento[] = ['debito', 'credito', 'pix'];

/* ---------------- Janela de seleção de itens ---------------- */

function SeletorItens({
  jaSelecionados,
  onConcluir,
  onFechar,
}: {
  jaSelecionados: Item[];
  onConcluir: (itens: Item[]) => void;
  onFechar: () => void;
}) {
  const [disponiveis, setDisponiveis] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(jaSelecionados.map((i) => i.id)));

  useEffect(() => {
    supabase
      .from('itens')
      .select('*')
      .eq('vendido', false)
      .order('nome')
      .then(({ data, error }) => {
        if (error) setErro(mensagemErro(error));
        setDisponiveis((data ?? []) as Item[]);
        setCarregando(false);
      });
  }, []);

  const lista = useMemo(() => {
    const termo = normalizar(busca.trim());
    return disponiveis.filter(
      (i) =>
        (filtro === 'todos' || i.tipo === filtro) &&
        (!termo || normalizar(i.nome).includes(termo)),
    );
  }, [disponiveis, busca, filtro]);

  const escolhidos = disponiveis.filter((i) => marcados.has(i.id));

  function alternar(id: string) {
    setMarcados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  return (
    <Modal titulo="Selecionar itens" onFechar={onFechar} largura="max-w-2xl">
      <input
        className="campo"
        placeholder="Buscar por nome"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        autoComplete="off"
      />

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            onClick={() => setFiltro(f.valor)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
              filtro === f.valor ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto">
        {carregando && <li className="p-4 text-slate-500">Carregando…</li>}
        {!carregando && lista.length === 0 && (
          <li className="p-4 text-center text-slate-500">Nenhum item disponível.</li>
        )}
        {lista.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 active:bg-slate-50">
              <input
                type="checkbox"
                className="h-6 w-6 flex-none accent-indigo-600"
                checked={marcados.has(item.id)}
                onChange={() => alternar(item.id)}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.nome}</p>
                <p className="truncate text-xs text-slate-500">
                  {TIPO_LABEL[item.tipo]}
                  {item.numero_serie ? ` · ${item.numero_serie}` : ''}
                </p>
              </div>
              <span className="flex-none font-semibold">{formatarReais(item.valor_centavos)}</span>
            </label>
          </li>
        ))}
      </ul>

      {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}

      <button
        className="btn-primario mt-4 w-full"
        disabled={escolhidos.length === 0}
        onClick={() => onConcluir(escolhidos)}
      >
        Concluir ({escolhidos.length})
      </button>
    </Modal>
  );
}

/* ---------------- Tela de venda ---------------- */

function Linha({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${destaque ? 'text-xl font-bold' : 'text-base'}`}>
      <span className={destaque ? '' : 'text-slate-600'}>{rotulo}</span>
      <span>{valor}</span>
    </div>
  );
}

export default function VenderPage() {
  const [venda, setVenda] = useState<Item[]>([]);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [descontoTxt, setDescontoTxt] = useState('');
  const [forma, setForma] = useState<FormaPagamento | null>(null);
  const [parcelas, setParcelas] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [toast, setToast] = useState<{ mensagem: string; tipo: 'ok' | 'erro' } | null>(null);

  const subtotal = venda.reduce((s, i) => s + i.valor_centavos, 0);
  const descontoDigitado = descontoTxt.trim() === '' ? 0 : reaisParaCentavos(descontoTxt);
  const descontoOk =
    descontoDigitado !== null && descontoDigitado >= 0 && descontoDigitado <= subtotal;
  const desconto = descontoOk ? (descontoDigitado as number) : 0;
  const total = subtotal - desconto;

  const valorParcela = Math.floor(total / parcelas);
  const ultimaParcela = total - valorParcela * (parcelas - 1);

  async function atualizarDisponibilidade() {
    const ids = venda.map((i) => i.id);
    if (!ids.length) return;
    const { data } = await supabase.from('itens').select('id').in('id', ids).eq('vendido', false);
    const disponiveis = new Set((data ?? []).map((r: { id: string }) => r.id));
    setVenda((v) => v.filter((i) => disponiveis.has(i.id)));
  }

  async function concluirVenda() {
    setErro('');
    if (venda.length === 0) return setErro('Adicione pelo menos um item à venda.');
    if (!forma) return setErro('Escolha a forma de pagamento.');
    if (!descontoOk) return setErro('Desconto inválido: não pode ser negativo nem deixar o total abaixo de zero.');

    setEnviando(true);
    const { error } = await supabase.rpc('registrar_venda', {
      p_itens: venda.map((i) => i.id),
      p_desconto_centavos: desconto,
      p_forma: forma,
      p_parcelas: forma === 'credito' ? parcelas : null,
    });
    setEnviando(false);

    if (error) {
      setErro(mensagemErro(error));
      await atualizarDisponibilidade();
      return;
    }

    setToast({ mensagem: `Venda registrada: ${formatarReais(total)}`, tipo: 'ok' });
    setVenda([]);
    setDescontoTxt('');
    setForma(null);
    setParcelas(1);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Vender</h1>

      <div className="flex flex-col items-center gap-2">
        <button
          onClick={() => setSeletorAberto(true)}
          aria-label="Adicionar itens à venda"
          className="flex aspect-square w-full max-w-[200px] items-center justify-center rounded-3xl bg-indigo-600 text-7xl font-light text-white shadow-lg transition active:scale-95"
        >
          +
        </button>
        <span className="text-sm text-slate-500">Toque para adicionar itens</span>
      </div>

      <section className="cartao space-y-3">
        <h2 className="font-semibold">Itens da venda</h2>
        {venda.length === 0 && <p className="text-sm text-slate-500">Nenhum item selecionado.</p>}
        <ul className="space-y-2">
          {venda.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{i.nome}</p>
                <p className="truncate text-xs text-slate-500">
                  {TIPO_LABEL[i.tipo]}
                  {i.numero_serie ? ` · ${i.numero_serie}` : ''}
                </p>
              </div>
              <div className="flex flex-none items-center gap-3">
                <span className="font-semibold">{formatarReais(i.valor_centavos)}</span>
                <button
                  onClick={() => setVenda((v) => v.filter((x) => x.id !== i.id))}
                  className="btn-perigo px-3 py-2 text-sm"
                  aria-label={`Remover ${i.nome}`}
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="cartao space-y-3">
        <Linha rotulo="Subtotal" valor={formatarReais(subtotal)} />
        <div>
          <label className="rotulo" htmlFor="desconto">Desconto (R$)</label>
          <input
            id="desconto"
            inputMode="decimal"
            className="campo"
            placeholder="0,00"
            value={descontoTxt}
            onChange={(e) => setDescontoTxt(e.target.value)}
          />
          {descontoTxt.trim() !== '' && !descontoOk && (
            <p className="mt-1 text-sm text-red-700">Valor inválido ou maior que o subtotal.</p>
          )}
        </div>
        <div className="border-t border-slate-200 pt-3">
          <Linha rotulo="Total" valor={formatarReais(total)} destaque />
        </div>
      </section>

      <section className="cartao space-y-3">
        <h2 className="font-semibold">Forma de pagamento</h2>
        <div className="grid grid-cols-3 gap-2">
          {FORMAS.map((f) => (
            <button
              key={f}
              onClick={() => setForma(f)}
              aria-pressed={forma === f}
              className={`rounded-xl py-4 text-base font-semibold ${
                forma === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {FORMA_LABEL[f]}
            </button>
          ))}
        </div>

        {forma === 'credito' && (
          <div className="space-y-2">
            <label className="rotulo" htmlFor="parcelas">Parcelas</label>
            <select
              id="parcelas"
              className="campo"
              value={parcelas}
              onChange={(e) => setParcelas(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, k) => k + 1).map((p) => (
                <option key={p} value={p}>
                  {p}x
                </option>
              ))}
            </select>
            <p className="text-sm text-slate-700">
              {parcelas}x de <strong>{formatarReais(valorParcela)}</strong>
              {parcelas > 1 && ultimaParcela !== valorParcela && (
                <span className="text-slate-500"> (última parcela: {formatarReais(ultimaParcela)})</span>
              )}
            </p>
          </div>
        )}
      </section>

      {erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      <button className="btn-primario w-full py-4 text-lg" onClick={concluirVenda} disabled={enviando}>
        {enviando ? 'Registrando…' : 'Concluir venda'}
      </button>

      {seletorAberto && (
        <SeletorItens
          jaSelecionados={venda}
          onFechar={() => setSeletorAberto(false)}
          onConcluir={(itens) => {
            setVenda(itens);
            setSeletorAberto(false);
          }}
        />
      )}

      {toast && <Toast mensagem={toast.mensagem} tipo={toast.tipo} onFechar={() => setToast(null)} />}
    </div>
  );
}
