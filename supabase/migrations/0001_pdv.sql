-- =========================================================
-- PDV — migração inicial (tabelas, RLS, storage, funções)
-- Executar no SQL Editor do Supabase ou via `supabase db push`.
-- =========================================================

-- ---------- Tipos e tabelas ----------

create type tipo_item as enum ('kit', 'residencial', 'viagem');

-- Central: conta principal. O código é gerado automaticamente.
create table if not exists centrais (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  criado_em timestamptz not null default now()
);

-- Perfil de cada usuário (central ou operador), ligado ao auth.users.
create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  papel text not null check (papel in ('central', 'operador')),
  nome text not null,
  central_id uuid not null references centrais(id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index if not exists perfis_central_idx on perfis (central_id);

-- Vendas. operador_id não tem FK de propósito: permite importar vendas de outra central.
create table if not exists vendas (
  id uuid primary key default gen_random_uuid(),
  central_id uuid not null references centrais(id) on delete cascade,
  operador_id uuid,
  operador_nome text not null,
  criado_em timestamptz not null default now(),
  subtotal_centavos bigint not null check (subtotal_centavos >= 0),
  desconto_centavos bigint not null default 0 check (desconto_centavos >= 0),
  total_centavos bigint not null check (total_centavos >= 0),
  forma_pagamento text not null check (forma_pagamento in ('debito', 'credito', 'pix')),
  parcelas int,
  itens jsonb not null,  -- snapshot: id, nome, tipo, valor_centavos, numero_serie
  constraint parcelas_validas check (
    (forma_pagamento = 'credito' and parcelas between 1 and 12)
    or (forma_pagamento <> 'credito' and parcelas is null)
  ),
  constraint total_coerente check (total_centavos = subtotal_centavos - desconto_centavos)
);
create index if not exists vendas_central_idx on vendas (central_id, criado_em desc);

-- Itens cadastrados (kits, acessórios residenciais e de viagem).
create table if not exists itens (
  id uuid primary key default gen_random_uuid(),
  central_id uuid not null references centrais(id) on delete cascade,
  tipo tipo_item not null,
  nome text not null check (length(trim(nome)) > 0),
  valor_centavos bigint not null check (valor_centavos >= 0),
  numero_serie text,
  fotos text[] not null default '{}',           -- caminhos no bucket "fotos"
  vendido boolean not null default false,       -- item vendido é marcado, nunca apagado
  venda_id uuid references vendas(id) on delete set null,
  criado_por uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  constraint kit_com_serie check (tipo <> 'kit' or length(trim(coalesce(numero_serie, ''))) > 0),
  constraint residencial_3_fotos check (tipo <> 'residencial' or coalesce(array_length(fotos, 1), 0) = 3),
  constraint viagem_1_foto check (tipo <> 'viagem' or coalesce(array_length(fotos, 1), 0) = 1)
);
create index if not exists itens_central_idx on itens (central_id, vendido, tipo);

-- ---------- Funções auxiliares (SECURITY DEFINER evita recursão nas policies) ----------

create or replace function minha_central() returns uuid
language sql stable security definer set search_path = public as $$
  select central_id from perfis where id = auth.uid();
$$;

create or replace function sou_central() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'central');
$$;

create or replace function gerar_codigo_central() returns text
language plpgsql as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- sem caracteres ambíguos (0/O, 1/I)
  c text;
  tentativas int := 0;
begin
  loop
    c := '';
    for i in 1..8 loop
      c := c || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from centrais where codigo = c);
    tentativas := tentativas + 1;
    if tentativas > 20 then raise exception 'Não foi possível gerar um código de central.'; end if;
  end loop;
  return c;
end $$;

-- ---------- Criação automática do perfil no cadastro ----------
-- Chamada pelo trigger em auth.users. Metadados enviados no signUp:
--   papel ('central' | 'operador'), nome, codigo_central (somente operador)

create or replace function criar_perfil_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_papel text := coalesce(new.raw_user_meta_data->>'papel', 'operador');
  v_nome text := coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1));
  v_codigo text := upper(trim(coalesce(new.raw_user_meta_data->>'codigo_central', '')));
  v_central uuid;
