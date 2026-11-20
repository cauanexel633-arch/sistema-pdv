import JSZip from 'jszip';
import { BUCKET_FOTOS, supabase } from './supabase';
import type { Item, Perfil, Venda } from './types';
import { fimDoDia, inicioDoDia } from './format';

/*
 * Formato do arquivo exportado (.zip):
 *   dados.json            → cadastros, vendas, operadores e metadados
 *   fotos/{item_id}/{n}.jpg
 * Dentro do dados.json, o campo `fotos` de cada item guarda o caminho relativo dentro do zip.
 */

export interface FiltrosExport {
  de: string;          // yyyy-mm-dd ou ''
  ate: string;         // yyyy-mm-dd ou ''
  operadorId: string;  // uuid ou ''
}

export interface DadosExport {
  formato: 'pdv-export';
  versao: 1;
  exportado_em: string;
  central_id: string;
  filtros: { de: string | null; ate: string | null; operador_id: string | null };
  operadores: Perfil[];
  itens: Item[];
  vendas: Venda[];
}

export interface AnaliseImportacao {
  zip: JSZip;
  itensNovos: Item[];
  itensExistentes: number;
  vendasNovas: Venda[];
  vendasExistentes: number;
  fotosNovas: number;
  fotosIgnoradas: number;
  operadores: number;
}

export function baixarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/* ---------------------------- EXPORTAR ---------------------------- */

export async function gerarExportacao(
  f: FiltrosExport,
  centralId: string,
  onProgresso: (msg: string) => void,
): Promise<{ blob: Blob; resumo: { itens: number; vendas: number; fotos: number; operadores: number } }> {
  onProgresso('Lendo vendas…');
  let vq = supabase.from('vendas').select('*').order('criado_em');
  if (f.de) vq = vq.gte('criado_em', inicioDoDia(f.de));
  if (f.ate) vq = vq.lte('criado_em', fimDoDia(f.ate));
  if (f.operadorId) vq = vq.eq('operador_id', f.operadorId);
  const { data: vendasData, error: erroVendas } = await vq;
  if (erroVendas) throw erroVendas;
  const vendas = (vendasData ?? []) as Venda[];
  const idsVendas = new Set(vendas.map((v) => v.id));

  onProgresso('Lendo cadastros…');
  const { data: itensData, error: erroItens } = await supabase.from('itens').select('*');
  if (erroItens) throw erroItens;
  const inicio = f.de ? new Date(inicioDoDia(f.de)).getTime() : -Infinity;
  const fim = f.ate ? new Date(fimDoDia(f.ate)).getTime() : Infinity;

  // Vendidos: entram se a venda foi exportada. Não vendidos: entram se cadastrados no período
  // (e, com filtro de operador, criados por ele).
  const itens = ((itensData ?? []) as Item[]).filter((i) => {
    if (i.vendido) return !!i.venda_id && idsVendas.has(i.venda_id);
    const t = new Date(i.criado_em).getTime();
    return t >= inicio && t <= fim && (!f.operadorId || i.criado_por === f.operadorId);
  });

  const zip = new JSZip();
  let totalFotos = 0;
  const itensExportados: Item[] = [];

  for (const [k, item] of itens.entries()) {
    onProgresso(`Baixando fotos ${k + 1} de ${itens.length}…`);
    const caminhosNoZip = item.fotos.map((_, idx) => `fotos/${item.id}/${idx}.jpg`);
    await Promise.all(
      item.fotos.map(async (caminho, idx) => {
        const { data, error } = await supabase.storage.from(BUCKET_FOTOS).download(caminho);
        if (error || !data) throw new Error(`Não foi possível baixar a foto de "${item.nome}".`);
        zip.file(caminhosNoZip[idx], data);
      }),
    );
    totalFotos += item.fotos.length;
    itensExportados.push({ ...item, fotos: caminhosNoZip });
  }

  onProgresso('Gerando arquivo…');
  const { data: perfisData, error: erroPerfis } = await supabase
    .from('perfis')
    .select('id, papel, nome, central_id, criado_em');
  if (erroPerfis) throw erroPerfis;
  const operadores = (perfisData ?? []) as Perfil[];

  const dados: DadosExport = {
    formato: 'pdv-export',
    versao: 1,
    exportado_em: new Date().toISOString(),
    central_id: centralId,
    filtros: { de: f.de || null, ate: f.ate || null, operador_id: f.operadorId || null },
    operadores,
    itens: itensExportados,
    vendas,
  };
  zip.file('dados.json', JSON.stringify(dados, null, 2));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

  return {
    blob,
    resumo: { itens: itensExportados.length, vendas: vendas.length, fotos: totalFotos, operadores: operadores.length },
  };
}

