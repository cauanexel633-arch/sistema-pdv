import { lazy, Suspense, useState, type FormEvent, type KeyboardEvent } from 'react';
import { BUCKET_FOTOS, supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { TIPO_LABEL, type Item, type TipoItem } from '../lib/types';
import { centavosParaCampo, mensagemErro, reaisParaCentavos } from '../lib/format';
import { comprimirImagem } from '../lib/imagem';
import Modal from './Modal';
import FotoInput from './FotoInput';
// Carregada sob demanda: a biblioteca da câmera só é baixada ao tocar em "Ler código".
const LeitorCodigo = lazy(() => import('./LeitorCodigo'));

const QTD_FOTOS: Record<TipoItem, number> = { kit: 0, residencial: 3, viagem: 1 };

const ROTULO_FOTOS: Record<TipoItem, string[]> = {
  kit: [],
  residencial: [
    'Foto 1 — embalagem do carregador',
    'Foto 2 — manual',
    'Foto 3 — embalagem do carregador ou manual',
  ],
  viagem: ['Caixa ou carregador'],
};

interface Props {
  tipo: TipoItem;
  item?: Item | null;
  onSalvo: () => void;
  onFechar: () => void;
}

export default function ItemForm({ tipo, item, onSalvo, onFechar }: Props) {
  const { perfil } = useAuth();
  const editando = Boolean(item);

  const [nome, setNome] = useState(item?.nome ?? '');
  const [serie, setSerie] = useState(item?.numero_serie ?? '');
  const [valor, setValor] = useState(item ? centavosParaCampo(item.valor_centavos) : '');
  const [fotos, setFotos] = useState<(File | null)[]>(() => Array(QTD_FOTOS[tipo]).fill(null));
  const [lendoCodigo, setLendoCodigo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  function atualizarFoto(indice: number, arquivo: File | null) {
    setFotos((prev) => prev.map((f, i) => (i === indice ? arquivo : f)));
  }

  // Leitor USB digita o código e envia Enter: vai para o campo de valor em vez de enviar o formulário.
  function enterNoSerial(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('campo-valor')?.focus();
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro('');

    if (!nome.trim()) {
      setErro('Informe o nome.');
      return;
    }
    if (tipo === 'kit' && !serie.trim()) {
      setErro('Informe o número de série.');
      return;
    }
    const valorCentavos = reaisParaCentavos(valor);
    if (valorCentavos === null) {
      setErro('Informe um valor válido em R$ (ex.: 1.250,00).');
      return;
    }
    if (!editando && fotos.some((f) => f === null)) {
      setErro(`Adicione ${QTD_FOTOS[tipo]} foto(s) obrigatória(s).`);
      return;
    }
    if (!perfil) return;

    setSalvando(true);
    const enviadas: string[] = [];
    try {
      if (item) {
        const { error } = await supabase
          .from('itens')
          .update({
            nome: nome.trim(),
            numero_serie: tipo === 'kit' ? serie.trim() : null,
            valor_centavos: valorCentavos,
          })
          .eq('id', item.id);
        if (error) throw error;
      } else {
        const id = crypto.randomUUID();
        for (let i = 0; i < fotos.length; i++) {
          const blob = await comprimirImagem(fotos[i]!);
          const caminho = `${perfil.central_id}/${id}/${i}.jpg`;
          const { error } = await supabase.storage
            .from(BUCKET_FOTOS)
            .upload(caminho, blob, { contentType: 'image/jpeg' });
          if (error) throw error;
          enviadas.push(caminho);
        }
        const { error } = await supabase.from('itens').insert({
          id,
          central_id: perfil.central_id,
          tipo,
          nome: nome.trim(),
          numero_serie: tipo === 'kit' ? serie.trim() : null,
          valor_centavos: valorCentavos,
          fotos: enviadas,
        });
        if (error) throw error;
      }
      onSalvo();
    } catch (err) {
      if (enviadas.length) await supabase.storage.from(BUCKET_FOTOS).remove(enviadas);
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={`${editando ? 'Editar' : 'Novo'} · ${TIPO_LABEL[tipo]}`} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        {QTD_FOTOS[tipo] > 0 &&
          (editando ? (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
              As fotos não podem ser trocadas depois do cadastro. Para trocá-las, exclua o item e cadastre de novo.
            </p>
          ) : (
            fotos.map((f, i) => (
              <FotoInput
                key={i}
                rotulo={ROTULO_FOTOS[tipo][i]}
                arquivo={f}
                onChange={(arq) => atualizarFoto(i, arq)}
              />
            ))
          ))}

        <div>
          <label className="rotulo" htmlFor="campo-nome">Nome</label>
          <input
            id="campo-nome"
            className="campo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="off"
          />
        </div>

        {tipo === 'kit' && (
          <div>
            <label className="rotulo" htmlFor="campo-serie">Número de série</label>
            <div className="flex gap-2">
              <input
                id="campo-serie"
                className="campo min-w-0 flex-1"
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                onKeyDown={enterNoSerial}
                placeholder="Digite ou use o leitor USB"
                autoComplete="off"
              />
              <button type="button" className="btn-secundario flex-none" onClick={() => setLendoCodigo(true)}>
                📷 Ler código
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="rotulo" htmlFor="campo-valor">Valor (R$)</label>
          <input
            id="campo-valor"
            inputMode="decimal"
            className="campo"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
          />
        </div>

        {erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" className="btn-secundario flex-1" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="btn-primario flex-1" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>

      {lendoCodigo && (
        <Suspense fallback={null}>
          <LeitorCodigo
            onLido={(codigo) => {
              setSerie(codigo);
              setLendoCodigo(false);
            }}
            onFechar={() => setLendoCodigo(false)}
          />
        </Suspense>
      )}
    </Modal>
  );
}
