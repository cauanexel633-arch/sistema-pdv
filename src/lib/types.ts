export type Papel = 'central' | 'operador';
export type TipoItem = 'kit' | 'residencial' | 'viagem';
export type FormaPagamento = 'debito' | 'credito' | 'pix';

export interface Perfil {
  id: string;
  papel: Papel;
  nome: string;
  central_id: string;
  criado_em?: string;
}

export interface Item {
  id: string;
  central_id: string;
  tipo: TipoItem;
  nome: string;
  valor_centavos: number;
  numero_serie: string | null;
  fotos: string[];
  vendido: boolean;
  venda_id: string | null;
  criado_por: string | null;
  criado_em: string;
}

export interface ItemVenda {
  id: string;
  nome: string;
  tipo: TipoItem;
  valor_centavos: number;
  numero_serie: string | null;
}

export interface Venda {
  id: string;
  central_id: string;
  operador_id: string | null;
  operador_nome: string;
  criado_em: string;
  subtotal_centavos: number;
  desconto_centavos: number;
  total_centavos: number;
  forma_pagamento: FormaPagamento;
  parcelas: number | null;
  itens: ItemVenda[];
}

export const TIPO_LABEL: Record<TipoItem, string> = {
  kit: 'Kit',
  residencial: 'Acessório Residencial',
  viagem: 'Acessório de Viagem',
};

export const FORMA_LABEL: Record<FormaPagamento, string> = {
  debito: 'Débito',
  credito: 'Crédito',
  pix: 'Pix',
};