/* ---------------------------- IMPORTAR ---------------------------- */

/** Consulta quais IDs já existem na base (em lotes, para não estourar a URL). */
async function idsExistentes(tabela: 'itens' | 'vendas', ids: string[]): Promise<Set<string>> {
  const achados = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    const { data, error } = await supabase.from(tabela).select('id').in('id', lote);
    if (error) throw error;
    for (const r of (data ?? []) as { id: string }[]) achados.add(r.id);
  }
  return achados;
}

export async function analisarImportacao(arquivo: File): Promise<AnaliseImportacao> {
  const zip = await JSZip.loadAsync(arquivo);
  const arqDados = zip.file('dados.json');
  if (!arqDados) throw new Error('O arquivo não contém dados.json. Use um .zip exportado por este sistema.');

  let dados: DadosExport;
  try {
    dados = JSON.parse(await arqDados.async('string')) as DadosExport;
  } catch {
    throw new Error('Não foi possível ler o dados.json do arquivo.');
  }
  if (dados.formato !== 'pdv-export' || dados.versao !== 1) {
    throw new Error('Formato de exportação não reconhecido.');
  }

  const existentesItens = await idsExistentes('itens', dados.itens.map((i) => i.id));
  const existentesVendas = await idsExistentes('vendas', dados.vendas.map((v) => v.id));

  const itensNovos = dados.itens.filter((i) => !existentesItens.has(i.id));
  const vendasNovas = dados.vendas.filter((v) => !existentesVendas.has(v.id));

  // Confere se todas as fotos dos cadastros novos estão no arquivo.
  for (const item of itensNovos) {
    for (const caminho of item.fotos) {
      if (!zip.file(caminho)) throw new Error(`Foto ausente no arquivo: ${caminho}`);
    }
  }

  const contarFotos = (lista: Item[]) => lista.reduce((s, i) => s + i.fotos.length, 0);
  return {
    zip,
    itensNovos,
    itensExistentes: dados.itens.length - itensNovos.length,
    vendasNovas,
    vendasExistentes: dados.vendas.length - vendasNovas.length,
    fotosNovas: contarFotos(itensNovos),
    fotosIgnoradas: contarFotos(dados.itens) - contarFotos(itensNovos),
    operadores: dados.operadores?.length ?? 0,
  };
}

export async function executarImportacao(
  a: AnaliseImportacao,
  centralId: string,
  onProgresso: (msg: string) => void,
): Promise<{ itens_importados: number; vendas_importadas: number }> {
  const enviadas: string[] = [];
  try {
    const itensPayload: Item[] = [];
    for (const [k, item] of a.itensNovos.entries()) {
      onProgresso(`Enviando fotos de ${k + 1} de ${a.itensNovos.length} cadastro(s)…`);
      const caminhos: string[] = [];
      for (let idx = 0; idx < item.fotos.length; idx++) {
        const arq = a.zip.file(item.fotos[idx]);
        if (!arq) throw new Error(`Foto ausente no arquivo: ${item.fotos[idx]}`);
        const blob = await arq.async('blob');
        const caminho = `${centralId}/${item.id}/${idx}.jpg`;
        const { error } = await supabase.storage
          .from(BUCKET_FOTOS)
          .upload(caminho, blob, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
        caminhos.push(caminho);
        enviadas.push(caminho);
      }
      itensPayload.push({ ...item, fotos: caminhos });
    }

    onProgresso('Gravando cadastros e vendas…');
    const { data, error } = await supabase.rpc('importar_dados', {
      p: { itens: itensPayload, vendas: a.vendasNovas },
    });
    if (error) throw error;
    return data as { itens_importados: number; vendas_importadas: number };
  } catch (err) {
    // Se algo falhou, remove as fotos enviadas nesta tentativa.
    if (enviadas.length) await supabase.storage.from(BUCKET_FOTOS).remove(enviadas);
    throw err;
  }
}
