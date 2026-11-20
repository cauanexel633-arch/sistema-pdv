const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 12345 (centavos) → "R$ 123,45" */
export const formatarReais = (centavos: number) => moeda.format(centavos / 100);

/** 12345 (centavos) → "123,45" para preencher campos */
export function centavosParaCampo(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

/**
 * Converte texto digitado em centavos. Aceita "1.250,00", "1250,5", "1250.50", "R$ 10".
 * Retorna null se o texto não for um valor válido.
 */
export function reaisParaCentavos(texto: string): number | null {
  let t = texto.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (t === '') return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Remove acentos e deixa minúsculo, para busca. */
export const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const inicioDoDia = (dia: string) => new Date(`${dia}T00:00:00`).toISOString();
export const fimDoDia = (dia: string) => new Date(`${dia}T23:59:59.999`).toISOString();

/** Traduz erros do Supabase/Postgres para mensagens em português. */
export function mensagemErro(err: unknown): string {
  const m = (err as { message?: string } | null)?.message ?? '';
  if (/row-level security/i.test(m)) return 'Você não tem permissão para esta ação.';
  if (/duplicate key|unique/i.test(m)) return 'Já existe um registro com esses dados.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet.';
  return m || 'Erro inesperado. Tente novamente.';
}
