import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import type { Perfil } from '../lib/types';
import { mensagemErro } from '../lib/format';
import {
  analisarImportacao,
  baixarArquivo,
  executarImportacao,
  gerarExportacao,
  type AnaliseImportacao,
} from '../lib/transferencia';
import Toast from '../components/Toast';

export default function DadosPage() {
  const { perfil } = useAuth();
  const [operadores, setOperadores] = useState<Perfil[]>([]);
  const [toast, setToast] = useState<{ mensagem: string; tipo: 'ok' | 'erro' } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [status, setStatus] = useState('');

  // Exportação
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [operadorId, setOperadorId] = useState('');
  const [resultadoExport, setResultadoExport] = useState('');

  // Importação
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analise, setAnalise] = useState<AnaliseImportacao | null>(null);
  const [resultadoImport, setResultadoImport] = useState('');

  useEffect(() => {
    supabase
      .from('perfis')
      .select('id, nome, papel, central_id')
      .order('nome')
      .then(({ data }) => setOperadores((data ?? []) as Perfil[]));
  }, []);

  async function exportar() {
    if (!perfil) return;
    if (de && ate && de > ate) {
      setToast({ mensagem: 'A data inicial é posterior à data final.', tipo: 'erro' });
      return;
    }
    setOcupado(true);
    setResultadoExport('');
    try {
      const { blob, resumo } = await gerarExportacao(
        { de, ate, operadorId },
        perfil.central_id,
        setStatus,
      );
      baixarArquivo(blob, `pdv-exportacao-${new Date().toISOString().slice(0, 10)}.zip`);
      setResultadoExport(
        `Exportado: ${resumo.itens} cadastro(s), ${resumo.vendas} venda(s), ${resumo.fotos} foto(s) e ${resumo.operadores} pessoa(s).`,
      );
    } catch (err) {
      setToast({ mensagem: mensagemErro(err), tipo: 'erro' });
    } finally {
      setOcupado(false);
      setStatus('');
    }
  }

  async function analisar() {
    if (!arquivo) return;
    setOcupado(true);
    setAnalise(null);
    setResultadoImport('');
    setStatus('Lendo arquivo…');
    try {
      setAnalise(await analisarImportacao(arquivo));
    } catch (err) {
      setToast({ mensagem: mensagemErro(err), tipo: 'erro' });
    } finally {
      setOcupado(false);
      setStatus('');
    }
  }

  async function confirmarImportacao() {
    if (!analise || !perfil) return;
    setOcupado(true);
    try {
      const r = await executarImportacao(analise, perfil.central_id, setStatus);
      setResultadoImport(
        `Importação concluída: ${r.itens_importados} cadastro(s), ${r.vendas_importadas} venda(s) e ${analise.fotosNovas} foto(s) incorporadas.`,
      );
      setAnalise(null);
      setArquivo(null);
    } catch (err) {
      setToast({ mensagem: mensagemErro(err), tipo: 'erro' });
    } finally {
      setOcupado(false);
      setStatus('');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dados</h1>

      {/* ---------- Exportar ---------- */}
      <section className="cartao space-y-4">
        <div>
          <h2 className="font-semibold">Exportar</h2>
          <p className="text-sm text-slate-500">
            Gera um .zip com <code>dados.json</code> (cadastros, vendas, operadores) e a pasta <code>fotos/</code>.
            Os filtros valem para as vendas; cadastros não vendidos seguem o mesmo período.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="rotulo" htmlFor="exp-de">De</label>
            <input id="exp-de" type="date" className="campo" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div>
            <label className="rotulo" htmlFor="exp-ate">Até</label>
            <input id="exp-ate" type="date" className="campo" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          <div>
            <label className="rotulo" htmlFor="exp-op">Operador</label>
            <select id="exp-op" className="campo" value={operadorId} onChange={(e) => setOperadorId(e.target.value)}>
              <option value="">Todos</option>
              {operadores.map((o) => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <button className="btn-primario w-full" onClick={exportar} disabled={ocupado}>
          {ocupado ? status || 'Exportando…' : 'Exportar'}
        </button>
        {resultadoExport && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{resultadoExport}</p>}
      </section>

      {/* ---------- Importar ---------- */}
      <section className="cartao space-y-4">
        <div>
          <h2 className="font-semibold">Importar</h2>
          <p className="text-sm text-slate-500">
            Carrega um .zip exportado por outro PDV. Registros com o mesmo ID já existentes são ignorados.
          </p>
        </div>

        <input
          type="file"
          accept=".zip,application/zip"
          className="block w-full text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-slate-200 file:px-4 file:py-3 file:font-semibold"
          onChange={(e) => {
            setArquivo(e.target.files?.[0] ?? null);
            setAnalise(null);
            setResultadoImport('');
          }}
        />

        {arquivo && !analise && (
          <button className="btn-secundario w-full" onClick={analisar} disabled={ocupado}>
            {ocupado ? status || 'Analisando…' : 'Analisar arquivo'}
          </button>
        )}

        {analise && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-4 text-sm">
            <p className="font-semibold">Resumo antes de importar</p>
            <ul className="space-y-1">
              <li>Cadastros a importar: <strong>{analise.itensNovos.length}</strong></li>
              <li>Cadastros já existentes (ignorados): <strong>{analise.itensExistentes}</strong></li>
              <li>Vendas a importar: <strong>{analise.vendasNovas.length}</strong></li>
              <li>Vendas já existentes (ignoradas): <strong>{analise.vendasExistentes}</strong></li>
              <li>Fotos a importar: <strong>{analise.fotosNovas}</strong></li>
              <li>Fotos já existentes (ignoradas): <strong>{analise.fotosIgnoradas}</strong></li>
            </ul>
            <p className="text-slate-500">
              Operadores no arquivo: {analise.operadores}. Eles não são criados automaticamente; as vendas
              mantêm o nome de quem vendeu. Cada operador deve criar a própria conta com o código desta central.
            </p>
            <div className="flex gap-3 pt-1">
              <button className="btn-secundario flex-1" onClick={() => setAnalise(null)} disabled={ocupado}>
                Cancelar
              </button>
              <button className="btn-primario flex-1" onClick={confirmarImportacao} disabled={ocupado}>
                {ocupado ? status || 'Importando…' : 'Confirmar importação'}
              </button>
            </div>
          </div>
        )}

        {resultadoImport && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{resultadoImport}</p>}
      </section>

      {toast && <Toast mensagem={toast.mensagem} tipo={toast.tipo} onFechar={() => setToast(null)} />}
    </div>
  );
}