begin
  if v_papel = 'central' then
    insert into centrais (codigo, nome)
      values (gerar_codigo_central(), 'Central de ' || v_nome)
      returning id into v_central;
  elsif v_papel = 'operador' then
    select id into v_central from centrais where codigo = v_codigo;
    if v_central is null then
      raise exception 'Código da central não encontrado. Confira o código com a central.';
    end if;
  else
    raise exception 'Tipo de conta inválido.';
  end if;

  insert into perfis (id, papel, nome, central_id) values (new.id, v_papel, v_nome, v_central);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function criar_perfil_novo_usuario();

-- ---------- RPC: registrar venda (transação única) ----------

create or replace function registrar_venda(
  p_itens uuid[],
  p_desconto_centavos bigint,
  p_forma text,
  p_parcelas int
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_perfil perfis%rowtype;
  v_ids uuid[];
  v_indisponiveis uuid[];
  v_subtotal bigint;
  v_desconto bigint := coalesce(p_desconto_centavos, 0);
  v_snapshot jsonb;
  v_venda uuid;
  v_nomes text;
begin
  select * into v_perfil from perfis where id = auth.uid();
  if not found then raise exception 'Sessão inválida. Faça login novamente.'; end if;

  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(p_itens) as x;
  if cardinality(v_ids) = 0 then raise exception 'Adicione pelo menos um item à venda.'; end if;

  if p_forma not in ('debito', 'credito', 'pix') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if p_forma = 'credito' and (p_parcelas is null or p_parcelas not between 1 and 12) then
    raise exception 'Informe de 1 a 12 parcelas.';
  end if;
  if p_forma <> 'credito' then p_parcelas := null; end if;

  -- Trava as linhas até o fim da transação: impede que dois operadores vendam o mesmo item.
  perform 1 from itens where id = any(v_ids) order by id for update;

  select coalesce(array_agg(x), '{}') into v_indisponiveis
  from unnest(v_ids) as x
  where not exists (
    select 1 from itens i
    where i.id = x and i.central_id = v_perfil.central_id and i.vendido = false
  );

  if cardinality(v_indisponiveis) > 0 then
    select string_agg(nome, ', ') into v_nomes from itens where id = any(v_indisponiveis);
    raise exception 'Itens já não estão disponíveis: %', coalesce(v_nomes, 'um ou mais itens selecionados');
  end if;

  select coalesce(sum(valor_centavos), 0),
         jsonb_agg(jsonb_build_object(
           'id', id, 'nome', nome, 'tipo', tipo,
           'valor_centavos', valor_centavos, 'numero_serie', numero_serie
         ) order by nome)
    into v_subtotal, v_snapshot
  from itens where id = any(v_ids);

  if v_desconto < 0 or v_desconto > v_subtotal then
    raise exception 'O desconto não pode ser negativo nem deixar o total abaixo de zero.';
  end if;

  insert into vendas (
    central_id, operador_id, operador_nome, subtotal_centavos,
    desconto_centavos, total_centavos, forma_pagamento, parcelas, itens
  ) values (
    v_perfil.central_id, v_perfil.id, v_perfil.nome, v_subtotal,
    v_desconto, v_subtotal - v_desconto, p_forma, p_parcelas, v_snapshot
  ) returning id into v_venda;

  update itens set vendido = true, venda_id = v_venda where id = any(v_ids);

  return v_venda;
end $$;

-- ---------- RPC: importar dados (somente central; ignora IDs já existentes) ----------

create or replace function importar_dados(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_central uuid := minha_central();
  v_vendas int := 0;
  v_itens int := 0;
begin
  if not sou_central() then
    raise exception 'Apenas a central pode importar dados.';
  end if;

  -- Vendas primeiro, pois itens vendidos referenciam venda_id.
  with ins as (
    insert into vendas (
      id, central_id, operador_id, operador_nome, criado_em,
      subtotal_centavos, desconto_centavos, total_centavos,
      forma_pagamento, parcelas, itens
    )
    select
      (x->>'id')::uuid, v_central, nullif(x->>'operador_id', '')::uuid, x->>'operador_nome',
      (x->>'criado_em')::timestamptz,
      (x->>'subtotal_centavos')::bigint, (x->>'desconto_centavos')::bigint, (x->>'total_centavos')::bigint,
      x->>'forma_pagamento', nullif(x->>'parcelas', '')::int, x->'itens'
    from jsonb_array_elements(coalesce(p->'vendas', '[]'::jsonb)) x
    on conflict (id) do nothing
    returning 1
  ) select count(*) into v_vendas from ins;

  with ins as (
    insert into itens (
      id, central_id, tipo, nome, valor_centavos, numero_serie, fotos,
      vendido, venda_id, criado_por, criado_em
    )
    select
      (x->>'id')::uuid, v_central, (x->>'tipo')::tipo_item, x->>'nome', (x->>'valor_centavos')::bigint,
      nullif(x->>'numero_serie', ''),
      coalesce(array(select jsonb_array_elements_text(x->'fotos')), '{}'::text[]),
      (x->>'vendido')::boolean, nullif(x->>'venda_id', '')::uuid,
      null,  -- criado_por do arquivo pode não existir neste projeto
      (x->>'criado_em')::timestamptz
    from jsonb_array_elements(coalesce(p->'itens', '[]'::jsonb)) x
    on conflict (id) do nothing
    returning 1
  ) select count(*) into v_itens from ins;

  return jsonb_build_object('itens_importados', v_itens, 'vendas_importadas', v_vendas);
end $$;

-- ---------- Permissões de execução das funções ----------

revoke execute on function gerar_codigo_central() from public, anon, authenticated;
revoke execute on function criar_perfil_novo_usuario() from public, anon, authenticated;
revoke execute on function registrar_venda(uuid[], bigint, text, int) from public, anon;
revoke execute on function importar_dados(jsonb) from public, anon;
grant execute on function registrar_venda(uuid[], bigint, text, int) to authenticated;
grant execute on function importar_dados(jsonb) to authenticated;
grant execute on function minha_central() to authenticated;
grant execute on function sou_central() to authenticated;

-- ---------- Row Level Security ----------

alter table centrais enable row level security;
alter table perfis enable row level security;
alter table itens enable row level security;
alter table vendas enable row level security;

-- Centrais: cada usuário vê apenas a própria central.
create policy "centrais: ver a própria" on centrais
  for select to authenticated using (id = minha_central());

-- Perfis: vê todos os usuários da mesma central (operadores e central).
-- Não há policies de INSERT/UPDATE/DELETE: perfis só são criados pelo trigger de cadastro.
create policy "perfis: ver da mesma central" on perfis
  for select to authenticated using (central_id = minha_central());

-- Itens: central e operadores veem e gerenciam os itens da própria central.
-- Itens vendidos não podem ser alterados nem excluídos diretamente.
create policy "itens: ver da própria central" on itens
  for select to authenticated using (central_id = minha_central());

create policy "itens: cadastrar na própria central" on itens
  for insert to authenticated
  with check (central_id = minha_central() and vendido = false);

create policy "itens: editar não vendidos" on itens
  for update to authenticated
  using (central_id = minha_central() and vendido = false)
  with check (central_id = minha_central() and vendido = false);

create policy "itens: excluir não vendidos" on itens
  for delete to authenticated
  using (central_id = minha_central() and vendido = false);

-- Vendas: somente leitura direta. Gravação só pela função registrar_venda / importar_dados.
create policy "vendas: ver da própria central" on vendas
  for select to authenticated using (central_id = minha_central());

-- ---------- Storage: bucket privado de fotos ----------
-- Caminho dos arquivos: {central_id}/{item_id}/{n}.jpg

insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

create policy "fotos: ler da própria central" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = minha_central()::text);

create policy "fotos: enviar para a própria central" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = minha_central()::text);

create policy "fotos: atualizar da própria central" on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = minha_central()::text)
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = minha_central()::text);

create policy "fotos: excluir da própria central" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = minha_central()::text);
